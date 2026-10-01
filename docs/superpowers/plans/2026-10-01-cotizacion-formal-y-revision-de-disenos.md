# Cotización formal y revisión de diseños Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar la simulación referencial de la cotización formal y permitir que el equipo revise y apruebe diseños por producto antes de la aceptación comercial.

**Architecture:** La cotización formal reutiliza los productos y materiales activos del catálogo, pero guarda medida y cantidad solicitadas como texto, sin exponer precios. Una migración aditiva incorpora los datos comerciales, el estado de diseño por ítem, sus archivos versionados y la propuesta comercial final. Servicios y rutas separados validan archivos y permisos; las interfaces de cliente y equipo consumen esos contratos.

**Tech Stack:** Node.js 22, Express 5, SQLite/better-sqlite3, Multer, módulos ES del navegador, JSDOM y `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-01-cotizacion-formal-y-revision-de-disenos-design.md`

## Global Constraints

- La simulación pública conserva la estimación estándar; la cotización formal no muestra subtotales ni totales hasta la propuesta final.
- Cada producto formal guarda medida/cobertura y cantidad como texto libre, material, extras, observación y modalidad `client_file` o `publitex_design`.
- Los diseños de cliente aceptan únicamente PDF, JPG y PNG de hasta 10 MB; el archivo se asocia a un producto y sus versiones no se sobrescriben.
- El rechazo de un diseño exige comentario; solo jefe, trabajador y superadmin pueden revisar diseños.
- El envío exige teléfono, empresa, nombre de trabajo, forma de pago y, si requiere factura, razón social y RUT.
- `pending_confirmation` contiene el valor comercial final; el cliente debe confirmarlo antes de `accepted`.
- `Iluminación` deja de estar disponible como extra; `Letrero luminoso` aparece como producto separado con precios provisionales internos mayores.

## Review Focus

- Un cliente intenta enviar un producto con modalidad `client_file` pero sin archivo: el servidor lo rechaza sin cambiar el estado del borrador.
- Un archivo cuyo nombre o MIME dice PNG/PDF pero cuya firma no corresponde: el servidor devuelve 400 y no crea una versión.
- Un trabajador revisa un diseño enviado: puede aprobar o rechazar, pero no aceptar la cotización ni fijar la propuesta comercial.
- Un cliente ajeno, una simulación o una cotización entregada intentan descargar, reemplazar o revisar un diseño: reciben 404/403 según el contrato y no se filtra el archivo.
- Un catálogo o una cotización histórica con el extra `lighting`: permanece legible como snapshot, pero no se puede seleccionar en productos nuevos.

---

## File Structure

- `server/database/migrations/013_formal_quotes_design_reviews.sql`: añade datos comerciales, flexibiliza el snapshot de ítems para solicitudes a medida y crea el historial de archivos/revisiones y propuesta.
- `server/catalog/catalog-repository.js` / `server/catalog/catalog-service.js`: expone una selección formal válida por producto/material/extras y conserva la estimación pública.
- `server/quotes/quote-service.js` / `server/quotes/quote-repository.js` / `server/quotes/quote-routes.js`: crea ítems formales, persiste datos de envío y bloquea el envío incompleto.
- `server/quotes/design-document.js`, `design-service.js`, `design-routes.js`: inspecciona PDFs/JPEGs/PNGs, versiona archivos y aplica permisos y revisiones por producto.
- `server/quotes/workflow-service.js` / `workflow-routes.js`: coordina estados generales, propuesta comercial y confirmación del cliente.
- `cotizacion.html`, `js/simulador.js`, `cotizaciones.html`, `js/cotizaciones.js`, `gestion.html`, `js/gestion.js`, `js/estado-cotizacion.js`, `css/styles.css`: separan la solicitud formal de la simulación y muestran las acciones de cliente/equipo.
- `tests/*.test.js`: cubren migración, catálogo, servicios, HTTP, permisos y DOM.

### Task 1: Migración, catálogo sin iluminación y Letrero luminoso

**Files:**
- Create: `server/database/migrations/013_formal_quotes_design_reviews.sql`
- Modify: `server/catalog/catalog-repository.js`
- Modify: `server/catalog/catalog-service.js`
- Test: `tests/database-migrations.test.js`
- Test: `tests/catalog-repository.test.js`
- Test: `tests/catalog-service.test.js`

**Interfaces:**
- Produces `catalog.findFormalSelection({ productId, materialId, extraIds })`, returning `{ product, material, extras, catalogPriceId }` or `null` without price or standard size/quantity labels.
- Produces quote-item fields `requested_measure`, `requested_quantity`, `design_mode`, `design_status`; quote fields `payment_method`, `requires_invoice`, `billing_legal_name`, `billing_rut`, `proposal_total`, `proposal_note`, `proposal_created_at`, `proposal_confirmed_at`.

- [ ] **Step 1: Write migration and catalog tests first**

Add tests that migrate a populated database, preserve its existing quote items/extras, expose no `lighting` extra from `listActive`, and expose `sign-luminous` with a price greater than the comparable `sign-rect` selection. Add tests for `findFormalSelection` rejecting an inactive product, material, or extra and returning labels for a valid combination.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test tests/database-migrations.test.js tests/catalog-repository.test.js tests/catalog-service.test.js`

Expected: FAIL because migration 013 and `findFormalSelection` do not exist.

- [ ] **Step 3: Implement migration 013 and formal catalog lookup**

Add only additive/rebuild-safe schema changes: preserve old snapshots, add requested text and design fields, create `quote_item_design_files` with immutable version number/content/hash/uploader timestamps and `quote_item_design_reviews` with reviewer/status/comment/timestamp, and allow workflow statuses `changes_required` and `pending_confirmation`. Add `sign-luminous` catalog rows from the rectangular-sign variants, deactivate all `lighting` price extras, and implement the formal product/material/extra lookup using active catalogue records.

- [ ] **Step 4: Run the focused tests to verify passing**

Run: `node --test tests/database-migrations.test.js tests/catalog-repository.test.js tests/catalog-service.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the catalog and schema work**

```bash
git add server/database/migrations/013_formal_quotes_design_reviews.sql server/catalog tests/database-migrations.test.js tests/catalog-repository.test.js tests/catalog-service.test.js
git commit -m "feat: add formal quote schema and luminous sign"
```

### Task 2: Formal items and commercial submission validation

**Files:**
- Modify: `server/quotes/quote-repository.js`
- Modify: `server/quotes/quote-service.js`
- Modify: `server/quotes/quote-routes.js`
- Test: `tests/quote-repository.test.js`
- Test: `tests/quote-service.test.js`
- Test: `tests/quote-api.test.js`

**Interfaces:**
- Consumes `catalog.findFormalSelection(input)` from Task 1.
- Produces `quoteService.addFormalItem(quoteId, userId, { productId, materialId, extraIds, requestedMeasure, requestedQuantity, observation, designMode })`.
- Produces `quoteService.saveDetails(id, userId, { phone, company, workName, paymentMethod, requiresInvoice, billingLegalName, billingRut })` and an enriched quote DTO whose items contain `requestedMeasure`, `requestedQuantity`, `designMode`, `designStatus`, and review/file history metadata.

- [ ] **Step 1: Write failing service, repository, and HTTP tests**

Cover acceptance of arbitrary nonempty measure and quantity text, 1000-character observation limit, the two design modes, rejection of invalid modes, and server-side validation that payment method is one of `transfer`, `cash`, `card`, `credit`. Cover invoice fields being required only when `requiresInvoice` is true. Pin the Review Focus missing-file condition: submitting a `client_file` item with no uploaded version fails with a public 400 error.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test tests/quote-repository.test.js tests/quote-service.test.js tests/quote-api.test.js`

Expected: FAIL because formal-item and commercial-field contracts are absent.

- [ ] **Step 3: Implement formal draft persistence and submission rules**

Keep legacy item endpoints compatible for historical tests, add the formal item service/repository path, and use the active catalog lookup only for product/material/extra validation and labels. Formal items store no exposed estimate. Normalize the commercial fields, map them from the repository, and require every client-file item to have a current design version before `submit` changes the quote from `draft` to `submitted`.

- [ ] **Step 4: Run the focused tests to verify passing**

Run: `node --test tests/quote-repository.test.js tests/quote-service.test.js tests/quote-api.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the formal item and commercial-field work**

```bash
git add server/quotes/quote-repository.js server/quotes/quote-service.js server/quotes/quote-routes.js tests/quote-repository.test.js tests/quote-service.test.js tests/quote-api.test.js
git commit -m "feat: collect formal quote details"
```

### Task 3: Versioned product-design files and review API

**Files:**
- Create: `server/quotes/design-document.js`
- Create: `server/quotes/design-service.js`
- Create: `server/quotes/design-routes.js`
- Modify: `server/app.js`
- Modify: `server/server.js`
- Test: `tests/quote-design.test.js`
- Test: `tests/quote-design-http.test.js`

**Interfaces:**
- Produces `inspectQuoteDesign(file)` returning `{ filename, mediaType, content, sha256 }` for PDF/JPEG/PNG up to `MAX_DESIGN_BYTES` (10 MB), otherwise `INVALID_DESIGN`.
- Produces `designService.upload(quoteId, itemId, context, file)`, `list(quoteId, itemId, context)`, `download(quoteId, itemId, version, context)`, and `review(quoteId, itemId, context, { status, comment })`.
- Produces client routes `PUT /api/quotes/:id/items/:itemId/design`, `GET /api/quotes/:id/items/:itemId/designs`, `GET /api/quotes/:id/items/:itemId/designs/:version`; staff route `POST /api/work/quotes/:id/items/:itemId/design/review`.

- [ ] **Step 1: Write failing document, service, permission, and HTTP tests**

Use minimal valid PDF, JPEG, and PNG byte fixtures; test spoofed extensions/signatures and an 10 MB + 1 byte file. Test version 1 then version 2, status reset to `pending_review`, retained rejection comment/history, owner-only replacement, staff review, required rejection comment, worker inability to review another nonexistent item, and the Review Focus unauthorized/simulation/delivered access cases.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test tests/quote-design.test.js tests/quote-design-http.test.js`

Expected: FAIL because the design document, service, and routes do not exist.

- [ ] **Step 3: Implement binary inspection, versioning, and access control**

Validate magic bytes rather than browser MIME alone; sanitize filenames and use `multer.memoryStorage()` with a single `file` part. Permit client upload only on own submitted/change-required quote and only for `client_file` items; write a new version rather than overwrite. Permit jefe/trabajador/superadmin to list/download/review submitted quote designs. Require a nonempty 1000-character-or-less comment for `rejected`; write a review history row and update the item’s current status. Register the service and routers in the runtime/application.

- [ ] **Step 4: Run the focused tests to verify passing**

Run: `node --test tests/quote-design.test.js tests/quote-design-http.test.js`

Expected: PASS.

- [ ] **Step 5: Commit design-file handling**

```bash
git add server/quotes/design-document.js server/quotes/design-service.js server/quotes/design-routes.js server/app.js server/server.js tests/quote-design.test.js tests/quote-design-http.test.js
git commit -m "feat: review designs by quote item"
```

### Task 4: Workflow, proposal and client confirmation

**Files:**
- Modify: `server/quotes/workflow-service.js`
- Modify: `server/quotes/workflow-routes.js`
- Modify: `server/quotes/quote-service.js`
- Modify: `server/quotes/quote-routes.js`
- Modify: `js/estado-cotizacion.js`
- Test: `tests/workflow.test.js`
- Test: `tests/quote-api.test.js`
- Test: `tests/quote-page.test.js`

**Interfaces:**
- Produces manager endpoint `POST /api/work/quotes/:id/proposal` with `{ total, note }` and client endpoint `POST /api/quotes/:id/confirm-proposal`.
- Produces quote statuses `submitted`, `in_review`, `changes_required`, `pending_confirmation`, `accepted`, then the existing invoicing/production statuses.

- [ ] **Step 1: Write failing workflow and rendering tests**

Cover worker visibility from `submitted`, manager start-review, rejected item changing the quote to `changes_required`, replacement returning it to `in_review`, inability to propose while any design is pending/rejected/unresolved Publitex design, proposal validation for a nonnegative CLP integer and a bounded note, owner-only confirmation, and no direct manager transition from review to accepted. Test labels/progress for the two new general states.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test tests/workflow.test.js tests/quote-api.test.js tests/quote-page.test.js`

Expected: FAIL because proposal and confirmation transitions do not exist.

- [ ] **Step 3: Implement guarded transitions and proposal persistence**

Extend workflow visibility and status rules. Make a rejection place the parent quote in `changes_required`; after a client replacement, return it to `in_review`. Permit jefe/superadmin to create or replace a final proposal only after every item status is approved, including a documented resolution for `publitex_design`; set `pending_confirmation`. Only the owning client can confirm it, which records an event and moves to `accepted`. Keep invoice attachment and production rules valid after the new accepted boundary.

- [ ] **Step 4: Run the focused tests to verify passing**

Run: `node --test tests/workflow.test.js tests/quote-api.test.js tests/quote-page.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the commercial confirmation workflow**

```bash
git add server/quotes/workflow-service.js server/quotes/workflow-routes.js server/quotes/quote-service.js server/quotes/quote-routes.js js/estado-cotizacion.js tests/workflow.test.js tests/quote-api.test.js tests/quote-page.test.js
git commit -m "feat: confirm reviewed quote proposals"
```

### Task 5: Client-facing formal request and follow-up UI

**Files:**
- Modify: `cotizacion.html`
- Modify: `js/simulador.js`
- Modify: `cotizaciones.html`
- Modify: `js/cotizaciones.js`
- Modify: `css/styles.css`
- Test: `tests/simulator.test.js`
- Test: `tests/quote-page.test.js`
- Test: `tests/quote-journey.test.js`
- Test: `tests/styles.test.js`

**Interfaces:**
- Consumes the formal item endpoint from Task 2 and design upload routes from Task 3.
- Consumes `paymentMethod`, invoice fields, `designMode`, `designStatus`, design history, and proposal fields from the quote DTO.

- [ ] **Step 1: Write failing DOM and journey tests**

Assert that the public simulator still contains and calls the estimate endpoint, while `cotizacion.html` contains no estimate result/price controls. Assert its product form uses free requested-measure and requested-quantity fields, client-file upload accepts `.pdf,.jpg,.jpeg,.png`, and Publitex-design does not require a file. Assert the quote editor hides all estimated prices, requires payment/invoice data before confirmation, shows per-item rejection comments and replacement controls, and shows proposal total only in `pending_confirmation`.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test tests/simulator.test.js tests/quote-page.test.js tests/quote-journey.test.js tests/styles.test.js`

Expected: FAIL because the formal UI and states are absent.

- [ ] **Step 3: Implement the formal client experience**

Leave the index simulator and its reference price behavior unchanged. Replace the authenticated quote-builder estimate path with a product form that posts formal data and then uploads the required item file. Add payment selection, invoice toggle and conditionally required tax fields to the quote editor. Render no estimated totals/subtotals in formal quote cards. Render design state/history, a replacement file control only for rejected owner items, and proposal confirmation only for the owner in `pending_confirmation`. Preserve autosave ordering and accessible dialog focus behavior.

- [ ] **Step 4: Run the focused tests to verify passing**

Run: `node --test tests/simulator.test.js tests/quote-page.test.js tests/quote-journey.test.js tests/styles.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the client UI**

```bash
git add cotizacion.html js/simulador.js cotizaciones.html js/cotizaciones.js css/styles.css tests/simulator.test.js tests/quote-page.test.js tests/quote-journey.test.js tests/styles.test.js
git commit -m "feat: separate formal quote from simulation"
```

### Task 6: Equipo de revisión de productos y propuesta final

**Files:**
- Modify: `gestion.html`
- Modify: `js/gestion.js`
- Modify: `css/styles.css`
- Test: `tests/gestion-page.test.js`
- Test: `tests/quote-journey.test.js`

**Interfaces:**
- Consumes design list/download/review routes from Task 3 and proposal route from Task 4.
- Renders `quote.items[].designMode`, `designStatus`, requested dimensions/quantity, current design document and review history.

- [ ] **Step 1: Write failing management-page tests**

Cover manager and worker cards displaying requested measure/quantity and design information, open/download links, review controls with mandatory rejection comment, no estimated-total text, jefe/superadmin proposal inputs, and worker omission of proposal controls. Include the Review Focus worker-review condition.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test tests/gestion-page.test.js tests/quote-journey.test.js`

Expected: FAIL because product design review controls are not rendered.

- [ ] **Step 3: Implement management review cards**

Render each formal product as a review block with all requested details, current file and historical comments. Connect approve/reject actions to the review API and refresh the updated quote. For jefe/superadmin, show final-total and proposal-note controls only when the backend says the quote is eligible; workers may review but cannot propose, accept, invoice, or deliver. Remove estimate text from this formal-work view while retaining invoice totals where a real invoice exists.

- [ ] **Step 4: Run the focused tests to verify passing**

Run: `node --test tests/gestion-page.test.js tests/quote-journey.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the team review UI**

```bash
git add gestion.html js/gestion.js css/styles.css tests/gestion-page.test.js tests/quote-journey.test.js
git commit -m "feat: review quote designs in management"
```

### Task 7: Full regression and delivery check

**Files:**
- Modify only files required by failures from the verification commands.
- Test: `tests/**/*.test.js`

**Interfaces:**
- Consumes every task’s public routes, DTOs, migration, UI, and existing invoice/attachment contracts.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: PASS with zero failures.

- [ ] **Step 2: Exercise a realistic manual journey on an isolated database**

Create a temporary database, then verify: public simulation estimates a standard product; a client submits a formal item with a design; a worker rejects it with a comment; the client replaces it; a manager approves it and creates a proposal; the client confirms it; invoice/production transitions still work. Record the exact commands and observed statuses in the final handoff.

- [ ] **Step 3: Confirm the verified worktree state**

Run: `git status --short`

Expected: no output after the commits in Tasks 1–6; if a regression fix was needed, commit it with the exact files it changed before completing this step.
