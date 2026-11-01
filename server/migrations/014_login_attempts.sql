CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key text PRIMARY KEY,
  attempt_count integer NOT NULL CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_window
  ON login_attempts (window_started_at);
