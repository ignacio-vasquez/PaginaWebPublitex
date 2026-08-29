const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function loadStylesheet() {
  return readFileSync(join(__dirname, '..', 'css', 'styles.css'), 'utf8');
}

module.exports = { loadStylesheet };
