CREATE TABLE quote_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE
);

INSERT INTO quote_numbers (quote_id)
SELECT id FROM quotes ORDER BY created_at, id;

CREATE TRIGGER assign_quote_number AFTER INSERT ON quotes
BEGIN
  INSERT INTO quote_numbers (quote_id) VALUES (NEW.id);
END;
