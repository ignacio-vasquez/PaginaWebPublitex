const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const catalog = {
  products: [
    {
      id: 'sign-rect', label: 'Letrero rectangular', calculationType: 'fixed',
      materials: [{ id: 'pvc-foam', label: 'PVC espumado' }, { id: 'acrylic', label: 'Acrílico' }],
      sizes: [{ id: '50x30', label: '50 × 30 cm' }],
      quantities: [{ id: 'sign-rect-qty-1', label: '1 unidad', quantity: 1 }],
      extras: [{ id: 'lighting', label: 'Iluminación' }],
    },
    {
      id: 'vehicle-wrap', label: 'Rotulación vehicular', calculationType: 'evaluation',
      materials: [{ id: 'vehicle-car', label: 'Automóvil' }],
      sizes: [{ id: 'coverage-partial', label: 'Cobertura parcial' }],
      quantities: [{ id: 'vehicle-wrap-qty-1', label: '1 vehículo', quantity: 1 }], extras: [],
    },
  ],
};

function fixture() {
  return new JSDOM(`<!doctype html><body><section data-simulator>
    <select data-simulator-product></select><select data-simulator-material disabled></select>
    <select data-simulator-size disabled></select><select data-simulator-quantity disabled></select>
    <fieldset data-simulator-extras disabled><legend>Extras</legend><div data-extra-options></div></fieldset>
    <textarea data-simulator-observation></textarea>
    <button data-simulator-estimate type="button">Calcular estimación</button>
    <div data-simulator-status role="status" aria-live="polite"></div>
    <section data-simulator-result hidden><p data-estimate-summary></p><p data-estimate-total></p>
      <p data-estimate-disclaimer>Valor referencial sujeto a confirmación por la empresa</p>
      <button data-quote-project type="button">Cotizar este proyecto</button></section>
  </section></body>`, { url: 'http://localhost/' });
}

function response(body, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body };
}

async function setup(overrides = {}) {
  const dom = overrides.quotation
    ? new JSDOM(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'cotizacion.html'), 'utf8'), { url: 'http://localhost/cotizacion.html' })
    : fixture();
  const calls = [];
  const api = overrides.api || (async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/catalog') return response(catalog);
    if (url === '/api/auth/session') return response({ authenticated: overrides.authenticated === true });
    return response({
      selection: JSON.parse(options.body),
      summary: { product: 'Letrero rectangular', material: 'Acrílico', size: '50 × 30 cm', quantity: '1 unidad', extras: ['Iluminación'] },
      estimatedTotal: 29000, requiresEvaluation: false,
    });
  });
  const stored = [];
  const storage = overrides.storage || { setItem: (...args) => stored.push(args) };
  const navigations = [];
  const { initSimulator } = await import(`../js/simulador.js?test=${Math.random()}`);
  const simulator = initSimulator(dom.window.document, api, storage, (url) => navigations.push(url));
  await simulator.ready;
  return { dom, calls, stored, navigations };
}

function choose(documentRoot, selector, value) {
  const control = documentRoot.querySelector(selector);
  control.value = value;
  control.dispatchEvent(new documentRoot.defaultView.Event('change', { bubbles: true }));
}

test('carga productos y limita los controles dependientes al producto elegido', async () => {
  const { dom } = await setup();
  const documentRoot = dom.window.document;
  assert.deepEqual([...documentRoot.querySelector('[data-simulator-product]').options].map((option) => option.value), ['', 'sign-rect', 'vehicle-wrap']);

  choose(documentRoot, '[data-simulator-product]', 'sign-rect');
  assert.deepEqual([...documentRoot.querySelector('[data-simulator-material]').options].map((option) => option.value), ['', 'pvc-foam', 'acrylic']);
  choose(documentRoot, '[data-simulator-material]', 'acrylic');
  choose(documentRoot, '[data-simulator-product]', 'vehicle-wrap');
  assert.equal(documentRoot.querySelector('[data-simulator-material]').value, '');
  assert.deepEqual([...documentRoot.querySelector('[data-simulator-material]').options].map((option) => option.value), ['', 'vehicle-car']);
});

test('envía solo identificadores y muestra el total y aviso literal', async () => {
  const { dom, calls } = await setup();
  const documentRoot = dom.window.document;
  choose(documentRoot, '[data-simulator-product]', 'sign-rect');
  choose(documentRoot, '[data-simulator-material]', 'acrylic');
  choose(documentRoot, '[data-simulator-size]', '50x30');
  choose(documentRoot, '[data-simulator-quantity]', 'sign-rect-qty-1');
  documentRoot.querySelector('[data-extra-options] input').click();
  documentRoot.querySelector('[data-simulator-estimate]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const sent = JSON.parse(calls[1].options.body);
  assert.deepEqual(sent, { productId: 'sign-rect', materialId: 'acrylic', sizeId: '50x30', quantityId: 'sign-rect-qty-1', extraIds: ['lighting'] });
  assert.equal(Object.hasOwn(sent, 'estimatedTotal'), false);
  assert.match(documentRoot.querySelector('[data-estimate-total]').textContent, /\$29\.000/);
  assert.match(documentRoot.querySelector('[data-estimate-disclaimer]').textContent, /Valor referencial sujeto a confirmación por la empresa/);
});

test('muestra Requiere evaluación sin moneda', async () => {
  const api = async (url) => url === '/api/catalog' ? response(catalog) : response({
    selection: {}, summary: { product: 'Rotulación vehicular', material: 'Automóvil', size: 'Cobertura parcial', quantity: '1 vehículo', extras: [] },
    estimatedTotal: null, requiresEvaluation: true,
  });
  const { dom } = await setup({ api });
  const documentRoot = dom.window.document;
  choose(documentRoot, '[data-simulator-product]', 'vehicle-wrap');
  choose(documentRoot, '[data-simulator-material]', 'vehicle-car');
  choose(documentRoot, '[data-simulator-size]', 'coverage-partial');
  choose(documentRoot, '[data-simulator-quantity]', 'vehicle-wrap-qty-1');
  documentRoot.querySelector('[data-simulator-estimate]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(documentRoot.querySelector('[data-estimate-total]').textContent, 'Requiere evaluación');
  assert.doesNotMatch(documentRoot.querySelector('[data-estimate-total]').textContent, /\$/);
});

test('conserva la selección cuando la API rechaza la estimación', async () => {
  const api = async (url) => url === '/api/catalog' ? response(catalog) : response({ error: 'La selección cambió.' }, false);
  const { dom } = await setup({ api });
  const documentRoot = dom.window.document;
  choose(documentRoot, '[data-simulator-product]', 'sign-rect');
  choose(documentRoot, '[data-simulator-material]', 'pvc-foam');
  choose(documentRoot, '[data-simulator-size]', '50x30');
  choose(documentRoot, '[data-simulator-quantity]', 'sign-rect-qty-1');
  documentRoot.querySelector('[data-simulator-estimate]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(documentRoot.querySelector('[data-simulator-material]').value, 'pvc-foam');
  assert.equal(documentRoot.querySelector('[data-simulator-status]').textContent, 'La selección cambió.');
});

test('con sesión traspasa únicamente los campos permitidos a la página de cotización', async () => {
  const { dom, stored, navigations } = await setup({ authenticated: true });
  const documentRoot = dom.window.document;
  choose(documentRoot, '[data-simulator-product]', 'sign-rect');
  choose(documentRoot, '[data-simulator-material]', 'acrylic');
  choose(documentRoot, '[data-simulator-size]', '50x30');
  choose(documentRoot, '[data-simulator-quantity]', 'sign-rect-qty-1');
  documentRoot.querySelector('[data-simulator-observation]').value = '  Fachada norte  ';
  documentRoot.querySelector('[data-simulator-estimate]').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  documentRoot.querySelector('[data-quote-project]').click();

  await new Promise(setImmediate);
  assert.equal(stored[0][0], 'publitex_quote_selection_v1');
  assert.deepEqual(JSON.parse(stored[0][1]), {
    productId: 'sign-rect', materialId: 'acrylic', sizeId: '50x30',
    quantityId: 'sign-rect-qty-1', extraIds: [], observation: 'Fachada norte',
  });
  assert.deepEqual(navigations, ['cotizacion.html']);
});


test('una simulación anónima no guarda ni transfiere datos aunque se invoque cotizar', async () => {
  const { dom, stored, navigations, calls } = await setup();
  const doc = dom.window.document;
  choose(doc, '[data-simulator-product]', 'sign-rect');
  choose(doc, '[data-simulator-material]', 'acrylic');
  choose(doc, '[data-simulator-size]', '50x30');
  choose(doc, '[data-simulator-quantity]', 'sign-rect-qty-1');
  doc.querySelector('[data-simulator-estimate]').click();
  await new Promise(setImmediate);
  assert.equal(doc.querySelector('[data-simulator-result]').hidden, false);
  assert.deepEqual(stored, []);
  doc.querySelector('[data-quote-project]').click();
  await new Promise(setImmediate);
  assert.deepEqual(stored, []);
  assert.deepEqual(navigations, []);
  assert.equal(calls.some(({ url }) => url.startsWith('/api/quotes')), false);
});


test('la página de cotización exige sesión antes de cargar el formulario', async () => {
  const { dom, navigations, calls, stored } = await setup({ quotation: true });
  assert.equal(dom.window.document.querySelector('[data-simulator]').hidden, true);
  assert.deepEqual(navigations, ['acceso.html?returnTo=cotizacion.html']);
  assert.equal(calls.some(({ url }) => url === '/api/catalog'), false);
  assert.deepEqual(stored, []);
});

test('cotización recupera la selección y solo la envía al borrador al guardar explícitamente', async () => {
  const storage = new JSDOM('', { url: 'http://localhost/' }).window.sessionStorage;
  storage.setItem('publitex_quote_selection_v1', JSON.stringify({
    productId: 'sign-rect', materialId: 'acrylic', sizeId: '50x30',
    quantityId: 'sign-rect-qty-1', extraIds: ['lighting'], observation: 'Fachada',
  }));
  const { dom, navigations } = await setup({ quotation: true, authenticated: true, storage });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-simulator]').hidden, false);
  assert.equal(doc.querySelector('h1').textContent, 'Cotización');
  assert.equal(doc.querySelector('[data-simulator-material]').value, 'acrylic');
  assert.equal(doc.querySelector('[data-simulator-observation]').value, 'Fachada');
  assert.equal(doc.querySelector('[data-extra-options] input').checked, true);
  assert.equal(storage.length, 0);
  assert.deepEqual(navigations, []);
  doc.querySelector('[data-simulator-estimate]').click();
  await new Promise(setImmediate);
  assert.equal(storage.length, 0);
  doc.querySelector('[data-quote-project]').click();
  await new Promise(setImmediate);
  assert.deepEqual(navigations, ['cotizaciones.html']);
  assert.equal(JSON.parse(storage.getItem('publitex_quote_handoff_v1')).observation, 'Fachada');
});


test('conserva la selección confirmada aunque se edite durante la consulta de sesión', async () => {
  let resolveSession;
  const { dom, stored } = await setup({ api: async (url) => {
    if (url === '/api/catalog') return response(catalog);
    if (url === '/api/auth/session') return new Promise((resolve) => { resolveSession = resolve; });
    return response({ summary: { product: 'Letrero', material: 'Acrílico', size: '50 × 30', quantity: '1', extras: [] }, estimatedTotal: 29000 });
  } });
  const doc = dom.window.document;
  choose(doc, '[data-simulator-product]', 'sign-rect');
  choose(doc, '[data-simulator-material]', 'acrylic');
  choose(doc, '[data-simulator-size]', '50x30');
  choose(doc, '[data-simulator-quantity]', 'sign-rect-qty-1');
  doc.querySelector('[data-simulator-estimate]').click();
  await new Promise(setImmediate);
  doc.querySelector('[data-quote-project]').click();
  choose(doc, '[data-simulator-product]', 'vehicle-wrap');
  resolveSession(response({ authenticated: true }));
  await new Promise(setImmediate);
  assert.equal(JSON.parse(stored[0][1]).productId, 'sign-rect');
});
