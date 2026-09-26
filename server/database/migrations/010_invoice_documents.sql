CREATE TABLE quote_invoices (
  quote_id TEXT PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('application/pdf','application/xml')),
  content BLOB NOT NULL CHECK (length(content) BETWEEN 1 AND 5242880),
  sha256 TEXT NOT NULL UNIQUE,
  folio TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0),
  document_type TEXT,
  issuer_rut TEXT,
  receiver_rut TEXT,
  receiver_name TEXT,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  UNIQUE (issuer_rut, document_type, folio)
);
