const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createDom } = require('./dom');
const tick = () => new Promise(setImmediate);

test('archivo muestra años desde 2005, ordena por factura y busca fecha en español', async () => {
  const { initInvoiceArchive } = await import('../js/facturas.js');
  const doc = createDom(readFileSync('facturas.html', 'utf8')).window.document;
  const first = new Date(2026, 8, 1, 12).getTime();
  const older = new Date(2026, 7, 20, 12).getTime();
  const records = [
    { id: 'old', code: 'COT-000001', invoiceNumber: 'F-1', status: 'delivered', invoicedAt: older, createdAt: older, clientName: 'Ana', items: [], events: [] },
    { id: 'new', code: 'COT-000002', invoiceNumber: 'F-2', status: 'delivered', invoicedAt: first, createdAt: first, clientName: 'Luis', clientEmail: 'luis@example.com', company: 'Taller Luis', phone: '912345678', estimatedTotal: 20000,
      items: [{ productLabel: 'Letrero', materialLabel: 'Acrílico', sizeLabel: 'Grande', quantityLabel: '2', observation: 'Frente azul', extras: [{ label: 'Instalación' }] }],
      events: [{ status: 'ready', createdAt: first + 3600000 }, { status: 'delivered', createdAt: first + 7200000 }] },
  ];
  initInvoiceArchive(doc, async url => new Response(JSON.stringify(url === '/api/auth/session'
    ? { authenticated: true, user: { role: 'jefe' } } : records)));
  await tick();
  assert.equal(doc.querySelector('[data-invoice-year="2005"]')?.textContent, '2005 (0)');
  assert.equal(doc.querySelector('[data-invoice-year="2026"]')?.textContent, '2026 (2)');
  assert.deepEqual([...doc.querySelectorAll('[data-invoice-card] summary')].map(node => node.textContent.split(' · ')[0]), ['F-2', 'F-1']);
  const search = doc.querySelector('[data-invoice-search]');
  search.value = '01 sept 2026';
  search.dispatchEvent(new doc.defaultView.Event('input'));
  assert.equal(doc.querySelectorAll('[data-invoice-card]').length, 1);
  assert.match(doc.querySelector('[data-invoice-card]').textContent, /Luis.*Letrero.*Acrílico.*Instalación/);
  doc.querySelector('[data-invoice-year="2005"]').click();
  assert.match(doc.querySelector('[data-invoice-list]').textContent, /No hay facturas/);
});

test('el archivo no muestra facturas al trabajador', async () => {
  const { initInvoiceArchive } = await import('../js/facturas.js');
  const doc = createDom(readFileSync('facturas.html', 'utf8')).window.document;
  const calls = [];
  initInvoiceArchive(doc, async url => {
    calls.push(url);
    return new Response(JSON.stringify({ authenticated: true, user: { role: 'trabajador' } }));
  });
  await tick();
  assert.deepEqual(calls, ['/api/auth/session']);
  assert.equal(doc.querySelector('[data-invoice-content]').hidden, true);
});

test('clasifica y busca por fecha del documento aunque la carga ocurra en otro año', async () => {
  const { initInvoiceArchive } = await import('../js/facturas.js');
  const doc = createDom(readFileSync('facturas.html', 'utf8')).window.document;
  const record = { id: 'q', code: 'COT-000001', status: 'delivered', invoiceNumber: '23',
    invoicedAt: Date.UTC(2026, 8, 26), createdAt: Date.UTC(2026, 8, 20), items: [], events: [],
    invoice: { issueDate: '2024-10-26', total: 11900, filename: 'factura.xml', receiverName: 'Ana', receiverRut: '11111111-1' } };
  initInvoiceArchive(doc, async url => new Response(JSON.stringify(url === '/api/auth/session'
    ? { authenticated: true, user: { role: 'jefe' } } : [record])));
  await tick();
  assert.equal(doc.querySelector('[data-invoice-year="2024"]').textContent, '2024 (1)');
  assert.equal(doc.querySelector('[data-invoice-year="2026"]').textContent, '2026 (0)');
  doc.querySelector('[data-invoice-year="2024"]').click();
  const search = doc.querySelector('[data-invoice-search]');
  search.value = '26-10-2024';
  search.dispatchEvent(new doc.defaultView.Event('input'));
  assert.equal(doc.querySelectorAll('[data-invoice-card]').length, 1);
  assert.equal(doc.querySelector('a[download]').getAttribute('href'), '/api/work/quotes/q/invoice');
  assert.match(doc.querySelector('[data-invoice-list]').textContent, /Total facturado/);
});

test('archive shows and searches work name alongside the permanent code', async () => {
  const { initInvoiceArchive } = await import('../js/facturas.js');
  const doc = createDom(readFileSync('facturas.html', 'utf8')).window.document;
  const record = { id: 'named', code: 'COT-000091', workName: 'Letrero Medialuna', invoiceNumber: '91',
    status: 'delivered', invoicedAt: Date.UTC(2026, 8, 1), createdAt: Date.UTC(2026, 8, 1),
    invoice: { issueDate: '2026-09-01', total: 1000, filename: 'oficial.pdf' }, items: [], events: [] };
  initInvoiceArchive(doc, async (url) => new Response(JSON.stringify(url === '/api/auth/session'
    ? { authenticated: true, user: { role: 'jefe' } } : [record])));
  await tick();
  assert.match(doc.querySelector('[data-invoice-card] summary').textContent, /Letrero Medialuna.*COT-000091/);
  const search = doc.querySelector('[data-invoice-search]');
  search.value = 'medialúna';
  search.dispatchEvent(new doc.defaultView.Event('input'));
  assert.equal(doc.querySelectorAll('[data-invoice-card]').length, 1);
  assert.match(doc.querySelector('[data-invoice-card]').textContent, /Letrero Medialuna/);
});

test('delivered archive keeps work attachments available to jefe after delivery', async () => {
  const { initInvoiceArchive } = await import('../js/facturas.js');
  const doc = createDom(readFileSync('facturas.html', 'utf8')).window.document;
  const record = { id: 'delivered', code: 'COT-000092', workName: 'Trabajo entregado', invoiceNumber: '92', status: 'delivered',
    invoicedAt: Date.UTC(2026, 8, 1), createdAt: Date.UTC(2026, 8, 1), invoice: { issueDate: '2026-09-01', total: 1000 }, items: [], events: [] };
  const calls = [];
  initInvoiceArchive(doc, async (url, options = {}) => {
    calls.push([url, options]);
    if (url === '/api/auth/session') return new Response(JSON.stringify({ authenticated: true, user: { role: 'jefe' } }));
    if (url === '/api/work/invoices') return new Response(JSON.stringify([record]));
    if (url.endsWith('/attachments')) return new Response(JSON.stringify([{ kind: 'completion', filename: 'final.jpg', downloadUrl: '/api/quotes/delivered/attachments/completion' }]));
    if (options.method === 'PUT') return new Response(JSON.stringify({ kind: 'completion', filename: 'final.jpg' }));
    return new Response(JSON.stringify([]));
  });
  await tick(); await tick();
  assert.equal(doc.querySelector('[data-invoice-attachments] a').getAttribute('href'), '/api/quotes/delivered/attachments/completion');
  const picker = doc.querySelector('[data-invoice-attachment-upload="completion"] input[type=file]');
  Object.defineProperty(picker, 'files', { configurable: true, value: [new doc.defaultView.File(['jpg'], 'final.jpg')] });
  assert.equal(picker.hidden, true);
  picker.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
  await tick(); await tick();
  assert.ok(calls.some(([url, options]) => url === '/api/quotes/delivered/attachments/completion' && options.method === 'PUT'));
});
