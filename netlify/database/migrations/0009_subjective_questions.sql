INSERT INTO assessments(id,course_id,title,kind,week,duration,questions)
SELECT 'f8cf20ce-2d01-4a7e-bc87-993d4a240918',course_id,'웹 기초 서술형 평가','quiz',2,20,
'[
 {"type":"text","prompt":"HTTP에서 요청과 응답이 어떤 역할을 하는지 클라이언트와 서버의 관계를 포함해 설명하세요.","model_answer":"클라이언트는 원하는 자원이나 작업을 HTTP 요청으로 서버에 전달한다. 서버는 요청을 처리한 후 상태 코드와 필요한 데이터를 HTTP 응답으로 반환한다.","rubric":"클라이언트가 요청을 보낸다는 설명 3점, 서버가 처리 후 응답한다는 설명 3점, 자원·작업 또는 상태 코드·데이터를 적절히 설명하면 4점. 표현이 달라도 의미가 정확하면 인정한다.","points":10,"tag":"HTTP 요청·응답","explanation":"요청과 응답의 주체 및 전달하는 정보를 구분한다."},
 {"type":"text","prompt":"HTML, CSS, JavaScript가 웹 화면에서 각각 담당하는 역할을 설명하세요.","model_answer":"HTML은 문서의 구조와 의미를 정의하고, CSS는 색상·배치 등 표현을 담당한다. JavaScript는 사용자 입력에 반응하거나 데이터를 처리하는 동작을 구현한다.","rubric":"HTML의 구조·의미 3점, CSS의 표현·스타일 3점, JavaScript의 동작·상호작용 4점. 적절한 예시로 설명해도 인정한다.","points":10,"tag":"웹 구성 요소","explanation":"구조, 표현, 동작의 역할을 이해한다."},
 {"type":"text","prompt":"사용자의 비밀번호를 데이터베이스에 평문으로 저장하면 안 되는 이유와 적절한 저장 방법을 설명하세요.","model_answer":"평문으로 저장하면 데이터베이스 유출 시 비밀번호가 그대로 노출된다. 사용자별 salt와 비밀번호 저장용 해시 함수를 사용해 해시값을 저장하고 로그인 때 입력 비밀번호를 같은 방식으로 검증한다.","rubric":"유출 시 비밀번호 노출 위험 4점, 비밀번호 저장용 해시 사용 4점, salt의 역할 또는 해시 비교를 통한 검증 설명 2점. 단순 암호화만 제시하면 해시 항목 점수는 부여하지 않는다.","points":10,"tag":"인증·비밀번호 보관","explanation":"비밀번호 원문을 복원할 필요 없이 일치 여부를 검증하도록 설계한다."}
]'::jsonb
FROM assessments WHERE id='ad06a855-9a44-4dfa-aeda-43abfe37dd06'
ON CONFLICT(id) DO NOTHING;
