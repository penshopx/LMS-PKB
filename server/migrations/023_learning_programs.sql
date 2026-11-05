-- Supplemental learning targets; never changes enrollment or certification rules.
CREATE TABLE IF NOT EXISTS learning_programs (
  id varchar PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  course_id varchar NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  due_date varchar(10) NOT NULL,
  source text NOT NULL CHECK (source IN ('assigned', 'personal')),
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at text NOT NULL,
  canceled_at text
);
CREATE INDEX IF NOT EXISTS idx_learning_programs_due_date ON learning_programs(due_date);
CREATE TABLE IF NOT EXISTS learning_program_members (
  id varchar PRIMARY KEY,
  program_id varchar NOT NULL REFERENCES learning_programs(id) ON DELETE CASCADE,
  participant_id varchar NOT NULL REFERENCES participants(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_program_member_unique
  ON learning_program_members(program_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_learning_program_members_participant
  ON learning_program_members(participant_id);
