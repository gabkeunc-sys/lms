-- Student tools: practice / retry attempts (not graded), grade appeals and weekly goals.
CREATE TABLE practice_attempts (
 id TEXT PRIMARY KEY,
 student_id TEXT NOT NULL REFERENCES app_users(id),
 source TEXT NOT NULL CHECK(source IN ('practice','retry')),
 bank_id TEXT,
 result_id TEXT,
 question_index INTEGER,
 concept TEXT NOT NULL DEFAULT '',
 correct INTEGER NOT NULL CHECK(correct IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX practice_attempts_student_idx ON practice_attempts(student_id, created_at);
CREATE TABLE grade_appeals (
 id TEXT PRIMARY KEY,
 result_id TEXT NOT NULL REFERENCES assessment_results(id),
 student_id TEXT NOT NULL REFERENCES app_users(id),
 question_index INTEGER NOT NULL,
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted','rejected')),
 response TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 resolved_at TEXT,
 resolved_by TEXT
);
CREATE UNIQUE INDEX grade_appeals_one_open ON grade_appeals(result_id, question_index) WHERE status='open';
CREATE TABLE student_goals (student_id TEXT PRIMARY KEY REFERENCES app_users(id), weekly_target INTEGER NOT NULL DEFAULT 5 CHECK(weekly_target BETWEEN 1 AND 50));
