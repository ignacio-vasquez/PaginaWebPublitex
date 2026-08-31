const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readdirSync, readFileSync } = require('node:fs');
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

test('los módulos JavaScript no referencian APIs de red ni almacenamiento', () => {
  const scriptsDirectory = join(__dirname, '..', 'js');
  const html = loadHomepage();

  for (const fileName of readdirSync(scriptsDirectory).filter((fileName) => fileName.endsWith('.js'))) {
    const source = readFileSync(join(scriptsDirectory, fileName), 'utf8');
    assert.doesNotMatch(source, /(fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie)/);
  }
  assert.doesNotMatch(html, /<form\b[^>]*data-quote-form/i);
  assert.match(html, /<div\b[^>]*data-quote-form[^>]*role="form"/i);
  assert.match(html, /<button\b[^>]*type="button"[^>]*data-submit-quote/i);
});

test('renderiza solicitudes sin innerHTML', () => {
  for (const fileName of ['formulario.js', 'solicitudes.js']) {
    const source = readFileSync(join(__dirname, '..', 'js', fileName), 'utf8');
    assert.doesNotMatch(source, /innerHTML/);
  }
});
