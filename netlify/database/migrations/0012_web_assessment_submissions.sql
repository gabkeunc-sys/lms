DO $assessment$
DECLARE c record; a_id uuid:='9aa97137-bc25-4b1e-bc2e-6b520dd08772'; s record; i integer:=0;
qs jsonb; answers jsonb; feedback jsonb; earned integer; j integer; selected integer;
written text[]:=ARRAY[
'클라이언트는 HTTP 요청으로 서버에 자원이나 처리를 요청한다. 서버는 요청을 처리하고 상태 코드와 데이터를 응답한다. HTML은 구조, CSS는 표현, JavaScript는 동작을 담당한다. 비밀번호는 유출에 대비해 사용자별 salt와 비밀번호 해시 함수를 적용해 저장하고 로그인 시 검증한다.',
'브라우저가 요청을 보내면 서버가 처리 결과를 응답한다. HTML은 문서 구조, CSS는 디자인, JavaScript는 클릭 같은 동작을 구현한다. 비밀번호는 평문이 노출되지 않도록 해시해서 저장한다.',
'클라이언트가 서버에 요청하고 서버가 데이터와 상태 코드를 반환한다. HTML은 구조를 만들고 CSS는 색과 배치를 담당하며 JavaScript는 상호작용을 처리한다. 비밀번호는 암호화해서 저장하면 된다.',
'HTTP는 요청과 응답으로 데이터를 주고받는다. HTML은 구조이고 CSS는 스타일이다. 비밀번호는 그대로 저장하면 안 된다.',
'서버가 브라우저 요청을 처리하고 응답한다. HTML로 내용을 구성하고 CSS로 디자인하며 JavaScript로 사용자 동작을 처리한다. 비밀번호는 salt와 scrypt 같은 비밀번호 해시로 저장해서 유출 시 원문이 바로 드러나지 않게 한다.',
'HTML은 화면의 뼈대, CSS는 스타일, JavaScript는 동작이다. 비밀번호는 해시해서 저장해야 한다.',
'HTTP에서 브라우저가 요청을 보내고 서버는 결과와 상태 코드를 보낸다. HTML은 구조, CSS는 데이터베이스, JavaScript는 디자인이다. 비밀번호는 데이터베이스에 원문으로 저장한다.',
'클라이언트 요청에 서버가 응답한다. HTML은 문서 구조이고 CSS는 배치와 색상이며 JavaScript는 이벤트 처리와 서버 데이터 요청을 담당한다. 비밀번호 원문 대신 사용자별 salt가 포함된 비밀번호 해시를 저장해 비교 검증한다.',
'웹에서는 서버와 브라우저가 통신한다. HTML과 CSS로 화면을 만든다. 비밀번호는 관리자만 볼 수 있도록 저장한다.'
];
BEGIN
 IF EXISTS(SELECT 1 FROM assessments WHERE id=a_id) THEN RETURN; END IF;
 IF (SELECT count(*) FROM courses WHERE owner_id='2316c163-ca5b-49e3-94b2-8d0852576799' AND deleted_at IS NULL AND title='풀스택 웹 개발 기초')<>1 THEN RAISE EXCEPTION 'Expected one active instructor course'; END IF;
 SELECT * INTO c FROM courses WHERE owner_id='2316c163-ca5b-49e3-94b2-8d0852576799' AND deleted_at IS NULL AND title='풀스택 웹 개발 기초';
 qs:='[
 {"type":"choice","prompt":"HTML에서 다른 페이지로 연결하는 링크를 만드는 요소는 무엇인가요?","options":["<p>","<a>","<div>","<span>"],"answer":1,"points":15,"tag":"HTML 링크","explanation":"a 요소의 href 속성에 연결할 주소를 지정합니다."},
 {"type":"choice","prompt":"CSS에서 글자 색상을 지정하는 속성은 무엇인가요?","options":["margin","display","color","padding"],"answer":2,"points":15,"tag":"CSS 속성","explanation":"color는 글자 색상, margin과 padding은 여백, display는 표시 방식을 지정합니다."},
 {"type":"choice","prompt":"JavaScript에서 재할당할 수 없는 변수를 선언하는 키워드는 무엇인가요?","options":["const","let","var","return"],"answer":0,"points":15,"tag":"JavaScript 선언","explanation":"const로 선언한 변수는 재할당할 수 없습니다. 객체의 내부 속성 변경 여부와는 구분합니다."},
 {"type":"choice","prompt":"HTTP 요청이 정상적으로 처리되었음을 나타내는 대표적인 상태 코드는 무엇인가요?","options":["404","500","401","200"],"answer":3,"points":15,"tag":"HTTP 상태 코드","explanation":"200은 성공, 401은 인증 필요, 404는 자원 없음, 500은 서버 오류를 나타냅니다."},
 {"type":"text","prompt":"웹 서비스의 동작과 보안을 설명하세요. ① HTTP 요청·응답에서 클라이언트와 서버의 역할 ② HTML·CSS·JavaScript의 역할 ③ 비밀번호를 평문으로 저장하면 안 되는 이유와 적절한 저장 방법을 포함하세요.","model_answer":"클라이언트는 HTTP 요청으로 자원이나 처리를 요청하고 서버는 처리 결과를 상태 코드와 데이터로 응답한다. HTML은 구조와 의미, CSS는 표현과 배치, JavaScript는 동작과 상호작용을 담당한다. 비밀번호를 평문으로 저장하면 유출 시 원문이 노출되므로 사용자별 salt와 비밀번호 저장용 해시 함수를 이용해 저장하고 입력값을 검증한다.","rubric":"총 40점. 클라이언트 요청·서버 응답 역할 10점(각 5점). HTML 구조·CSS 표현·JavaScript 동작 15점(각 5점). 평문 유출 위험 5점. 비밀번호 해시 저장 7점과 salt 또는 안전한 비밀번호 해시 함수 예시 3점. 단순 암호화만 언급하면 해시 점수는 부여하지 않는다. 동등한 의미의 표현을 인정하고 누락·잘못된 설명에 대해서만 감점한다.","points":40,"tag":"웹 구조·인증 보안","explanation":"웹 요청 처리, 화면 구성 요소의 역할, 안전한 비밀번호 보관을 함께 이해하는 문제입니다."}
 ]'::jsonb;
 INSERT INTO assessments(id,course_id,title,kind,week,duration,questions,published) VALUES(a_id,c.id,'웹 서비스 구조와 인증 이해도 평가','exam',2,30,qs,true);
 FOR s IN SELECT u.id FROM app_users u WHERE u.role='student' AND u.active=true AND c.student_ids @> to_jsonb(ARRAY[u.id::text]) ORDER BY u.email,u.id LOOP
  answers:='[]';feedback:='[]';earned:=0;
  FOR j IN 0..3 LOOP
   selected:=(qs->j->>'answer')::integer;
   IF i%4>0 AND j<i%4 THEN selected:=(selected+1)%4;ELSE earned:=earned+15;END IF;
   answers:=answers||to_jsonb(selected);feedback:=feedback||jsonb_build_object('score',CASE WHEN selected=(qs->j->>'answer')::integer THEN 15 ELSE 0 END,'status','confirmed');
  END LOOP;
  answers:=answers||jsonb_build_array(written[1+(i%array_length(written,1))]);feedback:=feedback||jsonb_build_array(jsonb_build_object('status','pending'));
  INSERT INTO assessment_results(id,assessment_id,student_id,questions,answers,score,total,submitted_at,duration_seconds,origin,grading,grading_status)
   VALUES(md5(a_id::text||s.id::text)::uuid,a_id,s.id,qs,answers,earned,100,now()-i*interval '2 minutes',720+i*43,'generated',feedback,'pending');
  i:=i+1;
 END LOOP;
 IF i=0 THEN RAISE EXCEPTION 'No enrolled students';END IF;
END $assessment$;
