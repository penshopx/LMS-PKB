CREATE TABLE IF NOT EXISTS practice_missions (
  id varchar PRIMARY KEY,
  course_id varchar REFERENCES courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  objective text NOT NULL,
  scenario text NOT NULL,
  source_text text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL,
  checklist jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at text NOT NULL,
  CONSTRAINT practice_missions_duration_check CHECK (duration_minutes BETWEEN 5 AND 15)
);
CREATE INDEX IF NOT EXISTS practice_missions_course_idx ON practice_missions(course_id);

CREATE TABLE IF NOT EXISTS mission_submissions (
  id varchar PRIMARY KEY,
  mission_id varchar NOT NULL REFERENCES practice_missions(id) ON DELETE RESTRICT,
  participant_id varchar NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  submission_key varchar NOT NULL,
  round integer NOT NULL,
  completed_checklist jsonb NOT NULL,
  evidence_text text NOT NULL,
  evidence_url text NOT NULL DEFAULT '',
  private_reflection text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_review',
  feedback text,
  next_practice_at text,
  submitted_at text NOT NULL,
  reviewed_at text,
  reviewed_by varchar REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT mission_submissions_status_check CHECK (status IN ('pending_review', 'accepted', 'repeat_requested')),
  CONSTRAINT mission_submissions_round_check CHECK (round > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS mission_submissions_key_unique
  ON mission_submissions(mission_id, participant_id, submission_key);
CREATE UNIQUE INDEX IF NOT EXISTS mission_submissions_round_unique
  ON mission_submissions(mission_id, participant_id, round);
CREATE INDEX IF NOT EXISTS mission_submissions_participant_idx ON mission_submissions(participant_id);

