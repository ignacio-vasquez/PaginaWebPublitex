CREATE TABLE quote_workflow (
  quote_id TEXT PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_review','accepted','in_production','ready','delivered')),
  assigned_worker_id TEXT REFERENCES users(id),
  CHECK (status = 'in_review' OR assigned_worker_id IS NOT NULL)
);

CREATE TABLE quote_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  effective_role TEXT NOT NULL CHECK (effective_role IN ('cliente','jefe','trabajador','superadmin')),
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','accepted','in_production','ready','delivered')),
  created_at INTEGER NOT NULL
);
CREATE INDEX quote_events_quote_idx ON quote_events(quote_id, created_at, id);
CREATE INDEX quote_workflow_worker_idx ON quote_workflow(assigned_worker_id, status);

INSERT INTO quote_events (quote_id, actor_id, effective_role, status, created_at)
SELECT id, user_id, 'cliente', 'draft', created_at FROM quotes ORDER BY created_at, id;
INSERT INTO quote_events (quote_id, actor_id, effective_role, status, created_at)
SELECT id, user_id, 'cliente', 'submitted', COALESCE(submitted_at, updated_at)
FROM quotes WHERE status = 'submitted' ORDER BY COALESCE(submitted_at, updated_at), id;
