CREATE TABLE IF NOT EXISTS course_publications (
  course_id varchar PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT true,
  format text NOT NULL DEFAULT 'self_paced'
    CHECK (format IN ('self_paced', 'upcoming', 'recording')),
  starts_at text,
  instructor text NOT NULL DEFAULT '',
  recording_url text NOT NULL DEFAULT ''
);
