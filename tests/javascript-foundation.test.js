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
