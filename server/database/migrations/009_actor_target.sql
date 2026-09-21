ALTER TABLE session_simulations ADD COLUMN target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
