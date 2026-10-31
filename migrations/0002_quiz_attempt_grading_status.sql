ALTER TABLE "quiz_attempts"
ADD COLUMN IF NOT EXISTS "grading_status" text DEFAULT 'graded' NOT NULL;

ALTER TABLE "quiz_attempts"
ADD COLUMN IF NOT EXISTS "grading_feedback" text,
ADD COLUMN IF NOT EXISTS "graded_by" varchar,
ADD COLUMN IF NOT EXISTS "graded_at" text;
