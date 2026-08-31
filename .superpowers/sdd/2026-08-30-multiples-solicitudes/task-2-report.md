# Task 2 — Crear, seleccionar y editar solicitudes

## Recovery audit

- The worktree started at commit `2cc8199` (`feat: model multiple quote requests`).
- The only pre-existing uncommitted change was the partial `tests/form.test.js` fixture/test diff. It was retained, reviewed, and completed rather than trusted as implementation evidence.
- The recovery diff correctly established the new request-view contract and a deterministic two-request RED case, but the production module still used the retired single-summary contract.

## TDD evidence

### RED

After auditing and extending the recovered tests, `node tests/form.test.js` failed with 8 failures (9 passing). The primary failure was the empty active request detail after submitting Beto; the remaining failures were the expected old single-summary assumptions against the new fixture.

### GREEN

The implementation was replaced only after RED. The final focused run was:

```text
node --test tests/form.test.js
1..1
# tests 1
# pass 1
# fail 0
```

The underlying file contains 17 passing form subtests, including collection/selection, validation, optional company, creation, isolated history editing, and edit cancellation.

## Commands and results

- `node --test tests/form.test.js` — PASS (17/17 form subtests).
- `npm test` — PASS (7/7 test files).
- `git diff --check` — PASS (no whitespace errors).
- Security scan over Task 2 production files for unsafe HTML/network/storage APIs — no matches for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `fetch`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `sessionStorage`, cookies, or IndexedDB.

## Files changed

- `index.html`: replaced the single summary with active request/history contracts, plural simulation warning, mode title hook, and cancel action.
- `js/formulario.js`: integrated the pure request-state module; added deterministic ID/time injection, safe active/history rendering, creation, selection, edit mode, isolated updates, cancellation, focus, and live announcements.
- `tests/form.test.js`: updated the fixture and legacy expectations; added multi-request selection, isolated editing, and cancellation coverage.

## Self-review and concerns

- Personal data is rendered through `createElement` and `textContent`; request IDs are carried only in button datasets and resolved through state transitions.
- Optional `empresa-cliente` is collected as `empresa`, preserved in each request, shown in details, and excluded from validation.
- Delete controls are present in the Task 2 contract but intentionally have no behavior yet; accessible deletion is Task 3 scope.
- No browser/manual visual verification was performed because responsive styling and deletion dialog belong to later tasks.
