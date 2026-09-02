const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createDom } = require('./dom');

const html = readFileSync(join(__dirname, '..', 'acceso.html'), 'utf8');

function authResponse(url) {
  if (url === '/api/auth/session') {
    return new Response(JSON.stringify({ authenticated: false }), { status: 200 });
  }
  return new Response(JSON.stringify({
    user: { id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'cliente' },
  }), { status: url.endsWith('/register') ? 201 : 200 });
}

async function submit(kind, search) {
  const dom = createDom(html);
  dom.reconfigure({ url: `http://localhost/acceso.html${search}` });
  const navigations = [];
  const { initAccessPage } = await import(`../js/acceso.js?handoff=${Math.random()}`);
  initAccessPage(dom.window.document, authResponse, dom.window.location, (url) => navigations.push(url));
  const form = dom.window.document.querySelector(`[data-${kind}-form]`);
  if (kind === 'login') {
    form.elements['login-email'].value = 'ana@example.com';
    form.elements['login-password'].value = 'secreto1';
  } else {
    form.elements['register-name'].value = 'Ana';
    form.elements['register-email'].value = 'ana@example.com';
    form.elements['register-password'].value = 'secreto1';
  }
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(setImmediate);
  return navigations;
}

test('login y registro regresan únicamente a cotizaciones.html', async () => {
  assert.deepEqual(await submit('login', '?returnTo=cotizaciones.html'), ['cotizaciones.html']);
  assert.deepEqual(await submit('register', '?returnTo=cotizaciones.html'), ['cotizaciones.html']);
});

test('sin destino permitido permanece en la vista de cuenta', async () => {
  assert.deepEqual(await submit('login', ''), []);
});

test('rechaza redirecciones externas, protocol-relative, traversal y páginas desconocidas', async () => {
  for (const value of [
    'https://evil.example', '//evil.example', '../cotizaciones.html', 'otra.html',
  ]) {
    assert.deepEqual(await submit('login', `?returnTo=${encodeURIComponent(value)}`), [], value);
  }
});
