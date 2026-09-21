CREATE TABLE quote_workflow_new (
  quote_id TEXT PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_review','accepted','invoiced','in_production','ready','delivered')),
  invoice_number TEXT,
  invoiced_at INTEGER,
  payment_due_at INTEGER,
  CHECK (invoiced_at IS NULL OR (invoice_number IS NOT NULL AND payment_due_at IS NOT NULL))
);
INSERT INTO quote_workflow_new (quote_id,status,invoice_number,invoiced_at,payment_due_at)
SELECT quote_id,status,invoice_number,invoiced_at,payment_due_at FROM quote_workflow;
DROP TABLE quote_workflow;
ALTER TABLE quote_workflow_new RENAME TO quote_workflow;
CREATE INDEX quote_workflow_status_idx ON quote_workflow(status);
