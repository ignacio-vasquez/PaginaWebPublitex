const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createDom } = require('./dom');

function loadAccessPage() {
  return readFileSync(join(__dirname, '..', 'acceso.html'), 'utf8');
}

function accessDom() {
  return createDom(loadAccessPage());
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('presenta una página de acceso accesible con formularios y perfil oculto', () => {
  const html = loadAccessPage();
  const dom = accessDom();
  const documentRoot = dom.window.document;

  assert.match(html, /<title>[^<]*acceso[^<]*<\/title>/i);
  assert.match(documentRoot.body.textContent, /¿Ya eres cliente o quieres gestionar tus proyectos\?/);
  assert.match(documentRoot.body.textContent, /Inicia sesión o crea una cuenta para consultar tus cotizaciones, seguir tus trabajos y mantener tus datos organizados\./);
  assert.ok(documentRoot.querySelector('[data-auth-view]'));
  assert.ok(documentRoot.querySelector('[data-login-form]'));
  assert.ok(documentRoot.querySelector('[data-register-form]'));
  assert.ok(documentRoot.querySelector('[data-account-view]'));
  assert.ok(documentRoot.querySelector('[data-logout]'));

  for (const selector of ['[data-login-form] label', '[data-register-form] label']) {
    assert.ok(documentRoot.querySelectorAll(selector).length >= 2, `labels visibles en ${selector}`);
  }
  assert.equal(documentRoot.querySelector('[data-register-form] [name="register-name"]').autocomplete, 'name');
  assert.equal(documentRoot.querySelector('[data-register-form] [name="register-email"]').autocomplete, 'email');
  assert.equal(documentRoot.querySelector('[data-login-form] [name="login-password"]').autocomplete, 'current-password');
  assert.equal(documentRoot.querySelector('[data-register-form] [name="register-password"]').autocomplete, 'new-password');

  const status = documentRoot.querySelector('[data-auth-status]');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(documentRoot.querySelector('[data-account-view]').hidden, true);
});

test('registro exitoso limpia contraseñas y muestra el perfil', async () => {
  const dom = accessDom();
  const { initAccessPage } = await import('../js/acceso.js');
  const calls = [];
  const api = async (url, options) => {
    calls.push([url, options]);
    return response({
      user: { id: 'u1', name: 'Ignacio', email: 'ignacio@example.com', role: 'cliente' },
    }, 201);
  };
  initAccessPage(dom.window.document, api);
  const form = dom.window.document.querySelector('[data-register-form]');
  form.elements['register-name'].value = 'Ignacio';
  form.elements['register-email'].value = 'ignacio@example.com';
  form.elements['register-password'].value = 'secreto1';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(setImmediate);

  const registrationCall = calls.find(([url]) => url === '/api/auth/register');
  assert.ok(registrationCall);
  assert.equal(registrationCall[1].credentials, 'same-origin');
  assert.equal(form.elements['register-password'].value, '');
  assert.equal(dom.window.document.querySelector('[data-login-form] [type="password"]').value, '');
  assert.equal(dom.window.document.querySelector('[data-account-view]').hidden, false);
  assert.match(dom.window.document.querySelector('[data-account-view]').textContent, /Ignacio/);
  assert.match(dom.window.document.querySelector('[data-account-view]').textContent, /Cliente/);
});

test('muestra el error de acceso y mueve el foco al estado', async () => {
  const dom = accessDom();
  const { initAccessPage } = await import('../js/acceso.js');
  initAccessPage(dom.window.document, async () => response({ error: 'Correo o contraseña incorrectos.' }, 401));
  const form = dom.window.document.querySelector('[data-login-form]');
  form.elements['login-email'].value = 'nadie@example.com';
  form.elements['login-password'].value = 'secreto1';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(setImmediate);

  const status = dom.window.document.querySelector('[data-auth-status]');
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /Correo o contraseña incorrectos/);
  assert.equal(dom.window.document.activeElement, status);
  assert.equal(form.elements['login-password'].value, '');
});

test('login exitoso muestra la cuenta y envía credenciales como JSON', async () => {
  const dom = accessDom();
  const { initAccessPage } = await import('../js/acceso.js');
  const calls = [];
  initAccessPage(dom.window.document, async (url, options) => {
    calls.push([url, options]);
    if (url === '/api/auth/session') return response({ authenticated: false });
    return response({ user: { id: 'u1', name: 'Luis', email: 'luis@example.com', role: 'trabajador' } });
  });
  const form = dom.window.document.querySelector('[data-login-form]');
  form.elements['login-email'].value = 'luis@example.com';
  form.elements['login-password'].value = 'secreto1';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(setImmediate);

  const loginCall = calls.find(([url]) => url === '/api/auth/login');
  assert.equal(loginCall[1].method, 'POST');
  assert.deepEqual(JSON.parse(loginCall[1].body), { email: 'luis@example.com', password: 'secreto1' });
  assert.equal(dom.window.document.querySelector('[data-account-view]').hidden, false);
  assert.match(dom.window.document.querySelector('[data-account-role]').textContent, /Trabajador/);
});

test('muestra una sesión existente al cargar y permite cerrarla', async () => {
  const dom = accessDom();
  const { initAccessPage } = await import('../js/acceso.js');
  const calls = [];
  const api = async (url, options) => {
    calls.push([url, options]);
    if (url === '/api/auth/session') {
      return response({ authenticated: true, user: { id: 'u1', name: 'Ana', email: 'ana@example.com', role: 'jefe' } });
    }
    return new Response(null, { status: 204 });
  };
  initAccessPage(dom.window.document, api);
  await new Promise(setImmediate);
  assert.equal(dom.window.document.querySelector('[data-account-view]').hidden, false);
  assert.match(dom.window.document.querySelector('[data-account-view]').textContent, /Ana/);

  dom.window.document.querySelector('[data-logout]').click();
  await new Promise(setImmediate);
  assert.equal(calls.at(-1)[0], '/api/auth/logout');
  assert.equal(calls.at(-1)[1].credentials, 'same-origin');
  assert.equal(dom.window.document.querySelector('[data-account-view]').hidden, true);
  assert.equal(dom.window.document.querySelector('[data-auth-view]').hidden, false);
});

test('renderiza datos recibidos de la API como texto', async () => {
  const dom = accessDom();
  const { initAccessPage } = await import('../js/acceso.js');
  initAccessPage(dom.window.document, async () => response({
    user: { id: 'u1', name: '<img src=x onerror=alert(1)>', email: 'x@example.com', role: 'cliente' },
  }, 201));
  const form = dom.window.document.querySelector('[data-register-form]');
  form.elements['register-name'].value = 'X';
  form.elements['register-email'].value = 'x@example.com';
  form.elements['register-password'].value = 'secreto1';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(setImmediate);

  assert.equal(dom.window.document.querySelector('[data-account-view] img'), null);
  assert.match(dom.window.document.querySelector('[data-account-view]').textContent, /<img src=x/);
});
