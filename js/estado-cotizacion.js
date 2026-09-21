const stages = [
  ['draft', 'Borrador'],
  ['submitted', 'Enviada'],
  ['in_review', 'En revisión'],
  ['accepted', 'Aceptada'],
  ['invoiced', 'Facturada'],
  ['ready', 'Lista'],
  ['delivered', 'Entregada'],
];

const labels = Object.fromEntries([
  ...stages,
  ['changes_required', 'Requiere cambios'],
  ['in_production', 'En producción'],
  ['rejected', 'Rechazada'],
  ['cancelled', 'Cancelada'],
]);

export function quoteStatusLabel(status) {
  return labels[status] || 'Estado no disponible';
}

export function renderQuoteProgress(root, quote) {
  const documentRoot = root.ownerDocument;
  const progress = root.querySelector('[data-quote-progress]');
  const visibleStages = quote.status === 'in_production'
    ? [...stages.slice(0, 4), ['in_production', 'En producción'], ...stages.slice(5)]
    : stages;
  const currentIndex = visibleStages.findIndex(([status]) => status === quote.status);
  root.querySelector('[data-tracking-description]').textContent = quote.status === 'draft'
    ? 'Borrador: puedes completar los datos y productos antes de enviar.'
    : quote.status === 'submitted'
      ? 'Enviada: recibimos tu cotización. Está pendiente de revisión por el equipo.'
      : `Estado actual: ${quoteStatusLabel(quote.status)}.${quote.invoicedAt ? ` Trabajo iniciado el ${new Date(quote.invoicedAt).toLocaleDateString('es-CL')}. Pago hasta el ${new Date(quote.paymentDueAt).toLocaleDateString('es-CL')}.` : ''}`;
  progress.replaceChildren();
  for (const [index, [status, label]] of visibleStages.entries()) {
    const item = documentRoot.createElement('li');
    const name = documentRoot.createElement('strong');
    const detail = documentRoot.createElement('span');
    name.setAttribute('data-step-label', '');
    name.textContent = label;
    const state = index === currentIndex ? 'current'
      : currentIndex >= 0 && index < currentIndex ? 'previous' : 'pending';
    item.dataset.stepState = state;
    if (status === quote.status) item.setAttribute('aria-current', 'step');
    detail.textContent = state === 'current' ? 'Estado actual'
      : state === 'previous' ? 'Etapa anterior' : 'Pendiente';
    item.append(name, detail);
    progress.append(item);
  }
  let history = root.querySelector('[data-tracking-events]');
  if (!history) {
    history = documentRoot.createElement('ol');
    history.dataset.trackingEvents = '';
    history.setAttribute('aria-label', 'Historial de movimientos');
    root.append(history);
  }
  history.replaceChildren();
  if (quote.invoicedAt) {
    const item = documentRoot.createElement('li');
    item.textContent = `Facturada: ${new Date(quote.invoicedAt).toLocaleString('es-CL')}`;
    history.append(item);
  }
  const finished = quote.events?.find(event => event.status === 'ready');
  if (finished) {
    const item = documentRoot.createElement('li');
    item.textContent = `Trabajo terminado: ${new Date(finished.createdAt).toLocaleString('es-CL')}`;
    history.append(item);
  }
  history.hidden = !history.children.length;
}
