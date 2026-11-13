// Sample data for student tools: practice/retry history (streaks), grade appeals, weekly goals.
// Usage: node scripts/seed-learn.cjs /tmp/learn-seed.sql && npx wrangler d1 execute lms --remote --file /tmp/learn-seed.sql
const fs = require('fs');
let seed = 77; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const uid = e => `(SELECT id FROM app_users WHERE email=${q(e)})`;
const out = ["DELETE FROM practice_attempts WHERE id LIKE 'seed-%';", "DELETE FROM grade_appeals WHERE id LIKE 'seed-%';", "DELETE FROM student_goals WHERE student_id IN (SELECT id FROM app_users WHERE email LIKE 'learner%@example.com' OR email LIKE 'student%@example.com');"];
const students = Array.from({length: 12}, (_, i) => `learner${String(i + 1).padStart(2, '0')}@example.com`).concat(['student01', 'student02', 'student03', 'student04', 'student05'].map(s => s + '@example.com'));
let n = 0;
for (const s of students) {
 const active = s === 'learner03@example.com' ? 0.95 : 0.25 + rnd() * 0.5;
 out.push(`INSERT OR REPLACE INTO student_goals(student_id,weekly_target) SELECT id,${[10, 15, 20][Math.floor(rnd() * 3)]} FROM app_users WHERE email=${q(s)};`);
 for (let d = 60; d >= 0; d--) {
  // learner03 keeps a streak for the last 9 days (today included).
  const on = s === 'learner03@example.com' ? (d <= 8 || rnd() < 0.55) : rnd() < active;
  if (!on) continue;
  const k = 2 + Math.floor(rnd() * 5);
  // Pick random bank questions from the student's courses; correctness ~65%.
  out.push(`INSERT INTO practice_attempts(id,student_id,source,bank_id,concept,correct,created_at) SELECT 'seed-pa-${++n}-'||b.id, u.id, 'practice', b.id, b.concept, CASE WHEN abs(random())%100<65 THEN 1 ELSE 0 END, strftime('%Y-%m-%dT%H:%M:%fZ','now','-${d} days','-${Math.floor(rnd() * 8)} hours') FROM app_users u JOIN courses c ON EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=u.id) JOIN question_bank b ON b.course_id=c.id AND json_extract(b.question,'$.type') IS NOT 'text' WHERE u.email=${q(s)} ORDER BY random() LIMIT ${k};`);
 }
}
// A few retries of wrong answers for learner03 (some mastered).
out.push(`INSERT INTO practice_attempts(id,student_id,source,result_id,question_index,concept,correct,created_at)
SELECT 'seed-rt-'||r.id||'-'||jq.key, r.student_id, 'retry', r.id, jq.key, coalesce(json_extract(jq.value,'$.tag'),''), 1, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')
FROM assessment_results r, json_each(r.questions) jq WHERE r.student_id=${uid('learner03@example.com')} AND json_extract(jq.value,'$.type') IS NOT 'text'
 AND json_extract(r.answers,'$['||jq.key||']') IS NOT json_extract(jq.value,'$.answer') AND abs(random())%2=0;`);
// Grade appeals on text answers (one open, one accepted).
const appeal = (id, email, status, reason, response, d) => out.push(`INSERT INTO grade_appeals(id,result_id,student_id,question_index,reason,status,response,created_at,resolved_at)
SELECT ${q(id)}, r.id, r.student_id, jq.key, ${q(reason)}, '${status}', ${q(response)}, strftime('%Y-%m-%dT%H:%M:%fZ','now','-${d} days'), ${status === 'open' ? 'NULL' : `strftime('%Y-%m-%dT%H:%M:%fZ','now','-${d - 1} days')`}
FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id, json_each(r.questions) jq WHERE r.student_id=${uid(email)} AND r.grading_status='confirmed' AND json_extract(jq.value,'$.type')='text' ORDER BY r.submitted_at ${status === 'open' ? 'DESC' : 'ASC'} LIMIT 1;`);
appeal('seed-ap-1', 'learner03@example.com', 'open', '채점 기준의 "장단점 설명"을 두 방법 모두 썼는데 감점된 이유를 알고 싶습니다. 대체 방법의 단점(분포 왜곡)도 적었습니다.', '', 1);
appeal('seed-ap-2', 'learner05@example.com', 'open', '모범 답안과 표현은 다르지만 같은 의미라고 생각합니다. 다시 확인 부탁드립니다.', '', 2);
appeal('seed-ap-3', 'learner01@example.com', 'rejected', '부분 점수가 너무 낮은 것 같습니다.', '두 번째 방법의 장단점이 빠져 있어 기준대로 채점했습니다. 다음에는 방법마다 장점과 단점을 짝지어 써 보세요.', 6);
fs.writeFileSync(process.argv[2] || 'learn-seed.sql', out.join('\n') + '\n');
