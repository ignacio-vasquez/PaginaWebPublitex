const test = require('node:test');
const assert = require('node:assert/strict');
const { createDom } = require('./dom');

test('la página de acceso realiza una sola consulta inicial de sesión', async () => {
  const dom = createDom(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'acceso.html'), 'utf8'));
  const originalDocument = global.document;
  const originalFetch = global.fetch;
  let sessionRequests = 0;
  global.document = dom.window.document;
  global.fetch = async (url) => {
    if (url === '/api/auth/session') sessionRequests += 1;
    return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
  };

  try {
    await import(`../js/app.js?access-session-${Date.now()}`);
    await new Promise(setImmediate);
    assert.equal(sessionRequests, 1);
  } finally {
    global.document = originalDocument;
    global.fetch = originalFetch;
  }
});

test('cambia Ingresar a Mi cuenta solo con una sesión autenticada', async () => {
  const { initSessionNavigation } = await import('../js/sesion-navegacion.js');
  const authenticatedDom = createDom('<a data-session-link href="acceso.html">Ingresar</a>');
  const calls = [];
  initSessionNavigation(authenticatedDom.window.document, async (url, options) => {
    calls.push([url, options]);
    return new Response(JSON.stringify({ authenticated: true, user: { name: 'Ana' } }), { status: 200 });
  });
  await new Promise(setImmediate);
  assert.equal(authenticatedDom.window.document.querySelector('[data-session-link]').textContent, 'Mi cuenta');
  assert.equal(authenticatedDom.window.document.querySelector('[data-session-link]').getAttribute('href'), 'acceso.html');
  assert.equal(calls[0][0], '/api/auth/session');
  assert.equal(calls[0][1].credentials, 'same-origin');

  const anonymousDom = createDom('<a data-session-link href="acceso.html">Ingresar</a>');
  initSessionNavigation(anonymousDom.window.document, async () => new Response(JSON.stringify({ authenticated: false }), { status: 200 }));
  await new Promise(setImmediate);
  assert.equal(anonymousDom.window.document.querySelector('[data-session-link]').textContent, 'Ingresar');
});


test('las acciones cambian entre simulación pública y cotización con sesión', async () => {
  const { initSessionNavigation } = await import('../js/sesion-navegacion.js');
  for (const authenticated of [false, true]) {
    const dom = createDom(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8'));
    initSessionNavigation(dom.window.document, async () => new Response(JSON.stringify({ authenticated })));
    await new Promise(setImmediate);
    const actions = [...dom.window.document.querySelectorAll('[data-project-link]')];
  assert.ok(actions.length >= 1);
    for (const action of actions) {
      assert.equal(action.textContent, authenticated ? 'Cotizar proyecto' : 'Simular proyecto');
      assert.equal(action.getAttribute('href'), authenticated ? 'cotizacion.html' : 'index.html#cotizacion');
    }
    assert.equal(dom.window.document.querySelector('[data-quote-project]').hidden, !authenticated);
  }
});
