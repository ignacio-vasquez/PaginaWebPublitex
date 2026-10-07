const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('muestra el formulario de cotización cuando el cliente tiene una sesión activa', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <div data-simulator data-quotation hidden></div>
    <p data-quotation-status>Comprobando sesión…</p>
  </body>`);
  const { initQuotationAccess } = await import(`../js/cotizacion-acceso.js?${Math.random()}`);
  const page = initQuotationAccess(dom.window.document, async () => ({
    ok: true,
    json: async () => ({ authenticated: true, user: { role: 'cliente' } }),
  }));

  await page.ready;

  assert.equal(dom.window.document.querySelector('[data-simulator]').hidden, false);
  assert.equal(dom.window.document.querySelector('[data-quotation-status]').textContent, '');
});
