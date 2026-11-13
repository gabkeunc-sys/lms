-- Requested sample course and assessment. Preserve existing course and assessment edits.
DO $seed$
DECLARE instructor_id uuid; sample_course_id uuid; students jsonb;
BEGIN
 SELECT id INTO instructor_id FROM app_users WHERE email='gabkeunc@gmail.com' AND role='admin' AND active=true;
 IF instructor_id IS NULL THEN RAISE EXCEPTION 'Sample owner admin account is missing'; END IF;
 SELECT coalesce(jsonb_agg(id ORDER BY email),'[]'::jsonb) INTO students FROM app_users
 WHERE id IN ('9bd479c5-b6bd-45cb-a5f1-7a73cb4a9e1d','611ca32e-62a2-42c9-8adc-a0760d033208','b78f1e1a-6afa-4386-a070-94e25f165660','4b90093f-c128-4e45-8ba0-07bfa110d22b','5a200407-f603-4b04-b89b-e60034e4e9ad','612ad0d2-e27d-4e7d-b150-d5e08fd79efb','2316c163-ca5b-49e3-94b2-8d0852576799','f0df9048-4128-4d60-b3d0-6fe2baaffd5d','be36465f-7ae2-4185-b7e3-63335a019fcc','24e630a5-95e3-4c0e-9faf-d7e787f7a618') AND role='student' AND active=true;
 -- Preserve role/status changes: enroll only currently active demo students.

 SELECT id INTO sample_course_id FROM courses WHERE owner_id=instructor_id AND title='풀스택 웹 개발 기초' ORDER BY created_at LIMIT 1;
 IF sample_course_id IS NULL THEN
  sample_course_id := 'f29c6d06-a469-4b76-8a23-99aba9e91415';
  INSERT INTO courses(id,owner_id,title,description,start_date,end_date,status,student_ids)
  VALUES(sample_course_id,instructor_id,'풀스택 웹 개발 기초','HTML·CSS·JavaScript로 화면을 구현하고, 서버 API와 PostgreSQL을 연결하여 회원가입·로그인 기능을 완성합니다. 주간 시험과 미니퀴즈로 이해도를 확인하고 부족한 개념을 보완합니다.','2026-11-16','2026-12-11','preparing',students);
 ELSE
  UPDATE courses SET student_ids=(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(student_ids||students)) WHERE id=sample_course_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM assessments a WHERE a.course_id=sample_course_id AND a.title='1주차 웹 기초 이해도 평가') THEN
  INSERT INTO assessments(id,course_id,title,kind,week,duration,questions)
  VALUES('ad06a855-9a44-4dfa-aeda-43abfe37dd06',sample_course_id,'1주차 웹 기초 이해도 평가','exam',1,20,$questions$[{"prompt": "HTML에서 다른 페이지로 이동하는 링크를 만드는 태그는?", "options": ["<p>", "<a>", "<div>", "<span>"], "answer": 1, "points": 10, "explanation": "<a>는 하이퍼링크를 만드는 태그이며, href 속성에 이동할 주소를 지정합니다.", "tag": "HTML 링크"}, {"prompt": "HTML에서 사용자의 입력을 받는 요소는?", "options": ["<input>", "<h1>", "<strong>", "<footer>"], "answer": 0, "points": 10, "explanation": "<input>은 텍스트·비밀번호 등 사용자 입력을 받는 요소입니다.", "tag": "HTML 폼"}, {"prompt": "class=\"notice\"인 요소를 선택하는 CSS 선택자는?", "options": ["#notice", "notice", ".notice", "*notice"], "answer": 2, "points": 10, "explanation": "클래스 선택자는 클래스 이름 앞에 마침표(.)를 붙입니다.", "tag": "CSS 선택자"}, {"prompt": "CSS에서 글자 색상을 지정하는 속성은?", "options": ["background", "font-size", "margin", "color"], "answer": 3, "points": 10, "explanation": "color는 글자 색상을 지정하는 속성입니다.", "tag": "CSS 글자 스타일"}, {"prompt": "CSS에서 요소의 테두리 바깥 여백을 지정하는 속성은?", "options": ["padding", "margin", "border", "width"], "answer": 1, "points": 10, "explanation": "margin은 테두리 바깥 여백, padding은 테두리 안쪽 여백을 지정합니다.", "tag": "CSS 박스 모델"}, {"prompt": "JavaScript에서 재할당할 수 없는 변수를 선언하는 키워드는?", "options": ["let", "var", "const", "function"], "answer": 2, "points": 10, "explanation": "const로 선언한 변수에는 다른 값을 재할당할 수 없습니다. 객체나 배열의 내부 내용은 변경할 수 있습니다.", "tag": "JavaScript 변수"}, {"prompt": "typeof 123의 실행 결과는?", "options": ["\"number\"", "\"string\"", "\"boolean\"", "\"object\""], "answer": 0, "points": 10, "explanation": "숫자 값에 typeof를 적용하면 문자열 \"number\"가 반환됩니다.", "tag": "JavaScript 자료형"}, {"prompt": "function add(a, b) { return a + b; }에서 add(2, 3)의 반환값은?", "options": ["2", "3", "\"23\"", "5"], "answer": 3, "points": 10, "explanation": "두 인수 2와 3을 더한 값 5를 반환합니다.", "tag": "JavaScript 함수"}, {"prompt": "버튼을 클릭했을 때 발생하는 이벤트 이름은?", "options": ["load", "click", "change", "submit"], "answer": 1, "points": 10, "explanation": "버튼 클릭은 click 이벤트로 처리합니다.", "tag": "JavaScript 이벤트"}, {"prompt": "document.querySelector('#submitBtn')이 선택하는 대상은?", "options": ["이름이 submitBtn인 태그", "클래스가 submitBtn인 모든 요소", "ID가 submitBtn인 첫 번째 요소", "모든 버튼 요소"], "answer": 2, "points": 10, "explanation": "#은 ID 선택자이며, querySelector()는 조건에 일치하는 첫 번째 요소를 반환합니다.", "tag": "DOM 선택"}]$questions$::jsonb);
 END IF;
END $seed$;
