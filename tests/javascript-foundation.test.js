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
  const quoteForm = loadHomepage().match(/<form\b[^>]*data-quote-form[^>]*>[\s\S]*?<\/form>/i)?.[0] ?? '';

  for (const fileName of readdirSync(scriptsDirectory).filter((fileName) => fileName.endsWith('.js'))) {
    const source = readFileSync(join(scriptsDirectory, fileName), 'utf8');
    assert.doesNotMatch(source, /(fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie)/);
  }
  assert.match(quoteForm, /\baction="#"/i);
});
