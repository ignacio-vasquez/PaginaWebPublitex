import { quoteStatusLabel } from './estado-cotizacion.js';
import { renderSessionNavigation } from './sesion-navegacion.js';
import { createInvoiceAttachment, invoiceDate } from './invoice-attachment.js';

const transitions = {
  submitted: {
    jefe: { status: 'in_review', label: 'Comenzar revisión' },
    superadmin: { status: 'in_review', label: 'Comenzar revisión' },
  },
  in_review: {
    jefe: { status: 'accepted', label: 'Aceptar cotización' },
    superadmin: { status: 'accepted', label: 'Aceptar cotización' },
  },
  invoiced: {
    jefe: { status: 'in_production', label: 'Tomar trabajo' },
    trabajador: { status: 'ready', label: 'Marcar lista' },
    superadmin: { status: 'in_production', label: 'Tomar trabajo' },
  },
  in_production: {
    jefe: { status: 'ready', label: 'Marcar lista' },
    trabajador: { status: 'ready', label: 'Marcar lista' },
    superadmin: { status: 'ready', label: 'Marcar lista' },
  },
  ready: {
    jefe: { status: 'delivered', label: 'Confirmar entrega' },
    superadmin: { status: 'delivered', label: 'Confirmar entrega' },
  },
};

export function initWorkPage(documentRoot = document, api = globalThis.fetch) {
  const root = documentRoot.querySelector('[data-work-page]');
  if (!root || typeof api !== 'function') return;
  const list = root.querySelector('[data-work-list]');
  const status = root.querySelector('[data-work-status]');
  const refresh = root.querySelector('[data-work-refresh]');
  const workSearch = root.querySelector('[data-work-search]');
  let role;
  let busy = false;
  let loadedQuotes = [];
  let searchTerm = '';
  const node = (tag, text, className) => {
    const element = documentRoot.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  async function request(url, options = {}) {
    const response = await api(url, { credentials: 'same-origin', ...options });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No pudimos completar la solicitud.');
    return body;
  }
  function card(quote) {
    const article = node('article');
    article.dataset.workCard = '';
    article.append(node('h2', `${quote.workName?.trim() || quote.code} · ${quote.code}`), node('span', quoteStatusLabel(quote.status), 'quote-status-badge'));
    if (['jefe', 'superadmin'].includes(role)) {
      const editor = node('div');
      editor.dataset.workNameEditor = '';
      const label = node('label', 'Nombre del trabajo (opcional, máximo 120 caracteres)');
      const input = node('input');
      input.type = 'text';
      input.maxLength = 120;
      input.value = quote.workName || '';
      input.dataset.workNameInput = '';
      const saveName = node('button', 'Guardar nombre');
      saveName.type = 'button';
      saveName.dataset.saveWorkName = '';
      const result = node('span');
      result.setAttribute('role', 'status');
      label.append(input);
      saveName.addEventListener('click', async () => {
        const value = input.value.trim();
        if (value.length > 120) { result.textContent = 'El nombre admite hasta 120 caracteres.'; return; }
        saveName.disabled = true;
        result.textContent = 'Guardando…';
        try {
          const updated = await request(`/api/work/quotes/${encodeURIComponent(quote.id)}/name`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workName: value }),
          });
          updateLoadedQuote(updated);
          result.textContent = 'Nombre guardado.';
          article.replaceWith(card(updated));
        } catch (error) { result.textContent = error.message; }
        finally { saveName.disabled = false; }
      });
      editor.append(label, saveName, result);
      article.append(editor);
    }
    article.append(node('p', [quote.company, quote.phone].filter(Boolean).join(' · ') || 'Proyecto particular'));
    for (const item of quote.items || []) {
      article.append(node('h3', item.productLabel), node('p', [item.materialLabel, item.sizeLabel, item.quantityLabel].filter(Boolean).join(' · ')));
      if (item.extras?.length) article.append(node('p', `Extras: ${item.extras.map(extra => extra.label).join(' · ')}`));
      if (item.observation) article.append(node('p', item.observation));
    }
    article.append(node('p', `Estimación: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(quote.estimatedTotal || 0)}${quote.hasEvaluation ? ' + productos sujetos a evaluación' : ''}`));
    if (quote.invoicedAt) article.append(node('p', `Trabajo en marcha · Factura ${quote.invoiceNumber} · Registrada: ${new Date(quote.invoicedAt).toLocaleDateString('es-CL')} · Pago hasta: ${new Date(quote.paymentDueAt).toLocaleDateString('es-CL')}`));
    if (quote.invoice) article.append(node('p', `Fecha de emisión: ${new Date(invoiceDate(quote)).toLocaleDateString('es-CL')} · Total facturado: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(quote.invoice.total)}`));
    const attachmentArea = node('section');
    attachmentArea.dataset.workAttachments = '';
    article.append(attachmentArea);
    void renderAttachments(quote, attachmentArea);
    if (['jefe', 'superadmin'].includes(role) && (quote.invoice || ['accepted', 'invoiced', 'in_production', 'ready'].includes(quote.status))) {
      article.append(createInvoiceAttachment(documentRoot, quote, {
        api,
        onBusy(value) { busy = value; refresh.disabled = value; },
        onSaved(updated) { updateLoadedQuote(updated); article.replaceWith(card(updated)); status.textContent = 'Factura guardada y vinculada a la cotización.'; },
      }));
    }
    const action = transitions[quote.status]?.[role];
    if (action) {
      const button = node('button', action.label);
      button.type = 'button';
      button.dataset.workTransition = '';
      button.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        button.disabled = true;
        refresh.disabled = true;
        status.textContent = 'Actualizando proyecto…';
        try {
          const body = { status: action.status };
          const updated = await request(`/api/work/quotes/${encodeURIComponent(quote.id)}/transition`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
          });
          if (updated.status === 'delivered') {
            loadedQuotes = loadedQuotes.filter((item) => item.id !== updated.id);
            article.remove();
            status.textContent = 'Entrega confirmada. La factura está en Facturas realizadas.';
          } else {
            updateLoadedQuote(updated);
            article.replaceWith(card(updated));
            status.textContent = 'Proyecto actualizado.';
          }
        } catch (error) {
          status.textContent = error.message || 'No pudimos conectar. Vuelve a intentarlo o actualiza el listado.';
        } finally {
          busy = false;
          refresh.disabled = false;
          button.disabled = false;
        }
      });
      article.append(button);
    }
    article.append(node('h3', 'Fechas del trabajo'));
    const events = node('ol');
    events.dataset.workEvents = '';
    if (quote.invoicedAt) events.append(node('li', `Facturada: ${new Date(quote.invoicedAt).toLocaleString('es-CL')}`));
    const finished = quote.events?.find(event => event.status === 'ready');
    if (finished) events.append(node('li', `Trabajo terminado: ${new Date(finished.createdAt).toLocaleString('es-CL')}`));
    article.append(events);
    if (!events.children.length) article.append(node('p', 'Aún no se factura.'));
    return article;
  }
  function updateLoadedQuote(quote) {
    if (quote.status === 'delivered') loadedQuotes = loadedQuotes.filter((item) => item.id !== quote.id);
    else loadedQuotes = loadedQuotes.map((item) => item.id === quote.id ? quote : item);
    if (!loadedQuotes.some((item) => item.id === quote.id) && quote.status !== 'delivered') loadedQuotes.push(quote);
  }
  const attachmentTypes = [
    ['budget', 'Presupuesto Excel', '.xlsx'],
    ['invoice_backup', 'Factura PDF de respaldo', '.pdf'],
    ['preview', 'Fotomontaje', '.jpg'],
    ['completion', 'Foto del trabajo terminado', '.jpg'],
  ];
  async function renderAttachments(quote, area) {
    area.replaceChildren();
    const title = node('h3', 'Archivos del trabajo');
    const links = node('ul');
    area.append(title, links);
    let files = [];
    try { files = await request(`/api/quotes/${encodeURIComponent(quote.id)}/attachments`); } catch { /* La cotización sigue operativa si no hay archivos. */ }
    if (!area.isConnected) return;
    const names = Object.fromEntries(attachmentTypes.map(([kind, label]) => [kind, label]));
    for (const file of files) {
      const item = node('li');
      const link = node('a', `${names[file.kind] || file.kind}: ${file.filename}`);
      link.href = file.downloadUrl;
      link.download = file.filename;
      item.append(link);
      links.append(item);
    }
    if (!files.length) links.append(node('li', 'Aún no hay archivos.'));
    if (!['jefe', 'superadmin'].includes(role)) return;
    links.remove();
    area.append(node('p', 'Los archivos son opcionales y no bloquean los cambios de estado.'));
    for (const [kind, label, accept] of attachmentTypes) {
      const form = node('form');
      form.dataset.attachmentUpload = kind;
      const picker = node('input');
      picker.type = 'file';
      picker.hidden = true;
      picker.accept = accept;
      picker.multiple = true;
      picker.setAttribute('aria-label', `${label} (${accept})`);
      const submit = node('button', `Cargar ${label.toLocaleLowerCase('es')}`);
      submit.type = 'button';
      submit.addEventListener('click', () => picker.click());
      const feedback = node('span');
      feedback.setAttribute('role', 'status');
      const pickerLabel = node('label', `${label} (${accept}): `);
      const current = files.filter(file => file.kind === kind);
      const fileBox = node('div');
      fileBox.className = 'attachment-current-file';
      if (current.length) {
        const fileList = node('ul');
        for (const file of current) {
          const download = node('a', file.filename);
          download.href = file.downloadUrl;
          download.download = file.filename;
          const item = node('li');
          item.append(download);
          fileList.append(item);
        }
        fileBox.append(fileList);
      } else fileBox.textContent = 'Aún no hay un archivo cargado.';
      form.append(pickerLabel, fileBox, picker, submit, feedback);
      form.addEventListener('submit', event => event.preventDefault());
      picker.addEventListener('change', async () => {
        if (!picker.files?.[0]) return;
        const selected = [...picker.files];
        const buttons = [...area.querySelectorAll('button')];
        buttons.forEach(button => { button.disabled = true; });
        busy = true;
        refresh.disabled = true;
        feedback.textContent = 'Cargando…';
        const errors = [];
        let saved = 0;
        try {
          for (const file of selected) {
            const body = new (documentRoot.defaultView?.FormData || globalThis.FormData)();
            body.append('file', file);
            try {
              await request(`/api/quotes/${encodeURIComponent(quote.id)}/attachments/${kind}`, { method: 'PUT', body });
              saved++;
            } catch (error) { errors.push(`${file.name}: ${error.message}`); }
          }
          await renderAttachments(quote, area);
          const resultStatus = area.querySelector(`[data-attachment-upload="${kind}"] [role="status"]`);
          if (resultStatus) resultStatus.textContent = `${saved} archivo(s) agregado(s). ${errors.join(' ')}`;
        } catch (error) { feedback.textContent = error.message; }
        finally { busy = false; refresh.disabled = false; buttons.forEach(button => { button.disabled = false; }); picker.value = ''; }
      });
      area.append(form);
    }
  }

  function filteredQuotes() {
    const search = searchTerm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    return loadedQuotes.filter((quote) => `${quote.workName || ''} ${quote.code || ''}`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').includes(search));
  }
  async function load() {
    if (busy) return;
    busy = true;
    refresh.disabled = true;
    list.replaceChildren();
    status.textContent = 'Cargando proyectos…';
    try {
      const session = await request('/api/auth/session');
      renderSessionNavigation(documentRoot, session.authenticated === true, session, api);
      role = session.user?.role;
      if (!session.authenticated || !['jefe', 'trabajador', 'superadmin'].includes(role)) {
        status.textContent = session.authenticated ? 'Esta sección está disponible para el equipo de Publitex.' : 'Ingresa con tu cuenta del equipo para ver los proyectos.';
        root.querySelector('[data-work-login]').hidden = false;
        refresh.hidden = true;
        return;
      }
      root.querySelector('[data-work-login]').hidden = true;
      root.querySelector('[data-invoice-archive]').hidden = role === 'trabajador';
      refresh.hidden = false;
      root.querySelector('[data-work-title]').textContent = role === 'trabajador' ? 'Mis trabajos' : 'Gestión de proyectos';
      loadedQuotes = await request('/api/work/quotes');
      list.replaceChildren(...filteredQuotes().map(card));
      status.textContent = loadedQuotes.length ? `${filteredQuotes().length} proyecto${filteredQuotes().length === 1 ? '' : 's'} en el listado.` : 'Todavía no hay proyectos disponibles para tu rol.';
    } catch (error) {
      status.textContent = error.message || 'No pudimos conectar. Actualiza el listado para reintentar.';
      refresh.hidden = false;
    } finally {
      busy = false;
      refresh.disabled = false;
    }
  }
  refresh.addEventListener('click', () => { void load(); });
  workSearch.addEventListener('input', () => {
    searchTerm = workSearch.value;
    list.replaceChildren(...filteredQuotes().map(card));
  });
  void load();
}
