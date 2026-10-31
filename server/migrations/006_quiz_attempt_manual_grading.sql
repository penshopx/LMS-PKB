-- Keep the lesson-progress field available in databases initialized before
-- the enrollment progress migration was included in the server migration set.
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS completed_lesson_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS grading_status text NOT NULL DEFAULT 'graded',
  ADD COLUMN IF NOT EXISTS grading_feedback text,
  ADD COLUMN IF NOT EXISTS graded_by varchar,
  ADD COLUMN IF NOT EXISTS graded_at text;

-- Previous essay attempts were intentionally not auto-passed. Queue them for
-- human review instead of leaving them permanently marked as failed.
UPDATE quiz_attempts AS attempt
SET grading_status = 'awaiting_review'
FROM quizzes AS quiz
WHERE quiz.id = attempt.quiz_id
  AND attempt.grading_status = 'graded'
  AND attempt.passed = 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(quiz.questions) AS question(value)
    WHERE question.value ->> 'type' = 'essay'
  );
