-- Student-instructor meetings (면담) with counseling logs: requests, scheduling, private notes vs. a summary shared with the student.
CREATE TABLE meetings (
 id TEXT PRIMARY KEY,
 course_id TEXT NOT NULL REFERENCES courses(id),
 student_id TEXT NOT NULL REFERENCES app_users(id),
 instructor_id TEXT NOT NULL REFERENCES app_users(id),
 requested_by TEXT NOT NULL DEFAULT 'student' CHECK(requested_by IN ('student','instructor')),
 topic TEXT NOT NULL CHECK(length(topic) BETWEEN 1 AND 200),
 request_note TEXT NOT NULL DEFAULT '' CHECK(length(request_note) <= 2000),
 preferred_at TEXT,
 scheduled_at TEXT,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','scheduled','done','declined','cancelled')),
 kind TEXT NOT NULL DEFAULT 'study' CHECK(kind IN ('study','career','attendance','life','other')),
 held_at TEXT,
 private_note TEXT NOT NULL DEFAULT '' CHECK(length(private_note) <= 8000),
 summary TEXT NOT NULL DEFAULT '' CHECK(length(summary) <= 4000),
 actions TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(actions)),
 published INTEGER NOT NULL DEFAULT 0,
 next_at TEXT,
 decline_reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX meetings_student_idx ON meetings(student_id, course_id);
CREATE INDEX meetings_instructor_idx ON meetings(instructor_id, status);
-- Old short counseling notes on the student page become completed meetings (private note only).
INSERT INTO meetings(id,course_id,student_id,instructor_id,requested_by,topic,status,kind,held_at,private_note,created_at,updated_at)
 SELECT 'mt-' || n.id, n.course_id, n.student_id, n.author_id, 'instructor', '면담 기록', 'done', 'study', n.created_at, n.body, n.created_at, n.created_at
 FROM student_notes n WHERE n.kind='counsel' AND n.course_id IS NOT NULL;
DELETE FROM student_notes WHERE kind='counsel' AND course_id IS NOT NULL;
