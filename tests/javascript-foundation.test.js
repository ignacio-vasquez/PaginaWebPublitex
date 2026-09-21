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
  for (const moduleName of ['menu', 'navegacion', 'portafolio', 'simulador', 'cotizaciones']) {
    assert.match(source, new RegExp(`from ['"]\\./${moduleName}\\.js['"]`));
  }
});

test('solo los flujos de cotización usan red y almacenamiento temporal con contratos acotados', () => {
  const scriptsDirectory = join(__dirname, '..', 'js');
  const html = loadHomepage();
  const allowedNetworkModules = new Set(['simulador.js', 'cotizaciones.js', 'superadmin.js']);

  for (const fileName of readdirSync(scriptsDirectory).filter((fileName) => fileName.endsWith('.js') && !allowedNetworkModules.has(fileName))) {
    const source = readFileSync(join(scriptsDirectory, fileName), 'utf8');
    assert.doesNotMatch(source, /(fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie)/);
  }
  const simulator = readFileSync(join(scriptsDirectory, 'simulador.js'), 'utf8');
  const quotes = readFileSync(join(scriptsDirectory, 'cotizaciones.js'), 'utf8');
  assert.match(simulator, /publitex_quote_handoff_v1/);
  assert.doesNotMatch(simulator, /localStorage|indexedDB|document\.cookie|innerHTML/);
  assert.doesNotMatch(quotes, /localStorage|indexedDB|document\.cookie|innerHTML/);
  assert.doesNotMatch(html, /<form\b[^>]*data-simulator/i);
  assert.match(html, /<div\b[^>]*data-simulator[^>]*role="form"/i);
});

test('renderiza el simulador sin innerHTML', () => {
  const source = readFileSync(join(__dirname, '..', 'js', 'simulador.js'), 'utf8');
  assert.doesNotMatch(source, /innerHTML/);
});
