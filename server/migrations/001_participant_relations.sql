-- ============================================================
-- Migration: participant_relations
-- Creates the three relational tables that replace the JSONB
-- arrays on participants, backfills any existing JSONB data,
-- then drops the legacy columns.
-- This script is fully idempotent and safe to re-run.
-- ============================================================

-- 1. Create relational tables (idempotent)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS participant_competencies (
  id            varchar PRIMARY KEY,
  participant_id varchar NOT NULL,
  unit_id       varchar NOT NULL,
  current_level varchar(4) NOT NULL,
  target_level  varchar(4) NOT NULL,
  last_assessed text NOT NULL,
  status        text NOT NULL DEFAULT 'gap'
);

CREATE TABLE IF NOT EXISTS evidences (
  id             varchar PRIMARY KEY,
  participant_id varchar NOT NULL,
  unit_id        varchar NOT NULL,
  type           text NOT NULL,
  title          text NOT NULL,
  description    text NOT NULL,
  file_url       text,
  submitted_at   text NOT NULL,
  assessed_at    text,
  assessor_id    varchar,
  score          integer,
  feedback       text,
  status         text NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS learning_records (
  id             varchar PRIMARY KEY,
  participant_id varchar NOT NULL,
  course_id      varchar NOT NULL,
  started_at     text NOT NULL,
  completed_at   text,
  progress       integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'not_started'
);

-- 2. Backfill from JSONB columns if they still exist
-- -----------------------------------------------------------
DO $$
DECLARE
  has_competencies    boolean;
  has_evidences       boolean;
  has_learning_history boolean;
  comp_count          bigint;
  ev_count            bigint;
  lr_count            bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'participants'
      AND column_name  = 'competencies'
  ) INTO has_competencies;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'participants'
      AND column_name  = 'evidences'
  ) INTO has_evidences;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'participants'
      AND column_name  = 'learning_history'
  ) INTO has_learning_history;

  -- Backfill competencies (skip participants already migrated)
  IF has_competencies THEN
    INSERT INTO participant_competencies
           (id, participant_id, unit_id, current_level, target_level, last_assessed, status)
    SELECT
      'pc-' || gen_random_uuid(),
      p.id,
      elem ->> 'unitId',
      elem ->> 'currentLevel',
      elem ->> 'targetLevel',
      COALESCE(elem ->> 'lastAssessed', to_char(now(), 'YYYY-MM-DD')),
      COALESCE(elem ->> 'status', 'gap')
    FROM participants p
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(p.competencies, '[]'::jsonb)
    ) AS elem
    WHERE jsonb_array_length(COALESCE(p.competencies, '[]'::jsonb)) > 0
      AND p.id NOT IN (
            SELECT DISTINCT participant_id FROM participant_competencies
          );
  END IF;

  -- Backfill evidences
  IF has_evidences THEN
    INSERT INTO evidences
           (id, participant_id, unit_id, type, title, description,
            file_url, submitted_at, assessed_at, assessor_id, score, feedback, status)
    SELECT
      COALESCE(elem ->> 'id', 'ev-' || gen_random_uuid()),
      p.id,
      elem ->> 'unitId',
      elem ->> 'type',
      elem ->> 'title',
      COALESCE(elem ->> 'description', ''),
      elem ->> 'fileUrl',
      COALESCE(elem ->> 'submittedAt', to_char(now(), 'YYYY-MM-DD')),
      elem ->> 'assessedAt',
      elem ->> 'assessorId',
      (elem ->> 'score')::integer,
      elem ->> 'feedback',
      COALESCE(elem ->> 'status', 'pending')
    FROM participants p
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(p.evidences, '[]'::jsonb)
    ) AS elem
    WHERE jsonb_array_length(COALESCE(p.evidences, '[]'::jsonb)) > 0
      AND p.id NOT IN (
            SELECT DISTINCT participant_id FROM evidences
          )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Backfill learning_records
  IF has_learning_history THEN
    INSERT INTO learning_records
           (id, participant_id, course_id, started_at, completed_at, progress, status)
    SELECT
      COALESCE(elem ->> 'id', 'lr-' || gen_random_uuid()),
      p.id,
      elem ->> 'courseId',
      COALESCE(elem ->> 'startedAt', to_char(now(), 'YYYY-MM-DD')),
      elem ->> 'completedAt',
      COALESCE((elem ->> 'progress')::integer, 0),
      COALESCE(elem ->> 'status', 'not_started')
    FROM participants p
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(p.learning_history, '[]'::jsonb)
    ) AS elem
    WHERE jsonb_array_length(COALESCE(p.learning_history, '[]'::jsonb)) > 0
      AND p.id NOT IN (
            SELECT DISTINCT participant_id FROM learning_records
          )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 3. Validate backfill row counts before dropping columns
  IF has_competencies THEN
    SELECT COUNT(*) INTO comp_count
    FROM participants p
    WHERE jsonb_array_length(COALESCE(p.competencies, '[]'::jsonb)) > 0
      AND p.id NOT IN (SELECT DISTINCT participant_id FROM participant_competencies);

    IF comp_count > 0 THEN
      RAISE EXCEPTION 'Backfill incomplete: % participant(s) still have competencies only in JSONB', comp_count;
    END IF;

    ALTER TABLE participants DROP COLUMN IF EXISTS competencies;
  END IF;

  IF has_learning_history THEN
    ALTER TABLE participants DROP COLUMN IF EXISTS learning_history;
  END IF;

  IF has_evidences THEN
    ALTER TABLE participants DROP COLUMN IF EXISTS evidences;
  END IF;
END;
$$;

-- Remove invalid rows left by older code/tests before enforcing ownership.
-- These rows cannot be surfaced because their parent record no longer exists.
DELETE FROM participant_competencies child
WHERE NOT EXISTS (
  SELECT 1 FROM participants parent WHERE parent.id = child.participant_id
);

DELETE FROM evidences child
WHERE NOT EXISTS (
  SELECT 1 FROM participants parent WHERE parent.id = child.participant_id
);

DELETE FROM learning_records child
WHERE NOT EXISTS (
  SELECT 1 FROM participants parent WHERE parent.id = child.participant_id
);

DELETE FROM learning_records child
WHERE NOT EXISTS (
  SELECT 1 FROM courses parent WHERE parent.id = child.course_id
);

-- 4. Add foreign-key constraints (idempotent via exception handler)
-- -----------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE participant_competencies
    ADD CONSTRAINT participant_competencies_participant_id_fk
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE participant_competencies
    ADD CONSTRAINT participant_competencies_unit_id_fk
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE evidences
    ADD CONSTRAINT evidences_participant_id_fk
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE evidences
    ADD CONSTRAINT evidences_unit_id_fk
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE learning_records
    ADD CONSTRAINT learning_records_participant_id_fk
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE learning_records
    ADD CONSTRAINT learning_records_course_id_fk
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Add indexes (idempotent)
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_participant_competencies_participant_id
  ON participant_competencies (participant_id);

CREATE INDEX IF NOT EXISTS idx_evidences_participant_id
  ON evidences (participant_id);

CREATE INDEX IF NOT EXISTS idx_learning_records_participant_id
  ON learning_records (participant_id);
