ALTER TABLE quotes ADD COLUMN work_name TEXT NOT NULL DEFAULT '';

CREATE TABLE quote_attachments (
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('budget', 'invoice_backup', 'preview', 'completion')),
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  content BLOB NOT NULL CHECK (length(content) BETWEEN 1 AND 10485760),
  sha256 TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (quote_id, kind)
);
