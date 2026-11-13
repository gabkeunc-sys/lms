-- Weekly module plan an instructor designs for a course. Assessments belong to the module with the same week.
CREATE TABLE course_modules (
 id TEXT PRIMARY KEY,
 course_id TEXT NOT NULL REFERENCES courses(id),
 week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 100),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 1000),
 UNIQUE(course_id, week)
);
CREATE INDEX course_modules_course_idx ON course_modules(course_id);
-- Retake history for the learning path: how many times the student took it and the first score.
ALTER TABLE assessment_results ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assessment_results ADD COLUMN first_score INTEGER;
