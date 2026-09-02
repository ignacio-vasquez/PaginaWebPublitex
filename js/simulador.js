const HANDOFF_KEY = 'publitex_quote_handoff_v1';

function replaceOptions(select, options, placeholder) {
  select.replaceChildren();
  const empty = select.ownerDocument.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  select.append(empty);
  for (const option of options) {
    const element = select.ownerDocument.createElement('option');
    element.value = option.id;
    element.textContent = option.label;
    select.append(element);
  }
  select.disabled = options.length === 0;
}

export function initSimulator(
  documentRoot = document,
  api = fetch,
  storage = sessionStorage,
  navigate = (url) => { window.location.href = url; },
) {
  const root = documentRoot.querySelector('[data-simulator]');
  if (!root) return { ready: Promise.resolve() };
  const product = root.querySelector('[data-simulator-product]');
  const material = root.querySelector('[data-simulator-material]');
  const size = root.querySelector('[data-simulator-size]');
  const quantity = root.querySelector('[data-simulator-quantity]');
  const extrasFieldset = root.querySelector('[data-simulator-extras]');
  const extrasContainer = root.querySelector('[data-extra-options]');
  const observation = root.querySelector('[data-simulator-observation]');
  const estimateButton = root.querySelector('[data-simulator-estimate]');
  const status = root.querySelector('[data-simulator-status]');
  const result = root.querySelector('[data-simulator-result]');
  const summary = root.querySelector('[data-estimate-summary]');
  const total = root.querySelector('[data-estimate-total]');
  const quoteButton = root.querySelector('[data-quote-project]');
  let products = [];
  let lastSelection = null;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function selectedExtras() {
    return [...extrasContainer.querySelectorAll('input:checked')].map((input) => input.value);
  }

  function selection() {
    return {
      productId: product.value,
      materialId: material.value,
      sizeId: size.value,
      quantityId: quantity.value,
      extraIds: selectedExtras(),
    };
  }

  function renderExtras(options) {
    extrasContainer.replaceChildren();
    for (const option of options) {
      const label = documentRoot.createElement('label');
      const input = documentRoot.createElement('input');
      input.type = 'checkbox';
      input.value = option.id;
      label.append(input, ` ${option.label}`);
      extrasContainer.append(label);
    }
    extrasFieldset.disabled = options.length === 0;
  }

  function invalidateEstimate() {
    result.hidden = true;
    lastSelection = null;
  }

  product.addEventListener('change', () => {
    const selected = products.find((candidate) => candidate.id === product.value);
    replaceOptions(material, selected?.materials || [], 'Selecciona un material');
    replaceOptions(size, selected?.sizes || [], 'Selecciona una medida');
    replaceOptions(quantity, selected?.quantities || [], 'Selecciona una cantidad');
    renderExtras(selected?.extras || []);
    invalidateEstimate();
    showStatus(selected ? `Opciones disponibles para ${selected.label}.` : '');
  });
  for (const control of [material, size, quantity, extrasContainer, observation]) {
    control.addEventListener('change', invalidateEstimate);
  }

  estimateButton.addEventListener('click', async () => {
    const current = selection();
    const controls = [[product, current.productId], [material, current.materialId], [size, current.sizeId], [quantity, current.quantityId]];
    const invalid = controls.find(([, value]) => !value);
    if (invalid) {
      showStatus('Completa producto, material, medida y cantidad para calcular.');
      invalid[0].focus();
      return;
    }
    estimateButton.disabled = true;
    showStatus('Calculando estimación…');
    try {
      const response = await api('/api/catalog/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(current),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No pudimos calcular la estimación.');
      const parts = [body.summary.product, body.summary.material, body.summary.size, body.summary.quantity];
      if (body.summary.extras.length) parts.push(`Extras: ${body.summary.extras.join(', ')}`);
      summary.textContent = parts.join(' · ');
      total.textContent = body.requiresEvaluation
        ? 'Requiere evaluación'
        : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(body.estimatedTotal);
      result.hidden = false;
      lastSelection = { ...current, extraIds: [...current.extraIds] };
      showStatus('Estimación calculada.');
    } catch (error) {
      showStatus(error.message || 'No pudimos calcular la estimación.');
    } finally {
      estimateButton.disabled = false;
    }
  });

  quoteButton.addEventListener('click', () => {
    if (!lastSelection) return;
    const handoff = { ...lastSelection, observation: observation.value.trim() };
    try {
      storage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      showStatus('No pudimos conservar la selección; deberás elegirla nuevamente después de ingresar.');
    }
    navigate('acceso.html?returnTo=cotizaciones.html');
  });

  const ready = (async () => {
    showStatus('Cargando opciones…');
    try {
      const response = await api('/api/catalog');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No pudimos cargar las opciones.');
      products = body.products;
      replaceOptions(product, products, 'Selecciona un producto');
      showStatus('Opciones cargadas.');
    } catch (error) {
      product.disabled = true;
      estimateButton.disabled = true;
      showStatus(error.message || 'No pudimos cargar las opciones.');
    }
  })();

  return { ready };
}

export { HANDOFF_KEY };
