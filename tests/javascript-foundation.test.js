const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { loadHomepage } = require('./html');

test('carga un módulo JavaScript local al final del body', () => {
  const html = loadHomepage();
  assert.match(html, /<script\b[^>]*type="module"[^>]*src="js\/app\.js"[^>]*><\/script>\s*<\/body>/i);
  assert.equal(existsSync(join(__dirname, '..', 'js', 'app.js')), true);
});

test('la aplicación coordina módulos de responsabilidades separadas', () => {
  const source = readFileSync(join(__dirname, '..', 'js', 'app.js'), 'utf8');
  for (const moduleName of ['menu', 'navegacion', 'portafolio', 'formulario']) {
    assert.match(source, new RegExp(`from ['"]\\./${moduleName}\\.js['"]`));
  }
});

test('el formulario no referencia APIs de red ni almacenamiento', () => {
  const formSource = readFileSync(join(__dirname, '..', 'js', 'formulario.js'), 'utf8');
  const messageSource = readFileSync(join(__dirname, '..', 'js', 'mensajes.js'), 'utf8');
  const quoteForm = loadHomepage().match(/<form\b[^>]*data-quote-form[^>]*>[\s\S]*?<\/form>/i)?.[0] ?? '';

  for (const source of [formSource, messageSource]) {
    assert.doesNotMatch(source, /\bfetch\b|\bXMLHttpRequest\b|\bsendBeacon\b|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|document\.cookie/);
  }
  assert.match(quoteForm, /\baction="#"/i);
});
