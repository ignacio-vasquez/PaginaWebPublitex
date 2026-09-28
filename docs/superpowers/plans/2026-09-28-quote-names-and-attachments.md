# Quote Names and Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add searchable work names and four secure, stage-aware attachments to each quote while keeping acceptance and delivery unblocked when files are missing.

**Architecture:** Store `work_name` and one current attachment per type in SQLite. A quote attachment service validates files and authorizes metadata/download/upload operations; the client quote API and team workflow views expose only files allowed for the caller and current stage. The backup invoice remains separate from the existing official invoice workflow.

**Tech Stack:** Node.js 22+, Express 5, built-in `node:sqlite`, Multer memory storage, browser ES modules, Node test runner, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-28-quote-names-and-attachments-design.md`

## Global Constraints

- Keep the quote code permanent; show it when `work_name` is blank.
- Allow `.xlsx` budget, backup `.pdf` invoice and `.jpg` JPEG images only; reject empty/mismatched files and files over 10 MB.
- Jefe/superadmin upload and replace files; quote owner and authorized team roles can view/download by stage.
- Show budget, backup invoice and preview JPG to the client from Aceptada; show completion JPG from Entregada.
- Do not require any attachment for Aceptar or Entregar.
- Keep backup invoice separate from `quote_invoices`, its metadata checks and the Facturas realizadas archive.
- Store attachment BLOBs in SQLite so existing backups include them; never serve them as static files.
- Search work names without case or accent sensitivity.

## Review Focus

- A customer must not read another customer's work name or attachment; pin this in `tests/quote-attachment-http.test.js`.
- A file with a permitted extension but wrong signature, an empty file or a file over 10 MB must fail; pin these in `tests/quote-attachment.test.js`.
- Customer visibility must not reveal pre-acceptance files or the completion photo before delivery; pin this in attachment service and quote-page tests.
- Replacing one attachment type must preserve the other three; pin this in `tests/quote-attachment.test.js`.
- Existing quotes without a work name must remain searchable by their permanent code; pin this in quote repository and UI tests.

---

## File Structure

- Create `server/database/migrations/011_quote_work_names_attachments.sql` for `quotes.work_name` and the typed `quote_attachments` table.
- Modify `server/quotes/quote-repository.js` and `quote-service.js` to map, search, and save names.
- Create `server/quotes/attachment-document.js` for type, extension, signature, filename, size and SHA-256 handling.
- Create `server/quotes/attachment-service.js` for transactional storage and authorization; keep HTTP parsing in routes.
- Create `server/quotes/attachment-routes.js` for authenticated list, upload and download endpoints.
- Modify `server/app.js` and `server/server.js` to construct and mount the attachment service/router.
- Modify `server/quotes/workflow-service.js` to include accepted work in worker-visible work lists without changing transition rules.
- Modify `cotizaciones.html` and `js/cotizaciones.js` for quote naming, client-side history search and stage-aware downloads.
- Modify `gestion.html` and `js/gestion.js` for name search, team downloads and jefe upload controls.
- Modify `js/facturas.js` to search/display the work name while retaining the official invoice archive behavior.
- Modify `css/styles.css` for the name, search and attachment controls.
- Create `tests/quote-attachment.test.js` and `tests/quote-attachment-http.test.js`; extend migration, quote API/repository, quote page, management page and invoice archive tests.

## Interfaces

- `createQuoteAttachmentService({ database, quotes, now })` returns:
  - `list(id, context) -> AttachmentMetadata[]`
  - `upload(id, kind, context, file) -> AttachmentMetadata`
  - `download(id, kind, context) -> { filename, media_type, content }`
- Attachment kinds are exactly `budget`, `invoice_backup`, `preview`, and `completion`.
- Attachment metadata is `{ kind, filename, mediaType, uploadedAt, downloadUrl }`; it never includes content or internal uploader IDs.
- `GET /api/quotes/:id/attachments` lists caller-visible metadata.
- `GET /api/quotes/:id/attachments/:kind` downloads one caller-authorized file.
- `PUT /api/quotes/:id/attachments/:kind` uploads/replaces one file and accepts one multipart field named `file`.
- The quote object adds `workName`; it is `''` for old/unnamed quotes. Attachment metadata comes from the stage-aware list endpoint, not the quote object.
- Existing `PATCH /api/quotes/:id` accepts `workName` for a customer's own draft. Add `PATCH /api/work/quotes/:id/name` for jefe/superadmin to set it after submission.

---

### Task 1: Persist work names and attachment metadata

**Files:**
- Create: `server/database/migrations/011_quote_work_names_attachments.sql`
- Modify: `server/quotes/quote-repository.js`
- Test: `tests/database-migrations.test.js`, `tests/quote-repository.test.js`

**Interfaces:**
- Consumes: existing `quotes`, users, quote code and migration setup.
- Produces: quote rows map `work_name` to `workName`; `quote_attachments` has one row per `(quote_id, kind)`, BLOB content, SHA-256, upload timestamp and uploader ID.

- [ ] **Step 1: Add `migration adds names and constrained attachment records`** asserting an old quote receives an empty name, only the four kinds are accepted, and duplicate `(quote_id, kind)` or invalid/oversize content is rejected.
- [ ] **Step 2: Run the targeted migration tests and confirm they fail** because migration 011 is absent.
- [ ] **Step 3: Add migration 011** with a non-null empty-default `work_name`, a kind check for the four exact values, a 1–10,485,760 byte BLOB constraint, foreign keys and unique quote/kind.
- [ ] **Step 4: Add repository tests** asserting returned quotes expose `workName` and old records return `''`.
- [ ] **Step 5: Map `work_name` in `mapQuote` and add repository name-update methods** for draft-owner and authorized-team calls; constrain names to trimmed 120-character values in the service layer.
- [ ] **Step 6: Run `node --test tests/database-migrations.test.js tests/quote-repository.test.js` and confirm both pass.**
- [ ] **Step 7: Commit** the migration and repository change.

### Task 2: Add quote name editing and search

**Files:**
- Modify: `server/quotes/quote-service.js`, `server/quotes/quote-routes.js`, `server/quotes/workflow-routes.js`
- Modify: `cotizaciones.html`, `js/cotizaciones.js`
- Test: `tests/quote-api.test.js`, `tests/quote-page.test.js`

**Interfaces:**
- Consumes: repository name mapping/update from Task 1.
- Produces: customer draft `PATCH` accepts `{ workName, phone, company }`; staff route `PATCH /api/work/quotes/:id/name` accepts `{ workName }`; client history filters by work name or quote code.

- [ ] **Step 1: Add `saves a trimmed work name on an owned draft`, `rejects an overlong work name`, `customer cannot edit another quote name`, and `jefe can name a submitted quote` API tests.**
- [ ] **Step 2: Run the targeted API tests and confirm new assertions fail.**
- [ ] **Step 3: Extend quote service and routes** with the two name-save paths; keep current phone/company validation and quote ownership checks.
- [ ] **Step 4: Add UI tests** for the name input, autosave, fallback to code, and case/accent-insensitive history search.
- [ ] **Step 5: Add the name field and history search** in `cotizaciones.html`/`js/cotizaciones.js`; show work name and code together in the history entry.
- [ ] **Step 6: Run `node --test tests/quote-api.test.js tests/quote-page.test.js` and confirm both pass.**
- [ ] **Step 7: Commit** the quote name API and customer interface.

### Task 3: Validate, store and authorize attachments

**Files:**
- Create: `server/quotes/attachment-document.js`, `server/quotes/attachment-service.js`
- Create: `tests/quote-attachment.test.js`

**Interfaces:**
- Consumes: migration 011 and quote lookup.
- Produces: `createQuoteAttachmentService({ database, quotes, now })` with `list`, `upload`, and `download` methods as defined above.

- [ ] **Step 1: Add service tests** named `accepts each matching attachment kind`, `rejects mismatched extension and signature`, `rejects empty and oversized files`, `replacing an attachment preserves other kinds`, `customer attachment access is limited to owned quotes`, `backup invoice is separate from official invoice state`, `client file visibility follows accepted and delivered stages`, `worker can read accepted attachments`, and `metadata never contains BLOB content`.
- [ ] **Step 2: Run `node --test tests/quote-attachment.test.js` and confirm it fails** because the attachment modules do not exist.
- [ ] **Step 3: Implement document validation** for actual XLSX ZIP/workbook content, PDF `%PDF-`, and JPEG start/end markers; sanitize filenames, enforce extensions and 10 MB, and calculate SHA-256.
- [ ] **Step 4: Implement the attachment service** to check owner/team access, return metadata only, replace only the matching `(quote_id, kind)` row in a transaction, and gate customer downloads by status.
- [ ] **Step 5: Re-run `node --test tests/quote-attachment.test.js` and confirm it passes.**
- [ ] **Step 6: Commit** the attachment validation and storage service.

### Task 4: Expose protected upload and download routes

**Files:**
- Create: `server/quotes/attachment-routes.js`, `tests/quote-attachment-http.test.js`
- Modify: `server/app.js`, `server/server.js`

**Interfaces:**
- Consumes: attachment service from Task 3 and existing auth context.
- Produces: authenticated `GET/PUT /api/quotes/:id/attachments[/:kind]`; PUT uses Multer memory storage, field `file`, 10 MB, one file, and no more than one part.

- [ ] **Step 1: Add HTTP tests** named `jefe uploads and downloads an attachment`, `owner downloads an accepted quote attachment`, `worker downloads an accepted work attachment`, `client and worker cannot upload`, `unrelated quote returns not found`, and `oversize upload returns 413 with private download headers`.
- [ ] **Step 2: Run the targeted HTTP tests and confirm the attachment endpoints are missing.**
- [ ] **Step 3: Add the router** with session auth, Multer limits, explicit 400/403/404/413 mapping, and `Content-Disposition: attachment` downloads.
- [ ] **Step 4: Wire the service into runtime construction and mount the router** without changing invoice routes.
- [ ] **Step 5: Run `node --test tests/quote-attachment-http.test.js` and confirm it passes.**
- [ ] **Step 6: Commit** the protected attachment API.

### Task 5: Add stage-aware attachment controls to quote and work pages

**Files:**
- Modify: `cotizaciones.html`, `js/cotizaciones.js`, `gestion.html`, `js/gestion.js`, `server/quotes/workflow-service.js`, `css/styles.css`
- Test: `tests/quote-page.test.js`, `tests/gestion-page.test.js`, `tests/workflow.test.js`

**Interfaces:**
- Consumes: attachment API from Task 4 and quote name from Task 2.
- Produces: client downloads for budget/invoice backup/preview after accepted and completion photo after delivered; jefe upload controls for all four kinds; worker downloads from accepted through delivered; name search in client history and team work list. Status transitions never check attachment presence.

- [ ] **Step 1: Add tests** named `worker work list includes accepted quotes`, `client sees shared attachments only after acceptance`, `client sees completion photo only after delivery`, `jefe can replace each of four attachments`, `worker sees downloads but no upload controls`, and `accept and deliver succeed without attachments`.
- [ ] **Step 2: Run targeted workflow and page tests and confirm the new expectations fail.**
- [ ] **Step 3: Extend worker work-list visibility** to accepted quotes only; preserve current later-stage role transition rules.
- [ ] **Step 4: Render quote name plus code** on client and team pages; add team work-name search. Fetch stage-aware metadata from `GET /api/quotes/:id/attachments` and show its download links. Render missing uploads as optional, not as errors.
- [ ] **Step 5: Add jefe upload/replace controls** with expected format, filename, progress/result text and refresh of attachment metadata.
- [ ] **Step 6: Add CSS** for responsive search, name and file controls with existing design tokens.
- [ ] **Step 7: Run `node --test tests/workflow.test.js tests/quote-page.test.js tests/gestion-page.test.js` and confirm they pass.**
- [ ] **Step 8: Commit** the stage-aware interface and visibility changes.

### Task 6: Include work names in archive search and run regression checks

**Files:**
- Modify: `js/facturas.js`
- Test: `tests/invoice-archive.test.js`, `tests/quote-journey.test.js`, `tests/security-http.test.js`

**Interfaces:**
- Consumes: `workName` on quote API objects.
- Produces: archive cards show and search the work name while only official invoices remain in the archive.

- [ ] **Step 1: Add `archive shows and searches work name` and `backup invoice attachment does not change official invoice archive` tests.**
- [ ] **Step 2: Run targeted archive tests and confirm the new expectations fail.**
- [ ] **Step 3: Include `workName` in archive card summary and normalized search fields.**
- [ ] **Step 4: Run `node --test tests/invoice-archive.test.js tests/quote-journey.test.js tests/security-http.test.js` and confirm they pass.**
- [ ] **Step 5: Run `npm test` for the full regression suite and resolve any failures.**
- [ ] **Step 6: Commit** the archive search and final regression changes.

## Execution Notes

- Implement tasks sequentially because later tasks depend on the data model, service and route interfaces established earlier.
- Preserve unrelated workspace changes. The design document is already committed separately; this plan is not committed until reviewed.
- Do not make attachment presence mandatory until a later approved scope change.
