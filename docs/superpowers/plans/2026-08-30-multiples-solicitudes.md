# Multiple Quote Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir crear, seleccionar, editar y eliminar varias solicitudes independientes durante la sesión, mostrando una activa y las demás en una lista compacta.

**Architecture:** Un módulo puro `js/solicitudes.js` producirá estados inmutables sin conocer el DOM. `js/formulario.js` conservará validación y campos, coordinará los modos crear/editar y renderizará la solicitud activa y el historial con nodos seguros; la confirmación de eliminación será un diálogo accesible separado dentro del mismo componente.

**Tech Stack:** HTML5, CSS3, JavaScript ES modules, Node.js 22+, `node:test`, JSDOM 26.1.0.

**Spec:** `docs/superpowers/specs/2026-08-30-multiples-solicitudes-design.md`

## Global Constraints

- Cada solicitud es independiente y conserva un identificador y fecha de creación propios.
- Mantener una sola solicitud activa; excluirla de “Otras solicitudes preparadas”.
- La colección existe solo en memoria y desaparece al recargar.
- No usar `fetch`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `sessionStorage`, cookies ni IndexedDB.
- Mostrar literalmente: “Simulación: estas solicitudes todavía no fueron enviadas a la empresa”.
- Crear, seleccionar, editar y eliminar debe funcionar con mouse y teclado.
- Renderizar datos personales con `createElement` y `textContent`, nunca con `innerHTML`.
- Eliminar requiere confirmación accesible, contención de foco, Escape y restauración de foco.
- Si falta el marcado asociado, el módulo debe terminar sin impedir las demás funciones.
- Respetar `prefers-reduced-motion` y conservar todas las pruebas actuales.

---

### Task 1: Estado puro de la colección

**Files:**
- Create: `js/solicitudes.js`
- Create: `tests/requests-state.test.js`

**Interfaces:**
- Consumes: objetos de valores normalizados y metadatos `{ id: string, createdAt: string }` proporcionados por el coordinador DOM.
- Produces: `createRequestState()`, `addRequest(state, values, metadata)`, `selectRequest(state, id)`, `updateRequest(state, id, values)`, `removeRequest(state, id)`, `getActiveRequest(state)` y `getOtherRequests(state)`.
- Estado: `{ requests: QuoteRequest[], activeId: string | null }`; las operaciones devuelven un objeto nuevo y nunca mutan su entrada.

- [ ] **Step 1: Escribir pruebas fallidas de creación y selección**

Create `tests/requests-state.test.js` using dynamic import and these fixtures:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const firstValues = {
  nombre: 'Ana', empresa: 'Taller Sur', telefono: '+56 9 1111 1111',
  correo: 'ana@example.com', servicio: 'letrero',
  descripcion: 'Letrero luminoso para la fachada principal.', consentimiento: true,
};

test('añade solicitudes sin reemplazar las anteriores y activa la nueva', async () => {
  const { createRequestState, addRequest } = await import('../js/solicitudes.js');
  let state = addRequest(createRequestState(), firstValues, { id: 'q-1', createdAt: '2026-08-30T10:00:00.000Z' });
  const previous = state;
  state = addRequest(state, { ...firstValues, nombre: 'Beto' }, { id: 'q-2', createdAt: '2026-08-30T11:00:00.000Z' });
  assert.equal(previous.requests.length, 1);
  assert.deepEqual(state.requests.map(({ id }) => id), ['q-1', 'q-2']);
  assert.equal(state.activeId, 'q-2');
});
```

Add a test that `selectRequest(state, 'q-1')` changes only `activeId`, while an unknown id returns the same state reference.

- [ ] **Step 2: Ejecutar para comprobar RED**

Run: `node --test tests/requests-state.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/solicitudes.js`.

- [ ] **Step 3: Implementar creación, adición y selección mínimas**

Create `js/solicitudes.js` with frozen-independent copies:

```js
export function createRequestState() {
  return { requests: [], activeId: null };
}

export function addRequest(state, values, { id, createdAt }) {
  const request = { ...values, id, createdAt };
  return { requests: [...state.requests, request], activeId: id };
}

export function selectRequest(state, id) {
  return state.requests.some((request) => request.id === id)
    ? { ...state, activeId: id }
    : state;
}
```

- [ ] **Step 4: Añadir pruebas fallidas de consultas, edición y eliminación**

Test these exact outcomes:

- `getActiveRequest` returns the selected object or `null`.
- `getOtherRequests` excludes the active request and returns newest first.
- `updateRequest(state, 'q-1', changedValues)` preserves `id` and `createdAt`, replaces only values for `q-1`, and makes it active.
- Updating an unknown id returns the same reference.
- Removing a non-active request preserves `activeId`.
- Removing the active request selects the newest remaining request.
- Removing the last request returns `{ requests: [], activeId: null }`.
- Removing an unknown id returns the same reference.

- [ ] **Step 5: Ejecutar RED e implementar las transiciones**

Run: `node --test tests/requests-state.test.js`

Expected: FAIL because the four exports do not exist.

Implement with `map`, `filter`, `find`, and `findLast`; preserve references on unknown identifiers. `updateRequest` must build `{ ...oldRequest, ...values, id: oldRequest.id, createdAt: oldRequest.createdAt }`. `removeRequest` must choose `remaining.at(-1)?.id ?? null` only when the active request was removed.

- [ ] **Step 6: Verificar y guardar**

Run: `node --test tests/requests-state.test.js && npm test && git diff --check`

Expected: all state tests and the existing six suites pass.

```bash
git add js/solicitudes.js tests/requests-state.test.js
git commit -m "feat: model multiple quote requests"
```

---

### Task 2: Crear, seleccionar y editar solicitudes

**Files:**
- Modify: `index.html`
- Modify: `js/formulario.js`
- Modify: `tests/form.test.js`

**Interfaces:**
- Consumes: all Task 1 state functions; injectable `options = { createId, now }` in `initQuoteForm(documentRoot, options)` for deterministic tests.
- Produces: the active-detail contract `[data-active-request]`, history `[data-request-history]`, rows `[data-request-item]`, and modes `create`/`edit` managed by the form.

- [ ] **Step 1: Actualizar el fixture y escribir la prueba fallida de múltiples solicitudes**

Replace the single summary fixture in `tests/form.test.js` with this contract after `[data-quote-form]`:

```html
<section data-requests-view hidden>
  <div data-requests-status role="status" aria-live="polite"></div>
  <article data-active-request tabindex="-1">
    <h3>Solicitud activa</h3>
    <p><strong>Simulación: estas solicitudes todavía no fueron enviadas a la empresa</strong></p>
    <dl data-active-request-list></dl>
    <button type="button" data-edit-active>Editar</button>
    <button type="button" data-delete-active>Eliminar</button>
    <button type="button" data-create-request>Crear otra solicitud</button>
  </article>
  <section data-request-history aria-labelledby="request-history-title" hidden>
    <h3 id="request-history-title">Otras solicitudes preparadas</h3>
    <ul data-request-list></ul>
  </section>
</section>
<button type="button" data-cancel-form hidden>Cancelar</button>
```

Include optional `<input name="empresa-cliente">`. Add a test that initializes with deterministic ids/times, submits Ana, chooses Crear otra solicitud, submits Beto, and asserts:

- The active detail contains Beto.
- The history contains exactly one `[data-request-item]` containing Ana.
- The active warning has the exact plural text.
- Clicking the history item’s `[data-view-request]` makes Ana active and moves Beto to history.

- [ ] **Step 2: Ejecutar para comprobar RED**

Run: `node --test tests/form.test.js`

Expected: FAIL because the current module replaces one summary and does not create a collection.

- [ ] **Step 3: Reemplazar el contrato HTML público**

In `index.html`, replace `.quote-summary` with the contract above and keep the form intrinsically non-submitting. Add `data-form-title` to its heading or a dedicated form-mode heading, and change the submit button’s text through `[data-submit-quote]`. Keep all information visible without JavaScript: use `hidden` only on enhancement views whose content starts empty.

- [ ] **Step 4: Implementar creación y renderizado seguro**

In `js/formulario.js`:

- Import Task 1 functions.
- Extend collection/render labels with `empresa` and map it to `[name="empresa-cliente"]` without validating it.
- Change the signature to `initQuoteForm(documentRoot = document, options = {})`.
- Use `options.createId ?? (() => crypto.randomUUID())` and `options.now ?? (() => new Date().toISOString())`.
- Keep local `state = createRequestState()` and `editingId = null`.
- Build detail/history exclusively with `createElement` and `textContent`.
- Store ids only in `button.dataset.requestId`; delegated clicks resolve them through state functions.
- After a valid creation, call `addRequest`, hide the form, render views, and focus `[data-active-request]`.
- “Crear otra solicitud” resets fields/errors, sets create mode, shows form, exposes `[data-cancel-form]`, and focuses Nombre without deleting state.
- Cancel create restores the active view without modifying state.

- [ ] **Step 5: Escribir RED para edición aislada y cancelación**

Add tests that create Ana and Beto, click Ana’s `[data-edit-request]`, and assert fields contain Ana. Change Nombre to “Ana Editada”, save, and assert Ana changed while Beto did not. Assert id/time are indirectly preserved by keeping the same history button `data-request-id`. Add a separate test proving Cancelar edición discards typed changes.

- [ ] **Step 6: Implementar edición y verificar**

On edit, set `editingId`, populate all fields, change submit text to “Guardar cambios”, show cancel, hide the request view, and focus Nombre. A valid save calls `updateRequest`; cancellation clears `editingId`, resets the form, and restores the previous active request. Active and history Editar buttons share this path.

Run: `node --test tests/form.test.js && npm test && git diff --check`

Expected: creation, selection, isolated editing, cancellation, validation, security, and existing suites pass.

- [ ] **Step 7: Guardar el flujo principal**

```bash
git add index.html js/formulario.js tests/form.test.js
git commit -m "feat: manage multiple quote requests in session"
```

---

### Task 3: Eliminación accesible y estados límite

**Files:**
- Modify: `index.html`
- Modify: `js/formulario.js`
- Modify: `tests/form.test.js`

**Interfaces:**
- Consumes: `removeRequest(state, id)` from Task 1 and active/history buttons from Task 2.
- Produces: `#request-delete-dialog`, `[data-confirm-delete]`, `[data-cancel-delete]`, focus containment and deterministic post-delete selection.

- [ ] **Step 1: Añadir el diálogo y escribir pruebas fallidas**

Append this contract after `[data-requests-view]` in the fixture and public HTML:

```html
<div id="request-delete-dialog" role="alertdialog" aria-modal="true"
     aria-labelledby="request-delete-title" aria-describedby="request-delete-description" hidden>
  <div data-request-delete-panel>
    <h3 id="request-delete-title">Eliminar solicitud</h3>
    <p id="request-delete-description" data-delete-description></p>
    <button type="button" data-confirm-delete>Eliminar solicitud</button>
    <button type="button" data-cancel-delete>Cancelar</button>
  </div>
</div>
```

Test that clicking Eliminar for Ana opens the dialog, includes “Ana” in its description, focuses Cancelar, traps Tab/Shift+Tab, closes with Escape, and restores focus to the exact delete trigger without changing the collection.

- [ ] **Step 2: Ejecutar RED e implementar apertura/cancelación**

Run: `node --test tests/form.test.js`

Expected: FAIL because no delete dialog handlers exist.

Implement local `pendingDeleteId` and `deleteTrigger`; set `inert` on siblings while open using the same save/restore pattern as `js/portafolio.js`. Handle Escape and focus wrapping only while visible. Cancel clears pending state and restores focus with optional chaining.

- [ ] **Step 3: Escribir pruebas fallidas de confirmación y límites**

Cover these flows:

- Deleting a non-active request leaves active detail unchanged.
- Deleting the active request activates the newest remaining request.
- Deleting the last request hides request views, shows an empty create form, and focuses Nombre.
- Each successful deletion updates `[data-requests-status]` with a visible announcement.
- Unknown/stale ids do not throw or change the DOM state.

- [ ] **Step 4: Implementar confirmación y verificar**

On confirm, call `removeRequest`, close the dialog without restoring focus to a removed button, then render. If an active request remains, focus its detail; otherwise enter empty create mode and focus Nombre. Use the exact status “Solicitud eliminada. Tus otras solicitudes preparadas no cambiaron.” when requests remain and “Solicitud eliminada. No quedan solicitudes preparadas.” when empty.

Run: `node --test tests/form.test.js && npm test && git diff --check`

Expected: all delete, focus, boundary, and prior tests pass.

- [ ] **Step 5: Guardar eliminación**

```bash
git add index.html js/formulario.js tests/form.test.js
git commit -m "feat: delete prepared quote requests accessibly"
```

---

### Task 4: Diseño responsive, documentación y verificación integral

**Files:**
- Modify: `css/styles.css`
- Modify: `README.md`
- Modify: `tests/styles.test.js`
- Modify: `tests/javascript-foundation.test.js`

**Interfaces:**
- Consumes: all `data-*`, `hidden`, `inert`, form modes, request view and delete-dialog contracts from Tasks 2–3.
- Produces: responsive master-detail presentation and documented temporary in-memory behavior.

- [ ] **Step 1: Escribir pruebas visuales y de seguridad fallidas**

Extend `tests/styles.test.js` to require declarations for:

```js
const requestSelectors = [
  '[data-requests-view]', '[data-active-request]', '[data-request-history]',
  '[data-request-item]', '#request-delete-dialog', '[data-request-delete-panel]',
  '[data-request-actions]', '[data-cancel-form]',
];
```

Assert the dialog is fixed with an inset/backdrop and the panel has constrained height/overflow. Assert request actions wrap, history is a list/grid, and a `min-width: 48rem` rule creates a wider active/history layout. Extend the JavaScript security scan to include the new `js/solicitudes.js` automatically through the existing `js/*.js` glob and assert no `innerHTML` reference exists in `js/formulario.js` or `js/solicitudes.js`.

- [ ] **Step 2: Ejecutar para comprobar RED**

Run: `node --test tests/styles.test.js tests/javascript-foundation.test.js`

Expected: FAIL because the new selectors and responsive layout are not styled.

- [ ] **Step 3: Diseñar estados y responsive**

Append focused CSS for request detail, compact history cards, wrapped actions, form-mode actions, live status, and fixed delete backdrop/panel. Use existing color variables and focus styles. On mobile stack everything in one column; at `48rem` allow request content/history items to use multiple columns without reducing touch targets. Add all new transitions to the existing reduced-motion override.

- [ ] **Step 4: Actualizar README**

Document that multiple independent requests can be prepared, edited and removed only during the current page session; reloading discards them; none are sent or stored; future persistence will require the backend/database stage.

- [ ] **Step 5: Verificar automáticamente**

Run: `npm test && git diff --check`

Expected: all state, form, accessibility, HTML, CSS, navigation, portfolio, and security suites pass with zero failures.

- [ ] **Step 6: Verificar manualmente en navegador**

Run: `python3 -m http.server 8081 --bind 127.0.0.1`.

At 320px, 768px, and 1440px verify: create three requests; select each; edit the first without changing the others; cancel an edit; cancel deletion with Escape; confirm deletion of inactive, active, and final requests; inspect focus order, live announcements, console and Network; reload and confirm the in-memory collection disappears.

- [ ] **Step 7: Guardar el acabado**

```bash
git add css/styles.css README.md tests/styles.test.js tests/javascript-foundation.test.js
git commit -m "feat: complete multiple quote request experience"
```

- [ ] **Step 8: Confirmar estado final**

Run: `npm test && git diff --check && git status --short --branch`

Expected: all tests pass, diff check prints nothing, and the branch has no uncommitted tracked files.
