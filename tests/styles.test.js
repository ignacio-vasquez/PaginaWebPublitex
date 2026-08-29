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

test('diseña un encabezado sticky y una presentación adaptable', () => {
  const css = loadStylesheet();

  assert.match(css, /body\s*>\s*header\s*\{[^}]*position:\s*sticky/is);
  assert.match(css, /body\s*>\s*header\s*\{[^}]*display:\s*flex/is);
  assert.match(css, /main\s*>\s*section:first-child\s*\{/i);
  assert.match(css, /main\s*>\s*section:first-child[\s\S]*grid-template-columns:/i);
  assert.match(css, /background:\s*var\(--color-accent\)/i);
});

test('organiza servicios, proceso y portafolio como componentes visuales', () => {
  const css = loadStylesheet();

  for (const selector of ['#servicios', '#proceso', '#trabajos', '#empresa']) {
    assert.match(css, new RegExp(`${selector.replace('#', '\\#')}\\s*\\{`));
  }
  assert.match(css, /#servicios\s+article\s*\{/i);
  assert.match(css, /#proceso\s+ol\s*\{[^}]*counter-reset:/is);
  assert.match(css, /#trabajos\s+figure\s*\{/i);
  assert.match(css, /object-fit:\s*cover/i);
});

test('incluye formulario, responsive y preferencias de accesibilidad', () => {
  const css = loadStylesheet();

  assert.match(css, /#cotizacion\s+form\s*\{/i);
  assert.match(css, /input,\s*select,\s*textarea\s*\{/i);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*0\.2rem solid var\(--color-accent-dark\)/is);
  assert.match(css, /@media\s*\(min-width:\s*48rem\)/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.doesNotMatch(css, /@import|bootstrap|tailwind/i);
});
