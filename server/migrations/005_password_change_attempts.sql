CREATE TABLE IF NOT EXISTS password_change_attempts (
  attempt_key text PRIMARY KEY,
  attempt_count integer NOT NULL CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_change_attempts_window
  ON password_change_attempts (window_started_at);