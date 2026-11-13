CREATE TABLE assessment_results (
 id uuid PRIMARY KEY, assessment_id uuid NOT NULL REFERENCES assessments(id),
 student_id uuid NOT NULL REFERENCES app_users(id),
 questions jsonb NOT NULL, answers jsonb NOT NULL,
 score integer NOT NULL CHECK(score>=0), total integer NOT NULL CHECK(total>0 AND score<=total),
 submitted_at timestamptz NOT NULL, duration_seconds integer NOT NULL CHECK(duration_seconds>=0),
 origin text NOT NULL DEFAULT 'generated', UNIQUE(assessment_id,student_id)
);
CREATE INDEX assessment_results_student_idx ON assessment_results(student_id);
UPDATE app_users SET name=trim(replace(name, U&' (\AC00\C0C1)', '')) WHERE name LIKE '%'||U&' (\AC00\C0C1)'||'%';
DO $results$
DECLARE a record; s record; q record; idx integer:=0; qcount integer; correct_count integer; selected integer;
 answer_list jsonb; earned integer; maximum integer;
BEGIN
 SELECT * INTO a FROM assessments WHERE id='ad06a855-9a44-4dfa-aeda-43abfe37dd06';
 IF a.id IS NULL THEN RAISE EXCEPTION 'Assessment missing'; END IF;
 qcount:=jsonb_array_length(a.questions);
 IF qcount=0 THEN RAISE EXCEPTION 'Assessment has no questions'; END IF;
 FOR s IN SELECT u.id FROM courses c JOIN app_users u ON c.student_ids @> to_jsonb(ARRAY[u.id::text])
 WHERE c.id=a.course_id AND u.role='student' AND u.active=true ORDER BY u.email,u.id LOOP
  correct_count:=greatest(0,qcount-(idx%6));answer_list:='[]';earned:=0;maximum:=0;
  FOR q IN SELECT value,ordinality FROM jsonb_array_elements(a.questions) WITH ORDINALITY LOOP
   selected:=(q.value->>'answer')::integer;
   IF ((q.ordinality::integer-1+idx)%qcount)>=correct_count THEN selected:=(selected+1)%4;
   ELSE earned:=earned+(q.value->>'points')::integer; END IF;
   maximum:=maximum+(q.value->>'points')::integer;
   answer_list:=answer_list||to_jsonb(selected);
  END LOOP;
  INSERT INTO assessment_results(id,assessment_id,student_id,questions,answers,score,total,submitted_at,duration_seconds)
  VALUES(md5(a.id::text||s.id::text)::uuid,a.id,s.id,a.questions,answer_list,earned,maximum,now()-(idx*interval '2 minutes'),600+(idx*37)%540)
  ON CONFLICT(assessment_id,student_id) DO NOTHING;
  idx:=idx+1;
 END LOOP;
END $results$;
