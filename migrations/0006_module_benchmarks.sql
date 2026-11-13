-- Expected score (0-100) a developer with about 3 years of industry experience would get on each weekly module.
-- Sample estimates for now; later replaced by real data or AI.
ALTER TABLE course_modules ADD COLUMN benchmark REAL CHECK(benchmark IS NULL OR benchmark BETWEEN 0 AND 100);
UPDATE course_modules SET benchmark = 76 + ((week * 7) % 15);
