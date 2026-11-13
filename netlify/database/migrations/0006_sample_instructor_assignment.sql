-- Assign the sample to the instructor shown in the user's screenshot.
DO $assign$
DECLARE target_teacher uuid; target_course uuid;
BEGIN
 SELECT id INTO target_teacher FROM app_users
 WHERE id='2316c163-ca5b-49e3-94b2-8d0852576799' AND name='조현우 (가상)' AND role='instructor' AND active=true;
 IF target_teacher IS NULL THEN RAISE EXCEPTION 'Verified demo instructor is unavailable'; END IF;
 SELECT c.id INTO target_course FROM courses c JOIN assessments a ON a.course_id=c.id
 JOIN app_users u ON u.id=c.owner_id
 WHERE a.id='ad06a855-9a44-4dfa-aeda-43abfe37dd06'
 AND c.title='풀스택 웹 개발 기초'
 AND (u.email='gabkeunc@gmail.com' AND u.role='admin' OR c.owner_id=target_teacher);
 IF target_course IS NULL THEN RAISE EXCEPTION 'Expected sample course is unavailable'; END IF;
 UPDATE courses SET owner_id=target_teacher,
 student_ids=coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(student_ids) WHERE value<>to_jsonb(target_teacher::text)),'[]'::jsonb)
 WHERE id=target_course;
END $assign$;
