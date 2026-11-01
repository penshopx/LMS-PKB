-- Historical attempts have no request identity; preserve them unchanged.
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS idempotency_key varchar;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS submission_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_submission_unique
  ON quiz_attempts (participant_id, quiz_id, idempotency_key);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'quiz_attempts'::regclass
      AND conname = 'quiz_attempts_submission_identity_pair'
  ) THEN
    ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_submission_identity_pair
      CHECK ((idempotency_key IS NULL) = (submission_fingerprint IS NULL));
  END IF;
END $$;
