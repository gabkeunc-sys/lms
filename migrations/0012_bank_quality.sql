-- Question bank quality: review status (AI drafts wait for review), sharing scope,
-- link to the exam question it was synced from, and how it was added (excel upload).
ALTER TABLE question_bank ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','reviewed'));
ALTER TABLE question_bank ADD COLUMN share TEXT NOT NULL DEFAULT 'course' CHECK(share IN ('course','all'));
ALTER TABLE question_bank ADD COLUMN source_assessment_id TEXT;
ALTER TABLE question_bank ADD COLUMN source_index INTEGER;
ALTER TABLE question_bank ADD COLUMN via TEXT NOT NULL DEFAULT '';
ALTER TABLE question_bank ADD COLUMN reviewed_at TEXT;
CREATE INDEX question_bank_course_idx ON question_bank(course_id);
CREATE INDEX question_bank_src_idx ON question_bank(source_assessment_id, source_index);
