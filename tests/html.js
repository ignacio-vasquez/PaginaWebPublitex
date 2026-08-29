const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function loadHomepage() {
  return readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
}

function hasElement(html, tag, attributes = '') {
  const expression = new RegExp(`<${tag}\\b[^>]*${attributes}[^>]*>`, 'i');
  return expression.test(html);
}

module.exports = { loadHomepage, hasElement };
