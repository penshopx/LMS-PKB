-- Complete the course deletion graph and protect course pre/post-test pointers.

-- Clear legacy quiz pointers that no longer resolve.
UPDATE courses course
SET pre_test_id = NULL
WHERE course.pre_test_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM quizzes quiz WHERE quiz.id = course.pre_test_id
  );

UPDATE courses course
SET post_test_id = NULL
WHERE course.post_test_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM quizzes quiz WHERE quiz.id = course.post_test_id
  );

-- Remove legacy enrollment rows whose required participant or selected course
-- no longer exists.
DELETE FROM enrollments child
WHERE NOT EXISTS (
  SELECT 1 FROM participants parent WHERE parent.id = child.participant_id
);

DELETE FROM enrollments child
WHERE child.course_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM courses parent WHERE parent.id = child.course_id
  );

-- Course deletion is intentional deletion of its learner progress. Replace the
-- earlier restrictive FK with a cascade so direct SQL and storage agree.
ALTER TABLE learning_records
  DROP CONSTRAINT IF EXISTS learning_records_course_id_fk;

ALTER TABLE learning_records
  ADD CONSTRAINT learning_records_course_id_fk
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE enrollments
    ADD CONSTRAINT enrollments_participant_id_fk
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE enrollments
    ADD CONSTRAINT enrollments_course_id_fk
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE courses
    ADD CONSTRAINT courses_pre_test_id_fk
    FOREIGN KEY (pre_test_id) REFERENCES quizzes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE courses
    ADD CONSTRAINT courses_post_test_id_fk
    FOREIGN KEY (post_test_id) REFERENCES quizzes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_participant_id
  ON enrollments (participant_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_course_id
  ON enrollments (course_id);

CREATE INDEX IF NOT EXISTS idx_courses_pre_test_id
  ON courses (pre_test_id);

CREATE INDEX IF NOT EXISTS idx_courses_post_test_id
  ON courses (post_test_id);