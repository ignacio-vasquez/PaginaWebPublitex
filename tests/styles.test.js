const test = require('node:test');
const assert = require('node:assert/strict');
const { loadHomepage } = require('./html');
const { loadStylesheet } = require('./css');

test('enlaza la hoja local y define el sistema visual provisional', () => {
  const html = loadHomepage();
  const css = loadStylesheet();

  assert.match(html, /<link\b[^>]*rel="stylesheet"[^>]*href="css\/styles\.css"/i);
  for (const token of ['--color-ink', '--color-accent', '--color-surface', '--color-text', '--content-width']) {
    assert.match(css, new RegExp(`${token}:`));
  }
  assert.match(css, /box-sizing:\s*border-box/i);
  assert.match(css, /font-family:\s*system-ui/i);
});
