const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('ofrece una página dedicada para editar un presupuesto', () => {
  const html = readFileSync(join(__dirname, '..', 'presupuesto.html'), 'utf8');
  assert.match(html, /data-quote-editor/);
  assert.match(html, /data-add-item/);
});
