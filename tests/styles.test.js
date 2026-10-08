const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { loadHomepage } = require('./html');
const { loadStylesheet } = require('./css');

function loadAccessPage() {
  return readFileSync(join(__dirname, '..', 'acceso.html'), 'utf8');
}

function getCssBlock(css, startPattern) {
  const match = startPattern.exec(css);
  assert.ok(match, `No se encontró el bloque CSS ${startPattern}`);

  const openingBrace = css.indexOf('{', match.index);
  let depth = 0;

  for (let index = openingBrace; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(openingBrace + 1, index);
  }

  assert.fail(`El bloque CSS ${startPattern} no está cerrado`);
}

test('enlaza la hoja local y define el sistema visual provisional', () => {
  const html = loadHomepage();
  const css = loadStylesheet();

  assert.match(html, /<link\b[^>]*rel="stylesheet"[^>]*href="css\/styles\.css"/i);
  for (const [token, value] of [
    ['--color-ink', '#111111'],
    ['--color-accent', '#ed6e00'],
    ['--color-accent-deep', '#9e4900'],
    ['--color-accent-text', '#aa4f00'],
    ['--color-surface', '#ffffff'],
    ['--color-text', '#111111'],
    ['--content-width', '72rem'],
  ]) {
    assert.match(css, new RegExp(`${token}:\\s*${value}`));
  }
  assert.match(css, /box-sizing:\s*border-box/i);
  assert.match(css, /font-family:\s*system-ui/i);
});

test('diseña un encabezado sticky y una presentación adaptable', () => {
  const css = loadStylesheet();

  assert.match(css, /body\s*>\s*header\s*\{[^}]*position:\s*sticky/is);
  assert.match(css, /body\s*>\s*header\s*\{[^}]*display:\s*flex/is);
  assert.match(css, /\.home-hero\s*\{[^}]*grid-template-columns:\s*1fr/is);
  assert.match(css, /\.home-hero\s*>\s*p:last-child\s+a:first-child,[^}]*\[data-simulator\]\s+button\s*\{[^}]*background:\s*var\(--color-accent-dark\)/is);
  assert.match(css, /html\s*\{[^}]*scroll-padding-top:\s*12rem/is);
  assert.match(css, /main\s*>\s*section\s*\{[^}]*scroll-margin-top:\s*12rem/is);
});

test('limita los estilos del hero a la presentación de inicio', () => {
  const homepage = loadHomepage();
  const accessPage = loadAccessPage();
  const css = loadStylesheet();

  assert.match(homepage, /<section\b[^>]*class="[^"]*\bhome-hero\b[^"]*"/i);
  assert.doesNotMatch(accessPage, /class="[^"]*\bhome-hero\b[^"]*"/i);
  assert.match(css, /\.home-hero\s*\{[^}]*background:\s*var\(--color-surface\)/i);
  assert.match(css, /\.home-hero\s*\{[^}]*color:\s*var\(--color-ink\)/i);
  assert.doesNotMatch(css, /main\s*>\s*section:first-child\s*\{[^}]*background:\s*linear-gradient/is);
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
  assert.match(css, /#servicios\s*>\s*p:first-child,[^}]*#trabajos\s*>\s*p:first-child[^}]*\{[^}]*color:\s*var\(--color-accent-text\)/is);
  assert.match(css, /#empresa\s*>\s*p:first-child\s*\{[^}]*color:\s*#ffffff/is);
});

test('incluye formulario, responsive y preferencias de accesibilidad', () => {
  const css = loadStylesheet();
  const desktopCss = getCssBlock(css, /@media\s*\(min-width:\s*48rem\)\s*/i);
  const reducedMotionCss = getCssBlock(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*/i);

  assert.match(css, /#cotizacion\s+\[data-simulator\]\s*\{/i);
  assert.match(css, /input,\s*select,\s*textarea\s*\{[^}]*border:\s*0\.0625rem solid #7b8790/is);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*0\.2rem solid var\(--color-accent-dark\)/is);
  assert.match(css, /\.home-hero\s*>\s*p:last-child\s+a:first-child:hover,[^}]*\[data-simulator\]\s+button:hover\s*\{[^}]*background:\s*var\(--color-accent-deep\)/is);
  assert.match(desktopCss, /html\s*\{[^}]*scroll-padding-top:\s*5\.5rem/is);
  assert.match(desktopCss, /main\s*>\s*section\s*\{[^}]*scroll-margin-top:\s*5\.5rem/is);
  assert.match(desktopCss, /\.home-hero\s*\{[^}]*grid-template-columns:\s*minmax\([^)]*\)\s+minmax\([^)]*\)/is);
  assert.match(desktopCss, /#servicios,\s*#trabajos\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/is);
  assert.match(desktopCss, /#proceso\s+ol\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/is);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(reducedMotionCss, /transition:\s*none\s*!important/is);
  assert.doesNotMatch(css, /@import|bootstrap|tailwind/i);
});

test('presenta los estados interactivos de navegación, portafolio y formulario', () => {
  const css = loadStylesheet();
  const desktopCss = getCssBlock(css, /@media\s*\(min-width:\s*48rem\)\s*/i);
  const mobileCss = css.slice(0, css.indexOf('@media (min-width: 48rem)'));

  assert.match(mobileCss, /#menu-button\s*\{/i);
  assert.match(mobileCss, /#menu-button\[aria-expanded="true"\]\s*\{[^}]*(?:background|border-color|color):/is);
  assert.match(mobileCss, /#primary-navigation\[hidden\]\s*\{/i);
  assert.match(css, /\[data-filter\]\[aria-pressed="true"\]\s*\{/i);
  assert.match(css, /\[aria-current="location"\]\s*\{/i);
  assert.match(css, /body\s*>\s*header\s*\[aria-current="page"\]\s*\{/i);
  assert.match(css, /\.field-error\s*\{/i);
  assert.match(css, /\[aria-invalid="true"\]\s*\{[^}]*border-color:/is);
  assert.match(css, /#portfolio-dialog\s*\{[^}]*position:\s*fixed/is);
  assert.match(css, /body\.dialog-open\s*\{[^}]*overflow:\s*hidden/is);
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/is);
  assert.match(desktopCss, /#menu-button\s*\{[^}]*display:\s*none/is);
  assert.match(desktopCss, /#primary-navigation\s*\{[^}]*display:\s*block/is);
  assert.match(desktopCss, /body\s*>\s*header\s*>\s*nav\s*\+\s*\[data-session-link\]\s*\{[^}]*margin-left:\s*clamp\(1\.5rem/is);
});

test('presenta el resultado del simulador como una tarjeta adaptable', () => {
  const css = loadStylesheet();
  assert.match(css, /\[data-simulator-result\]\s*\{[^}]*border:/is);
  assert.match(css, /\[data-estimate-total\]\s*\{[^}]*font-size:/is);
  assert.match(css, /\[data-extra-options\]\s*\{[^}]*display:\s*flex/is);
});

test('organiza las cotizaciones sin desbordamiento y presenta un diálogo modal', () => {
  const css = loadStylesheet();
  const desktopCss = getCssBlock(css, /@media\s*\(min-width:\s*48rem\)\s*/i);
  assert.match(css, /\[data-quote-workspace\]\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/is);
  assert.match(css, /\[data-quote-item\]\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/is);
  assert.match(css, /\[data-submit-dialog\]\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/is);
  assert.match(desktopCss, /\[data-quote-workspace\]\s*\{[^}]*grid-template-columns:\s*minmax\(16rem,\s*0\.7fr\)\s+minmax\(0,\s*1\.3fr\)/is);
});
