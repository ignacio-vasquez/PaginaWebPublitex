import { HANDOFF_KEY } from './simulador.js';

function successful(response) {
  return response && (response.ok === undefined ? response.status < 400 : response.ok);
}

async function bodyOf(response) {
  try { return await response.json(); } catch { return {}; }
}

export function initQuotePage(
  documentRoot = document,
  api = globalThis.fetch,
  storage = globalThis.sessionStorage,
  navigate = (url) => { globalThis.location.href = url; },
) {
  const page = documentRoot.querySelector('[data-quote-page]');
  if (!page || typeof api !== 'function') return { ready: Promise.resolve() };
  const list = page.querySelector('[data-quote-list]');
  const editor = page.querySelector('[data-quote-editor]');
  const phone = page.querySelector('[data-quote-phone]');
  const company = page.querySelector('[data-quote-company]');
  const items = page.querySelector('[data-quote-items]');
  const total = page.querySelector('[data-quote-total]');
  const saveStatus = page.querySelector('[data-save-status]');
  const retry = page.querySelector('[data-save-retry]');
  const pageStatus = page.querySelector('[data-quote-page-status]');
  const submitButton = page.querySelector('[data-submit-quote]');
  const dialog = page.querySelector('[data-submit-dialog]');
  const confirmSubmit = page.querySelector('[data-confirm-submit]');
  const cancelSubmit = page.querySelector('[data-cancel-submit]');
  let quotes = [];
  let current = null;
  let saveQueue = Promise.resolve();
  let editVersion = 0;
  let lastSave = null;
  let dialogTrigger = null;

  async function request(url, options = {}) {
    const response = await api(url, { credentials: 'same-origin', ...options });
    const responseBody = await bodyOf(response);
    if (!successful(response)) {
      const error = new Error(responseBody.error || 'No pudimos completar la acción.');
      error.status = response?.status;
      throw error;
    }
    return responseBody;
  }

  function money(value) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
  }

  function replaceCurrent(next) {
    current = next;
    quotes = quotes.map((quote) => quote.id === next.id ? next : quote);
    if (!quotes.some((quote) => quote.id === next.id)) quotes.unshift(next);
    renderList();
    renderEditor();
  }

  function button(label, attribute, callback) {
    const element = documentRoot.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.setAttribute(attribute, '');
    element.addEventListener('click', callback);
    return element;
  }

  function renderList() {
    list.replaceChildren();
    for (const quote of quotes) {
      const item = documentRoot.createElement('li');
      const select = button(
        `${quote.status === 'draft' ? 'Borrador' : 'Enviada'} · ${quote.items.length} producto${quote.items.length === 1 ? '' : 's'}`,
        'data-select-quote',
        () => { current = quote; renderEditor(); },
      );
      if (current?.id === quote.id) select.setAttribute('aria-current', 'true');
      item.append(select);
      list.append(item);
    }
  }

  async function deleteItem(itemId, control) {
    control.disabled = true;
    try {
      replaceCurrent(await request(`/api/quotes/${current.id}/items/${itemId}`, { method: 'DELETE' }));
    } catch (error) {
      pageStatus.textContent = error.message;
      control.disabled = false;
    }
  }

  function beginItemEdit(article, item) {
    const input = documentRoot.createElement('input');
    input.value = item.observation || '';
    input.setAttribute('aria-label', `Observación para ${item.productLabel}`);
    const save = button('Guardar cambios', 'data-save-item', async () => {
      save.disabled = true;
      try {
        replaceCurrent(await request(`/api/quotes/${current.id}/items/${item.id}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId: item.productId, materialId: item.materialId, sizeId: item.sizeId,
            quantityId: item.quantityId, extraIds: item.extras.map((extra) => extra.id),
            observation: input.value.trim(),
          }),
        }));
      } catch (error) {
        pageStatus.textContent = error.message;
        save.disabled = false;
      }
    });
    article.append(input, save);
    input.focus();
  }

  function renderEditor() {
    if (!current) { editor.hidden = true; return; }
    editor.hidden = false;
    editor.dataset.status = current.status;
    phone.value = current.phone || '';
    company.value = current.company || '';
    const editable = current.status === 'draft';
    phone.disabled = !editable;
    company.disabled = !editable;
    submitButton.disabled = !editable;
    page.querySelector('[data-add-item]').hidden = !editable;
    items.replaceChildren();
    for (const quoteItem of current.items) {
      const article = documentRoot.createElement('article');
      article.setAttribute('data-quote-item', '');
      const title = documentRoot.createElement('h4');
      title.textContent = quoteItem.productLabel;
      const description = documentRoot.createElement('p');
      description.textContent = [quoteItem.materialLabel, quoteItem.sizeLabel, quoteItem.quantityLabel].join(' · ');
      const subtotal = documentRoot.createElement('p');
      subtotal.textContent = quoteItem.requiresEvaluation ? 'Requiere evaluación' : money(quoteItem.estimatedSubtotal);
      article.append(title, description, subtotal);
      if (editable) {
        article.append(
          button('Editar', 'data-edit-item', () => beginItemEdit(article, quoteItem)),
          button('Eliminar', 'data-delete-item', (event) => deleteItem(quoteItem.id, event.currentTarget)),
        );
      }
      items.append(article);
    }
    total.textContent = current.hasEvaluation
      ? `Total parcial: ${money(current.estimatedTotal)} · Hay productos pendientes de evaluación`
      : `Total estimado: ${money(current.estimatedTotal)}`;
    saveStatus.textContent = editable ? 'Borrador guardado' : 'Cotización enviada · Solo lectura';
    retry.hidden = true;
  }

  function saveDetails() {
    const version = ++editVersion;
    const details = { phone: phone.value.trim(), company: company.value.trim() };
    lastSave = details;
    saveStatus.textContent = 'Guardando…';
    retry.hidden = true;
    const perform = async () => {
      try {
        const saved = await request(`/api/quotes/${current.id}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(details),
        });
        current = saved;
        quotes = quotes.map((quote) => quote.id === saved.id ? saved : quote);
        if (version === editVersion) saveStatus.textContent = 'Borrador guardado';
      } catch (error) {
        if (version === editVersion) {
          saveStatus.textContent = error.message;
          retry.hidden = false;
        }
      }
    };
    saveQueue = saveQueue.then(perform, perform);
    return saveQueue;
  }

  phone.addEventListener('change', saveDetails);
  company.addEventListener('change', saveDetails);
  retry.addEventListener('click', () => {
    if (lastSave) saveDetails();
  });

  page.querySelector('[data-create-quote]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try { replaceCurrent(await request('/api/quotes', { method: 'POST' })); }
    catch (error) { pageStatus.textContent = error.message; }
    finally { event.currentTarget.disabled = false; }
  });

  function closeDialog() {
    dialog.hidden = true;
    documentRoot.body.classList.remove('dialog-open');
    dialogTrigger?.focus();
  }
  submitButton.addEventListener('click', () => {
    dialogTrigger = submitButton;
    dialog.hidden = false;
    documentRoot.body.classList.add('dialog-open');
    confirmSubmit.focus();
  });
  cancelSubmit.addEventListener('click', closeDialog);
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDialog();
    if (event.key !== 'Tab') return;
    if (event.shiftKey && documentRoot.activeElement === confirmSubmit) {
      event.preventDefault(); cancelSubmit.focus();
    } else if (!event.shiftKey && documentRoot.activeElement === cancelSubmit) {
      event.preventDefault(); confirmSubmit.focus();
    }
  });
  confirmSubmit.addEventListener('click', async () => {
    confirmSubmit.disabled = true;
    try {
      const submitted = await request(`/api/quotes/${current.id}/submit`, { method: 'POST' });
      closeDialog();
      replaceCurrent(submitted);
    } catch (error) {
      pageStatus.textContent = error.message;
    } finally { confirmSubmit.disabled = false; }
  });

  const ready = (async () => {
    try {
      const session = await request('/api/auth/session');
      if (!session.authenticated) {
        navigate('acceso.html?returnTo=cotizaciones.html');
        return;
      }
      quotes = await request('/api/quotes');
      let handoff = null;
      try {
        const stored = storage?.getItem(HANDOFF_KEY);
        if (stored) handoff = JSON.parse(stored);
      } catch { /* El listado sigue disponible sin almacenamiento temporal. */ }
      if (handoff) {
        try {
          let target = quotes.find((quote) => quote.status === 'draft');
          if (!target) target = await request('/api/quotes', { method: 'POST' });
          target = await request(`/api/quotes/${target.id}/items`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(handoff),
          });
          quotes = quotes.filter((quote) => quote.id !== target.id);
          quotes.unshift(target);
          storage?.removeItem(HANDOFF_KEY);
        } catch (error) {
          pageStatus.textContent = `${error.message} Vuelve al simulador para revisar la selección.`;
        }
      }
      current = quotes.find((quote) => quote.status === 'draft') || quotes[0] || null;
      renderList();
      renderEditor();
    } catch (error) {
      if (error.status === 401) navigate('acceso.html?returnTo=cotizaciones.html');
      else pageStatus.textContent = error.message;
    }
  })();

  return { ready };
}
