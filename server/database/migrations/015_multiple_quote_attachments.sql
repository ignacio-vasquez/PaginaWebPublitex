CREATE TABLE quote_attachments_multiple (
  id TEXT PRIMARY KEY NOT NULL,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('budget', 'invoice_backup', 'preview', 'completion')),
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  content BLOB NOT NULL CHECK (length(content) BETWEEN 1 AND 10485760),
  sha256 TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id)
);

INSERT INTO quote_attachments_multiple
  (id,quote_id,kind,filename,media_type,content,sha256,uploaded_at,uploaded_by)
SELECT lower(hex(randomblob(16))),quote_id,kind,filename,media_type,content,sha256,uploaded_at,uploaded_by
FROM quote_attachments;

DROP TABLE quote_attachments;
ALTER TABLE quote_attachments_multiple RENAME TO quote_attachments;
CREATE INDEX quote_attachments_by_quote_kind ON quote_attachments(quote_id,kind,uploaded_at);
