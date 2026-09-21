const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createDom } = require('./dom');
const tick = () => new Promise(setImmediate);

test('el acceso Superadmin abre el panel y muestra a quién se está representando', async () => {
  const { renderSessionNavigation } = await import('../js/sesion-navegacion.js');
  const doc = createDom('<header><nav><a data-session-link></a><a data-project-link></a></nav></header>').window.document;
  const session = {
    authenticated: true,
    realUser: { id: 'admin', name: 'Ignacio', role: 'superadmin' },
    user: { id: 'boss', name: 'Marcelo Velis', role: 'jefe' },
    simulation: { role: 'jefe', targetUserId: 'boss' },
  };
  renderSessionNavigation(doc, true, session);
  assert.equal(doc.querySelector('[data-superadmin-controls] a').getAttribute('href'), 'superadmin.html');
  assert.match(doc.querySelector('[data-simulation-banner]').textContent, /Marcelo Velis/);
  assert.equal(doc.querySelector('[data-simulation-banner] a').getAttribute('href'), 'superadmin.html');
  renderSessionNavigation(doc, false);
  assert.equal(doc.querySelector('[data-superadmin-controls]'), null);
});

test('panel separa funcionarios y clientes y actúa como la persona seleccionada', async () => {
  const { initSuperadminPanel } = await import('../js/superadmin-panel.js');
  const doc = createDom(readFileSync('superadmin.html', 'utf8')).window.document;
  const destinations = [];
  const calls = [];
  const session = { authenticated: true, user: { id: 'admin', name: 'Ignacio', role: 'superadmin' }, realUser: { id: 'admin', role: 'superadmin' } };
  initSuperadminPanel(doc, async (url, options) => {
    calls.push([url, options]);
    if (url === '/api/auth/session') return new Response(JSON.stringify(session));
    if (url === '/api/superadmin/actors') return new Response(JSON.stringify({
      staff: [{ id: 'boss', name: 'Marcelo Velis', email: 'marcelo@example.com', role: 'jefe' }, { id: 'worker', name: 'Marcos Velis', email: 'marcos@example.com', role: 'trabajador' }],
      clients: [{ id: 'client', name: 'Ana', email: 'ana@example.com', role: 'cliente' }],
    }));
    return new Response(JSON.stringify({ user: { role: options.body.includes('client') ? 'cliente' : 'jefe' } }));
  }, url => destinations.push(url));
  await tick();
  assert.deepEqual([...doc.querySelectorAll('[data-actor-row] h2')].map(node => node.textContent), ['Marcelo Velis', 'Marcos Velis']);
  doc.querySelector('[data-actor-tab="clients"]').click();
  assert.deepEqual([...doc.querySelectorAll('[data-actor-row] h2')].map(node => node.textContent), ['Ana']);
  doc.querySelector('[data-act-as="client"]').click();
  await tick();
  assert.deepEqual(JSON.parse(calls.find(([url]) => url === '/api/superadmin/act-as')[1].body), { targetUserId: 'client' });
  assert.deepEqual(destinations, ['cotizaciones.html']);
});

test('funcionarios normales no ven acceso Superadmin', async () => {
  const { renderSessionNavigation } = await import('../js/sesion-navegacion.js');
  const doc = createDom('<header><nav><a data-session-link></a><a data-project-link></a></nav></header>').window.document;
  renderSessionNavigation(doc, true, { user: { role: 'trabajador' } });
  assert.equal(doc.querySelector('[data-superadmin-controls]'), null);
  assert.equal(doc.querySelector('[data-project-link]').getAttribute('href'), 'gestion.html');
});
