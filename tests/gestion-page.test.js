const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createDom } = require('./dom');
const tick = () => new Promise(setImmediate);

test('jefe puede tomar un trabajo, marcarlo listo y confirmar la entrega desde la pantalla', async () => {
  const { initWorkPage } = await import('../js/gestion.js');
  const doc = createDom(readFileSync('gestion.html', 'utf8')).window.document;
  const transitions = [];
  let current = { id: 'q1', code: 'COT-1', status: 'invoiced', items: [], events: [] };
  initWorkPage(doc, async (url, options) => {
    if (url === '/api/auth/session') return new Response(JSON.stringify({ authenticated: true, user: { role: 'jefe' } }));
    if (options?.method === 'POST') {
      const { status } = JSON.parse(options.body);
      transitions.push(status);
      current = { ...current, status, events: [...current.events, { status, effectiveRole: 'jefe', createdAt: Date.now() }] };
      return new Response(JSON.stringify(current));
    }
    return new Response(JSON.stringify([current]));
  });
  await tick();
  assert.equal(doc.querySelector('[data-work-transition]').textContent, 'Tomar trabajo');
  for (const [nextLabel, expectedStatus] of [['Marcar lista', 'in_production'], ['Confirmar entrega', 'ready']]) {
    doc.querySelector('[data-work-transition]').click();
    await tick();
    assert.equal(doc.querySelector('[data-work-transition]').textContent, nextLabel);
    assert.equal(current.status, expectedStatus);
  }
  doc.querySelector('[data-work-transition]').click();
  await tick();
  assert.deepEqual(transitions, ['in_production', 'ready', 'delivered']);
  assert.equal(doc.querySelectorAll('[data-work-card]').length, 0);
});

for (const [role, initial, next] of [['jefe', 'in_review', 'accepted'], ['trabajador', 'invoiced', 'ready']]) {
  test(`${role} puede avanzar el trabajo`, async () => {
    const { initWorkPage } = await import('../js/gestion.js');
    const doc = createDom(readFileSync('gestion.html', 'utf8')).window.document;
    const calls = [];
    initWorkPage(doc, async (url, options) => {
      calls.push([url, options]);
      let body;
      if (url === '/api/auth/session') body = { authenticated: true, user: { role } };
      else if (options?.method === 'POST') body = { id: 'q1', code: 'COT-1', status: next, items: [], events: [{ status: next, effectiveRole: role, createdAt: '2026-09-06' }] };
      else body = [{ id: 'q1', code: 'COT-1', status: initial, items: [], events: [] }];
      return new Response(JSON.stringify(body));
    });
    await tick();
    assert.equal(doc.querySelector('[data-worker-select]'), null);
    doc.querySelector('[data-work-transition]').click();
    await tick();
    const posted = calls.find(([, options]) => options?.method === 'POST');
    assert.equal(posted[0], '/api/work/quotes/q1/transition');
    assert.deepEqual(JSON.parse(posted[1].body), { status: next });
    assert.match(doc.querySelector('[data-work-list]').textContent, role === 'jefe' ? /Aceptada/ : /Lista/);
    assert.equal(doc.querySelectorAll('[data-work-events] li').length, role === 'trabajador' ? 1 : 0);
  });
}

test('jefe adjunta el archivo, revisa sus datos y confirma antes de facturar', async () => {
  const { initWorkPage } = await import('../js/gestion.js');
  const doc = createDom(readFileSync('gestion.html', 'utf8')).window.document;
  const calls = [];
  initWorkPage(doc, async (url, options) => {
    if (url === '/api/auth/session') return new Response(JSON.stringify({ authenticated: true, user: { role: 'jefe' } }));
    if (url.endsWith('/preview')) return new Response(JSON.stringify({ filename: 'factura.xml', metadata: { number: '123', issueDate: '2024-10-26', total: 11900, issuerRut: '76000000-0', receiverRut: '11111111-1', receiverName: 'Ana' } }));
    if (options?.method === 'POST') {
      calls.push(options.body);
      return new Response(JSON.stringify({ id: 'q1', code: 'COT-1', status: 'invoiced', invoiceNumber: '123', invoice: { filename: 'factura.xml', issueDate: '2024-10-26', total: 11900 }, invoicedAt: Date.UTC(2026, 8, 20), paymentDueAt: Date.UTC(2026, 9, 20), items: [], events: [] }));
    }
    return new Response(JSON.stringify([{ id: 'q1', code: 'COT-1', status: 'accepted', items: [], events: [] }]));
  });
  await tick();
  assert.equal(doc.querySelector('[data-work-transition]'), null);
  assert.equal(doc.querySelector('.invoice-attachment form').hidden, true);
  const picker = doc.querySelector('[data-invoice-file]');
  Object.defineProperty(picker, 'files', { value: [new doc.defaultView.File(['xml'], 'factura.xml', { type: 'application/xml' })] });
  picker.dispatchEvent(new doc.defaultView.Event('change'));
  await tick();
  assert.equal(calls.length, 0);
  assert.equal(doc.querySelector('[name="number"]').value, '123');
  assert.equal(doc.querySelector('[name="issueDate"]').value, '2024-10-26');
  doc.querySelector('[data-invoice-confirm]').click();
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].get('invoice').name, 'factura.xml');
  assert.equal(calls[0].get('number'), '123');
  assert.equal(doc.querySelector('[data-work-transition]').textContent, 'Tomar trabajo');
  assert.equal(doc.querySelector('a[download]').getAttribute('href'), '/api/work/quotes/q1/invoice');
  assert.match(doc.querySelector('[data-work-list]').textContent, /Facturada/);
  assert.match(doc.querySelector('[data-work-list]').textContent, /Trabajo en marcha/);
  assert.ok(doc.querySelector('[data-work-list]').textContent.includes(new Date(Date.UTC(2026, 9, 20)).toLocaleDateString('es-CL')));
});

test('el historial visible muestra solo las horas de facturación y término', async () => {
  const { initWorkPage } = await import('../js/gestion.js');
  const doc = createDom(readFileSync('gestion.html', 'utf8')).window.document;
  initWorkPage(doc, async (url) => new Response(JSON.stringify(url === '/api/auth/session'
    ? { authenticated: true, user: { role: 'jefe' } }
    : [{ id: 'q1', code: 'COT-1', status: 'ready', invoiceNumber: 'F-1',
      invoicedAt: Date.UTC(2026, 8, 20, 12), paymentDueAt: Date.UTC(2026, 9, 20, 12),
      items: [], events: [
        { status: 'in_review', createdAt: 1 }, { status: 'accepted', createdAt: 2 },
        { status: 'invoiced', createdAt: Date.UTC(2026, 8, 20, 12) },
        { status: 'ready', createdAt: Date.UTC(2026, 8, 21, 18) },
      ] }] )));
  await tick();
  const entries = [...doc.querySelectorAll('[data-work-events] li')].map(entry => entry.textContent);
  assert.equal(entries.length, 2);
  assert.match(entries[0], /^Facturada:/);
  assert.match(entries[1], /^Trabajo terminado:/);
  assert.equal(entries.some(entry => /En revisión|Aceptada/.test(entry)), false);
});

test('al confirmar entrega sale del listado activo y muestra el acceso al archivo', async () => {
  const { initWorkPage } = await import('../js/gestion.js');
  const doc = createDom(readFileSync('gestion.html', 'utf8')).window.document;
  initWorkPage(doc, async (url, options) => new Response(JSON.stringify(url === '/api/auth/session'
    ? { authenticated: true, user: { role: 'jefe' } }
    : options?.method === 'POST'
      ? { id: 'q1', code: 'COT-1', status: 'delivered', items: [], events: [] }
      : [{ id: 'q1', code: 'COT-1', status: 'ready', items: [], events: [] }])));
  await tick();
  assert.equal(doc.querySelector('[data-invoice-archive]').hidden, false);
  doc.querySelector('[data-work-transition]').click();
  await tick();
  assert.equal(doc.querySelectorAll('[data-work-card]').length, 0);
  assert.match(doc.querySelector('[data-work-status]').textContent, /Facturas realizadas/);
});
