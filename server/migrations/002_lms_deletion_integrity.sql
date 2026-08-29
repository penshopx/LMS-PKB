-- Keep quiz attempts and certificates consistent when their owning
-- participant, quiz, or course is deleted.

-- Remove legacy orphan rows before adding the constraints.
DELETE FROM quiz_attempts child
WHERE NOT EXISTS (
  SELECT 1 FROM quizzes parent WHERE parent.id = child.quiz_id
);

DELETE FROM quiz_attempts child
WHERE NOT EXISTS (
  SELECT 1 FROM participants parent WHERE parent.id = child.participant_id
);

DELETE FROM quizzes child
WHERE NOT EXISTS (
  SELECT 1 FROM courses parent WHERE parent.id = child.course_id
);

DELETE FROM certificates child
WHERE NOT EXISTS (
  SELECT 1 FROM participants parent WHERE parent.id = child.participant_id
);

UPDATE certificates child
SET course_id = NULL
WHERE child.course_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM courses parent WHERE parent.id = child.course_id
  );

DO $$ BEGIN
  ALTER TABLE quizzes
    ADD CONSTRAINT quizzes_course_id_fk
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE quiz_attempts
    ADD CONSTRAINT quiz_attempts_quiz_id_fk
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE quiz_attempts
    ADD CONSTRAINT quiz_attempts_participant_id_fk
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE certificates
    ADD CONSTRAINT certificates_participant_id_fk
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE certificates
    ADD CONSTRAINT certificates_course_id_fk
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_quizzes_course_id
  ON quizzes (course_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id
  ON quiz_attempts (quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_participant_id
  ON quiz_attempts (participant_id);

CREATE INDEX IF NOT EXISTS idx_certificates_participant_id
  ON certificates (participant_id);

CREATE INDEX IF NOT EXISTS idx_certificates_course_id
  ON certificates (course_id);