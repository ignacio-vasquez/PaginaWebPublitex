import { renderSessionNavigation } from './sesion-navegacion.js';

const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const dateText = timestamp => timestamp ? new Date(timestamp).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' }) : 'Sin fecha registrada';
const invoiceYear = quote => new Date(quote.invoicedAt || quote.events?.find(event => event.status === 'delivered')?.createdAt || quote.createdAt).getFullYear();

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
  const fields = [quote.code, quote.invoiceNumber, quote.clientName, quote.clientEmail,
    quote.company, quote.phone, dateTerms(quote.invoicedAt),
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
    const summary = node('summary', `${quote.invoiceNumber || 'Factura sin número'} · ${quote.code} · ${new Date(quote.invoicedAt || quote.createdAt).toLocaleDateString('es-CL')}`);
    details.append(summary);
    details.append(node('p', `Cliente: ${quote.clientName || 'Sin nombre'} · ${quote.clientEmail || 'Sin correo'}`));
    details.append(node('p', `Contacto: ${[quote.company, quote.phone].filter(Boolean).join(' · ') || 'Sin datos adicionales'}`));
    details.append(node('p', `Facturada: ${dateText(quote.invoicedAt)}`));
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
    return details;
  }

  function renderList() {
    const query = normalize(search.value);
    const visible = records.filter(quote => invoiceYear(quote) === selectedYear && matches(quote, query))
      .sort((a, b) => (b.invoicedAt || b.createdAt) - (a.invoicedAt || a.createdAt) || b.code.localeCompare(a.code));
    title.textContent = `Facturas de ${selectedYear}`;
    list.replaceChildren(...visible.map(card));
    if (!visible.length) list.append(node('p', query ? 'No hay facturas que coincidan con la búsqueda en este año.' : 'No hay facturas entregadas en este año.'));
    status.textContent = `${visible.length} factura${visible.length === 1 ? '' : 's'} encontrada${visible.length === 1 ? '' : 's'} en ${selectedYear}.`;
  }

  function renderYears() {
    const latestYear = Math.max(new Date().getFullYear(), 2005, ...records.map(invoiceYear));
    years.replaceChildren();
    for (let year = latestYear; year >= 2005; year -= 1) {
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
