const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

function loadPage() {
  return readFileSync(join(__dirname, '..', 'cotizaciones.html'), 'utf8');
}

function pageDom() {
  return new JSDOM(loadPage(), { url: 'http://localhost/cotizaciones.html' });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const draft = {
  id: 'quote-1', status: 'draft', phone: '', company: '', estimatedTotal: 79000,
  hasEvaluation: false, createdAt: 1, updatedAt: 1, submittedAt: null,
  items: [
    { id: 'item-1', productId: 'sign-rect', materialId: 'acrylic', sizeId: '100x50', quantityId: 'sign-rect-qty-2', productLabel: 'Letrero rectangular', materialLabel: 'Acrílico', sizeLabel: '100 × 50 cm', quantityLabel: '2 unidades', quantityValue: 2, observation: '', estimatedSubtotal: 64000, requiresEvaluation: false, extras: [] },
    { id: 'item-2', productId: 'sign-rect', materialId: 'pvc-foam', sizeId: '50x30', quantityId: 'sign-rect-qty-1', productLabel: 'Letrero pequeño', materialLabel: 'PVC espumado', sizeLabel: '50 × 30 cm', quantityLabel: '1 unidad', quantityValue: 1, observation: '', estimatedSubtotal: 15000, requiresEvaluation: false, extras: [] },
  ],
};

async function init({ api, storage, url = 'http://localhost/cotizaciones.html' } = {}) {
  const dom = pageDom();
  dom.reconfigure({ url });
  const navigations = [];
  const { initQuotePage } = await import(`../js/cotizaciones.js?test=${Math.random()}`);
  const controller = initQuotePage(dom.window.document, api, storage, (target) => navigations.push(target));
  await controller.ready;
  return { dom, navigations };
}

test('define navegación semántica, editor accesible y confirmación de envío', () => {
  const dom = pageDom();
  const documentRoot = dom.window.document;
  const links = [...documentRoot.querySelectorAll('header nav a')].map((link) => link.textContent.trim());
  assert.deepEqual(links, ['Inicio', 'Mi cuenta', 'Mis cotizaciones']);
  assert.ok(documentRoot.querySelector('[data-quote-list]'));
  assert.equal(documentRoot.querySelector('[data-create-quote]').textContent.trim(), 'Nueva cotización');
  assert.ok(documentRoot.querySelector('[data-quote-editor]'));
  assert.ok(documentRoot.querySelector('label[for="quote-phone"]'));
  assert.ok(documentRoot.querySelector('label[for="quote-company"]'));
  assert.ok(documentRoot.querySelector('[data-add-item]'));
  assert.equal(documentRoot.querySelector('[data-submit-dialog]').getAttribute('aria-modal'), 'true');
  assert.match(documentRoot.body.textContent, /Guardando…|Borrador guardado|Reintentar/);
});

test('redirige una sesión anónima al acceso con retorno seguro', async () => {
  const { navigations } = await init({
    api: async () => json({ authenticated: false }),
    storage: { getItem: () => null },
  });
  assert.deepEqual(navigations, ['acceso.html?returnTo=cotizaciones.html']);
});

test('carga y renderiza dos productos separados, con controles de edición y eliminación', async () => {
  const api = async (url) => {
    if (url === '/api/auth/session') return json({ authenticated: true, user: { id: 'user-1' } });
    if (url === '/api/quotes') return json([draft]);
    throw new Error(url);
  };
  const { dom } = await init({ api, storage: { getItem: () => null } });
  const documentRoot = dom.window.document;
  assert.equal(documentRoot.querySelectorAll('[data-quote-item]').length, 2);
  assert.match(documentRoot.querySelector('[data-quote-items]').textContent, /Letrero rectangular/);
  assert.match(documentRoot.querySelector('[data-quote-items]').textContent, /Letrero pequeño/);
  assert.equal(documentRoot.querySelectorAll('[data-edit-item]').length, 2);
  assert.equal(documentRoot.querySelectorAll('[data-delete-item]').length, 2);
});

test('incorpora el handoff en un borrador y lo elimina solo después del éxito', async () => {
  const calls = [];
  let removed = false;
  const handoff = { productId: 'sign-rect', materialId: 'acrylic', sizeId: '100x50', quantityId: 'sign-rect-qty-2', extraIds: [], observation: 'fachada' };
  const api = async (url, options = {}) => {
    calls.push([url, options]);
    if (url === '/api/auth/session') return json({ authenticated: true, user: { id: 'user-1' } });
    if (url === '/api/quotes' && !options.method) return json([]);
    if (url === '/api/quotes' && options.method === 'POST') return json({ ...draft, items: [] }, 201);
    if (url === '/api/quotes/quote-1/items') return json(draft, 201);
    throw new Error(url);
  };
  const storage = {
    getItem: () => JSON.stringify(handoff),
    removeItem: (key) => { assert.equal(key, 'publitex_quote_handoff_v1'); removed = true; },
  };
  await init({ api, storage });
  assert.deepEqual(JSON.parse(calls.find(([url]) => url.endsWith('/items'))[1].body), handoff);
  assert.equal(removed, true);

  removed = false;
  await init({ api: async (url, options = {}) => {
    if (url === '/api/auth/session') return json({ authenticated: true, user: {} });
    if (url === '/api/quotes' && !options.method) return json([draft]);
    return json({ error: 'El catálogo cambió.' }, 400);
  }, storage });
  assert.equal(removed, false);
});

test('autosave recorta detalles y conserva los valores visibles si falla', async () => {
  const calls = [];
  let failSave = false;
  const api = async (url, options = {}) => {
    if (url === '/api/auth/session') return json({ authenticated: true, user: {} });
    if (url === '/api/quotes') return json([draft]);
    if (options.method === 'PATCH') {
      calls.push(JSON.parse(options.body));
      return failSave ? json({ error: 'Sin conexión.' }, 503) : json({ ...draft, ...JSON.parse(options.body) });
    }
    throw new Error(url);
  };
  const { dom } = await init({ api, storage: { getItem: () => null } });
  const phone = dom.window.document.querySelector('[data-quote-phone]');
  const company = dom.window.document.querySelector('[data-quote-company]');
  phone.value = '  +56 9 1234 5678  ';
  company.value = '  Publitex  ';
  phone.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise(setImmediate);
  assert.deepEqual(calls[0], { phone: '+56 9 1234 5678', company: 'Publitex' });

  failSave = true;
  phone.value = '+56 9 9999 9999';
  phone.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise(setImmediate);
  assert.equal(phone.value, '+56 9 9999 9999');
  assert.equal(dom.window.document.querySelector('[data-save-retry]').hidden, false);
  assert.match(dom.window.document.querySelector('[data-save-status]').textContent, /Sin conexión/);
});

test('la confirmación atrapa el foco, lo restaura y vuelve la cotización de solo lectura', async () => {
  const api = async (url, options = {}) => {
    if (url === '/api/auth/session') return json({ authenticated: true, user: {} });
    if (url === '/api/quotes') return json([{ ...draft, phone: '+56 9 1234 5678' }]);
    if (url.endsWith('/submit')) return json({ ...draft, status: 'submitted', submittedAt: 2 });
    throw new Error(`${options.method} ${url}`);
  };
  const { dom } = await init({ api, storage: { getItem: () => null } });
  const documentRoot = dom.window.document;
  const submit = documentRoot.querySelector('[data-submit-quote]');
  submit.focus();
  submit.click();
  const confirm = documentRoot.querySelector('[data-confirm-submit]');
  const cancel = documentRoot.querySelector('[data-cancel-submit]');
  assert.equal(documentRoot.activeElement, confirm);
  cancel.focus();
  cancel.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  assert.equal(documentRoot.activeElement, confirm);
  confirm.click();
  await new Promise(setImmediate);
  assert.equal(documentRoot.querySelector('[data-quote-editor]').dataset.status, 'submitted');
  assert.equal(documentRoot.querySelector('[data-quote-phone]').disabled, true);
  assert.equal(documentRoot.activeElement, submit);
});


test('indica el teléfono faltante antes de abrir la confirmación', async () => {
  const { dom } = await init({ api: async (url) => {
    if (url === '/api/auth/session') return json({ authenticated: true });
    if (url === '/api/quotes') return json([draft]);
    throw new Error(url);
  } });
  const doc = dom.window.document;
  doc.querySelector('[data-submit-quote]').click();
  assert.equal(doc.querySelector('[data-submit-dialog]').hidden, true);
  assert.equal(doc.activeElement, doc.querySelector('[data-quote-phone]'));
  assert.match(doc.querySelector('[data-quote-page-status]').textContent, /Ingresa un teléfono/);
});

test('espera el autoguardado y evita enviar cuando los detalles no se guardaron', async () => {
  let finishSave;
  let submissions = 0;
  const { dom } = await init({ api: async (url, options = {}) => {
    if (url === '/api/auth/session') return json({ authenticated: true });
    if (url === '/api/quotes') return json([draft]);
    if (options.method === 'PATCH') return new Promise((resolve) => { finishSave = resolve; });
    if (url.endsWith('/submit')) { submissions += 1; return json({ ...draft, status: 'submitted' }); }
    throw new Error(url);
  } });
  const doc = dom.window.document;
  const phone = doc.querySelector('[data-quote-phone]');
  phone.value = '+56 9 1234 5678';
  phone.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise(setImmediate);
  doc.querySelector('[data-submit-quote]').click();
  doc.querySelector('[data-confirm-submit]').click();
  await new Promise(setImmediate);
  assert.equal(submissions, 0);
  finishSave(json({ error: 'El teléfono no es válido.' }, 400));
  await new Promise(setImmediate);
  assert.equal(submissions, 0);
  assert.match(doc.querySelector('[data-quote-page-status]').textContent, /corrige|guardar/i);
  assert.equal(phone.disabled, false);
  assert.equal(doc.querySelector('[data-quote-company]').disabled, false);
});


test('envía un teléfono local válido después de completar el autoguardado pendiente', async () => {
  let finishSave;
  let savedPhone = '';
  let submissions = 0;
  const { dom } = await init({ api: async (url, options = {}) => {
    if (url === '/api/auth/session') return json({ authenticated: true });
    if (url === '/api/quotes') return json([draft]);
    if (options.method === 'PATCH') return new Promise((resolve) => {
      finishSave = () => {
        savedPhone = JSON.parse(options.body).phone;
        resolve(json({ ...draft, phone: savedPhone }));
      };
    });
    if (url.endsWith('/submit')) {
      assert.equal(savedPhone, '912345678');
      submissions += 1;
      return json({ ...draft, phone: savedPhone, status: 'submitted' });
    }
    throw new Error(url);
  } });
  const doc = dom.window.document;
  const phone = doc.querySelector('[data-quote-phone]');
  phone.value = '912345678';
  phone.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise(setImmediate);
  doc.querySelector('[data-submit-quote]').click();
  doc.querySelector('[data-confirm-submit]').click();
  await new Promise(setImmediate);
  assert.equal(submissions, 0);
  finishSave();
  await new Promise(setImmediate);
  assert.equal(submissions, 1);
  assert.equal(doc.querySelector('[data-quote-editor]').dataset.status, 'submitted');
});


test('un error de guardado en otro borrador no bloquea una cotización válida', async () => {
  const other = { ...draft, id: 'quote-2', phone: '912345678' };
  let submittedId;
  const { dom } = await init({ api: async (url, options = {}) => {
    if (url === '/api/auth/session') return json({ authenticated: true });
    if (url === '/api/quotes') return json([draft, other]);
    if (options.method === 'PATCH') return json({ error: 'El teléfono no es válido.' }, 400);
    if (url.endsWith('/submit')) { submittedId = url; return json({ ...other, status: 'submitted' }); }
    throw new Error(url);
  } });
  const doc = dom.window.document;
  const phone = doc.querySelector('[data-quote-phone]');
  phone.value = 'incorrecto';
  phone.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await new Promise(setImmediate);
  doc.querySelector('[data-quote-id="quote-2"] [data-select-quote]').click();
  doc.querySelector('[data-submit-quote]').click();
  doc.querySelector('[data-confirm-submit]').click();
  await new Promise(setImmediate);
  assert.equal(submittedId, '/api/quotes/quote-2/submit');
});


test('el historial identifica cada cotización y Ver estado muestra su progreso real', async () => {
  const sent = { ...draft, id: 'quote-2', code: 'COT-000002', status: 'submitted', createdAt: 2000, submittedAt: 3000 };
  const first = { ...draft, code: 'COT-000001', createdAt: 1000 };
  const { dom } = await init({ api: async (url) => {
    if (url === '/api/auth/session') return json({ authenticated: true });
    if (url === '/api/quotes') return json([first, sent]);
    throw new Error(url);
  } });
  const doc = dom.window.document;
  const entries = [...doc.querySelectorAll('[data-quote-list] > li')];
  assert.match(entries[0].textContent, /COT-000002/);
  assert.match(entries[0].textContent, /Enviada/);
  assert.equal(entries[0].querySelector('time').dateTime, '1970-01-01T00:00:02.000Z');
  entries[0].querySelector('[data-view-quote-status]').click();
  const tracking = doc.querySelector('[data-quote-tracking]');
  assert.equal(tracking.hidden, false);
  assert.match(doc.querySelector('#quote-editor-title').textContent, /COT-000002/);
  assert.equal(tracking.querySelector('[aria-current="step"] [data-step-label]').textContent, 'Enviada');
  const steps = [...tracking.querySelectorAll('[data-step-label]')].map((step) => step.textContent);
  assert.deepEqual(steps, ['Borrador', 'Enviada', 'En revisión', 'Aceptada', 'Facturada', 'Lista', 'Entregada']);
  assert.equal(tracking.querySelectorAll('[data-step-state="pending"]').length, 5);
  assert.equal(doc.activeElement.id, 'quote-tracking-title');
  assert.equal(doc.querySelectorAll('[data-select-quote][aria-current="true"]').length, 1);
  doc.querySelectorAll('[data-view-quote-status]')[1].click();
  assert.equal(tracking.querySelector('[aria-current="step"] [data-step-label]').textContent, 'Borrador');
  assert.match(doc.querySelector('#quote-editor-title').textContent, /COT-000001/);
});

test('el historial vacío explica cómo comenzar sin mostrar estados inventados', async () => {
  const { dom } = await init({ api: async (url) => json(url === '/api/auth/session' ? { authenticated: true } : []) });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-quote-editor]').hidden, true);
  assert.match(doc.querySelector('[data-quote-list]').textContent, /Aún no tienes cotizaciones/);
});
