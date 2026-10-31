ALTER TABLE "enrollments"
ADD COLUMN IF NOT EXISTS "completed_lesson_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;