CREATE TABLE IF NOT EXISTS bujks (
  id varchar PRIMARY KEY,
  name text NOT NULL,
  created_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS bujks_name_lower_unique
  ON bujks (lower(name));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS participant_id varchar,
  ADD COLUMN IF NOT EXISTS bujk_id varchar;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS bujk_id varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_bujk_id_fk'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_bujk_id_fk
      FOREIGN KEY (bujk_id) REFERENCES bujks(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_participant_id_fk'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_participant_id_fk
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_bujk_id_fk'
  ) THEN
    ALTER TABLE participants ADD CONSTRAINT participants_bujk_id_fk
      FOREIGN KEY (bujk_id) REFERENCES bujks(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'participant', 'bujk_pic'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_participant_id_unique
  ON users (participant_id)
  WHERE participant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bujk_invitations (
  id varchar PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('participant', 'bujk_pic')),
  bujk_id varchar NOT NULL REFERENCES bujks(id) ON DELETE CASCADE,
  participant_name text,
  nip text,
  position text,
  unit text,
  invited_by varchar NOT NULL,
  expires_at text NOT NULL,
  accepted_at text,
  created_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS bujk_invitations_bujk_created_idx
  ON bujk_invitations (bujk_id, created_at DESC);
