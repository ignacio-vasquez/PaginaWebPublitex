DROP TRIGGER audit_simulation_exit;
CREATE TABLE session_simulations_new (
  token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,
  real_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'jefe', 'trabajador'))
);
INSERT INTO session_simulations_new (token_hash,real_user_id,role)
SELECT token_hash,real_user_id,role FROM session_simulations;
DROP TABLE session_simulations;
ALTER TABLE session_simulations_new RENAME TO session_simulations;
CREATE TRIGGER audit_simulation_exit AFTER DELETE ON session_simulations
BEGIN
  INSERT INTO simulation_events (actor_id, effective_role, action, created_at)
  VALUES (OLD.real_user_id, OLD.role, 'exit', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
END;
