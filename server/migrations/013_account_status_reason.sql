-- Preserve unknown reasons on historical events instead of backfilling fiction.
-- New status changes require a reason at the authenticated API boundary.
ALTER TABLE account_status_history ADD COLUMN IF NOT EXISTS reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'account_status_history'::regclass
      AND conname = 'account_status_history_reason_valid'
  ) THEN
    ALTER TABLE account_status_history
      ADD CONSTRAINT account_status_history_reason_valid
      CHECK (reason IS NULL OR (
        reason ~ '[^[:space:]]' AND char_length(reason) <= 1000
      ));
  END IF;
END $$;
