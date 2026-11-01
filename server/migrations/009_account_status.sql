-- Preserve existing accounts and all learning history. Session versions revoke
-- every older session without depending on session-store deletion timing.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
