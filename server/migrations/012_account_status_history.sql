-- Append-only application audit trail. Identity snapshots intentionally have no
-- cascading account foreign keys, so deleting an account cannot erase history.
-- Existing state is not backfilled: its actor and change time are unknown.
CREATE TABLE IF NOT EXISTS account_status_history (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar NOT NULL,
  actor_username text NOT NULL,
  target_user_id varchar NOT NULL,
  target_username text NOT NULL,
  previous_is_active boolean NOT NULL,
  new_is_active boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_status_history_actual_change
    CHECK (previous_is_active <> new_is_active)
);
CREATE INDEX IF NOT EXISTS account_status_history_chronology_idx
  ON account_status_history (changed_at, id);
