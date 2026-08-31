const test = require('node:test');
const assert = require('node:assert/strict');
const { createDom } = require('./dom');

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
