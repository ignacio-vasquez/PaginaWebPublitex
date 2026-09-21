CREATE TABLE simulation_users (
  real_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('cliente', 'jefe', 'trabajador')),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (real_user_id, role)
);
CREATE TABLE session_simulations (
  token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,
  real_user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  FOREIGN KEY (real_user_id, role) REFERENCES simulation_users(real_user_id, role) ON DELETE CASCADE
);
CREATE TABLE simulation_events (
  id INTEGER PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  effective_role TEXT NOT NULL CHECK (effective_role IN ('cliente', 'jefe', 'trabajador')),
  action TEXT NOT NULL CHECK (action IN ('enter', 'exit')),
  created_at INTEGER NOT NULL
);
CREATE TRIGGER audit_simulation_exit AFTER DELETE ON session_simulations
BEGIN
  INSERT INTO simulation_events (actor_id, effective_role, action, created_at)
  VALUES (OLD.real_user_id, OLD.role, 'exit', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
END;
