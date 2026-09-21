CREATE TABLE quote_workflow_new (
  quote_id TEXT PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_review','accepted','invoiced','in_production','ready','delivered')),
  assigned_worker_id TEXT REFERENCES users(id),
  invoice_number TEXT,
  invoiced_at INTEGER,
  payment_due_at INTEGER,
  CHECK (status = 'in_review' OR assigned_worker_id IS NOT NULL),
  CHECK (invoiced_at IS NULL OR (invoice_number IS NOT NULL AND payment_due_at IS NOT NULL))
);
INSERT INTO quote_workflow_new (quote_id,status,assigned_worker_id)
SELECT quote_id,status,assigned_worker_id FROM quote_workflow;
DROP TABLE quote_workflow;
ALTER TABLE quote_workflow_new RENAME TO quote_workflow;
CREATE INDEX quote_workflow_worker_idx ON quote_workflow(assigned_worker_id, status);

CREATE TABLE quote_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  effective_role TEXT NOT NULL CHECK (effective_role IN ('cliente','jefe','trabajador','superadmin')),
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','accepted','invoiced','in_production','ready','delivered')),
  created_at INTEGER NOT NULL
);
INSERT INTO quote_events_new SELECT * FROM quote_events;
DROP TABLE quote_events;
ALTER TABLE quote_events_new RENAME TO quote_events;
CREATE INDEX quote_events_quote_idx ON quote_events(quote_id, created_at, id);
