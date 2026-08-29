# Public Site JavaScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir interacciones accesibles con JavaScript nativo al menú, navegación, portafolio y formulario público de Publitexweb sin enviar ni almacenar datos.

**Architecture:** `js/app.js` importa e inicializa módulos independientes que reciben un `Document` y terminan silenciosamente cuando no encuentran su componente. Las reglas puras de validación se separan del DOM para probarlas directamente; las interacciones se prueban con `node:test` y JSDOM.

**Tech Stack:** HTML5, CSS3, JavaScript ES modules, Node.js 22+, `node:test`, JSDOM 26.1.0.

**Spec:** `docs/superpowers/specs/2026-08-29-sitio-publico-javascript-design.md`

## Global Constraints

- Usar JavaScript nativo; no incorporar frameworks ni librerías de interfaz.
- Mantener navegación y contenido básico útiles cuando JavaScript no cargue.
- No enviar solicitudes a internet ni usar `localStorage`, `sessionStorage`, cookies o IndexedDB.
- Mostrar literalmente: “Simulación: esta solicitud todavía no fue enviada a la empresa”.
- Aceptar teléfonos con 8 a 15 dígitos y los separadores espacio, paréntesis, guion y prefijo `+`.
- Exigir al menos 20 caracteres visibles en la descripción.
- Todas las funciones deben poder operarse con mouse y teclado.
- Respetar `prefers-reduced-motion` y conservar las pruebas HTML/CSS existentes.

---

### Task 1: Base modular y entorno de pruebas DOM

**Files:**
- Modify: `package.json`
- Modify: `index.html`
- Create: `js/package.json`
- Create: `js/app.js`
- Create: `tests/dom.js`
- Create: `tests/javascript-foundation.test.js`

**Interfaces:**
- Consumes: el documento HTML actual y el script `npm test`.
- Produces: `createDom(html?: string): JSDOM`, `loadHomepageDom(): JSDOM` y el punto de entrada `js/app.js` usado por los módulos posteriores.

- [ ] **Step 1: Instalar JSDOM como dependencia de desarrollo reproducible**

Run: `npm install --save-dev --save-exact jsdom@26.1.0`

Expected: `package.json` contiene `"jsdom": "26.1.0"` en `devDependencies` y se crea `package-lock.json`.

- [ ] **Step 2: Escribir la prueba fallida de la base JavaScript**

Create `tests/javascript-foundation.test.js`:

```js
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
```

- [ ] **Step 3: Ejecutar la prueba para comprobar que falla**

Run: `node --test tests/javascript-foundation.test.js`

Expected: FAIL porque `index.html` todavía no enlaza `js/app.js` y el archivo no existe.

- [ ] **Step 4: Crear el punto de entrada y enlazarlo**

Create `js/app.js`:

```js
import { initMenu } from './menu.js';
import { initNavigation } from './navegacion.js';
import { initPortfolio } from './portafolio.js';
import { initQuoteForm } from './formulario.js';

export function initApp(documentRoot = document) {
  initMenu(documentRoot);
  initNavigation(documentRoot);
  initPortfolio(documentRoot);
  initQuoteForm(documentRoot);
}

initApp();
```

Create `js/package.json` so Node interprets only the browser source directory as ES modules while the existing tests remain CommonJS:

```json
{
  "type": "module"
}
```

Add immediately before `</body>` in `index.html`:

```html
    <script type="module" src="js/app.js"></script>
```

Create the four imported files with the same temporary safe interface, replacing each stub in its corresponding later task:

```js
export function initMenu() {}
```

Use `initNavigation`, `initPortfolio`, and `initQuoteForm` respectively in the other three files.

Create `tests/dom.js`:

```js
const { JSDOM } = require('jsdom');
const { loadHomepage } = require('./html');

function createDom(html = '<!doctype html><html><body></body></html>') {
  return new JSDOM(html, { url: 'http://localhost/' });
}

function loadHomepageDom() {
  return createDom(loadHomepage());
}

module.exports = { createDom, loadHomepageDom };
```

- [ ] **Step 5: Ejecutar todas las pruebas**

Run: `npm test`

Expected: PASS; las pruebas anteriores y las dos pruebas nuevas quedan verdes.

- [ ] **Step 6: Guardar la base modular**

```bash
git add package.json package-lock.json index.html js tests/dom.js tests/javascript-foundation.test.js
git commit -m "test: establish JavaScript module foundation"
```

---

### Task 2: Menú móvil y navegación activa

**Files:**
- Modify: `index.html`
- Modify: `js/menu.js`
- Modify: `js/navegacion.js`
- Create: `tests/navigation.test.js`

**Interfaces:**
- Consumes: `createDom(html)` de `tests/dom.js` y `initApp` de `js/app.js`.
- Produces: `initMenu(documentRoot: Document): void` e `initNavigation(documentRoot: Document, Observer?: typeof IntersectionObserver): void`.

- [ ] **Step 1: Escribir pruebas fallidas del menú**

Create `tests/navigation.test.js` with JSDOM loaded through dynamic `import()` and tests that build a header containing `#menu-button` and `#primary-navigation`. Assert these exact transitions:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDom } = require('./dom');

test('el botón abre el menú y Escape lo cierra devolviendo el foco', async () => {
  const dom = createDom('<button id="menu-button" aria-expanded="false" aria-controls="primary-navigation">Menú</button><nav id="primary-navigation" hidden><a href="#servicios">Servicios</a></nav>');
  const { initMenu } = await import('../js/menu.js');
  const button = dom.window.document.querySelector('#menu-button');
  const nav = dom.window.document.querySelector('#primary-navigation');
  initMenu(dom.window.document);
  button.click();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(nav.hidden, false);
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(nav.hidden, true);
  assert.equal(dom.window.document.activeElement, button);
});

test('elegir un enlace cierra el menú', async () => {
  const dom = createDom('<button id="menu-button" aria-expanded="true" aria-controls="primary-navigation">Menú</button><nav id="primary-navigation"><a href="#servicios">Servicios</a></nav>');
  const { initMenu } = await import('../js/menu.js');
  initMenu(dom.window.document);
  dom.window.document.querySelector('a').click();
  assert.equal(dom.window.document.querySelector('button').getAttribute('aria-expanded'), 'false');
});
```

- [ ] **Step 2: Ejecutar las pruebas para comprobar que fallan**

Run: `node --test tests/navigation.test.js`

Expected: FAIL porque los stubs no cambian ningún estado.

- [ ] **Step 3: Añadir el contrato HTML del menú**

Insert a button before the primary `nav`, give the nav `id="primary-navigation"`, and keep the navigation unhidden by default:

```html
<button id="menu-button" type="button" aria-expanded="false" aria-controls="primary-navigation">
  <span aria-hidden="true">☰</span><span>Menú</span>
</button>
<nav id="primary-navigation" aria-label="Navegación principal">
```

Add `data-section-link` to links pointing to `#inicio`, `#servicios`, `#trabajos`, `#empresa`, and `#contacto`.

- [ ] **Step 4: Implementar apertura, cierre y sección visible**

In `js/menu.js`, define local `openMenu`, `closeMenu`, click/link/Escape listeners, and a `(min-width: 48rem)` `matchMedia` change listener. Only apply `hidden` on small screens; on desktop remove it. When Escape closes an open menu, call `button.focus()`.

In `js/navegacion.js`, export `initNavigation(documentRoot = document, Observer = globalThis.IntersectionObserver)`. Observe the five target sections with `{ rootMargin: '-35% 0px -55%', threshold: 0 }`; on intersecting entries, remove old `aria-current` attributes and set `aria-current="location"` on the matching `data-section-link`. Return immediately when `Observer` is not a function.

- [ ] **Step 5: Completar pruebas de navegación activa y ejecutar la suite**

Add a fake observer that captures its callback, initialize `initNavigation`, emit `{ isIntersecting: true, target: section }`, and assert that only the matching link has `aria-current="location"`.

Run: `npm test`

Expected: PASS, including menu close behavior and the observer fallback.

- [ ] **Step 6: Guardar menú y navegación**

```bash
git add index.html js/menu.js js/navegacion.js tests/navigation.test.js
git commit -m "feat: add accessible mobile navigation"
```

---

### Task 3: Filtros y visor accesible del portafolio

**Files:**
- Modify: `index.html`
- Modify: `js/portafolio.js`
- Create: `tests/portfolio.test.js`

**Interfaces:**
- Consumes: figuras `#trabajos figure[data-category]` y botones `[data-filter]`.
- Produces: `initPortfolio(documentRoot: Document): void`; controla `hidden`, `aria-pressed`, `#portfolio-dialog`, foco y clase `dialog-open`.

- [ ] **Step 1: Escribir pruebas fallidas para filtros y visor**

Create a compact fixture with four filter buttons, three figures categorized as `letreros`, `vehiculos`, `adhesivos`, and this dialog contract:

```html
<div id="portfolio-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-dialog-title" hidden>
  <div data-dialog-panel>
    <button type="button" data-dialog-close>Cerrar</button>
    <img data-dialog-image alt="">
    <h3 id="portfolio-dialog-title" data-dialog-title></h3>
  </div>
</div>
```

Assert that selecting `vehiculos` sets only that filter to `aria-pressed="true"`, hides the other figures, and keeps the vehicle visible. Assert that activating a figure opens the dialog, copies image `src`, `alt`, and caption, focuses close, then Escape closes it and returns focus to the figure trigger.

- [ ] **Step 2: Ejecutar las pruebas para comprobar que fallan**

Run: `node --test tests/portfolio.test.js`

Expected: FAIL porque `initPortfolio` todavía es un stub y el HTML no contiene controles.

- [ ] **Step 3: Añadir controles y diálogo al HTML**

Add a `div` labeled “Filtrar trabajos” before the figures, with the four buttons and exact filter values `all`, `letreros`, `vehiculos`, `adhesivos`. Set `aria-pressed="true"` only on Todos. Add the matching `data-category` to each figure, make each figure keyboard-activatable with an internal `<button type="button" data-portfolio-open>`, and append the dialog contract after the figures.

- [ ] **Step 4: Implementar filtros y visor**

In `js/portafolio.js`, query the controls defensively. Filter with `figure.hidden = filter !== 'all' && figure.dataset.category !== filter`. For the viewer, save `documentRoot.activeElement`, copy the selected image and caption, set `dialog.hidden = false`, add `dialog-open` to `documentRoot.body`, and focus close. Close on close-button click, backdrop click only when `event.target === dialog`, or Escape; reverse each state and restore focus with optional chaining.

- [ ] **Step 5: Ejecutar pruebas específicas y completas**

Run: `node --test tests/portfolio.test.js && npm test`

Expected: PASS; filtering, dialog content, three close mechanisms, scroll lock, and focus restoration are covered.

- [ ] **Step 6: Guardar el portafolio interactivo**

```bash
git add index.html js/portafolio.js tests/portfolio.test.js
git commit -m "feat: add portfolio filters and viewer"
```

---

### Task 4: Validación y confirmación simulada

**Files:**
- Modify: `index.html`
- Modify: `js/formulario.js`
- Modify: `js/mensajes.js`
- Create: `tests/form.test.js`

**Interfaces:**
- Consumes: `form[data-quote-form]` y sus campos con los nombres HTML existentes.
- Produces: `validateQuote(values): Record<string, string>`, `initQuoteForm(documentRoot: Document): void`, `setFieldError(field, message): void`, `clearFieldError(field): void`, `showStatus(container, message, kind): void`.

- [ ] **Step 1: Escribir pruebas fallidas para reglas puras**

Create `tests/form.test.js` and dynamically import `validateQuote`. Verify an empty object returns errors for `nombre`, `telefono`, `correo`, `servicio`, `descripcion`, and `consentimiento`. Verify this object returns no errors:

```js
{
  nombre: 'Ignacio',
  telefono: '+56 9 1234-5678',
  correo: 'ignacio@example.com',
  servicio: 'letrero',
  descripcion: 'Letrero luminoso de dos metros para una fachada.',
  consentimiento: true,
}
```

Also assert 7 and 16 phone digits fail, forbidden phone letters fail, an invalid email fails, and 19 visible description characters fail.

- [ ] **Step 2: Ejecutar las reglas para comprobar que fallan**

Run: `node --test tests/form.test.js`

Expected: FAIL porque `validateQuote` no existe.

- [ ] **Step 3: Implementar reglas y mensajes de campo**

Implement `validateQuote(values)` without DOM dependencies. Trim string values; strip allowed separators to count digits; reject remaining characters; use a conservative email expression requiring non-space text around `@` and a dot. Return Spanish corrective messages keyed by field name.

In `js/mensajes.js`, implement field errors by creating/reusing `<span class="field-error" id="${field.id}-error">`, setting `aria-invalid="true"` and appending the error id to `aria-describedby`. Clearing removes only the generated error id and resets `aria-invalid`. `showStatus` sets text, `data-status-kind`, and unhides the supplied live region.

- [ ] **Step 4: Añadir el contrato HTML y pruebas DOM del formulario**

Add `data-quote-form` and `novalidate` to the form. Add before its submit button:

```html
<div class="form-status" data-form-status role="status" aria-live="polite" hidden></div>
```

Add after the form:

```html
<section class="quote-summary" data-quote-summary aria-labelledby="quote-summary-title" hidden>
  <h3 id="quote-summary-title">Resumen de tu solicitud</h3>
  <p><strong>Simulación: esta solicitud todavía no fue enviada a la empresa</strong></p>
  <dl data-summary-list></dl>
  <button type="button" data-edit-quote>Editar datos</button>
  <button type="button" data-clear-quote>Limpiar formulario</button>
</section>
```

Add DOM tests asserting `submit` is canceled, invalid fields receive associated errors, first invalid field receives focus, a valid request reveals the summary with the exact simulation warning, Editar returns to the form, and Limpiar calls `form.reset()` and removes the summary.

- [ ] **Step 5: Implementar el flujo DOM sin enviar ni guardar**

In `initQuoteForm`, always call `event.preventDefault()`. Collect only the six specified fields, run `validateQuote`, render errors, and focus the first invalid element. For valid data, create summary rows with `createElement` and `textContent` (never `innerHTML`), hide the form and reveal the summary. Editing reverses visibility and focuses the first field; clearing additionally resets form values and generated errors.

Do not reference `fetch`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, or a non-`#` form action.

- [ ] **Step 6: Ejecutar pruebas específicas y completas**

Run: `node --test tests/form.test.js && npm test`

Expected: PASS; invalid, valid, edit, clear, no-network, and no-storage assertions are green.

- [ ] **Step 7: Guardar el formulario interactivo**

```bash
git add index.html js/formulario.js js/mensajes.js tests/form.test.js
git commit -m "feat: validate quote requests in the browser"
```

---

### Task 5: Diseño de estados, documentación y verificación integral

**Files:**
- Modify: `css/styles.css`
- Modify: `README.md`
- Modify: `tests/styles.test.js`
- Modify: `tests/javascript-foundation.test.js`

**Interfaces:**
- Consumes: IDs, clases, atributos `data-*`, `hidden`, `aria-expanded`, `aria-pressed`, `aria-current`, `aria-invalid`, `data-status-kind`, and `dialog-open` introduced in Tasks 2–4.
- Produces: presentación responsive and accessible de todos los estados JavaScript y documentación de uso.

- [ ] **Step 1: Escribir pruebas fallidas de integración visual y seguridad**

Extend CSS tests to require selectors for `#menu-button`, `[data-filter][aria-pressed="true"]`, `[aria-current="location"]`, `.field-error`, `[aria-invalid="true"]`, `#portfolio-dialog`, `.dialog-open`, and `[hidden]`. Require the mobile menu rules outside the desktop media query and a desktop rule hiding `#menu-button` while displaying `#primary-navigation`.

Extend the foundation test to scan every `js/*.js` file and reject:

```js
/(fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie)/
```

- [ ] **Step 2: Ejecutar las pruebas para comprobar que fallan**

Run: `node --test tests/styles.test.js tests/javascript-foundation.test.js`

Expected: FAIL porque aún no existen todas las reglas visuales.

- [ ] **Step 3: Diseñar todos los estados interactivos**

Append focused component sections to `css/styles.css`: menu button and collapsed navigation below 48rem; active navigation underline; filter button row with wrapping; portfolio trigger reset and hover/focus state; fixed dialog backdrop and centered panel; `body.dialog-open { overflow: hidden; }`; field error text plus high-contrast invalid border; status and summary cards; and a strong `[hidden] { display: none !important; }` guarantee.

Inside the existing `@media (min-width: 48rem)`, hide the menu button and force primary navigation visible. Inside `prefers-reduced-motion: reduce`, remove transitions and smooth scrolling from all new components.

- [ ] **Step 4: Actualizar la guía del proyecto**

Change README stage to JavaScript and document:

- Run `npm install` after cloning.
- Run `npm test` for all automated checks.
- Run `python3 -m http.server 8081 --bind 127.0.0.1` and open `http://127.0.0.1:8081`.
- The quote form is a local simulation and does not send or save data.
- JavaScript modules live under `js/`, with one responsibility per file.

- [ ] **Step 5: Ejecutar verificación automática completa**

Run: `npm test && git diff --check`

Expected: all HTML, CSS, navigation, portfolio, form, accessibility-contract, and security tests pass; diff check prints nothing.

- [ ] **Step 6: Verificar manualmente en navegador**

Run: `python3 -m http.server 8081 --bind 127.0.0.1`

At 320px, 768px, and 1440px widths, verify the menu, every filter, dialog close paths, invalid form, valid simulation, Editar, Limpiar, keyboard focus, and reduced-motion preference. Confirm browser console has no errors and Network shows no request when submitting.

- [ ] **Step 7: Guardar el acabado de la etapa**

```bash
git add css/styles.css README.md tests/styles.test.js tests/javascript-foundation.test.js
git commit -m "feat: complete accessible JavaScript experience"
```

- [ ] **Step 8: Confirmar el estado final**

Run: `npm test && git diff --check && git status --short --branch`

Expected: all tests pass, diff check has no output, and the feature branch has no uncommitted files.
