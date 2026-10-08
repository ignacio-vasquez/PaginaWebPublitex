import { renderSessionNavigation } from './sesion-navegacion.js';
import { createInvoiceAttachment, invoiceDate } from './invoice-attachment.js';

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const dateText = timestamp => timestamp ? new Date(timestamp).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' }) : 'Sin fecha registrada';
const invoiceYear = quote => new Date(invoiceDate(quote)).getFullYear();
const workAttachments = [
  ['budget', 'Presupuesto Excel', '.xlsx'],
  ['invoice_backup', 'Factura PDF de respaldo', '.pdf'],
  ['preview', 'Fotomontaje', '.jpg'],
  ['completion', 'Foto del trabajo terminado', '.jpg'],
];

function dateTerms(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const longMonth = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(date);
  const shortMonth = new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(date).replace('.', '');
  const year = date.getFullYear();
  return `${day} ${longMonth} ${year} ${day} ${shortMonth} ${year} ${day} ${longMonth.slice(0, 4)} ${year} ${day}/${month}/${year} ${day}-${month}-${year}`;
}

function matches(quote, query) {
  if (!query) return true;
  const fields = [quote.code, quote.workName, quote.invoiceNumber, quote.clientName, quote.clientEmail,
    quote.company, quote.phone, dateTerms(invoiceDate(quote)), quote.invoice?.receiverName,
    quote.invoice?.receiverRut, quote.invoice?.issuerRut,
    dateTerms(quote.events?.find(event => event.status === 'ready')?.createdAt),
    dateTerms(quote.events?.find(event => event.status === 'delivered')?.createdAt)];
  for (const item of quote.items || []) {
    fields.push(item.productLabel, item.materialLabel, item.sizeLabel, item.quantityLabel,
      item.observation, ...(item.extras || []).map(extra => extra.label));
  }
  return fields.some(field => normalize(field).includes(query));
}

export function initInvoiceArchive(documentRoot = document, api = globalThis.fetch) {
  const root = documentRoot.querySelector('[data-invoice-page]');
  if (!root || typeof api !== 'function') return;
  const status = root.querySelector('[data-invoice-status]');
  const content = root.querySelector('[data-invoice-content]');
  const years = root.querySelector('[data-invoice-years]');
  const search = root.querySelector('[data-invoice-search]');
  const list = root.querySelector('[data-invoice-list]');
  const title = root.querySelector('[data-invoice-year-title]');
  let records = [];
  let selectedYear = new Date().getFullYear();
  const node = (tag, value) => {
    const element = documentRoot.createElement(tag);
    if (value !== undefined) element.textContent = value;
    return element;
  };

  function card(quote) {
    const details = node('details');
    details.dataset.invoiceCard = '';
    const summary = node('summary', `${quote.invoiceNumber || 'Factura sin número'} · ${quote.workName?.trim() || quote.code} · ${quote.code} · ${new Date(invoiceDate(quote)).toLocaleDateString('es-CL')}`);
    details.append(summary);
    details.append(node('p', `Cliente: ${quote.clientName || 'Sin nombre'} · ${quote.clientEmail || 'Sin correo'}`));
    details.append(node('p', `Contacto: ${[quote.company, quote.phone].filter(Boolean).join(' · ') || 'Sin datos adicionales'}`));
    if (quote.invoice) {
      details.append(node('p', `Fecha de emisión: ${new Date(invoiceDate(quote)).toLocaleDateString('es-CL')} · Total facturado: ${money.format(quote.invoice.total)}`));
      if (quote.invoice.receiverName) details.append(node('p', `Receptor de la factura: ${quote.invoice.receiverName} · RUT ${quote.invoice.receiverRut}`));
    }
    details.append(node('p', `Registrada como facturada: ${dateText(quote.invoicedAt)}`));
    const finished = quote.events?.find(event => event.status === 'ready');
    if (finished) details.append(node('p', `Trabajo terminado: ${dateText(finished.createdAt)}`));
    const delivered = quote.events?.find(event => event.status === 'delivered');
    if (delivered) details.append(node('p', `Entregada: ${dateText(delivered.createdAt)}`));
    if (quote.paymentDueAt) details.append(node('p', `Plazo de pago: ${dateText(quote.paymentDueAt)}`));
    details.append(node('p', `Estimación original: ${money.format(quote.estimatedTotal || 0)}${quote.hasEvaluation ? ' + productos sujetos a evaluación' : ''}`));
    if (quote.items?.length) {
      const heading = node('h3', 'Detalle del trabajo');
      const products = node('ul');
      for (const item of quote.items) {
        const text = [item.productLabel, item.materialLabel, item.sizeLabel, item.quantityLabel,
          ...(item.extras || []).map(extra => extra.label), item.observation].filter(Boolean).join(' · ');
        products.append(node('li', text));
      }
      details.append(heading, products);
    }
    details.append(createInvoiceAttachment(documentRoot, quote, {
      api,
      onSaved(updated) {
        records = records.map(record => record.id === updated.id ? { ...record, ...updated } : record);
        selectedYear = invoiceYear(updated);
        search.value = '';
        renderYears();
        renderList();
        status.textContent = `Factura guardada en ${selectedYear} y vinculada a ${quote.code}.`;
      },
    }));
    const attachmentArea = node('section');
    attachmentArea.dataset.invoiceAttachments = '';
    details.append(attachmentArea);
    void renderWorkAttachments(quote, attachmentArea);
    return details;
  }

  async function renderWorkAttachments(quote, area) {
    const heading = node('h3', 'Archivos del trabajo');
    const links = node('ul');
    area.replaceChildren(heading, links);
    let files = [];
    try {
      const response = await api(`/api/quotes/${encodeURIComponent(quote.id)}/attachments`, { credentials: 'same-origin' });
      const body = await response.json();
      if (response.ok && Array.isArray(body)) files = body;
    } catch { /* El archivo de facturas sigue disponible si la carga de archivos falla. */ }
    if (!area.isConnected) return;
    const names = Object.fromEntries(workAttachments.map(([kind, label]) => [kind, label]));
    for (const file of files) {
      const link = node('a', `${names[file.kind] || file.kind}: ${file.filename}`);
      link.href = file.downloadUrl;
      link.download = file.filename;
      const item = node('li');
      item.append(link);
      links.append(item);
    }
    if (!files.length) links.append(node('li', 'Aún no hay archivos.'));
    links.remove();
    for (const [kind, label, accept] of workAttachments) {
      const form = node('form');
      form.dataset.invoiceAttachmentUpload = kind;
      const picker = node('input');
      picker.type = 'file';
      picker.hidden = true;
      picker.accept = accept;
      picker.multiple = true;
      picker.setAttribute('aria-label', `${label} (${accept})`);
      const pickerLabel = node('label', `${label} (${accept}): `);
      const submit = node('button', `Cargar ${label.toLocaleLowerCase('es')}`);
      submit.type = 'button';
      submit.addEventListener('click', () => picker.click());
      const feedback = node('span');
      feedback.setAttribute('role', 'status');
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
        feedback.textContent = 'Cargando…';
        let saved = 0;
        const errors = [];
        try {
          for (const file of selected) {
            const body = new (documentRoot.defaultView?.FormData || globalThis.FormData)();
            body.append('file', file);
            try {
              const response = await api(`/api/quotes/${encodeURIComponent(quote.id)}/attachments/${kind}`, {
                method: 'PUT', credentials: 'same-origin', body,
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || 'No pudimos guardar el archivo.');
              saved++;
            } catch (error) { errors.push(`${file.name}: ${error.message || 'No pudimos conectar.'}`); }
          }
          await renderWorkAttachments(quote, area);
          const resultStatus = area.querySelector(`[data-invoice-attachment-upload="${kind}"] [role="status"]`);
          if (resultStatus) resultStatus.textContent = `${saved} archivo(s) agregado(s). ${errors.join(' ')}`;
        } catch (error) { feedback.textContent = error.message || 'No pudimos conectar.'; }
        finally { buttons.forEach(button => { button.disabled = false; }); picker.value = ''; }
      });
      area.append(form);
    }
  }

  function renderList() {
    const query = normalize(search.value);
    const visible = records.filter(quote => invoiceYear(quote) === selectedYear && matches(quote, query))
      .sort((a, b) => invoiceDate(b) - invoiceDate(a) || b.code.localeCompare(a.code));
    title.textContent = `Facturas de ${selectedYear}`;
    list.replaceChildren(...visible.map(card));
    if (!visible.length) list.append(node('p', query ? 'No hay facturas que coincidan con la búsqueda en este año.' : 'No hay facturas entregadas en este año.'));
    status.textContent = `${visible.length} factura${visible.length === 1 ? '' : 's'} encontrada${visible.length === 1 ? '' : 's'} en ${selectedYear}.`;
  }

  function renderYears() {
    const latestYear = Math.max(new Date().getFullYear(), 2005, ...records.map(invoiceYear));
    const earliestYear = Math.min(2005, ...records.map(invoiceYear));
    years.replaceChildren();
    for (let year = latestYear; year >= earliestYear; year -= 1) {
      const count = records.filter(quote => invoiceYear(quote) === year).length;
      const button = node('button', `${year} (${count})`);
      button.type = 'button';
      button.dataset.invoiceYear = String(year);
      button.setAttribute('aria-pressed', String(year === selectedYear));
      button.addEventListener('click', () => {
        selectedYear = year;
        years.querySelectorAll('[data-invoice-year]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        renderList();
      });
      years.append(button);
    }
  }

  search.addEventListener('input', renderList);
  void (async () => {
    try {
      const sessionResponse = await api('/api/auth/session', { credentials: 'same-origin' });
      const session = await sessionResponse.json();
      renderSessionNavigation(documentRoot, session.authenticated === true, session, api);
      if (!session.authenticated || !['jefe', 'superadmin'].includes(session.user?.role)) {
        status.textContent = 'Solo el jefe puede consultar las facturas realizadas.';
        return;
      }
      const response = await api('/api/work/invoices', { credentials: 'same-origin' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No pudimos cargar las facturas.');
      records = body;
      content.hidden = false;
      renderYears();
      renderList();
    } catch (error) { status.textContent = error.message || 'No pudimos conectar.'; }
  })();
}
