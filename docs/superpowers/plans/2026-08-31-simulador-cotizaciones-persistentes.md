# Persistent Quote Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-priced public simulator that transfers its selection through login into an autosaved, multi-product SQLite quote draft owned by the authenticated client.

**Architecture:** Extend the existing versioned SQLite database with catalog and quote tables, then place repositories and services behind focused public and authenticated HTTP routes. Replace the in-memory homepage request form with a catalog-driven simulator, preserve only catalog identifiers temporarily through authentication, and render persistent drafts on a new private page.

**Tech Stack:** Node.js 22.13+, CommonJS server modules, ES browser modules, built-in `node:sqlite`, Express 5, jsdom, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-simulador-cotizaciones-persistentes-design.md`

## Global Constraints

- SQLite is the source of truth for catalog options, prices, quotes, and quote items.
- The browser never sends an authoritative price and never performs the price calculation.
- Creating, reading, editing, or submitting a quote requires an authenticated user.
- Every quote query is scoped by the real authenticated user id.
- A submitted quote cannot be edited or deleted through draft endpoints.
- Product, material, size, quantity, and extras come only from active compatible catalog options.
- Free-text observations never affect pricing.
- Vehicle wrapping returns `requiresEvaluation: true`; it never receives an invented number.
- Temporary handoff data contains catalog identifiers and observations only, never secrets or trusted prices.
- Existing authentication, public site, accessibility, and SQLite backup behavior must remain green.

---

## File Structure

**Create:**

- `server/database/migrations/002_catalog_quotes.sql`: catalog, pricing, quotes, and quote items schema plus demonstration seed data.
- `server/catalog/catalog-repository.js`: query active catalog options and resolve one compatible configuration.
- `server/catalog/catalog-service.js`: public catalog shape and authoritative estimate calculation.
- `server/catalog/catalog-routes.js`: public catalog and estimate endpoints.
- `server/quotes/quote-repository.js`: transactional persistence for owned drafts and items.
- `server/quotes/quote-service.js`: ownership, validation, totals, autosave, and submission rules.
- `server/quotes/quote-routes.js`: authenticated quote API.
- `js/simulador.js`: homepage catalog loading, dependent selects, estimate display, and handoff.
- `js/cotizaciones.js`: private quote list/editor, autosave state, item actions, and submission.
- `cotizaciones.html`: private drafts and submitted quotes page.
- `tests/catalog-repository.test.js`
- `tests/catalog-service.test.js`
- `tests/catalog-api.test.js`
- `tests/quote-repository.test.js`
- `tests/quote-service.test.js`
- `tests/quote-api.test.js`
- `tests/simulator.test.js`
- `tests/quote-page.test.js`
- `tests/quote-handoff.test.js`
- `tests/quote-journey.test.js`

**Modify:**

- `server/app.js`: mount public catalog and protected quote routers.
- `server/server.js`: compose catalog and quote dependencies from the owned SQLite connection.
- `index.html`: replace the simulated request manager with the public price simulator.
- `acceso.html`: preserve a safe return destination and link authenticated users to quotes.
- `js/acceso.js`: redirect only to an allowlisted internal destination after authentication.
- `js/app.js`: initialize the simulator and quote page.
- `css/styles.css`: simulator, estimate, quote editor, save-state, and responsive styles.
- `tests/access-page.test.js`: quote navigation and safe return behavior.
- `tests/javascript-foundation.test.js`: replace the obsolete blanket storage prohibition with a targeted handoff contract.
- `README.md`: explain demonstration estimates and persistent drafts.

---

### Task 1: Versioned catalog and quote schema

**Files:**
- Create: `server/database/migrations/002_catalog_quotes.sql`
- Modify: `tests/database-migrations.test.js`

**Interfaces:**
- Produces catalog identifiers: `sign-rect`, `sticker-print`, `banner`, `vehicle-wrap`.
- Produces quote statuses: `draft`, `submitted`.
- Produces foreign-key-backed tables consumed by Tasks 2 and 3.

- [ ] **Step 1: Write failing migration assertions**

Add a test that migrates a temporary database and asserts the literal table list contains `catalog_products`, `catalog_materials`, `catalog_sizes`, `catalog_quantities`, `catalog_extras`, `catalog_prices`, `catalog_price_extras`, `quotes`, `quote_items`, and `quote_item_extras`. Assert the four product codes occur exactly once after calling `migrateDatabase` twice. Assert a `quote_items` insert with an unknown `quote_id` fails with SQLite foreign-key error `787`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/database-migrations.test.js`

Expected: FAIL because `002_catalog_quotes.sql` and its tables do not exist.

- [ ] **Step 3: Implement migration and seed**

Create normalized catalog tables with stable text primary keys, `active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))`, integer Chilean-peso prices, and explicit compatibility foreign keys. Use `INSERT OR IGNORE` with these demonstrative groups:

```text
sign-rect: pvc-foam, acrylic, aluminium-composite; 50x30, 100x50, 150x75; qty 1,2,5
sticker-print: vinyl-white, vinyl-transparent, vinyl-microperforated; a4, 50x50, 100x100; qty 10,50,100
banner: canvas-standard, canvas-reinforced; 80x180, 100x200, 200x100; qty 1,2,5
vehicle-wrap: vehicle-car, vehicle-pickup, vehicle-van materials; coverage-partial, coverage-full sizes; qty 1
```

Seed fixed integer example base prices and compatible extras (`lighting`, `installation`, `eyelets`, `structure`) while marking `vehicle-wrap` with calculation type `evaluation`. Define `quotes(id, user_id, status, phone, company, estimated_total, has_evaluation, created_at, updated_at, submitted_at)` and immutable item snapshots for labels and estimated subtotal. Add indexes for quote owner/status and item ordering.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/database-migrations.test.js tests/database-backup.test.js`

Expected: PASS; backups include both migrations.

- [ ] **Step 5: Commit**

```bash
git add server/database/migrations/002_catalog_quotes.sql tests/database-migrations.test.js
git commit -m "feat: add catalog and quote database schema"
```

---

### Task 2: Catalog repository and authoritative pricing

**Files:**
- Create: `server/catalog/catalog-repository.js`
- Create: `server/catalog/catalog-service.js`
- Create: `tests/catalog-repository.test.js`
- Create: `tests/catalog-service.test.js`

**Interfaces:**
- Produces `createCatalogRepository({ database })` with `listActive()` and `findConfiguration({ productId, materialId, sizeId, quantityId, extraIds })`.
- Produces `createCatalogService({ catalog })` with async `getCatalog()` and `estimate(selection)`.
- `estimate` returns `{ selection, summary, estimatedTotal, requiresEvaluation }` and ignores any inbound `estimatedTotal` property.

- [ ] **Step 1: Write failing repository contract tests**

Assert `listActive()` returns products with nested compatible materials, sizes, quantities, and extras, excludes rows changed to `active = 0`, and never returns internal price columns. Assert `findConfiguration` returns one resolved configuration for literal valid identifiers and returns `null` for a material belonging to another product.

- [ ] **Step 2: Verify repository RED**

Run: `node --test tests/catalog-repository.test.js`

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the repository**

Prepare catalog reads once in the factory. Map SQLite null-prototype rows into plain camelCase objects. Sort products and nested options by their `sort_order`; accept duplicate extra ids only after deduplicating and sorting them. Resolve base and extra prices in one read transaction and return `null` unless every requested id is active and compatible.

- [ ] **Step 4: Verify repository GREEN**

Run: `node --test tests/catalog-repository.test.js`

Expected: PASS.

- [ ] **Step 5: Write failing pricing tests**

Use a real temporary SQLite catalog. Assert one known combination produces a hand-calculated literal total, quantity multiplication occurs exactly once, compatible extras add their fixed values, vehicle wrapping returns `estimatedTotal: null` and `requiresEvaluation: true`, and an incompatible selection rejects with `{ code: 'INVALID_CATALOG_SELECTION' }`. Include `estimatedTotal: 1` in input and prove it does not affect output.

- [ ] **Step 6: Implement pricing service and verify**

Calculate `estimatedTotal = (basePrice + sum(unitExtraPrices)) * quantity`, using only resolved repository values. Return labels in `summary`, ids in normalized `selection`, and a generic Spanish invalid-selection error. Run:

`node --test tests/catalog-service.test.js tests/catalog-repository.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/catalog tests/catalog-repository.test.js tests/catalog-service.test.js
git commit -m "feat: add server-side quote estimation"
```

---

### Task 3: Public catalog API

**Files:**
- Create: `server/catalog/catalog-routes.js`
- Create: `tests/catalog-api.test.js`
- Modify: `server/app.js`
- Modify: `server/server.js`

**Interfaces:**
- Produces `GET /api/catalog` → `{ products: [...] }`.
- Produces `POST /api/catalog/estimate` with catalog ids → authoritative estimate.
- `createRuntime` exposes `catalogRepository` and `catalogService` for focused tests.

- [ ] **Step 1: Write failing HTTP tests**

Build an app with a real temporary database and injected no-op login limiter. Assert catalog access works without a cookie, estimate returns the known literal result, malformed JSON remains handled by the existing error handler, incompatible ids return `400`, and an inbound fake price is absent from the result.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/catalog-api.test.js`

Expected: FAIL with `404` for `/api/catalog`.

- [ ] **Step 3: Implement and mount router**

Create an Express router with JSON responses and pass service errors through `next`. Map `INVALID_CATALOG_SELECTION` to status `400` without exposing SQL details. Compose catalog dependencies whenever a runtime-owned or externally injected database is available; allow `catalogService` injection in route tests.

- [ ] **Step 4: Verify GREEN and regressions**

Run: `node --test tests/catalog-api.test.js tests/security-http.test.js tests/runtime-persistence.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/catalog/catalog-routes.js server/app.js server/server.js tests/catalog-api.test.js
git commit -m "feat: expose public quote catalog API"
```

---

### Task 4: Owned quote repository

**Files:**
- Create: `server/quotes/quote-repository.js`
- Create: `tests/quote-repository.test.js`

**Interfaces:**
- Produces `createQuoteRepository({ database, now? })`.
- Methods: `createDraft({ id, userId })`, `listByUser(userId)`, `findOwned(id, userId)`, `saveDetails({ id, userId, phone, company })`, `addItem({ quoteId, userId, item })`, `updateItem({ quoteId, itemId, userId, item })`, `deleteItem({ quoteId, itemId, userId })`, `submit({ id, userId })`.
- Every returned quote is `{ id, status, phone, company, estimatedTotal, hasEvaluation, createdAt, updatedAt, submittedAt, items }`.

- [ ] **Step 1: Write failing repository tests**

Using two persisted users, prove draft creation/listing, plain-object mapping, restart persistence, stable item order, item snapshot/extras round-trip, total recomputation, and strict ownership. Assert updates with the second user return `null` and do not change data. Assert submit changes status and timestamp transactionally; later save/add/update/delete methods reject with `{ code: 'QUOTE_NOT_EDITABLE' }`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/quote-repository.test.js`

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement transactional repository**

Prepare statements once. Wrap item write plus quote aggregate recomputation in `BEGIN IMMEDIATE` / `COMMIT`, rolling back on error. Compute aggregate as the sum of non-null item subtotals and set `has_evaluation` if any item requires evaluation. Include `user_id = ?` in every quote mutation and use a shared owned-draft lookup before item writes.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/quote-repository.test.js tests/runtime-persistence.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/quotes/quote-repository.js tests/quote-repository.test.js
git commit -m "feat: persist owned quote drafts"
```

---

### Task 5: Quote service, autosave API, and submission

**Files:**
- Create: `server/quotes/quote-service.js`
- Create: `server/quotes/quote-routes.js`
- Create: `tests/quote-service.test.js`
- Create: `tests/quote-api.test.js`
- Modify: `server/app.js`
- Modify: `server/server.js`

**Interfaces:**
- Produces `createQuoteService({ quotes, catalogService, createId? })`.
- Produces protected endpoints: `GET/POST /api/quotes`, `GET/PATCH /api/quotes/:id`, `POST /api/quotes/:id/items`, `PUT/DELETE /api/quotes/:id/items/:itemId`, `POST /api/quotes/:id/submit`.

- [ ] **Step 1: Write failing service tests**

Assert the service validates Chilean/international phone input as 8–15 digits after separators, trims company/observation, recalculates every item through `catalogService`, stores server snapshots, supports multiple items, and rejects empty submission with `QUOTE_EMPTY`, invalid details with `INVALID_QUOTE`, and submitted edits with `QUOTE_NOT_EDITABLE`.

- [ ] **Step 2: Implement service and verify**

Return errors with stable codes and Spanish public messages. Never forward request prices into repository items. Run `node --test tests/quote-service.test.js`; expected PASS.

- [ ] **Step 3: Write failing authenticated API tests**

Use real users, sessions, SQLite repositories, and cookies. Assert every endpoint returns `401` without a session, client A receives `404` for client B's id, autosave returns the full updated draft, invalid state returns `409`, successful submission returns status `submitted`, and subsequent mutation returns `409`.

- [ ] **Step 4: Mount routes and compose dependencies**

Apply `requireUser` to the quote router. Map validation to `400`, ownership/missing resource to `404`, and state conflicts to `409`. Expose `quoteRepository` and `quoteService` on runtime while preserving existing injection behavior.

- [ ] **Step 5: Verify API and security**

Run: `node --test tests/quote-api.test.js tests/quote-service.test.js tests/authorization.test.js tests/security-http.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/quotes server/app.js server/server.js tests/quote-service.test.js tests/quote-api.test.js
git commit -m "feat: add authenticated quote workflow API"
```

---

### Task 6: Public simulator interface

**Files:**
- Create: `js/simulador.js`
- Create: `tests/simulator.test.js`
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/styles.css`
- Modify: `tests/homepage.test.js`
- Modify: `tests/form.test.js`
- Modify: `tests/javascript-foundation.test.js`

**Interfaces:**
- Produces `initSimulator(documentRoot = document, api = fetch, storage = sessionStorage)`.
- Stores handoff under `publitex_quote_handoff_v1` with `{ productId, materialId, sizeId, quantityId, extraIds, observation }` only.

- [ ] **Step 1: Write failing DOM tests**

Assert catalog options load from a complete real-response fixture; selecting a product limits dependent controls; incompatible prior selections clear; estimate requests contain ids but no price; the literal result and disclaimer render; evaluation renders no currency; API errors preserve selection; and clicking **Cotizar este proyecto** stores only the allowlisted handoff fields then navigates to `acceso.html?returnTo=cotizaciones.html`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/simulator.test.js`

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Replace old homepage request UI**

Remove the in-memory prepared-request manager markup from `index.html` and render labeled product/material/size/quantity selects, compatible extra checkboxes, optional observation, estimate action, result region, disclaimer, and handoff CTA. Keep `js/solicitudes.js` only until no remaining tests/imports use it; delete it and obsolete state tests in this same commit if `rg solicitudes` shows no production consumer.

- [ ] **Step 4: Implement simulator state and accessibility**

Use text nodes, not `innerHTML`. Disable dependent selects until choices exist, announce catalog/estimate state through `aria-live`, and focus the first invalid control. Treat storage failure as nonfatal: navigate to access but explain that the configuration must be selected again after login.

- [ ] **Step 5: Verify frontend GREEN**

Run: `node --test tests/simulator.test.js tests/homepage.test.js tests/form.test.js tests/javascript-foundation.test.js tests/styles.test.js`

Expected: PASS after updating obsolete tests to the new public contract.

- [ ] **Step 6: Commit**

```bash
git add index.html js/simulador.js js/app.js css/styles.css tests
git commit -m "feat: replace quote form with public simulator"
```

---

### Task 7: Safe authentication return and quote handoff

**Files:**
- Create: `tests/quote-handoff.test.js`
- Modify: `js/acceso.js`
- Modify: `acceso.html`
- Modify: `tests/access-page.test.js`

**Interfaces:**
- Allows only `cotizaciones.html` as `returnTo`; all other values fall back to the existing account view.
- Successful register/login navigates through injected `navigate(url)` for deterministic tests.

- [ ] **Step 1: Write failing redirect tests**

Assert successful login with `?returnTo=cotizaciones.html` navigates there, registration behaves identically, absent return destination stays on the account view, and `https://evil.example`, `//evil.example`, encoded traversal, and unknown local pages never navigate.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/quote-handoff.test.js tests/access-page.test.js`

Expected: FAIL because authentication currently has no safe return handling.

- [ ] **Step 3: Implement allowlisted return**

Read `location.search`, compare the decoded value to the literal allowlist `new Set(['cotizaciones.html'])`, and call `navigate` only after a successful authenticated response. Add copy explaining that access is required to save the quote.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test tests/quote-handoff.test.js tests/access-page.test.js tests/session-navigation.test.js`

Expected: PASS.

```bash
git add js/acceso.js acceso.html tests/quote-handoff.test.js tests/access-page.test.js
git commit -m "feat: resume quotes safely after authentication"
```

---

### Task 8: Private quote page and autosave UI

**Files:**
- Create: `cotizaciones.html`
- Create: `js/cotizaciones.js`
- Create: `tests/quote-page.test.js`
- Modify: `js/app.js`
- Modify: `css/styles.css`
- Modify: `acceso.html`

**Interfaces:**
- Produces `initQuotePage(documentRoot = document, api = fetch, storage = sessionStorage)`.
- Consumes the Task 5 quote API and Task 6 handoff key.

- [ ] **Step 1: Write failing page contract tests**

Assert semantic navigation to Inicio/Mi cuenta/Mis cotizaciones; accessible draft list/editor; phone/company controls; add/edit/delete item controls; literal save states `Guardando…`, `Borrador guardado`, and recoverable error; submitted quotes render read-only; and the submit confirmation dialog traps/restores focus.

- [ ] **Step 2: Write failing behavior tests**

Assert unauthenticated session redirects to access with safe return, quote list loads, a handoff creates a draft/item and is removed only after server success, two products render separately, autosave sends trimmed details, failed autosave keeps visible values and offers retry, and confirmed submit switches to read-only.

- [ ] **Step 3: Verify RED**

Run: `node --test tests/quote-page.test.js`

Expected: FAIL because the page/module do not exist.

- [ ] **Step 4: Implement page and state machine**

Keep server responses as the canonical saved state and a separate editable view model for pending changes. Serialize autosaves so a slower response cannot overwrite a newer edit. Disable only the affected action while saving. Clear handoff after confirmed item creation; on catalog rejection retain it and offer return to simulator.

- [ ] **Step 5: Add responsive and accessible styling**

Reuse existing cards, status colors, focus rings, dialog isolation, and reduced-motion rules. On narrow screens stack quote list, editor, and totals without horizontal scrolling.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test tests/quote-page.test.js tests/access-page.test.js tests/styles.test.js`

Expected: PASS.

```bash
git add cotizaciones.html js/cotizaciones.js js/app.js css/styles.css acceso.html tests/quote-page.test.js
git commit -m "feat: add persistent client quote workspace"
```

---

### Task 9: End-to-end journey, documentation, and cleanup

**Files:**
- Create: `tests/quote-journey.test.js`
- Modify: `README.md`
- Modify: any obsolete request-state files proven unused by `rg`.

**Interfaces:**
- Verifies the complete public-to-private flow against a real temporary SQLite file and HTTP server.

- [ ] **Step 1: Write the end-to-end test**

Start a runtime with deterministic ids and a temporary database. Through HTTP: fetch catalog, estimate a known product, register a user, create a draft, add the simulated item plus a second item, autosave contact details, close runtime, reopen the same database, list the same draft, submit it, and prove later mutation returns `409`. Register a second client and prove the first quote returns `404` for that session.

- [ ] **Step 2: Verify journey**

Run: `node --test tests/quote-journey.test.js`

Expected: PASS.

- [ ] **Step 3: Remove obsolete simulation code safely**

Run `rg -n "solicitudes|data-requests-view|data-submit-quote" . -g '!node_modules'`. Delete only modules/tests with no remaining production consumer, update imports, then rerun `node --test tests/javascript-foundation.test.js tests/homepage.test.js`.

- [ ] **Step 4: Update documentation**

Document that catalog prices are demonstration estimates, quotes require login, drafts autosave in SQLite, submitted quotes are read-only in this stage, vehicle wrapping requires evaluation, and the real boss price table/admin editor are future work.

- [ ] **Step 5: Run full verification**

Run: `npm test`

Expected outside restricted sandbox: all tests PASS. If HTTP binding returns `listen EPERM`, rerun with the approved local-port permission; do not weaken application networking or tests.

Run: `git status --short --ignored`

Expected: source/test/doc changes tracked; `data/*.sqlite`, WAL/SHM files, backups, `node_modules`, `.worktrees`, and `.superpowers` remain ignored.

- [ ] **Step 6: Manual acceptance journey**

With a temporary `PUBLITEX_DB_PATH`, start the server, simulate a product, click **Cotizar este proyecto**, register, confirm the item appears in a draft, add a second item, reload, restart the server, verify both remain, submit, and verify controls become read-only. Confirm another account cannot open the quote.

- [ ] **Step 7: Commit**

```bash
git add README.md tests/quote-journey.test.js
git add -u
git commit -m "test: verify persistent quote journey"
```

---

## Completion Check

Before this plan is complete:

1. Compare every acceptance criterion in the spec against Tasks 1–9.
2. Confirm all price assertions use hand-calculated literals independent of production code.
3. Confirm no API accepts a trusted price or cross-user quote id.
4. Confirm the handoff is removed only after a successful persisted item response.
5. Confirm draft persistence after both browser reload and server restart.
6. Confirm submitted quotes reject every draft mutation.
7. Run the complete suite and the manual two-user journey.
8. Confirm the repository contains no database, backup, secret, or brainstorm session artifact.
