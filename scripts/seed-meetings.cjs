// Sample data for 면담·상담일지: requests, scheduled meetings and completed counseling logs, dated around the run day.
// Re-runnable: rows use fixed 5eed...m ids. Usage: node scripts/seed-meetings.cjs /tmp/meet-seed.sql && npx wrangler d1 execute lms --remote --file /tmp/meet-seed.sql
const fs = require('fs');
const q = s => s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";
const uid = e => `(SELECT id FROM app_users WHERE email=${q(e)})`;
const cid = t => `(SELECT id FROM courses WHERE title=${q(t)} AND deleted_at IS NULL ORDER BY created_at LIMIT 1)`;
const owner = t => `(SELECT owner_id FROM courses WHERE title=${q(t)} AND deleted_at IS NULL ORDER BY created_at LIMIT 1)`;
const base = new Date(); base.setUTCHours(0, 0, 0, 0);
const at = (days, hourKST) => new Date(base.getTime() + days * 864e5 + (hourKST - 9) * 36e5).toISOString();
const rows = [
 {s: 'learner03@example.com', c: '데이터분석 실무', by: 'student', topic: '회귀분석 과제가 어려워요', note: '잔차 그래프를 어떻게 해석해야 하는지 모르겠어요. 과제 마감 전에 한 번 봐 주세요.', pref: at(2, 14), status: 'requested', kind: 'study'},
 {s: 'learner05@example.com', c: '인공지능 기초', by: 'student', topic: 'AI 직무 진로 상담', note: '데이터 분석가와 ML 엔지니어 중 어떤 쪽이 맞을지 고민입니다.', pref: at(3, 16), status: 'requested', kind: 'career'},
 {s: 'learner07@example.com', c: '피지컬 AI 입문', by: 'instructor', topic: '미응시 2건 확인과 학습 계획', sched: at(1, 10), status: 'scheduled', kind: 'attendance'},
 {s: 'learner01@example.com', c: '데이터분석 실무', by: 'student', topic: '중간 평가 이후 학습 계획', pref: at(-7, 15), sched: at(-6, 15), held: at(-6, 15), status: 'done', kind: 'study', pub: 1,
  summary: '중간 평가에서 가설 검정 문항 정답률이 낮았습니다. p-value 해석을 다시 정리하고, 매주 실습 노트를 공유하기로 했습니다.',
  actions: [{text: 'p-value 해석 연습 문제 10개 풀기', done: true}, {text: '7주차 실습 노트 금요일까지 공유', done: false}, {text: '연습 모드에서 t-검정 개념 반복', done: false}],
  priv: '아르바이트로 평일 저녁 시간이 부족하다고 함. 주말 학습 위주로 계획. 다음 면담에서 실습 노트 제출 여부 확인.', next: at(8, 15)},
 {s: 'learner04@example.com', c: '인공지능 기초', by: 'instructor', topic: '포트폴리오 방향 상담', sched: at(-12, 11), held: at(-12, 11), status: 'done', kind: 'career', pub: 1,
  summary: '이미지 분류 프로젝트를 포트폴리오로 정리하기로 했습니다. 결과 그래프와 실패한 시도까지 기록하면 좋습니다.',
  actions: [{text: 'CNN 실습 결과를 README로 정리', done: true}, {text: '다음 주까지 프로젝트 주제 2개 후보 정하기', done: true}], priv: '진로 의지가 뚜렷함. 심화 과정 추천 고려.'},
 {s: 'learner02@example.com', c: '피지컬 AI 입문', by: 'instructor', topic: '지각·결석 상담', sched: at(-3, 13), held: at(-3, 13), status: 'done', kind: 'attendance', pub: 0, summary: '',
  actions: [], priv: '가족 간병으로 오전 수업 지각이 잦음. 녹화 강의 링크 안내함. 학생에게 공개하지 않음.'},
 {s: 'student01@example.com', c: 'AI 서비스 개발 입문', by: 'student', topic: 'API 연동 과제 피드백', pref: at(-9, 17), sched: at(-8, 17), held: at(-8, 17), status: 'done', kind: 'study', pub: 1,
  summary: 'HTTP 상태 코드 처리와 오류 메시지 표시가 빠져 있었습니다. 예외 처리를 보완해 다시 제출하기로 했습니다.',
  actions: [{text: 'fetch 오류 처리 추가 후 재제출', done: true}, {text: 'HTTP 상태 코드 정리 노트 만들기', done: false}], priv: '이해도는 좋으나 마감 직전 몰아서 작업하는 습관.'},
 {s: 'student01@example.com', c: 'AI 서비스 개발 입문', by: 'student', topic: '최종 프로젝트 주제 상의', note: '챗봇과 추천 서비스 중 고민 중이에요.', pref: at(2, 18), status: 'requested', kind: 'study'},
 {s: 'student01@example.com', c: '데이터베이스 기초', by: 'instructor', topic: '트랜잭션 개념 보충', sched: at(4, 14), status: 'scheduled', kind: 'study'},
];
const out = ["DELETE FROM meetings WHERE id LIKE '5eed%';"];
rows.forEach((r, i) => {
 const id = `5eed0000-0000-4000-8000-m${String(i + 1).padStart(11, '0')}`;
 out.push(`INSERT INTO meetings(id,course_id,student_id,instructor_id,requested_by,topic,request_note,preferred_at,scheduled_at,status,kind,held_at,private_note,summary,actions,published,next_at,created_at,updated_at) VALUES(${[q(id), cid(r.c), uid(r.s), owner(r.c), q(r.by), q(r.topic), q(r.note || ''), q(r.pref), q(r.sched), q(r.status), q(r.kind), q(r.held), q(r.priv || ''), q(r.summary || ''), q(JSON.stringify(r.actions || [])), r.pub ? 1 : 0, q(r.next), q(r.held || r.sched || r.pref), q(r.held || r.sched || r.pref)].join(',')});`);
 if (r.next) out.push(`INSERT INTO meetings(id,course_id,student_id,instructor_id,requested_by,topic,scheduled_at,status,kind) VALUES(${[q(id.replace('-m', '-n')), cid(r.c), uid(r.s), owner(r.c), q('instructor'), q('후속 면담: ' + r.topic), q(r.next), q('scheduled'), q(r.kind)].join(',')});`);
});
fs.writeFileSync(process.argv[2] || '/tmp/meet-seed.sql', out.join('\n') + '\n');
console.log('wrote', out.length, 'statements');
