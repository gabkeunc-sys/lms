-- Instructor tools: reusable question bank and private student notes (memos, counseling records).
CREATE TABLE question_bank (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES app_users(id),
 course_id TEXT REFERENCES courses(id),
 concept TEXT NOT NULL DEFAULT '' CHECK(length(concept) <= 80),
 difficulty TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
 question TEXT NOT NULL CHECK(json_valid(question)),
 source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','exam','ai')),
 used_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 deleted_at TEXT
);
CREATE INDEX question_bank_owner_idx ON question_bank(owner_id);
CREATE TABLE student_notes (
 id TEXT PRIMARY KEY,
 course_id TEXT REFERENCES courses(id),
 student_id TEXT NOT NULL REFERENCES app_users(id),
 author_id TEXT NOT NULL REFERENCES app_users(id),
 kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('note','counsel')),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX student_notes_student_idx ON student_notes(student_id, created_at);
