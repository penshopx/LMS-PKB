CREATE TABLE IF NOT EXISTS discussion_threads (
  id varchar PRIMARY KEY,
  course_id varchar NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  group_id varchar REFERENCES bujks(id) ON DELETE RESTRICT,
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  moderation_reason text,
  moderated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  moderated_at text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS discussion_threads_course_idx ON discussion_threads(course_id, group_id);
CREATE TABLE IF NOT EXISTS discussion_replies (
  id varchar PRIMARY KEY,
  thread_id varchar NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  moderation_reason text,
  moderated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  moderated_at text,
  helpful boolean NOT NULL DEFAULT false,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS discussion_replies_thread_idx ON discussion_replies(thread_id);
