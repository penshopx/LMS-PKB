CREATE TABLE discussion_reports (
  id varchar PRIMARY KEY,
  thread_id varchar NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
  reply_id varchar REFERENCES discussion_replies(id) ON DELETE CASCADE,
  reporter_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_key text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  handled_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CONSTRAINT discussion_reports_status_check CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  CONSTRAINT discussion_reports_target_check CHECK (
    target_key = CASE WHEN reply_id IS NULL THEN 'thread:' || thread_id ELSE 'reply:' || reply_id END
  )
);
CREATE UNIQUE INDEX discussion_reports_reporter_target_idx ON discussion_reports(reporter_id, target_key);
CREATE INDEX discussion_reports_queue_idx ON discussion_reports(status, created_at);
CREATE INDEX discussion_reports_reporter_time_idx ON discussion_reports(reporter_id, created_at);
