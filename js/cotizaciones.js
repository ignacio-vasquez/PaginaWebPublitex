import { HANDOFF_KEY } from './simulador.js';
import { quoteStatusLabel, renderQuoteProgress } from './estado-cotizacion.js';

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
  const tracking = page.querySelector('[data-quote-tracking]');
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
  let lastSaveError = null;
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
    if (!quotes.length) {
      const empty = documentRoot.createElement('li');
      empty.textContent = 'Aún no tienes cotizaciones. Crea un borrador para comenzar.';
      list.append(empty);
    }
    const history = [...quotes].sort((a, b) => b.createdAt - a.createdAt
      || (b.code || b.id).localeCompare(a.code || a.id, 'es', { numeric: true }));
    for (const quote of history) {
      const item = documentRoot.createElement('li');
      item.dataset.quoteId = quote.id;
      item.className = 'quote-history-entry';
      const code = documentRoot.createElement('strong');
      code.textContent = quote.code || quote.id;
      const date = documentRoot.createElement('time');
      date.dateTime = new Date(quote.createdAt).toISOString();
      date.textContent = formatDate(quote.createdAt);
      const status = documentRoot.createElement('span');
      status.className = 'quote-status-badge';
      status.textContent = quoteStatusLabel(quote.status);
      const count = documentRoot.createElement('p');
      count.textContent = `${quote.items.length} producto${quote.items.length === 1 ? '' : 's'}`;
      const selectQuote = (showTracking) => {
        const next = quotes.find((candidate) => candidate.id === quote.id);
        if (!next) return;
        const changed = current?.id !== next.id;
        current = next;
        tracking.hidden = !showTracking;
        if (changed) renderEditor();
        else renderTracking();
        renderList();
        page.querySelector(showTracking ? '#quote-tracking-title' : '#quote-editor-title').focus();
      };
      const select = button(
        'Ver cotización',
        'data-select-quote',
        () => selectQuote(false),
      );
      select.setAttribute('aria-label', `Ver cotización ${code.textContent}`);
      const viewStatus = button('Ver estado', 'data-view-quote-status', () => selectQuote(true));
      viewStatus.setAttribute('aria-label', `Ver estado de ${code.textContent}`);
      if (current?.id === quote.id) {
        select.setAttribute('aria-current', 'true');
        item.dataset.selected = 'true';
      }
      const actions = documentRoot.createElement('div');
      actions.className = 'quote-history-actions';
      actions.append(select, viewStatus);
      item.append(code, date, status, count, actions);
      list.append(item);
    }
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(timestamp));
  }

  function renderTracking() {
    renderQuoteProgress(tracking, current);
    const dates = [`Creada: ${formatDate(current.createdAt)}`];
    if (current.submittedAt != null) dates.push(`Enviada: ${formatDate(current.submittedAt)}`);
    tracking.querySelector('[data-tracking-dates]').textContent = dates.join(' · ');
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
    page.querySelector('#quote-editor-title').textContent = `Cotización ${current.code || current.id}`;
    page.querySelector('[data-quote-current-status]').textContent = quoteStatusLabel(current.status);
    renderTracking();
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
    saveStatus.textContent = editable ? 'Borrador guardado' : `${quoteStatusLabel(current.status)} · Solo lectura`;
    retry.hidden = true;
  }

  function saveDetails() {
    const quoteId = current.id;
    const version = ++editVersion;
    const details = { phone: phone.value.trim(), company: company.value.trim() };
    lastSave = details;
    saveStatus.textContent = 'Guardando…';
    retry.hidden = true;
    const perform = async () => {
      try {
        const saved = await request(`/api/quotes/${quoteId}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(details),
        });
        if (current.id === quoteId) current = saved;
        quotes = quotes.map((quote) => quote.id === saved.id ? saved : quote);
        if (version === editVersion && current.id === quoteId) {
          lastSaveError = null;
          saveStatus.textContent = 'Borrador guardado';
        }
      } catch (error) {
        if (version === editVersion && current.id === quoteId) {
          lastSaveError = { quoteId, error };
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
    pageStatus.textContent = '';
    if (!phone.value.trim()) {
      pageStatus.textContent = 'Ingresa un teléfono de contacto antes de enviar la cotización.';
      phone.focus();
      return;
    }
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
    phone.disabled = true;
    company.disabled = true;
    try {
      await saveQueue;
      if (lastSaveError?.quoteId !== current.id && (phone.value.trim() !== (current.phone || '')
        || company.value.trim() !== (current.company || ''))) {
        await saveDetails();
      }
      if (lastSaveError?.quoteId === current.id) {
        closeDialog();
        pageStatus.textContent = 'No se envió la cotización. Corrige los datos o reintenta el guardado antes de enviar.';
        return;
      }
      const submitted = await request(`/api/quotes/${current.id}/submit`, { method: 'POST' });
      closeDialog();
      replaceCurrent(submitted);
    } catch (error) {
      pageStatus.textContent = error.message;
    } finally {
      confirmSubmit.disabled = false;
      phone.disabled = current?.status !== 'draft';
      company.disabled = current?.status !== 'draft';
    }
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
          pageStatus.textContent = `${error.message} Vuelve a Cotización para revisar la selección.`;
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
