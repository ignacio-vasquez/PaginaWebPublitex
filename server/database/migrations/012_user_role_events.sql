CREATE TABLE user_role_events (
  id INTEGER PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  previous_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX user_role_events_target_idx ON user_role_events(target_user_id, created_at);
