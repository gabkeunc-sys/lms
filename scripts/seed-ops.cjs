// Usage: node scripts/seed-ops.cjs /tmp/ops-seed.sql && npx wrangler d1 execute lms --remote --file /tmp/ops-seed.sql
// Sample history for the admin operations screens. Re-runnable: deletes rows it created (id prefix 'seed-').
const fs = require('fs');
let seed = 20261113; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const q = s => s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";
const uid = e => `(SELECT id FROM app_users WHERE email=${q(e)})`;
const ADMIN = "(SELECT id FROM app_users WHERE role='admin' ORDER BY created_at LIMIT 1)";
const cid = t => `(SELECT id FROM courses WHERE title=${q(t)} AND deleted_at IS NULL LIMIT 1)`;
const NOW = new Date('2026-11-13T09:00:00Z');
const at = (daysAgo, h = int(0, 23), m = int(0, 59)) => { const d = new Date(NOW - daysAgo * 864e5); d.setUTCHours(h, m, int(0, 59), 0); return d.toISOString(); };
const out = ["DELETE FROM ai_usage WHERE id LIKE 'seed-%';", "DELETE FROM activity_log WHERE id LIKE 'seed-%';", "DELETE FROM announcements WHERE id LIKE 'seed-%';", "DELETE FROM notifications WHERE id LIKE 'seed-%';"];
let n = 0; const id = p => `seed-${p}-${String(++n).padStart(5, '0')}`;

const teachers = [['teacher01@example.com', '조현우'], ['teacher02@example.com', '이수진'], ['gabkeunc@gmail.com', '최갑근']];
const students = ['learner01', 'learner02', 'learner03', 'learner04', 'learner05', 'learner06', 'learner07', 'learner08', 'learner09', 'learner10', 'learner11', 'learner12', 'student01', 'student02', 'student03', 'student04', 'student05', 'student06', 'student08', 'student09', 'student10'].map(s => s + '@example.com');
const names = {'learner01@example.com': '김도현', 'learner02@example.com': '이하린', 'learner03@example.com': '박서준', 'learner04@example.com': '정유나', 'learner05@example.com': '최민재', 'learner06@example.com': '한지우', 'learner07@example.com': '오세린', 'learner08@example.com': '윤태오', 'student01@example.com': '김민준', 'student02@example.com': '이서연', 'student03@example.com': '박지호', 'student04@example.com': '최하은'};
const courses = ['데이터분석 실무', '피지컬 AI 입문', '인공지능 기초', 'AI 서비스 개발 입문', '데이터베이스 기초'];

// ---- AI usage: 75 days ----
const errors = ['OpenAI 응답 시간 초과 (30s)', 'Rate limit: 분당 요청 한도 초과', 'JSON 형식이 아닌 응답', 'HTTP 500: upstream error'];
const rows = [];
for (let d = 75; d >= 0; d--) {
 const day = new Date(NOW - d * 864e5).getUTCDay(), weekend = day === 0 || day === 6;
 const growth = 1 + (75 - d) / 60; // usage grows as courses run
 const grading = Math.round((weekend ? int(0, 3) : int(4, 12)) * growth), guidance = Math.round((weekend ? int(0, 1) : int(0, 4)) * growth);
 for (const [purpose, count] of [['grading', grading], ['guidance', guidance]]) for (let i = 0; i < count; i++) {
  if (d === 0 && rnd() < .6) continue;
  const ok = rnd() > .035, input = purpose === 'grading' ? int(900, 2600) : int(2200, 5200), output = ok ? (purpose === 'grading' ? int(140, 420) : int(500, 1100)) : 0;
  const cost = ok ? (input * 0.4 + output * 1.6) / 1e6 : 0, t = pick(teachers)[0];
  rows.push(`(${q(id('ai'))},${q(at(d, int(0, d === 0 ? 8 : 23)))},'openai','gpt-4.1-mini',${q(purpose)},${uid(t)},${ok ? input : 0},${output},${cost.toFixed(6)},${ok ? 1 : 0},${ok ? 'NULL' : q(pick(errors))},${int(1200, ok ? 6800 : 30000)})`);
 }
}
rows.push(`(${q(id('ai'))},${q(at(9, 10))},'openai','gpt-4.1-mini','test',${ADMIN},18,6,0.000017,1,NULL,640)`);
for (let i = 0; i < rows.length; i += 200) out.push(`INSERT INTO ai_usage(id,created_at,provider,model,purpose,user_id,input_tokens,output_tokens,cost_usd,ok,error,latency_ms) VALUES\n${rows.slice(i, i + 200).join(',\n')};`);

// ---- Activity log: 45 days ----
const acts = [];
const log = (daysAgo, actor, action, target, detail = {}, h) => acts.push(`(${q(id('log'))},${q(at(daysAgo, h ?? int(0, 23)))},${actor},${q(action)},${q(target)},${q(JSON.stringify(detail))})`);
const ips = ['211.234.10.', '121.162.44.', '175.223.18.', '59.10.201.'];
for (let d = 45; d >= 0; d--) {
 for (let i = 0; i < int(5, 11); i++) { const s = pick(students); log(d, uid(s), 'auth.login', s, {ip: pick(ips) + int(2, 250)}, int(0, d === 0 ? 8 : 23)); }
 for (const [e] of teachers) if (rnd() < .8) log(d, uid(e), 'auth.login', e, {ip: pick(ips) + int(2, 250)}, int(0, d === 0 ? 8 : 23));
 if (rnd() < .7) log(d, ADMIN, 'auth.login', 'admin', {ip: '211.234.10.7'}, int(0, d === 0 ? 8 : 23));
 if (rnd() < .25) { const s = pick(students); log(d, 'NULL', 'auth.login_failed', s, {ip: pick(ips) + int(2, 250)}); }
 if (d > 0) for (let i = 0; i < int(1, 5); i++) {
  const [t] = pick(teachers), s = pick(Object.keys(names)), used = rnd() < .75 ? int(1, 3) : 0, changed = used ? (rnd() < .3 ? int(1, used) : 0) : 0;
  if (used) log(d, uid(t), 'grade.ai_proposal', `${names[s]} · ${int(2, 7)}주차 주관식`, {questions: used});
  log(d, uid(t), 'grade.confirm', `${names[s]} · ${int(2, 7)}주차 ${pick(['미니퀴즈', '평가'])}`, {score: int(52, 98), ai_used: used, ai_changed: changed});
 }
 if (d > 0 && rnd() < .35) { const [t] = pick(teachers), s = pick(Object.keys(names)); log(d, uid(t), pick(['guidance.publish', 'guidance.publish', 'guidance.save']), `${names[s]} · ${pick(courses)}`, {}); }
}
log(44, ADMIN, 'course.create', '데이터분석 실무', {owner: '최갑근'}, 2);
log(44, ADMIN, 'course.create', '피지컬 AI 입문', {owner: '최갑근'}, 2);
log(44, ADMIN, 'course.create', '인공지능 기초', {owner: '최갑근'}, 3);
log(43, ADMIN, 'course.enroll', '데이터분석 실무', {added: 10, created: 6, skipped: 0}, 3);
log(43, ADMIN, 'course.enroll', '피지컬 AI 입문', {added: 10, created: 4, skipped: 0}, 3);
log(43, ADMIN, 'course.enroll', '인공지능 기초', {added: 10, created: 2, skipped: 0}, 4);
log(38, ADMIN, 'member.role', 'teacher02@example.com', {name: '이수진', role: 'instructor'}, 1);
log(30, ADMIN, 'course.assign', '데이터베이스 기초', {owner: '이수진'}, 5);
log(4, ADMIN, 'member.password_reset', 'student06@example.com', {name: '강수빈'}, 6);
log(5, ADMIN, 'member.deactivate', 'student07@example.com', {name: '휴학 처리'}, 7);
log(12, ADMIN, 'ai.limit', 'ai_monthly_limit_usd', {limit: 20}, 1);
log(6, uid('teacher01@example.com'), 'course.update', 'AI 서비스 개발 입문', {students: 9}, 4);
log(3, ADMIN, 'risk.notify', 'learner07@example.com', {student: '오세린', course: '데이터분석 실무', reasons: ['미응시 2건', '3년차 기준 -28점']}, 5);
log(2, ADMIN, 'announcement.create', '11월 정기 점검 안내', {}, 1);
log(1, uid('gabkeunc@gmail.com'), 'announcement.create', '6주차 미니퀴즈 범위 안내', {}, 6);
for (let i = 0; i < acts.length; i += 200) out.push(`INSERT INTO activity_log(id,created_at,actor_id,action,target,detail) VALUES\n${acts.slice(i, i + 200).join(',\n')};`);

// ---- Announcements ----
const ann = [
 [null, 'urgent', '11월 정기 점검 안내 (11/16 02:00~04:00)', '서버 점검으로 11월 16일(일) 새벽 2시부터 4시까지 접속이 되지 않습니다.\n이 시간에는 시험 응시를 피해 주세요.', ADMIN, 2],
 [null, 'notice', '2학기 수료 기준 안내', '과정별 수료 기준은 응시율 80% 이상, 평균 60점 이상입니다. 보고서 메뉴에서 현재 상태를 확인할 수 있습니다.', ADMIN, 9],
 [null, 'notice', 'AI 채점 결과는 강사가 확인한 뒤 공개됩니다', 'AI가 제안한 점수는 담당 강사가 검토·수정한 뒤 확정됩니다. 확정 전에는 성적에 반영되지 않습니다.', ADMIN, 20],
 ['데이터분석 실무', 'exam', '6주차 미니퀴즈 범위 안내', '시각화(matplotlib, seaborn)와 그룹 집계까지 범위입니다. 노트북 파일을 미리 열어 두세요.', uid('gabkeunc@gmail.com'), 1],
 ['인공지능 기초', 'exam', '8주차 최종 평가 일정', '최종 평가는 객관식 15문항, 주관식 3문항입니다. 시간은 60분입니다.', uid('gabkeunc@gmail.com'), 3],
 ['피지컬 AI 입문', 'notice', '센서 실습 키트 반납 안내', '실습이 끝난 키트는 다음 주 수업 전까지 반납해 주세요.', uid('gabkeunc@gmail.com'), 5],
 ['AI 서비스 개발 입문', 'notice', '프로젝트 팀 구성 안내', '3인 1조로 팀을 구성해 다음 주까지 알려 주세요.', uid('teacher01@example.com'), 7],
 ['데이터베이스 기초', 'exam', '중간 평가 재응시 안내', '중간 평가 미응시자는 이번 주 금요일까지 재응시할 수 있습니다.', uid('teacher02@example.com'), 4],
];
ann.forEach(([c, kind, title, body, by, d]) => out.push(`INSERT INTO announcements(id,course_id,kind,title,body,created_by,created_at) VALUES(${q(id('ann'))},${c ? cid(c) : 'NULL'},${q(kind)},${q(title)},${q(body)},${by},${q(at(d, int(0, 8)))});`));

// ---- Notifications ----
const notes = [
 ['gabkeunc@gmail.com', 'risk', '위험 학생 알림: 오세린', '데이터분석 실무 · 미응시 2건, 3년차 기준 -28점. 상담을 권장합니다.', '/teach/results', 3, null],
 ['gabkeunc@gmail.com', 'course', '과정 배정: 인공지능 기초', '관리자가 인공지능 기초 과정의 담당 강사로 지정했습니다.', '/teach/courses', 44, 43],
 ['gabkeunc@gmail.com', 'course', '학생 10명 등록: 데이터분석 실무', 'CSV 일괄 등록으로 학생 10명이 추가되었습니다.', '/teach/courses', 43, 42],
 ['teacher01@example.com', 'risk', '위험 학생 알림: 김민준', 'AI 서비스 개발 입문 · 직전 평균 대비 24점 하락.', '/teach/results', 2, null],
 ['teacher02@example.com', 'course', '과정 배정: 데이터베이스 기초', '관리자가 데이터베이스 기초 과정의 담당 강사로 지정했습니다.', '/teach/courses', 30, 29],
];
notes.forEach(([e, kind, title, body, link, d, read]) => out.push(`INSERT INTO notifications(id,user_id,kind,title,body,link,created_at,read_at) SELECT ${q(id('ntf'))},id,${q(kind)},${q(title)},${q(body)},${q(link)},${q(at(d, 3))},${read == null ? 'NULL' : q(at(read, 4))} FROM app_users WHERE email=${q(e)};`));
fs.writeFileSync(process.argv[2] || 'ops-seed.sql', out.join('\n') + '\n');
console.log('ai', rows.length, 'log', acts.length);
