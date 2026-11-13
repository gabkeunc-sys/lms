// Sample data for instructor tools: question bank (from existing exams) and student notes/counseling records.
// Usage: node scripts/seed-teach.cjs /tmp/teach-seed.sql && npx wrangler d1 execute lms --remote --file /tmp/teach-seed.sql
const fs = require('fs');
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const uid = e => `(SELECT id FROM app_users WHERE email=${q(e)})`;
const cid = t => `(SELECT id FROM courses WHERE title=${q(t)} AND deleted_at IS NULL LIMIT 1)`;
const out = ["DELETE FROM question_bank WHERE id LIKE 'seed-%';", "DELETE FROM student_notes WHERE id LIKE 'seed-%';"];
// Every question of every existing exam goes into its instructor's bank, tagged by concept.
out.push(`INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source,used_count,created_at)
SELECT 'seed-qb-'||a.id||'-'||jq.key, c.owner_id, c.id, coalesce(json_extract(jq.value,'$.tag'),''),
 CASE abs(random())%3 WHEN 0 THEN 'easy' WHEN 1 THEN 'medium' ELSE 'hard' END, jq.value, 'exam', 1+abs(random())%3, a.created_at
FROM assessments a JOIN courses c ON c.id=a.course_id, json_each(a.questions) jq WHERE c.deleted_at IS NULL;`);
const ai = [
 ['gabkeunc@gmail.com', '데이터분석 실무', '그룹 집계', 'medium', {type: 'choice', prompt: 'pandas에서 부서별 평균 급여를 구하는 코드로 가장 알맞은 것은?', options: ["df.groupby('dept')['salary'].mean()", "df.sort_values('dept').mean()", "df['salary'].groupby().mean('dept')", "df.pivot('dept').salary"], answer: 0, points: 10, explanation: 'groupby로 묶은 뒤 열을 골라 mean을 적용합니다.'}],
 ['gabkeunc@gmail.com', '인공지능 기초', '과적합', 'hard', {type: 'text', prompt: '검증 손실은 늘고 학습 손실은 계속 줄어드는 상황을 설명하고, 이를 줄이는 방법 두 가지를 쓰세요.', points: 10, model_answer: '과적합 상태입니다. 드롭아웃·정규화, 조기 종료, 데이터 증강 등으로 줄일 수 있습니다.', rubric: '과적합 진단 4점, 해결 방법 각 3점', explanation: '학습/검증 곡선의 차이로 과적합을 판단합니다.'}],
 ['gabkeunc@gmail.com', '피지컬 AI 입문', 'PID 제어', 'easy', {type: 'choice', prompt: 'PID 제어에서 누적 오차를 줄이는 역할을 하는 항은?', options: ['비례(P)', '적분(I)', '미분(D)', '피드포워드'], answer: 1, points: 10, explanation: '적분 항은 누적된 오차를 보정합니다.'}],
];
ai.forEach(([e, c, concept, d, ques], i) => out.push(`INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source,used_count,created_at) VALUES('seed-qb-ai-${i}',${uid(e)},${cid(c)},${q(concept)},'${d}',${q(JSON.stringify({...ques, tag: concept}))},'ai',0,strftime('%Y-%m-%dT%H:%M:%fZ','now','-${i + 1} days'));`));
const notes = [
 ['learner07@example.com', '데이터분석 실무', 'counsel', '2주 연속 미응시. 회사 일정으로 저녁 시간이 부족하다고 함. 주말 보충 퀴즈로 대체하기로 합의.', 2],
 ['learner05@example.com', '데이터분석 실무', 'counsel', '최근 점수 하락. 시각화 파트에서 matplotlib 문법이 헷갈린다고 함. 예제 노트북 3개 추가 제공.', 4],
 ['learner05@example.com', '피지컬 AI 입문', 'note', '센서 실습 키트 받아감. 다음 수업 전 반납 예정.', 6],
 ['learner08@example.com', '데이터분석 실무', 'note', '질문을 많이 하는 편. 그룹 집계 개념은 이해했지만 피벗은 연습 필요.', 9],
 ['learner03@example.com', '피지컬 AI 입문', 'counsel', '점수 급락 알림 확인. 이번 주 개인 면담 30분 진행, 칼만 필터 기초 자료 공유.', 1],
 ['student09@example.com', 'AI 서비스 개발 입문', 'counsel', '미응시 5건. 연락 결과 장기 출장. 복귀 후 재응시 일정 잡기로 함.', 3],
 ['student03@example.com', 'AI 서비스 개발 입문', 'note', 'RAG 과제에서 좋은 아이디어 제출. 팀 프로젝트 리더 후보.', 7],
];
const owner = {'데이터분석 실무': 'gabkeunc@gmail.com', '피지컬 AI 입문': 'gabkeunc@gmail.com', '인공지능 기초': 'gabkeunc@gmail.com', 'AI 서비스 개발 입문': 'teacher01@example.com'};
notes.forEach(([s, c, kind, body, d], i) => out.push(`INSERT INTO student_notes(id,course_id,student_id,author_id,kind,body,created_at) SELECT 'seed-note-${i}',${cid(c)},id,${uid(owner[c])},'${kind}',${q(body)},strftime('%Y-%m-%dT%H:%M:%fZ','now','-${d} days','-3 hours') FROM app_users WHERE email=${q(s)};`));
fs.writeFileSync(process.argv[2] || 'teach-seed.sql', out.join('\n') + '\n');
