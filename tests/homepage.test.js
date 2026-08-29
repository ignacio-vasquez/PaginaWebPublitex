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

test('describe los tres servicios principales en artículos', () => {
  const html = loadHomepage();
  const services = ['Letreros luminosos', 'Rotulación vehicular', 'Adhesivos y gráficas'];

  assert.equal(hasElement(html, 'section', 'id="servicios"'), true);
  assert.equal((html.match(/<article\b/gi) || []).length >= 3, true);
  for (const service of services) assert.match(html, new RegExp(service, 'i'));
});

test('explica el proceso mediante una lista ordenada', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="proceso"'), true);
  assert.equal(hasElement(html, 'ol'), true);
  for (const step of ['Idea y medidas', 'Diseño', 'Fabricación', 'Instalación']) {
    assert.match(html, new RegExp(step, 'i'));
  }
});

test('incluye un portafolio preparado para fotografías reales', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="trabajos"'), true);
  assert.equal((html.match(/<figure\b/gi) || []).length, 3);
  assert.equal((html.match(/<img\b[^>]*alt="[^"]+"/gi) || []).length, 3);
});

test('presenta a la empresa sin inventar cifras ni certificaciones', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="empresa"'), true);
  assert.match(html, /diseño, fabricación e instalación/i);
  assert.doesNotMatch(html, /años de experiencia|clientes satisfechos|certificad[oa]/i);
});

test('solicita los datos mínimos para preparar una cotización', () => {
  const html = loadHomepage();
  const fields = ['nombre', 'empresa-cliente', 'telefono', 'correo', 'servicio', 'descripcion'];

  assert.equal(hasElement(html, 'section', 'id="cotizacion"'), true);
  assert.equal(hasElement(html, 'form', 'method="post"'), true);
  for (const field of fields) {
    assert.match(html, new RegExp(`(?:id|name)="${field}"`, 'i'));
    assert.match(html, new RegExp(`for="${field}"`, 'i'));
  }
  assert.equal((html.match(/\brequired\b/gi) || []).length >= 5, true);
});

test('incluye contacto y navegación complementaria en el pie', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="contacto"'), true);
  assert.match(html, /Datos definitivos pendientes/i);
  assert.match(html, /<footer>[\s\S]*href="#inicio"/i);
});

test('usa identificadores únicos y un solo título principal', () => {
  const html = loadHomepage();
  const ids = [...html.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
});

test('no incorpora tecnologías reservadas para etapas posteriores', () => {
  const html = loadHomepage();

  assert.doesNotMatch(html, /<style\b|<script\b|style="/i);
  assert.equal(html.includes('{{'), false);
});
