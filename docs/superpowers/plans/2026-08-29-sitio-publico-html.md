# Sitio público HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la primera versión semántica, navegable y accesible del sitio público de la empresa usando solamente HTML.

**Architecture:** Un único documento `index.html` contendrá la página pública completa y usará secciones identificadas para navegación interna. Una suite pequeña con `node:test` leerá el HTML como texto y comprobará la presencia de la estructura, el contenido y los atributos esenciales sin introducir frameworks ni CSS antes de tiempo.

**Tech Stack:** HTML5, Node.js 22, `node:test`, Git

**Spec:** `docs/superpowers/specs/2026-08-29-sistema-publicidad-visual-design.md`

## Global Constraints

- Esta etapa usa HTML semántico; no incorpora CSS, JavaScript del navegador, Express, Oracle ni React.
- La identidad es provisional hasta disponer del nombre, logotipo, colores y fotografías reales de la empresa.
- El sitio público debe incluir inicio, servicios, trabajos, empresa, contacto y solicitud de cotización.
- Los visitantes no necesitan una cuenta.
- La interfaz debe poder evolucionar sin cambiar la arquitectura aprobada.
- Todo el texto visible estará escrito en español.

## Estructura de archivos

- `index.html`: documento público completo y navegación interna.
- `package.json`: comando reproducible para ejecutar las pruebas, sin dependencias externas.
- `tests/html.js`: utilidades pequeñas para cargar el documento y buscar etiquetas o atributos.
- `tests/homepage.test.js`: requisitos ejecutables de estructura, contenido y accesibilidad básica.
- `README.md`: instrucciones de aprendizaje, visualización y verificación de esta primera etapa.

---

### Task 1: Documento HTML mínimo y pruebas base

**Files:**
- Create: `package.json`
- Create: `tests/html.js`
- Create: `tests/homepage.test.js`
- Create: `index.html`

**Interfaces:**
- Consumes: ninguna.
- Produces: `loadHomepage(): string` y `hasElement(html: string, tag: string, attributes?: string): boolean`; documento `index.html` con idioma, metadatos, encabezado, contenido principal y pie de página.

- [ ] **Step 1: Crear la prueba que exige el documento base**

Crear `package.json`:

```json
{
  "name": "publitexweb",
  "version": "0.1.0",
  "private": true,
  "description": "Sitio y sistema de gestión para una empresa de publicidad visual",
  "scripts": {
    "test": "node --test"
  }
}
```

Crear `tests/html.js`:

```js
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
```

Crear `tests/homepage.test.js`:

```js
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
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo esperado**

Run: `npm test`

Expected: FAIL con `ENOENT` porque `index.html` todavía no existe.

- [ ] **Step 3: Crear el documento HTML mínimo**

Crear `index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Letreros luminosos, rotulación vehicular y adhesivos a medida.">
    <title>Publitexweb | Publicidad visual</title>
  </head>
  <body>
    <header>
      <p><a href="#inicio" aria-label="Ir al inicio">Publitexweb</a></p>
    </header>

    <main id="inicio">
      <h1>Hacemos que tu negocio destaque</h1>
    </main>

    <footer>
      <p><small>Publitexweb — Publicidad visual</small></p>
    </footer>
  </body>
</html>
```

- [ ] **Step 4: Ejecutar la prueba y confirmar que pasa**

Run: `npm test`

Expected: 1 test, 1 PASS, 0 FAIL.

- [ ] **Step 5: Guardar el documento base en Git**

```bash
git add package.json tests/html.js tests/homepage.test.js index.html
git commit -m "feat: add semantic HTML document shell"
```

---

### Task 2: Navegación y presentación principal

**Files:**
- Modify: `tests/homepage.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `loadHomepage()` y `hasElement()` de `tests/html.js`; ancla `#inicio` de Task 1.
- Produces: navegación hacia `#servicios`, `#trabajos`, `#empresa` y `#contacto`; presentación con accesos a `#cotizacion` y `#trabajos`.

- [ ] **Step 1: Escribir las pruebas de navegación y presentación**

Agregar a `tests/homepage.test.js`:

```js
test('ofrece navegación interna hacia todas las secciones públicas', () => {
  const html = loadHomepage();
  const destinations = ['#inicio', '#servicios', '#trabajos', '#empresa', '#contacto'];

  for (const destination of destinations) {
    assert.match(html, new RegExp(`href="${destination}"`, 'i'));
  }
});

test('presenta el servicio y dos acciones principales', () => {
  const html = loadHomepage();

  assert.match(html, /Hacemos que tu negocio destaque/i);
  assert.match(html, /Letreros luminosos, rotulación vehicular y soluciones adhesivas/i);
  assert.match(html, /href="#cotizacion"[^>]*>\s*Solicitar cotización/i);
  assert.match(html, /href="#trabajos"[^>]*>\s*Ver nuestros trabajos/i);
});
```

- [ ] **Step 2: Ejecutar las pruebas y verificar los fallos de enlaces y contenido**

Run: `npm test`

Expected: 2 pruebas nuevas FAIL porque aún no existen el menú completo ni las acciones.

- [ ] **Step 3: Implementar navegación y presentación**

Reemplazar el contenido de `<header>` por:

```html
<header>
  <p><a href="#inicio" aria-label="Ir al inicio">Publitexweb</a></p>
  <nav aria-label="Navegación principal">
    <ul>
      <li><a href="#inicio">Inicio</a></li>
      <li><a href="#servicios">Servicios</a></li>
      <li><a href="#trabajos">Trabajos</a></li>
      <li><a href="#empresa">Nosotros</a></li>
      <li><a href="#contacto">Contacto</a></li>
    </ul>
  </nav>
  <a href="#cotizacion">Cotizar proyecto</a>
</header>
```

Reemplazar el contenido inicial de `<main>` por:

```html
<main id="inicio">
  <section aria-labelledby="titulo-principal">
    <p>Diseño · Fabricación · Instalación</p>
    <h1 id="titulo-principal">Hacemos que tu negocio destaque</h1>
    <p>Letreros luminosos, rotulación vehicular y soluciones adhesivas diseñadas para hacer visible tu marca.</p>
    <p>
      <a href="#cotizacion">Solicitar cotización</a>
      <a href="#trabajos">Ver nuestros trabajos</a>
    </p>
  </section>
</main>
```

- [ ] **Step 4: Ejecutar toda la suite**

Run: `npm test`

Expected: 3 tests, 3 PASS, 0 FAIL.

- [ ] **Step 5: Guardar navegación y presentación en Git**

```bash
git add index.html tests/homepage.test.js
git commit -m "feat: add public navigation and hero content"
```

---

### Task 3: Servicios y proceso de trabajo

**Files:**
- Modify: `tests/homepage.test.js`
- Modify: `index.html`
- Create: `assets/trabajo-letrero.svg`
- Create: `assets/trabajo-camion.svg`
- Create: `assets/trabajo-vitrina.svg`

**Interfaces:**
- Consumes: navegación a `#servicios` creada en Task 2.
- Produces: sección `#servicios` con tres artículos y sección `#proceso` con cuatro pasos ordenados.

- [ ] **Step 1: Escribir las pruebas de servicios y proceso**

Agregar a `tests/homepage.test.js`:

```js
test('describe los tres servicios principales en artículos', () => {
  const html = loadHomepage();
  const services = ['Letreros luminosos', 'Rotulación vehicular', 'Adhesivos y gráficas'];

  assert.equal(hasElement(html, 'section', 'id="servicios"'), true);
  assert.equal((html.match(/<article\b/gi) || []).length >= 3, true);
  for (const service of services) assert.match(html, new RegExp(service, 'i'));
});

test('explica el proceso mediante una lista ordenada', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="proceso"'), true);
  assert.equal(hasElement(html, 'ol'), true);
  for (const step of ['Idea y medidas', 'Diseño', 'Fabricación', 'Instalación']) {
    assert.match(html, new RegExp(step, 'i'));
  }
});
```

- [ ] **Step 2: Ejecutar las pruebas y confirmar que faltan ambas secciones**

Run: `npm test`

Expected: 2 pruebas nuevas FAIL.

- [ ] **Step 3: Agregar servicios y proceso antes de cerrar `<main>`**

```html
<section id="servicios" aria-labelledby="titulo-servicios">
  <p>Lo que hacemos</p>
  <h2 id="titulo-servicios">Soluciones para destacar tu marca</h2>
  <article>
    <h3>Letreros luminosos</h3>
    <p>Diseño, fabricación e instalación de letreros visibles de día y de noche.</p>
  </article>
  <article>
    <h3>Rotulación vehicular</h3>
    <p>Gráficas y adhesivos para camiones, vehículos comerciales y flotas.</p>
  </article>
  <article>
    <h3>Adhesivos y gráficas</h3>
    <p>Soluciones para vitrinas, señalización, productos y superficies de distintos tamaños.</p>
  </article>
</section>

<section id="proceso" aria-labelledby="titulo-proceso">
  <h2 id="titulo-proceso">Cómo desarrollamos un proyecto</h2>
  <ol>
    <li><strong>Idea y medidas:</strong> conocemos la necesidad, ubicación y dimensiones.</li>
    <li><strong>Diseño:</strong> preparamos una propuesta visual y técnica.</li>
    <li><strong>Fabricación:</strong> producimos el trabajo con los materiales acordados.</li>
    <li><strong>Instalación:</strong> entregamos o instalamos el producto terminado.</li>
  </ol>
</section>
```

- [ ] **Step 4: Ejecutar toda la suite**

Run: `npm test`

Expected: 5 tests, 5 PASS, 0 FAIL.

- [ ] **Step 5: Guardar servicios y proceso en Git**

```bash
git add index.html tests/homepage.test.js
git commit -m "feat: describe services and production process"
```

---

### Task 4: Portafolio y presentación de la empresa

**Files:**
- Modify: `tests/homepage.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: anclas `#trabajos` y `#empresa` anunciadas en Task 2.
- Produces: portafolio con tres figuras y textos alternativos provisionales; descripción de la empresa.

- [ ] **Step 1: Escribir las pruebas de portafolio y empresa**

Agregar a `tests/homepage.test.js`:

```js
test('incluye un portafolio preparado para fotografías reales', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="trabajos"'), true);
  assert.equal((html.match(/<figure\b/gi) || []).length, 3);
  assert.equal((html.match(/<img\b[^>]*alt="[^"]+"/gi) || []).length, 3);
});

test('presenta a la empresa sin inventar cifras ni certificaciones', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="empresa"'), true);
  assert.match(html, /diseño, fabricación e instalación/i);
  assert.doesNotMatch(html, /años de experiencia|clientes satisfechos|certificad[oa]/i);
});
```

- [ ] **Step 2: Ejecutar las pruebas y observar los fallos esperados**

Run: `npm test`

Expected: 2 pruebas nuevas FAIL porque faltan `#trabajos` y `#empresa`.

- [ ] **Step 3: Agregar portafolio y empresa antes de cerrar `<main>`**

```html
<section id="trabajos" aria-labelledby="titulo-trabajos">
  <p>Proyectos realizados</p>
  <h2 id="titulo-trabajos">Trabajos que hacen visible una marca</h2>
  <figure>
    <img src="assets/trabajo-letrero.svg" alt="Letrero luminoso instalado en la fachada de un negocio">
    <figcaption>Letrero luminoso para local comercial</figcaption>
  </figure>
  <figure>
    <img src="assets/trabajo-camion.svg" alt="Camión comercial con rotulación adhesiva">
    <figcaption>Rotulación de vehículo comercial</figcaption>
  </figure>
  <figure>
    <img src="assets/trabajo-vitrina.svg" alt="Vitrina decorada con gráficas adhesivas">
    <figcaption>Adhesivos para vitrina</figcaption>
  </figure>
</section>

<section id="empresa" aria-labelledby="titulo-empresa">
  <p>Sobre la empresa</p>
  <h2 id="titulo-empresa">Del diseño a la instalación</h2>
  <p>Desarrollamos soluciones de publicidad visual adaptadas a las medidas, materiales y necesidades de cada proyecto.</p>
</section>
```

Crear `assets/trabajo-letrero.svg`, `assets/trabajo-camion.svg` y `assets/trabajo-vitrina.svg` como imágenes provisionales accesibles. Cada archivo debe usar este contenido, sustituyendo `DESCRIPCION` por `Letrero luminoso`, `Rotulación vehicular` y `Adhesivos para vitrina`, respectivamente:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420" role="img" aria-labelledby="title">
  <title id="title">DESCRIPCION — fotografía pendiente</title>
  <rect width="640" height="420" fill="#e5e7eb"/>
  <text x="320" y="210" text-anchor="middle" dominant-baseline="middle" fill="#374151" font-family="sans-serif" font-size="24">DESCRIPCION</text>
</svg>
```

- [ ] **Step 4: Ejecutar toda la suite**

Run: `npm test`

Expected: 7 tests, 7 PASS, 0 FAIL.

- [ ] **Step 5: Guardar portafolio y presentación en Git**

```bash
git add index.html assets tests/homepage.test.js
git commit -m "feat: add portfolio and company sections"
```

---

### Task 5: Formulario de cotización, contacto y pie de página

**Files:**
- Modify: `tests/homepage.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: ancla `#cotizacion` usada en Task 2 y ancla `#contacto` usada por la navegación.
- Produces: formulario HTML con método `post`, campos identificados, consentimiento y datos de contacto provisionales claramente marcados.

- [ ] **Step 1: Escribir las pruebas del formulario y contacto**

Agregar a `tests/homepage.test.js`:

```js
test('solicita los datos mínimos para preparar una cotización', () => {
  const html = loadHomepage();
  const fields = ['nombre', 'empresa-cliente', 'telefono', 'correo', 'servicio', 'descripcion'];

  assert.equal(hasElement(html, 'section', 'id="cotizacion"'), true);
  assert.equal(hasElement(html, 'form', 'method="post"'), true);
  for (const field of fields) {
    assert.match(html, new RegExp(`(?:id|name)="${field}"`, 'i'));
    assert.match(html, new RegExp(`for="${field}"`, 'i'));
  }
  assert.equal((html.match(/\brequired\b/gi) || []).length >= 5, true);
});

test('incluye contacto y navegación complementaria en el pie', () => {
  const html = loadHomepage();

  assert.equal(hasElement(html, 'section', 'id="contacto"'), true);
  assert.match(html, /Datos definitivos pendientes/i);
  assert.match(html, /<footer>[\s\S]*href="#inicio"/i);
});
```

- [ ] **Step 2: Ejecutar las pruebas y confirmar los dos fallos nuevos**

Run: `npm test`

Expected: 2 pruebas nuevas FAIL.

- [ ] **Step 3: Agregar cotización y contacto al final de `<main>`**

```html
<section id="cotizacion" aria-labelledby="titulo-cotizacion">
  <h2 id="titulo-cotizacion">Cuéntanos sobre tu proyecto</h2>
  <p>Indica qué necesitas. La empresa revisará la información antes de contactarte.</p>
  <form action="#" method="post">
    <p><label for="nombre">Nombre</label><input id="nombre" name="nombre" autocomplete="name" required></p>
    <p><label for="empresa-cliente">Empresa</label><input id="empresa-cliente" name="empresa-cliente" autocomplete="organization"></p>
    <p><label for="telefono">Teléfono</label><input id="telefono" name="telefono" type="tel" autocomplete="tel" required></p>
    <p><label for="correo">Correo</label><input id="correo" name="correo" type="email" autocomplete="email" required></p>
    <p>
      <label for="servicio">Tipo de trabajo</label>
      <select id="servicio" name="servicio" required>
        <option value="">Selecciona una opción</option>
        <option value="letrero">Letrero luminoso</option>
        <option value="vehiculo">Rotulación vehicular</option>
        <option value="adhesivo">Adhesivos y gráficas</option>
        <option value="otro">Otro</option>
      </select>
    </p>
    <p><label for="descripcion">Descripción, medidas y ubicación</label><textarea id="descripcion" name="descripcion" rows="6" required></textarea></p>
    <p><label><input name="consentimiento" type="checkbox" required> Autorizo el uso de estos datos para responder mi solicitud.</label></p>
    <button type="submit">Enviar solicitud</button>
  </form>
</section>

<section id="contacto" aria-labelledby="titulo-contacto">
  <h2 id="titulo-contacto">Contacto</h2>
  <p>Datos definitivos pendientes de confirmar con la empresa.</p>
</section>
```

Reemplazar el contenido de `<footer>` por:

```html
<footer>
  <p><strong>Publitexweb</strong> — Publicidad visual</p>
  <nav aria-label="Navegación complementaria">
    <a href="#inicio">Volver al inicio</a>
    <a href="#servicios">Servicios</a>
    <a href="#trabajos">Trabajos</a>
    <a href="#contacto">Contacto</a>
  </nav>
  <p><small>Identidad y datos comerciales provisionales.</small></p>
</footer>
```

- [ ] **Step 4: Ejecutar toda la suite**

Run: `npm test`

Expected: 9 tests, 9 PASS, 0 FAIL.

- [ ] **Step 5: Guardar formulario, contacto y pie en Git**

```bash
git add index.html tests/homepage.test.js
git commit -m "feat: add quote request and contact content"
```

---

### Task 6: Documentación y verificación final de la etapa HTML

**Files:**
- Modify: `tests/homepage.test.js`
- Create: `README.md`

**Interfaces:**
- Consumes: documento completo producido por Tasks 1–5.
- Produces: verificación de identificadores únicos, jerarquía de títulos y documentación para abrir y probar el sitio.

- [ ] **Step 1: Agregar pruebas finales de integridad del documento**

Agregar a `tests/homepage.test.js`:

```js
test('usa identificadores únicos y un solo título principal', () => {
  const html = loadHomepage();
  const ids = [...html.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1]);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
});

test('no incorpora tecnologías reservadas para etapas posteriores', () => {
  const html = loadHomepage();

  assert.doesNotMatch(html, /<style\b|<script\b|style="/i);
  assert.equal(html.includes('{{'), false);
});
```

- [ ] **Step 2: Ejecutar las pruebas y comprobar el resultado**

Run: `npm test`

Expected: 11 tests, 11 PASS, 0 FAIL. Si aparece un identificador repetido o estilo en línea, corregir exactamente ese atributo en `index.html` y repetir el comando.

- [ ] **Step 3: Crear la guía de aprendizaje y uso**

Crear `README.md`:

```markdown
# Publitexweb

Proyecto progresivo para una empresa de publicidad visual y para practicar desarrollo web y bases de datos.

## Etapa actual: HTML

Esta versión contiene solo la estructura y el contenido semántico. Todavía no incluye estilos ni comportamiento dinámico.

## Ver la página

Abre `index.html` en un navegador web.

## Ejecutar las pruebas

```bash
npm test
```

## Ruta de aprendizaje

HTML → CSS → JavaScript → Node.js + Express → Oracle → React
```

- [ ] **Step 4: Ejecutar la verificación final y revisar el estado de Git**

Run: `npm test && git status --short`

Expected: 11 tests, 11 PASS, 0 FAIL; solamente `README.md` y `tests/homepage.test.js` aparecen modificados o sin seguimiento.

- [ ] **Step 5: Guardar la primera etapa completa en Git**

```bash
git add README.md tests/homepage.test.js
git commit -m "docs: explain HTML learning stage"
```

- [ ] **Step 6: Confirmar el historial y el árbol limpio**

Run: `git log --oneline -8 && git status --short`

Expected: aparecen los seis commits de implementación, el commit del diseño y el commit del plan; `git status --short` no muestra archivos pendientes.
