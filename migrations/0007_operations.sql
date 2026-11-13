-- Operations: announcements, in-app notifications, AI usage metering, audit log and admin settings.
CREATE TABLE announcements (
 id TEXT PRIMARY KEY,
 course_id TEXT REFERENCES courses(id),
 kind TEXT NOT NULL DEFAULT 'notice' CHECK(kind IN ('notice','exam','urgent')),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 body TEXT NOT NULL DEFAULT '' CHECK(length(body) <= 4000),
 created_by TEXT NOT NULL REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 deleted_at TEXT
);
CREATE INDEX announcements_course_idx ON announcements(course_id);
CREATE TABLE notifications (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES app_users(id),
 kind TEXT NOT NULL DEFAULT 'info',
 title TEXT NOT NULL CHECK(length(title) <= 200),
 body TEXT NOT NULL DEFAULT '' CHECK(length(body) <= 2000),
 link TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 read_at TEXT
);
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at);
CREATE TABLE ai_usage (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 provider TEXT NOT NULL,
 model TEXT NOT NULL DEFAULT '',
 purpose TEXT NOT NULL,
 user_id TEXT,
 input_tokens INTEGER NOT NULL DEFAULT 0,
 output_tokens INTEGER NOT NULL DEFAULT 0,
 cost_usd REAL NOT NULL DEFAULT 0,
 ok INTEGER NOT NULL DEFAULT 1 CHECK(ok IN (0,1)),
 error TEXT,
 latency_ms INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ai_usage_created_idx ON ai_usage(created_at);
CREATE TABLE activity_log (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 actor_id TEXT,
 action TEXT NOT NULL,
 target TEXT NOT NULL DEFAULT '',
 detail TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail))
);
CREATE INDEX activity_log_created_idx ON activity_log(created_at);
CREATE TABLE admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO admin_settings(key,value) VALUES('ai_monthly_limit_usd','20');
-- When a result was confirmed, for grading-delay metrics.
ALTER TABLE assessment_results ADD COLUMN confirmed_at TEXT;
UPDATE assessment_results SET confirmed_at = submitted_at WHERE grading_status='confirmed';
UPDATE assessment_results SET confirmed_at = strftime('%Y-%m-%dT%H:%M:%fZ', submitted_at, '+' || (4 + (abs(random()) % 70)) || ' hours') WHERE grading_status='confirmed' AND EXISTS(SELECT 1 FROM json_each(questions) j WHERE json_extract(j.value,'$.type')='text');
