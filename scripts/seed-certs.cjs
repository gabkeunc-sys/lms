// Sample data for completion certificates: two ended courses with exam results and their certificates
// (auto-issued, one manual issue, one revoked). Re-runnable: rows use fixed 5eed... ids.
// Usage: node scripts/seed-certs.cjs /tmp/certs-seed.sql && npx wrangler d1 execute lms --remote --file /tmp/certs-seed.sql
const fs = require('fs');
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const uid = e => `(SELECT id FROM app_users WHERE email=${q(e)})`;
const uname = e => `(SELECT name FROM app_users WHERE email=${q(e)})`;
let seed = 20261113; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', chunk = () => Array.from({length: 4}, () => ALPHA[Math.floor(rnd() * ALPHA.length)]).join('');
const grade = a => ([[95, 'A+'], [90, 'A'], [85, 'B+'], [80, 'B'], [75, 'C+'], [70, 'C'], [65, 'D+'], [60, 'D']].find(([m]) => a >= m) || [0, 'F'])[1];
const id = (kind, n) => `5eed0000-0000-4000-8000-${kind}${String(n).padStart(12 - kind.length, '0')}`;

const courses = [
 {n: 1, title: '파이썬 프로그래밍 기초', owner: 'gabkeunc@gmail.com', start: '2026-07-27', end: '2026-10-23', desc: '변수, 제어문, 함수, 자료구조, 파일 처리까지 파이썬 기본기를 다지는 12주 과정입니다.',
  students: Array.from({length: 12}, (_, i) => `learner${String(i + 1).padStart(2, '0')}@example.com`),
  exams: [['1주차 변수와 자료형 미니퀴즈', 'quiz', 1], ['4주차 제어문·함수 중간 점검', 'exam', 4], ['8주차 자료구조 평가', 'exam', 8], ['12주차 최종 평가', 'exam', 12]],
  skip: {'learner07@example.com': [2], 'learner12@example.com': [1, 3]}, low: ['learner11@example.com'], high: ['learner03@example.com', 'learner01@example.com'],
  manual: ['learner07@example.com'], revoked: {'learner10@example.com': '최종 평가 부정행위 신고로 재평가 진행 중'}},
 {n: 2, title: '웹 서비스 기초', owner: 'teacher01@example.com', start: '2026-06-29', end: '2026-09-25', desc: 'HTML, CSS, JavaScript와 간단한 서버까지 웹 서비스의 기본 구조를 배웁니다.',
  students: ['student01', 'student02', 'student03', 'student04', 'student05', 'student06', 'student08', 'student09', 'student10'].map(s => s + '@example.com'),
  exams: [['2주차 HTML·CSS 퀴즈', 'quiz', 2], ['6주차 JavaScript 평가', 'exam', 6], ['12주차 최종 프로젝트 평가', 'exam', 12]],
  skip: {'student09@example.com': [1, 2]}, low: ['student05@example.com'], high: ['student03@example.com'], manual: [], revoked: {}},
];
const question = (title, i) => ({tag: ['기초 문법', '자료형', '제어문', '함수', '자료구조'][i % 5], prompt: `${title} 문항 ${i + 1}`, options: ['보기 A', '보기 B', '보기 C', '보기 D'], answer: i % 4, points: 10, explanation: `정답은 보기 ${'ABCD'[i % 4]}입니다.`});
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);

const out = ["DELETE FROM certificates WHERE id LIKE '5eed%';", "DELETE FROM notifications WHERE id LIKE '5eed%';", "DELETE FROM assessment_results WHERE id LIKE '5eed%';", "DELETE FROM assessments WHERE id LIKE '5eed%';", "DELETE FROM courses WHERE id LIKE '5eed%';"];
let rn = 0, cn = 0;
for (const c of courses) {
 const cid = id('c', c.n);
 out.push(`INSERT INTO courses(id,owner_id,title,description,start_date,end_date,status,student_ids,created_at) SELECT ${q(cid)},${uid(c.owner)},${q(c.title)},${q(c.desc)},'${c.start}','${c.end}','ended',(SELECT json_group_array(id) FROM app_users WHERE email IN (${c.students.map(q).join(',')})),'${addDays(c.start, -14)}T01:00:00.000Z';`);
 const scores = {};
 c.exams.forEach(([title, kind, week], k) => {
  const aid = id('a', c.n * 100 + k), qs = Array.from({length: 10}, (_, i) => question(title, i));
  const opens = addDays(c.start, (week - 1) * 7 + 3);
  out.push(`INSERT INTO assessments(id,course_id,title,kind,week,duration,opens_at,closes_at,questions,created_at,published) VALUES(${q(aid)},${q(cid)},${q(title)},'${kind}',${week},${kind === 'quiz' ? 15 : 40},'${opens}T00:00:00.000Z','${addDays(opens, 4)}T14:59:00.000Z',${q(JSON.stringify(qs))},'${addDays(opens, -7)}T00:00:00.000Z',1);`);
  c.students.forEach(e => {
   if ((c.skip[e] || []).includes(k)) return;
   const base = c.low.includes(e) ? 0.45 : c.high.includes(e) ? 0.93 : 0.66 + rnd() * 0.22;
   const right = Math.max(1, Math.min(10, Math.round((base + (rnd() - 0.5) * 0.2) * 10)));
   const answers = qs.map((x, i) => i < right ? x.answer : (x.answer + 1) % 4);
   (scores[e] ||= []).push(right * 10);
   out.push(`INSERT INTO assessment_results(id,assessment_id,student_id,questions,answers,score,total,submitted_at,duration_seconds,origin,grading,grading_status,confirmed_at) SELECT ${q(id('r', ++rn))},${q(aid)},id,${q(JSON.stringify(qs))},${q(JSON.stringify(answers))},${right * 10},100,'${addDays(opens, 1 + Math.floor(rnd() * 3))}T1${Math.floor(rnd() * 9)}:20:00.000Z',${600 + Math.floor(rnd() * 1500)},'generated','[]','confirmed','${addDays(opens, 5)}T03:00:00.000Z' FROM app_users WHERE email=${q(e)};`);
  });
 });
 for (const e of c.students) {
  const s = scores[e] || [], avg = s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length * 10) / 10 : 0;
  const tookAll = s.length === c.exams.length, eligible = tookAll && avg >= 60, manual = c.manual.includes(e);
  if (!eligible && !manual) continue;
  const no = `GCL-${c.end.slice(0, 4)}-${chunk()}-${chunk()}`, rev = c.revoked[e];
  const issued = manual ? `${addDays(c.end, 4)}T05:10:00.000Z` : `${addDays(c.end, 1)}T00:00:00.000Z`;
  out.push(`INSERT INTO certificates(id,cert_no,course_id,student_id,student_name,course_title,average,grade,completed_on,method,issued_at,issued_by,revoked_at,revoked_by,revoke_reason) VALUES(${q(id('d', ++cn))},'${no}',${q(cid)},${uid(e)},${uname(e)},${q(c.title)},${avg},'${grade(avg)}','${c.end}','${manual ? 'manual' : 'auto'}','${issued}',${manual ? uid(c.owner) : 'NULL'},${rev ? `'${addDays(c.end, 9)}T02:00:00.000Z'` : 'NULL'},${rev ? uid(c.owner) : 'NULL'},${rev ? q(rev) : 'NULL'});`);
  out.push(`INSERT INTO notifications(id,user_id,kind,title,body,link,created_at) VALUES(${q(id('e', cn))},${uid(e)},'success',${q('수료증이 발급되었습니다: ' + c.title)},${q('수료증 번호 ' + no + '. PDF와 이미지로 내려받을 수 있습니다.')},'/learn/certificates','${issued}');`);
 }
}
fs.writeFileSync(process.argv[2] || 'certs-seed.sql', out.join('\n') + '\n');
console.log('statements', out.length, 'certificates', cn);
