-- Cloudflare D1 (SQLite) schema. Equivalent to the final state of the Netlify PostgreSQL migrations 0001-0013.
-- Conventions: ids are UUID text, timestamps are ISO-8601 UTC text (same format as Date#toISOString),
-- booleans are 0/1 integers, JSON columns hold JSON text.
CREATE TABLE app_users (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) <= 80),
 email TEXT UNIQUE NOT NULL CHECK(length(email) <= 254 AND email = lower(email)),
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','instructor','admin')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE app_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX app_sessions_user_idx ON app_sessions(user_id);
CREATE TABLE auth_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at TEXT NOT NULL);

CREATE TABLE courses (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES app_users(id),
 title TEXT NOT NULL CHECK(length(title) <= 160),
 description TEXT NOT NULL DEFAULT '',
 start_date TEXT, end_date TEXT,
 status TEXT NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','active','ended')),
 student_ids TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(student_ids)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 deleted_at TEXT,
 CHECK(end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX courses_owner_idx ON courses(owner_id);

CREATE TABLE assessments (
 id TEXT PRIMARY KEY,
 course_id TEXT NOT NULL REFERENCES courses(id),
 title TEXT NOT NULL CHECK(length(title) <= 160),
 kind TEXT NOT NULL CHECK(kind IN ('exam','quiz')),
 week INTEGER NOT NULL DEFAULT 1 CHECK(week BETWEEN 1 AND 100),
 duration INTEGER NOT NULL DEFAULT 30 CHECK(duration BETWEEN 1 AND 240),
 opens_at TEXT, closes_at TEXT,
 questions TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(questions)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 CHECK(closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);
CREATE INDEX assessments_course_idx ON assessments(course_id);

CREATE TABLE assessment_results (
 id TEXT PRIMARY KEY,
 assessment_id TEXT NOT NULL REFERENCES assessments(id),
 student_id TEXT NOT NULL REFERENCES app_users(id),
 questions TEXT NOT NULL CHECK(json_valid(questions)),
 answers TEXT NOT NULL CHECK(json_valid(answers)),
 score INTEGER NOT NULL CHECK(score >= 0),
 total INTEGER NOT NULL CHECK(total > 0 AND score <= total),
 submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 duration_seconds INTEGER NOT NULL CHECK(duration_seconds >= 0),
 origin TEXT NOT NULL DEFAULT 'generated',
 grading TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(grading)),
 grading_status TEXT NOT NULL DEFAULT 'confirmed' CHECK(grading_status IN ('pending','review','confirmed')),
 revision INTEGER NOT NULL DEFAULT 0,
 UNIQUE(assessment_id, student_id)
);
CREATE INDEX assessment_results_student_idx ON assessment_results(student_id);

CREATE TABLE assessment_attempts (
 assessment_id TEXT REFERENCES assessments(id),
 student_id TEXT REFERENCES app_users(id),
 started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(assessment_id, student_id)
);

CREATE TABLE ai_settings (
 id INTEGER PRIMARY KEY CHECK(id = 1),
 encrypted_key TEXT NOT NULL,
 model TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 provider TEXT NOT NULL DEFAULT 'gemini' CHECK(provider IN ('gemini','openai','anthropic'))
);

CREATE TABLE learning_guidance (
 course_id TEXT NOT NULL REFERENCES courses(id),
 student_id TEXT NOT NULL REFERENCES app_users(id),
 content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 8000),
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 updated_by TEXT NOT NULL REFERENCES app_users(id),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(course_id, student_id)
);
