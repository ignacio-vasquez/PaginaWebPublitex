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
