-- Images used in questions, choices and explanations (R2 is not enabled on this account, so images live in D1).
CREATE TABLE question_images (
 id TEXT PRIMARY KEY,
 mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp','image/gif')),
 data TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 700000),
 created_by TEXT REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
