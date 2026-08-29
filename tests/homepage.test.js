const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHomepage, hasElement } = require('./html');

test('define un documento HTML en español con estructura semántica', () => {
  const html = loadHomepage();

  assert.match(html, /^<!doctype html>/i);
  assert.equal(hasElement(html, 'html', 'lang="es"'), true);
  assert.equal(hasElement(html, 'meta', 'name="viewport"'), true);
  assert.equal(hasElement(html, 'header'), true);
  assert.equal(hasElement(html, 'main'), true);
  assert.equal(hasElement(html, 'footer'), true);
  assert.match(html, /<title>[^<]+<\/title>/i);
});

test('ofrece navegación interna hacia todas las secciones públicas', () => {
  const html = loadHomepage();
  const destinations = ['#inicio', '#servicios', '#trabajos', '#empresa', '#contacto'];

  for (const destination of destinations) {
    assert.match(html, new RegExp(`href="${destination}"`, 'i'));
  }
});

test('presenta el servicio y dos acciones principales', () => {
  const html = loadHomepage();

  assert.match(html, /Hacemos que tu negocio destaque/i);
  assert.match(html, /Letreros luminosos, rotulación vehicular y soluciones adhesivas/i);
  assert.match(html, /href="#cotizacion"[^>]*>\s*Solicitar cotización/i);
  assert.match(html, /href="#trabajos"[^>]*>\s*Ver nuestros trabajos/i);
});
