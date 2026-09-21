import { quoteStatusLabel } from './estado-cotizacion.js';
import { renderSessionNavigation } from './sesion-navegacion.js';

const transitions = {
  submitted: { status: 'in_review', roles: ['jefe', 'superadmin'], label: 'Comenzar revisión' },
  in_review: { status: 'accepted', roles: ['jefe', 'superadmin'], label: 'Aceptar cotización' },
  accepted: { status: 'invoiced', roles: ['jefe', 'superadmin'], label: 'Registrar factura e iniciar trabajo' },
  invoiced: { status: 'ready', roles: ['trabajador', 'superadmin'], label: 'Marcar lista' },
  in_production: { status: 'ready', roles: ['trabajador', 'superadmin'], label: 'Marcar lista' },
  ready: { status: 'delivered', roles: ['jefe', 'superadmin'], label: 'Confirmar entrega' },
};

export function initWorkPage(documentRoot = document, api = globalThis.fetch) {
  const root = documentRoot.querySelector('[data-work-page]');
  if (!root || typeof api !== 'function') return;
  const list = root.querySelector('[data-work-list]');
  const status = root.querySelector('[data-work-status]');
  const refresh = root.querySelector('[data-work-refresh]');
  let role;
  let busy = false;
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
    article.append(node('h2', quote.code), node('span', quoteStatusLabel(quote.status), 'quote-status-badge'));
    article.append(node('p', [quote.company, quote.phone].filter(Boolean).join(' · ') || 'Proyecto particular'));
    for (const item of quote.items || []) {
      article.append(node('h3', item.productLabel), node('p', [item.materialLabel, item.sizeLabel, item.quantityLabel].filter(Boolean).join(' · ')));
      if (item.extras?.length) article.append(node('p', `Extras: ${item.extras.map(extra => extra.label).join(' · ')}`));
      if (item.observation) article.append(node('p', item.observation));
    }
    article.append(node('p', `Estimación: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(quote.estimatedTotal || 0)}${quote.hasEvaluation ? ' + productos sujetos a evaluación' : ''}`));
    if (quote.invoicedAt) article.append(node('p', `Trabajo en marcha · Factura ${quote.invoiceNumber} · Emitida: ${new Date(quote.invoicedAt).toLocaleDateString('es-CL')} · Pago hasta: ${new Date(quote.paymentDueAt).toLocaleDateString('es-CL')}`));
    const action = transitions[quote.status];
    if (action?.roles.includes(role)) {
      let invoiceInput;
      const button = node('button', action.label);
      button.type = 'button';
      button.dataset.workTransition = '';
      if (action.status === 'invoiced') {
        const label = node('label', 'Número de factura emitida');
        invoiceInput = node('input');
        invoiceInput.type = 'text';
        invoiceInput.maxLength = 100;
        invoiceInput.required = true;
        invoiceInput.dataset.invoiceNumber = '';
        label.append(invoiceInput);
        article.append(label);
        button.disabled = true;
        invoiceInput.addEventListener('input', () => { button.disabled = !invoiceInput.value.trim(); });
      }
      button.addEventListener('click', async () => {
        if (busy || (invoiceInput && !invoiceInput.value.trim())) return;
        busy = true;
        button.disabled = true;
        refresh.disabled = true;
        if (invoiceInput) invoiceInput.disabled = true;
        status.textContent = 'Actualizando proyecto…';
        try {
          const body = { status: action.status, ...(invoiceInput ? { invoiceNumber: invoiceInput.value.trim() } : {}) };
          const updated = await request(`/api/work/quotes/${encodeURIComponent(quote.id)}/transition`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
          });
          if (updated.status === 'delivered') {
            article.remove();
            status.textContent = 'Entrega confirmada. La factura está en Facturas realizadas.';
          } else {
            article.replaceWith(card(updated));
            status.textContent = 'Proyecto actualizado.';
          }
        } catch (error) {
          status.textContent = error.message || 'No pudimos conectar. Vuelve a intentarlo o actualiza el listado.';
        } finally {
          busy = false;
          refresh.disabled = false;
          if (invoiceInput) invoiceInput.disabled = false;
          button.disabled = Boolean(invoiceInput && !invoiceInput.value.trim());
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
      const quotes = await request('/api/work/quotes');
      list.replaceChildren(...quotes.map(card));
      status.textContent = quotes.length ? `${quotes.length} proyecto${quotes.length === 1 ? '' : 's'} en el listado.` : 'Todavía no hay proyectos disponibles para tu rol.';
    } catch (error) {
      status.textContent = error.message || 'No pudimos conectar. Actualiza el listado para reintentar.';
      refresh.hidden = false;
    } finally {
      busy = false;
      refresh.disabled = false;
    }
  }
  refresh.addEventListener('click', () => { void load(); });
  void load();
}
