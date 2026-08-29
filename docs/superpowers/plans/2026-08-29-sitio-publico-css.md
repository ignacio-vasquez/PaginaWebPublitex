# Sitio público CSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el sitio HTML existente en una interfaz profesional, comercial, accesible y adaptable mediante CSS tradicional.

**Architecture:** `css/styles.css` concentrará el sistema visual, organizado desde tokens y base global hasta componentes y media queries. `index.html` conservará su semántica y solo enlazará la hoja; `tests/styles.test.js` verificará contratos CSS estructurales usando `node:test`, sin analizar estilos calculados ni añadir dependencias.

**Tech Stack:** HTML5, CSS3, Node.js 22, `node:test`, Git

**Spec:** `docs/superpowers/specs/2026-08-29-sitio-publico-css-design.md`

## Global Constraints

- Usar CSS tradicional en `css/styles.css`; no Bootstrap, Tailwind, preprocesadores ni dependencias externas.
- No añadir JavaScript, Express, Oracle ni React.
- Mantener azul muy oscuro, blanco, gris claro, gris oscuro y naranja como paleta provisional.
- Usar tipografía de sistema, sin descargar fuentes.
- Implementar mobile-first y ampliar la cuadrícula desde `48rem`.
- No provocar desplazamiento horizontal a 320px.
- Mantener el orden semántico y todo el contenido visible actual.
- Incluir `:focus-visible` y respetar `prefers-reduced-motion`.

## Estructura de archivos

- `css/styles.css`: sistema visual completo, componentes y adaptación responsive.
- `index.html`: enlace a la hoja de estilos, sin estilos inline.
- `tests/css.js`: carga el CSS real desde disco.
- `tests/styles.test.js`: contratos automatizados de enlace, tokens, componentes, responsive y accesibilidad.
- `README.md`: documenta la nueva etapa CSS y cómo visualizarla.

---

### Task 1: Hoja de estilos, tokens y base global

**Files:**
- Create: `css/styles.css`
- Create: `tests/css.js`
- Create: `tests/styles.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `index.html` semántico y script `npm test` existente.
- Produces: `loadStylesheet(): string`, enlace `css/styles.css`, tokens `--color-*`, normalización y estilos globales.

- [ ] **Step 1: Escribir la prueba que exige enlace, archivo y tokens**

Crear `tests/css.js`:

```js
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function loadStylesheet() {
  return readFileSync(join(__dirname, '..', 'css', 'styles.css'), 'utf8');
}

module.exports = { loadStylesheet };
```

Crear `tests/styles.test.js`:

```js
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
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo inicial**

Run: `node --test tests/styles.test.js`

Expected: FAIL con `ENOENT` para `css/styles.css`.

- [ ] **Step 3: Enlazar la hoja y crear la base visual**

Agregar dentro de `<head>`, después de la descripción:

```html
<link rel="stylesheet" href="css/styles.css">
```

Crear `css/styles.css`:

```css
:root {
  --color-ink: #101c28;
  --color-ink-soft: #1c2b38;
  --color-accent: #f36b21;
  --color-accent-dark: #c94d0c;
  --color-surface: #ffffff;
  --color-surface-soft: #f2f5f7;
  --color-text: #17212b;
  --color-muted: #5b6874;
  --color-border: #d9e0e5;
  --shadow-card: 0 1rem 2.5rem rgb(16 28 40 / 0.1);
  --radius-small: 0.5rem;
  --radius-large: 1rem;
  --content-width: 72rem;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 1rem;
  line-height: 1.6;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
}

a {
  color: inherit;
  text-decoration-thickness: 0.12em;
  text-underline-offset: 0.2em;
}

h1,
h2,
h3,
p,
figure {
  margin-top: 0;
}

h1,
h2,
h3 {
  line-height: 1.15;
}

main > section,
body > header,
body > footer {
  padding-inline: max(1rem, calc((100% - var(--content-width)) / 2));
}

main > section {
  padding-block: clamp(3.5rem, 8vw, 6.5rem);
}
```

- [ ] **Step 4: Ejecutar las pruebas completas**

Run: `node --test tests/styles.test.js && npm test`

Expected: prueba CSS PASS y `npm test` confirma que los archivos HTML y CSS pasan sin fallos.

- [ ] **Step 5: Guardar la base CSS en Git**

```bash
git add css/styles.css index.html tests/css.js tests/styles.test.js
git commit -m "feat: add CSS foundation and design tokens"
```

---

### Task 2: Encabezado y presentación principal

**Files:**
- Modify: `css/styles.css`
- Modify: `tests/styles.test.js`

**Interfaces:**
- Consumes: tokens y reglas base de Task 1; estructura `header` y primera sección de `main`.
- Produces: encabezado sticky adaptable, navegación, botones compartidos y hero de alto contraste.

- [ ] **Step 1: Escribir la prueba de encabezado y hero**

Agregar a `tests/styles.test.js`:

```js
test('diseña un encabezado sticky y una presentación adaptable', () => {
  const css = loadStylesheet();

  assert.match(css, /body\s*>\s*header\s*\{[^}]*position:\s*sticky/is);
  assert.match(css, /body\s*>\s*header\s*\{[^}]*display:\s*flex/is);
  assert.match(css, /main\s*>\s*section:first-child\s*\{/i);
  assert.match(css, /main\s*>\s*section:first-child[\s\S]*grid-template-columns:/i);
  assert.match(css, /background:\s*var\(--color-accent\)/i);
});
```

- [ ] **Step 2: Ejecutar la prueba y verificar el fallo**

Run: `node --test tests/styles.test.js`

Expected: la prueba nueva FAIL porque faltan reglas de header y hero.

- [ ] **Step 3: Agregar encabezado, acciones y presentación**

Anexar a `css/styles.css`:

```css
body > header {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  min-height: 4.5rem;
  padding-block: 0.75rem;
  background: rgb(16 28 40 / 0.97);
  color: var(--color-surface);
  box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 0.18);
}

body > header p {
  margin: 0 auto 0 0;
  font-size: 1.15rem;
  font-weight: 850;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

body > header p a,
body > header nav a,
body > header > a {
  text-decoration: none;
}

body > header ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

body > header nav a {
  color: #dce4ea;
  font-size: 0.92rem;
  font-weight: 650;
}

body > header > a,
main > section:first-child > p:last-child a:first-child,
form button {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1.1rem;
  border: 0;
  border-radius: var(--radius-small);
  background: var(--color-accent);
  color: #fff;
  font: inherit;
  font-weight: 750;
  text-decoration: none;
  cursor: pointer;
}

main > section:first-child {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
  align-items: center;
  min-height: calc(100svh - 4.5rem);
  background: linear-gradient(135deg, var(--color-ink), var(--color-ink-soft));
  color: #fff;
}

main > section:first-child > p:first-child {
  margin-bottom: 0.75rem;
  color: #ff9a5c;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

main > section:first-child h1 {
  max-width: 12ch;
  margin-bottom: 1.25rem;
  font-size: clamp(2.5rem, 8vw, 5rem);
}

main > section:first-child > p:nth-of-type(2) {
  max-width: 42rem;
  color: #dce4ea;
  font-size: clamp(1rem, 2vw, 1.2rem);
}

main > section:first-child > img {
  width: 100%;
  max-height: 30rem;
  border-radius: var(--radius-large);
  object-fit: cover;
  box-shadow: var(--shadow-card);
}

main > section:first-child > p:last-child {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
}

main > section:first-child > p:last-child a:last-child {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  padding: 0.65rem 1rem;
  border: 0.1rem solid #fff;
  border-radius: var(--radius-small);
  text-decoration: none;
}
```

- [ ] **Step 4: Ejecutar la suite completa**

Run: `node --test tests/styles.test.js && npm test`

Expected: todas las pruebas PASS.

- [ ] **Step 5: Guardar encabezado y hero en Git**

```bash
git add css/styles.css tests/styles.test.js
git commit -m "feat: style navigation and hero"
```

---

### Task 3: Servicios, proceso, portafolio y empresa

**Files:**
- Modify: `css/styles.css`
- Modify: `tests/styles.test.js`

**Interfaces:**
- Consumes: tokens, tipografía y ancho común de Tasks 1–2.
- Produces: tarjetas, cuadrículas responsive, pasos numerados, portafolio y sección de empresa contrastante.

- [ ] **Step 1: Escribir la prueba de secciones comerciales**

Agregar a `tests/styles.test.js`:

```js
test('organiza servicios, proceso y portafolio como componentes visuales', () => {
  const css = loadStylesheet();

  for (const selector of ['#servicios', '#proceso', '#trabajos', '#empresa']) {
    assert.match(css, new RegExp(`${selector.replace('#', '\\#')}\\s*\\{`));
  }
  assert.match(css, /#servicios\s*article\s*\{/i);
  assert.match(css, /#proceso\s*ol\s*\{[^}]*counter-reset:/is);
  assert.match(css, /#trabajos\s*figure\s*\{/i);
  assert.match(css, /object-fit:\s*cover/i);
});
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `node --test tests/styles.test.js`

Expected: prueba nueva FAIL.

- [ ] **Step 3: Agregar estilos de contenido comercial**

Anexar a `css/styles.css`:

```css
#servicios,
#trabajos {
  background: var(--color-surface-soft);
}

#servicios > p:first-child,
#trabajos > p:first-child,
#empresa > p:first-child {
  margin-bottom: 0.5rem;
  color: var(--color-accent-dark);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

#servicios > h2,
#proceso > h2,
#trabajos > h2,
#empresa > h2,
#cotizacion > h2,
#contacto > h2 {
  max-width: 20ch;
  margin-bottom: 2rem;
  font-size: clamp(1.9rem, 5vw, 3rem);
}

#servicios {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

#servicios > p,
#servicios > h2 {
  grid-column: 1 / -1;
}

#servicios article {
  overflow: hidden;
  padding: 1rem;
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

#servicios article img {
  width: 100%;
  aspect-ratio: 16 / 10;
  margin-bottom: 1.25rem;
  border-radius: calc(var(--radius-large) - 0.3rem);
  object-fit: cover;
}

#servicios article p,
#empresa p:last-child {
  color: var(--color-muted);
}

#proceso {
  background: var(--color-surface);
}

#proceso ol {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin: 0;
  padding: 0;
  counter-reset: process;
  list-style: none;
}

#proceso li {
  position: relative;
  padding: 1.25rem 1.25rem 1.25rem 4rem;
  border-left: 0.2rem solid var(--color-accent);
  background: #fff7f1;
}

#proceso li::before {
  position: absolute;
  top: 1rem;
  left: 1rem;
  color: var(--color-accent-dark);
  font-size: 1.5rem;
  font-weight: 850;
  content: counter(process, decimal-leading-zero);
  counter-increment: process;
}

#trabajos {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

#trabajos > p,
#trabajos > h2 {
  grid-column: 1 / -1;
}

#trabajos figure {
  overflow: hidden;
  margin: 0;
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

#trabajos figure img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

#trabajos figcaption {
  padding: 1rem;
  font-weight: 750;
}

#empresa {
  background: var(--color-ink);
  color: #fff;
}

#empresa p:last-child {
  max-width: 48rem;
  color: #dce4ea;
  font-size: 1.1rem;
}
```

- [ ] **Step 4: Ejecutar la suite completa**

Run: `node --test tests/styles.test.js && npm test`

Expected: todas las pruebas PASS.

- [ ] **Step 5: Guardar las secciones en Git**

```bash
git add css/styles.css tests/styles.test.js
git commit -m "feat: style services process and portfolio"
```

---

### Task 4: Formulario, pie, responsive y accesibilidad

**Files:**
- Modify: `css/styles.css`
- Modify: `tests/styles.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: todos los tokens y componentes anteriores.
- Produces: formulario completo, contacto y pie; estados focus/hover; layout desde 48rem; movimiento reducido; documentación CSS.

- [ ] **Step 1: Escribir la prueba de cierre visual y responsive**

Agregar a `tests/styles.test.js`:

```js
test('incluye formulario, responsive y preferencias de accesibilidad', () => {
  const css = loadStylesheet();

  assert.match(css, /#cotizacion\s+form\s*\{/i);
  assert.match(css, /input,\s*select,\s*textarea\s*\{/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /@media\s*\(min-width:\s*48rem\)/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.doesNotMatch(css, /@import|bootstrap|tailwind/i);
});
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `node --test tests/styles.test.js`

Expected: prueba nueva FAIL.

- [ ] **Step 3: Agregar formulario, pie y accesibilidad**

Anexar a `css/styles.css`:

```css
#cotizacion {
  background: var(--color-surface-soft);
}

#cotizacion > p,
#cotizacion form {
  max-width: 48rem;
}

#cotizacion form {
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 4vw, 2rem);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

#cotizacion form p {
  margin: 0;
}

#cotizacion label:not(:has(input[type="checkbox"])) {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 700;
}

input,
select,
textarea {
  width: 100%;
  min-height: 2.8rem;
  padding: 0.7rem 0.8rem;
  border: 0.0625rem solid #aab5bd;
  border-radius: var(--radius-small);
  background: #fff;
  color: var(--color-text);
  font: inherit;
}

textarea {
  min-height: 9rem;
  resize: vertical;
}

input[type="checkbox"] {
  width: 1.15rem;
  min-height: auto;
  margin-right: 0.4rem;
  accent-color: var(--color-accent);
}

#contacto {
  background: #fff7f1;
}

body > footer {
  display: grid;
  gap: 1rem;
  padding-block: 2.5rem;
  background: var(--color-ink);
  color: #dce4ea;
}

body > footer p {
  margin: 0;
}

body > footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
}

body > footer a {
  color: #fff;
}

a,
button,
input,
select,
textarea {
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}

a:hover,
button:hover {
  color: #fff;
}

body > header > a:hover,
main > section:first-child > p:last-child a:first-child:hover,
form button:hover {
  background: var(--color-accent-dark);
  transform: translateY(-0.1rem);
}

:focus-visible {
  outline: 0.2rem solid #ffb27f;
  outline-offset: 0.2rem;
}
```

- [ ] **Step 4: Agregar las reglas responsive y movimiento reducido**

Anexar a `css/styles.css`:

```css
@media (min-width: 48rem) {
  body > header {
    flex-wrap: nowrap;
  }

  main > section:first-child {
    grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.95fr);
  }

  main > section:first-child > p:last-child {
    grid-column: 1;
  }

  main > section:first-child > img {
    grid-column: 2;
    grid-row: 1 / span 4;
  }

  #servicios,
  #trabajos {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  #proceso ol {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  #cotizacion form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  #cotizacion form p:nth-last-child(-n + 3),
  #cotizacion form button {
    grid-column: 1 / -1;
  }

  form button {
    justify-self: start;
  }

  body > footer {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  body > footer p:last-child {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Actualizar README con la etapa CSS**

Reemplazar la sección `## Etapa actual: HTML` y su párrafo por:

```markdown
## Etapa actual: CSS

Esta versión contiene la estructura semántica y una interfaz responsive creada con CSS tradicional. Todavía no incluye comportamiento dinámico.
```

Agregar después de “Abre `index.html` en un navegador web”:

```markdown
La hoja `css/styles.css` contiene tokens, componentes y reglas responsive organizadas por sección.
```

- [ ] **Step 6: Ejecutar verificación final**

Run: `node tests/homepage.test.js && node --test tests/styles.test.js && npm test && git diff --check`

Expected: 12 pruebas HTML PASS, 4 pruebas CSS PASS, suite completa PASS y `git diff --check` sin salida.

- [ ] **Step 7: Guardar y confirmar árbol limpio**

```bash
git add css/styles.css tests/styles.test.js README.md
git commit -m "feat: complete responsive CSS stage"
git status --short
```

Expected: el commit se crea y `git status --short` no muestra archivos pendientes.
