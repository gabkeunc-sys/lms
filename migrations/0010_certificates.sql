-- Course completion certificates. One per student per course; revoked rows stay so auto-issue does not re-create them.
CREATE TABLE IF NOT EXISTS certificates (
 id TEXT PRIMARY KEY,
 cert_no TEXT NOT NULL UNIQUE,
 course_id TEXT NOT NULL,
 student_id TEXT NOT NULL,
 student_name TEXT NOT NULL,
 course_title TEXT NOT NULL,
 average REAL NOT NULL,
 grade TEXT NOT NULL,
 completed_on TEXT NOT NULL,
 method TEXT NOT NULL DEFAULT 'auto' CHECK (method IN ('auto','manual')),
 issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 issued_by TEXT,
 revoked_at TEXT,
 revoked_by TEXT,
 revoke_reason TEXT,
 UNIQUE (course_id, student_id)
);
CREATE INDEX IF NOT EXISTS certificates_student ON certificates(student_id);
