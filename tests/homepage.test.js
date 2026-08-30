const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHomepage, hasElement, assetExists } = require('./html');

test('define un documento HTML en español con estructura semántica', () => {
  const html = loadHomepage();

  assert.match(html, /^<!doctype html>/i);
  assert.equal(hasElement(html, 'html', 'lang="es"'), true);
  assert.equal(hasElement(html, 'meta', 'name="viewport"'), true);
  assert.equal(hasElement(html, 'header'), true);
  assert.equal(hasElement(html, 'main'), true);
  assert.equal(hasElement(html, 'footer'), true);
  assert.match(html, /<title>[^<]+<\/title>/i);
  assert.match(html, /<a\b[^>]*href="#inicio"[^>]*aria-label="Publitexweb, ir al inicio"/i);
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
  const portfolio = html.match(/<section\b[^>]*id="trabajos"[^>]*>[\s\S]*?<\/section>/i)?.[0] ?? '';

  assert.equal(hasElement(html, 'section', 'id="trabajos"'), true);
  assert.equal((portfolio.match(/<figure\b/gi) || []).length, 3);
  assert.equal((portfolio.match(/<img\b[^>]*alt="Imagen provisional de [^"]+"/gi) || []).length, 3);
});

test('usa los medios provisionales accesibles en la presentación y los servicios', () => {
  const html = loadHomepage();
  const hero = html.match(/<section\b[^>]*aria-labelledby="titulo-principal"[^>]*>[\s\S]*?<\/section>/i)?.[0] ?? '';
  const services = html.match(/<section\b[^>]*id="servicios"[^>]*>[\s\S]*?<\/section>/i)?.[0] ?? '';
  const articles = services.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) || [];
  const assetPaths = [
    'assets/trabajo-letrero.svg',
    'assets/trabajo-camion.svg',
    'assets/trabajo-vitrina.svg'
  ];

  assert.match(hero, /<img\b[^>]*src="assets\/trabajo-letrero\.svg"[^>]*alt="[^"]+"/i);
  assert.equal(articles.length, 3);
  for (const [index, assetPath] of assetPaths.entries()) {
    const expectedSource = assetPath.replace('.', '\\.');

    assert.match(articles[index], new RegExp(`<img\\b[^>]*src="${expectedSource}"[^>]*alt="[^"]+"`, 'i'));
    assert.match(html, new RegExp(`src="${expectedSource}"`, 'i'));
    assert.equal(assetExists(assetPath), true);
  }
});

test('presenta a la empresa sin inventar cifras ni certificaciones', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="empresa"'), true);
  assert.match(html, /diseño, fabricación e instalación/i);
  assert.doesNotMatch(html, /años de experiencia|clientes satisfechos|certificad[oa]/i);
});

test('solicita los datos mínimos para preparar una cotización', () => {
  const html = loadHomepage();
  const quoteSection = html.match(/<section\b[^>]*id="cotizacion"[^>]*>[\s\S]*?<\/section>/i)?.[0] ?? '';
  const fields = ['nombre', 'empresa-cliente', 'telefono', 'correo', 'servicio', 'descripcion'];

  assert.equal(hasElement(html, 'section', 'id="cotizacion"'), true);
  assert.doesNotMatch(quoteSection, /<form\b/i);
  assert.match(quoteSection, /<div\b[^>]*data-quote-form[^>]*role="form"/i);
  assert.match(quoteSection, /<button\b[^>]*type="button"[^>]*data-submit-quote/i);
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

test('no incorpora estilos ni JavaScript inline', () => {
  const html = loadHomepage();

  assert.doesNotMatch(html, /<style\b|style="|<script\b(?![^>]*\bsrc="js\/app\.js")/i);
  assert.equal(html.includes('{{'), false);
});
