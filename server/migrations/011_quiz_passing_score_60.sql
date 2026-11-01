-- The requested policy replaces the former 80% threshold, not diagnostic
-- pre-tests (0%) or other explicitly configured thresholds.
ALTER TABLE quizzes ALTER COLUMN passing_score SET DEFAULT 60;

WITH changed_quizzes AS (
  UPDATE quizzes SET passing_score = 60
  WHERE passing_score = 80
  RETURNING id
), updated_attempts AS (
  UPDATE quiz_attempts a
  SET passed = CASE WHEN a.grading_status = 'graded' AND a.score >= 60 THEN 1 ELSE 0 END
  FROM changed_quizzes q
  WHERE a.quiz_id = q.id
  RETURNING a.id
), course_states AS (
  SELECT e.id,
    CASE WHEN counts.total > 0
      THEN round(100.0 * counts.done / counts.total)::integer ELSE 0 END AS progress,
    counts.total > 0 AND counts.done = counts.total AND EXISTS (
      SELECT 1 FROM quiz_attempts a
      WHERE a.quiz_id = c.post_test_id AND a.participant_id = e.participant_id
        AND a.grading_status = 'graded' AND a.score >= 60
    ) AS is_complete
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  CROSS JOIN LATERAL (
    SELECT count(*) AS total,
      count(*) FILTER (
        WHERE COALESCE(e.completed_lesson_ids, '[]'::jsonb) ? (lesson->>'id')
      ) AS done
    FROM jsonb_array_elements(COALESCE(c.lessons, '[]'::jsonb)) AS lesson
  ) counts
  WHERE c.post_test_id IN (SELECT id FROM changed_quizzes)
  -- Data-modifying CTEs share one snapshot. Use score + grading status above,
  -- not the old passed flag, to evaluate the newly adopted threshold.
)
UPDATE enrollments e
SET progress = s.progress,
    status = CASE WHEN s.is_complete THEN 'completed'
                  WHEN s.progress > 0 THEN 'in_progress' ELSE 'enrolled' END,
    completed_at = CASE WHEN s.is_complete THEN COALESCE(
      e.completed_at,
      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) ELSE NULL END
FROM course_states s WHERE e.id = s.id;
