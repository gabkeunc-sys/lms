// Student tools: today's learning home, wrong-answer notes and retry, practice mode (no AI),
// rubric feedback with grade appeals, achievements (badges, streak, weekly goal).
import {randomUUID} from 'node:crypto';
import {logActivity, notify} from './ops.mjs';

const UUID = /^[a-f0-9-]{36}$/;
const NOWSQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const j = v => typeof v === 'string' ? JSON.parse(v) : v;
const isText = q => q.type === 'text';
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const dayKey = d => new Date(new Date(d).getTime() + 9 * 36e5).toISOString().slice(0, 10); // KST day

// "방법 2가지 각 10점, 장단점 설명 10점" → [{label, points}], scaled to the question's points.
export function rubricCriteria(rubric, points) {
 const out = [];
 for (const seg of String(rubric || '').split(/[,，;\n]|\.\s/)) {
  const m = seg.match(/(\d+)\s*점/); if (!m) continue;
  let pts = Number(m[1]); const each = /각/.test(seg) && seg.match(/(\d+)\s*(가지|개)/);
  if (each) pts *= Number(each[1]);
  const label = seg.replace(/(각\s*)?\d+\s*점.*/, '').replace(/[:\s]+$/, '').trim();
  if (label) out.push({label, points: pts});
 }
 const sum = out.reduce((a, c) => a + c.points, 0);
 if (sum && sum !== points) { let acc = 0; out.forEach((c, i) => { c.points = i === out.length - 1 ? points - acc : Math.round(c.points * points / sum); acc += c.points; }); }
 return out;
}

async function myResults(query, sid) {
 return (await query(`SELECT r.id,r.score,r.total,r.grading_status,r.submitted_at,r.confirmed_at,r.questions,r.answers,r.grading,a.id AS assessment_id,a.title,a.week,a.kind,a.course_id,c.title AS course_title FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE r.student_id=$1 AND c.deleted_at IS NULL ORDER BY r.submitted_at`, [sid])).rows.map(r => ({...r, questions: j(r.questions), answers: j(r.answers), grading: j(r.grading)}));
}
const myCourses = async (query, sid) => (await query('SELECT c.id,c.title,c.start_date,c.end_date,c.owner_id FROM courses c WHERE c.deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) ORDER BY c.start_date', [sid])).rows;
// Per-question outcome: 1 correct, 0 wrong, fraction for graded text, null if not graded yet.
const outcome = (r, i) => { const q = r.questions[i], g = r.grading[i] || {}; if (isText(q)) return g.status === 'confirmed' ? g.score / q.points : null; return r.answers[i] === q.answer ? 1 : 0; };

function wrongItems(results, attempts) {
 const last = new Map(); for (const a of attempts) if (a.source === 'retry') last.set(a.result_id + ':' + a.question_index, a);
 const items = [];
 for (const r of results) r.questions.forEach((q, i) => {
  const o = outcome(r, i); if (o == null || o >= (isText(q) ? 0.6 : 1)) return;
  const at = last.get(r.id + ':' + i);
  items.push({result_id: r.id, index: i, course_id: r.course_id, course_title: r.course_title, title: r.title, week: r.week, submitted_at: r.submitted_at, concept: q.tag || '기타', type: q.type || 'choice', prompt: q.prompt, options: isText(q) ? null : q.options, my_answer: r.answers[i], points: q.points, score: isText(q) ? r.grading[i]?.score : 0, feedback: isText(q) ? r.grading[i]?.feedback || '' : '', retried_at: at?.created_at || null, mastered: !!at?.correct});
 });
 return items;
}

async function activityDays(query, sid) {
 const rows = (await query(`SELECT submitted_at AS at FROM assessment_results WHERE student_id=$1 UNION ALL SELECT created_at FROM practice_attempts WHERE student_id=$1 UNION ALL SELECT created_at FROM activity_log WHERE actor_id=$1 AND action='auth.login'`, [sid])).rows;
 const days = new Map(); for (const r of rows) { const k = dayKey(r.at); days.set(k, (days.get(k) || 0) + 1); }
 return days;
}
function streakOf(days) {
 let cur = 0, best = 0, run = 0; const today = dayKey(Date.now());
 const sorted = [...days.keys()].sort(); let prev = null;
 for (const k of sorted) { run = prev && (Date.parse(k) - Date.parse(prev)) === 864e5 ? run + 1 : 1; best = Math.max(best, run); prev = k; }
 for (let d = new Date(today); ; d = new Date(d.getTime() - 864e5)) { const k = d.toISOString().slice(0, 10); if (days.has(k)) cur++; else if (k === today) continue; else break; }
 return {current: cur, best};
}
const weekStart = () => { const n = new Date(Date.now() + 9 * 36e5); const d = (n.getUTCDay() + 6) % 7; return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - d) - 9 * 36e5).toISOString(); };

async function achievements(query, sid) {
 const results = await myResults(query, sid);
 const attempts = (await query('SELECT * FROM practice_attempts WHERE student_id=$1 ORDER BY created_at', [sid])).rows;
 const days = await activityDays(query, sid), streak = streakOf(days);
 const goal = Number((await query('SELECT weekly_target FROM student_goals WHERE student_id=$1', [sid])).rows[0]?.weekly_target || 10);
 const ws = weekStart(), weekDone = attempts.filter(a => a.created_at >= ws).length + results.filter(r => r.submitted_at >= ws).reduce((a, r) => a + r.questions.length, 0);
 // Module completion and benchmark reached, per course week.
 const mods = (await query(`SELECT m.course_id,m.week,m.title,m.benchmark FROM course_modules m JOIN courses c ON c.id=m.course_id WHERE c.deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1)`, [sid])).rows;
 const published = (await query(`SELECT a.id,a.course_id,a.week FROM assessments a JOIN courses c ON c.id=a.course_id WHERE a.published=1 AND c.deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1)`, [sid])).rows;
 let modulesDone = 0, benchReached = 0; const moduleList = [];
 for (const m of mods) {
  const ex = published.filter(a => a.course_id === m.course_id && a.week === m.week); if (!ex.length) continue;
  const rs = ex.map(a => results.find(r => r.assessment_id === a.id && r.grading_status === 'confirmed'));
  if (rs.every(Boolean)) { modulesDone++; const p = rs.reduce((s, r) => s + r.score * 100 / r.total, 0) / rs.length; const reached = m.benchmark != null && p >= m.benchmark; if (reached) benchReached++; moduleList.push({course_id: m.course_id, week: m.week, title: m.title, percent: r1(p), benchmark: m.benchmark, reached, at: rs.map(r => r.confirmed_at || r.submitted_at).sort().pop()}); }
 }
 const perfect = results.filter(r => r.grading_status === 'confirmed' && r.score === r.total);
 const retryOk = attempts.filter(a => a.source === 'retry' && a.correct).length, practiced = attempts.filter(a => a.source === 'practice').length;
 const first = results[0]?.submitted_at;
 const B = (id, icon, name, desc, earned, progress, target, at) => ({id, icon, name, desc, earned: !!earned, progress: Math.min(progress, target), target, at: earned ? at || null : null});
 const badges = [
  B('first', 'flag', '첫걸음', '첫 평가를 제출했어요', first, results.length ? 1 : 0, 1, first),
  B('module1', 'cube', '모듈 완주', '주차 모듈의 평가를 모두 끝냈어요', modulesDone >= 1, modulesDone, 1, moduleList[0]?.at),
  B('module5', 'stack', '꾸준한 완주자', '모듈 5개를 완료했어요', modulesDone >= 5, modulesDone, 5),
  B('bench1', 'target', '현업 기준 도달', '한 모듈에서 3년차 기준 점수를 넘었어요', benchReached >= 1, benchReached, 1, moduleList.find(m => m.reached)?.at),
  B('bench3', 'trophy', '현업 수준 3관왕', '3개 모듈에서 3년차 기준을 넘었어요', benchReached >= 3, benchReached, 3),
  B('perfect', 'star', '만점', '평가에서 만점을 받았어요', perfect.length, perfect.length ? 1 : 0, 1, perfect[0]?.submitted_at),
  B('streak3', 'flame', '3일 연속', '3일 연속 학습했어요', streak.best >= 3, streak.best, 3),
  B('streak7', 'fire', '일주일 연속', '7일 연속 학습했어요', streak.best >= 7, streak.best, 7),
  B('retry10', 'refresh', '오답 정복', '오답 다시 풀기에서 10문항을 맞혔어요', retryOk >= 10, retryOk, 10),
  B('practice30', 'dumbbell', '연습벌레', '연습 문제를 30문항 풀었어요', practiced >= 30, practiced, 30),
  B('goal', 'check', '주간 목표 달성', '이번 주 목표를 채웠어요', weekDone >= goal, weekDone, goal),
 ];
 const heat = []; for (let i = 83; i >= 0; i--) { const k = dayKey(Date.now() - i * 864e5); heat.push({day: k, n: days.get(k) || 0}); }
 return {badges, streak, goal: {target: goal, done: weekDone, week_start: ws}, heat, modules: moduleList, counts: {results: results.length, practiced, retry_ok: retryOk, modules: modulesDone, bench: benchReached}};
}

export async function learnAPI({path, method, body, session, query, response, fail, url}) {
 if (!session) return fail('로그인이 필요합니다.', 401);
 let m;
 // ---- instructor side of appeals ----
 if (path.startsWith('/instructor/appeals')) {
  if (!['instructor', 'admin'].includes(session.role)) return fail('강사만 접근할 수 있습니다.', 403);
  const own = session.role === 'admin' ? '1=1' : 'c.owner_id=$1', params = session.role === 'admin' ? [] : [session.id];
  if (path === '/instructor/appeals' && method === 'GET') {
   const rows = (await query(`SELECT g.*,u.name AS student_name,a.title,a.week,c.title AS course_title,r.questions,r.answers,r.grading FROM grade_appeals g JOIN assessment_results r ON r.id=g.result_id JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id JOIN app_users u ON u.id=g.student_id WHERE ${own} ORDER BY g.status='open' DESC,g.created_at DESC`, params)).rows;
   return response({appeals: rows.map(x => { const q = j(x.questions)[x.question_index], g = j(x.grading)[x.question_index] || {}; return {id: x.id, status: x.status, reason: x.reason, response: x.response, created_at: x.created_at, resolved_at: x.resolved_at, student_name: x.student_name, title: x.title, week: x.week, course_title: x.course_title, question: {prompt: q?.prompt, points: q?.points, rubric: q?.rubric, tag: q?.tag}, answer: j(x.answers)[x.question_index], score: g.score, feedback: g.feedback}; })});
  }
  if ((m = path.match(/^\/instructor\/appeals\/([a-f0-9-]{36})$/)) && method === 'POST') {
   const ap = (await query(`SELECT g.*,c.owner_id,a.title FROM grade_appeals g JOIN assessment_results r ON r.id=g.result_id JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE g.id=$1`, [m[1]])).rows[0];
   if (!ap || (ap.owner_id !== session.id && session.role !== 'admin')) return fail('이의 신청을 찾을 수 없습니다.', 404);
   if (ap.status !== 'open') return fail('이미 처리한 이의 신청입니다.', 409);
   const status = body.status === 'accepted' ? 'accepted' : 'rejected', text = String(body.response || '').slice(0, 2000);
   if (status === 'accepted' && Number.isInteger(body.score)) {
    const r = (await query('SELECT * FROM assessment_results WHERE id=$1', [ap.result_id])).rows[0];
    const qs = j(r.questions), grading = [...j(r.grading)], q = qs[ap.question_index];
    if (!q || body.score < 0 || body.score > q.points) return fail('점수를 확인하세요.');
    const prev = grading[ap.question_index]?.score || 0; grading[ap.question_index] = {...grading[ap.question_index], score: body.score, status: 'confirmed', appeal: ap.id};
    await query('UPDATE assessment_results SET grading=$1,score=$2,revision=revision+1 WHERE id=$3', [JSON.stringify(grading), r.score - prev + body.score, r.id]);
    await logActivity(query, session.id, 'grade.appeal', r.id, {from: prev, to: body.score});
   }
   await query(`UPDATE grade_appeals SET status=$1,response=$2,resolved_at=${NOWSQL},resolved_by=$3 WHERE id=$4`, [status, text, session.id, ap.id]);
   await notify(query, ap.student_id, `이의 신청 ${status === 'accepted' ? '반영' : '답변'}: ${ap.title}`, text || (status === 'accepted' ? '점수를 다시 확인해 반영했습니다.' : '채점 기준에 따라 기존 점수를 유지합니다.'), '/learn/feedback', 'appeal');
   return response({ok: true});
  }
  return fail('요청한 기능을 찾을 수 없습니다.', 404);
 }

 if (session.role !== 'student') return fail('학생 계정으로 이용하세요.', 403);
 const sid = session.id;

 if (path === '/student/today' && method === 'GET') {
  const courses = await myCourses(query, sid);
  const exams = (await query(`SELECT a.id,a.title,a.kind,a.week,a.duration,a.opens_at,a.closes_at,c.title AS course_title,(SELECT 1 FROM assessment_results r WHERE r.assessment_id=a.id AND r.student_id=$1) AS done FROM assessments a JOIN courses c ON c.id=a.course_id WHERE a.published=1 AND c.deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) AND (a.closes_at IS NULL OR a.closes_at>${NOWSQL}) AND (a.opens_at IS NULL OR a.opens_at<strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days')) ORDER BY coalesce(a.closes_at,a.opens_at)`, [sid])).rows.filter(x => !x.done);
  const results = await myResults(query, sid);
  const attempts = (await query('SELECT * FROM practice_attempts WHERE student_id=$1', [sid])).rows;
  const guidance = (await query(`SELECT g.course_id,g.content,g.updated_at,c.title AS course_title FROM learning_guidance g JOIN courses c ON c.id=g.course_id WHERE g.student_id=$1 AND g.published=1`, [sid])).rows;
  const tasks = guidance.flatMap(g => { const plan = g.content.split(/■/).find(s => /계획|할 일/.test(s.split('\n')[0])) || ''; return plan.split('\n').filter(l => /^\s*\d+[.)]/.test(l)).slice(0, 2).map(l => ({course_title: g.course_title, text: l.replace(/^\s*\d+[.)]\s*/, '').trim()})); });
  const bench = (await query('SELECT course_id,week,benchmark FROM course_modules WHERE benchmark IS NOT NULL')).rows;
  const distance = courses.map(c => {
   const conf = results.filter(r => r.course_id === c.id && r.grading_status === 'confirmed');
   const weeks = [...new Set(conf.map(r => r.week))], bw = bench.filter(b => b.course_id === c.id && weeks.includes(b.week));
   const mine = conf.length ? conf.reduce((a, r) => a + r.score * 100 / r.total, 0) / conf.length : null, target = bw.length ? bw.reduce((a, b) => a + b.benchmark, 0) / bw.length : null;
   const next = bench.filter(b => b.course_id === c.id && !weeks.includes(b.week)).sort((a, b) => a.week - b.week)[0];
   return {course_id: c.id, course_title: c.title, mine: r1(mine), benchmark: r1(target), gap: mine != null && target != null ? r1(target - mine) : null, next_week: next?.week || null, next_benchmark: next?.benchmark ?? null};
  });
  const wrong = wrongItems(results, attempts).filter(w => !w.mastered);
  const ach = await achievements(query, sid);
  const fresh = results.filter(r => r.confirmed_at && Date.now() - Date.parse(r.confirmed_at) < 7 * 864e5 && r.questions.some(isText)).map(r => ({result_id: r.id, title: r.title, course_title: r.course_title, percent: r1(r.score * 100 / r.total)}));
  const weak = conceptRates(results).filter(c => c.rate < 70).slice(0, 3);
  return response({exams, tasks: tasks.slice(0, 5), distance, wrong_count: wrong.length, wrong_concepts: [...new Set(wrong.map(w => w.concept))].slice(0, 4), weak, streak: ach.streak, goal: ach.goal, badges: ach.badges.filter(b => b.earned).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 4), next_badge: ach.badges.filter(b => !b.earned).sort((a, b) => b.progress / b.target - a.progress / a.target)[0] || null, fresh_feedback: fresh});
 }

 if (path === '/student/wrong-notes' && method === 'GET') {
  const results = await myResults(query, sid);
  const attempts = (await query('SELECT * FROM practice_attempts WHERE student_id=$1 ORDER BY created_at', [sid])).rows;
  return response({items: wrongItems(results, attempts).reverse()});
 }
 if (path === '/student/retry' && method === 'POST') {
  if (!UUID.test(body.result_id || '') || !Number.isInteger(body.index)) return fail('문항을 확인하세요.');
  const r = (await query('SELECT questions FROM assessment_results WHERE id=$1 AND student_id=$2', [body.result_id, sid])).rows[0];
  const q = r && j(r.questions)[body.index]; if (!q) return fail('문항을 찾을 수 없습니다.', 404);
  if (isText(q)) return response({type: 'text', model_answer: q.model_answer, rubric: q.rubric, explanation: q.explanation || ''});
  if (!Number.isInteger(body.answer) || body.answer < 0 || body.answer > 3) return fail('보기를 선택하세요.');
  const correct = body.answer === q.answer;
  await query('INSERT INTO practice_attempts(id,student_id,source,result_id,question_index,concept,correct) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), sid, 'retry', body.result_id, body.index, q.tag || '', correct ? 1 : 0]);
  return response({correct, answer: q.answer, explanation: q.explanation || ''});
 }

 if (path === '/student/practice' && method === 'GET') {
  const results = await myResults(query, sid), rates = conceptRates(results);
  const courses = await myCourses(query, sid), ids = courses.map(c => c.id), owners = [...new Set(courses.map(c => c.owner_id))];
  if (!ids.length) return response({concepts: rates, questions: []});
  const ph = ids.map((_, i) => '$' + (i + 1)).join(','), oh = owners.map((_, i) => '$' + (ids.length + i + 1)).join(',');
  const bank = (await query(`SELECT id,concept,difficulty,question,course_id FROM question_bank WHERE deleted_at IS NULL AND status<>'draft' AND (course_id IN (${ph}) OR (course_id IS NULL AND owner_id IN (${oh})))`, [...ids, ...owners])).rows.map(b => ({...b, question: j(b.question)})).filter(b => !isText(b.question) && b.question.options?.every(o => String(o).trim()));
  const want = String(url?.searchParams.get('concept') || '').trim() || null;
  const weak = rates.filter(c => c.rate < 80).map(c => c.concept);
  const pool = want ? bank.filter(b => b.concept === want) : bank;
  const score = b => (weak.includes(b.concept) ? 0 : 1) + Math.random();
  // Round-robin over enrolled courses (weak concepts first inside each), at most 2 questions per concept.
  const groups = [...pool.sort((a, b2) => score(a) - score(b2)).reduce((m, b) => { const k = b.course_id || 'common'; (m.get(k) || m.set(k, []).get(k)).push(b); return m; }, new Map()).values()].sort(() => Math.random() - 0.5);
  const seen = new Set(), perConcept = new Map(), picked = [], cap = want ? 5 : 2;
  while (picked.length < 5 && groups.some(g => g.length)) for (const g of groups) {
   while (g.length) { const b = g.shift(), k = b.question.prompt, c = b.concept || '기타'; if (seen.has(k) || (perConcept.get(c) || 0) >= cap) continue; seen.add(k); perConcept.set(c, (perConcept.get(c) || 0) + 1); picked.push(b); break; }
   if (picked.length >= 5) break;
  }
  const today = (await query(`SELECT count(*) AS n, sum(correct) AS ok FROM practice_attempts WHERE student_id=$1 AND source='practice' AND created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')`, [sid])).rows[0];
  return response({concepts: rates, weak, questions: picked.map(b => ({id: b.id, course_title: courses.find(c => c.id === b.course_id)?.title || '', concept: b.concept, difficulty: b.difficulty, prompt: b.question.prompt, options: b.question.options})), week: {n: Number(today.n || 0), ok: Number(today.ok || 0)}});
 }
 if (path === '/student/practice/check' && method === 'POST') {
  if (typeof body.bank_id !== 'string' || body.bank_id.length > 90) return fail('문항을 확인하세요.');
  const b = (await query('SELECT question,concept FROM question_bank WHERE id=$1 AND deleted_at IS NULL', [body.bank_id])).rows[0];
  if (!b) return fail('문항을 찾을 수 없습니다.', 404);
  const q = j(b.question); if (!Number.isInteger(body.answer)) return fail('보기를 선택하세요.');
  const correct = body.answer === q.answer;
  await query('INSERT INTO practice_attempts(id,student_id,source,bank_id,concept,correct) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), sid, 'practice', body.bank_id, b.concept, correct ? 1 : 0]);
  return response({correct, answer: q.answer, explanation: q.explanation || ''});
 }

 if (path === '/student/feedback' && method === 'GET') {
  const results = await myResults(query, sid);
  const appeals = (await query('SELECT * FROM grade_appeals WHERE student_id=$1 ORDER BY created_at DESC', [sid])).rows;
  const items = [];
  for (const r of results) r.questions.forEach((q, i) => {
   if (!isText(q)) return; const g = r.grading[i] || {};
   const crit = rubricCriteria(q.rubric, q.points);
   let criteria = Array.isArray(g.criteria) ? g.criteria : null, estimated = false;
   if (!criteria && g.status === 'confirmed' && crit.length) { estimated = true; const ratio = g.score / q.points; let acc = 0; criteria = crit.map((c, k) => { const s = k === crit.length - 1 ? g.score - acc : Math.round(c.points * ratio); acc += s; return {...c, score: Math.max(0, Math.min(c.points, s))}; }); }
   items.push({result_id: r.id, index: i, title: r.title, week: r.week, course_title: r.course_title, submitted_at: r.submitted_at, confirmed: r.grading_status === 'confirmed' && g.status === 'confirmed', concept: q.tag || '', prompt: q.prompt, answer: r.answers[i], points: q.points, score: g.status === 'confirmed' ? g.score : null, feedback: g.status === 'confirmed' ? g.feedback || '' : '', ai_assisted: !!g.provider, reviewed: !!g.reviewed_by, rubric: q.rubric, model_answer: r.grading_status === 'confirmed' ? q.model_answer : null, criteria: g.status === 'confirmed' ? criteria : null, estimated, appeals: appeals.filter(a => a.result_id === r.id && a.question_index === i).map(a => ({id: a.id, status: a.status, reason: a.reason, response: a.response, created_at: a.created_at, resolved_at: a.resolved_at}))});
  });
  return response({items: items.reverse()});
 }
 if (path === '/student/appeals' && method === 'POST') {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length > 2000) return fail('이의 신청 사유를 입력하세요.');
  const r = (await query(`SELECT r.id,r.questions,r.grading_status,a.title,c.owner_id,u.name FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id JOIN app_users u ON u.id=r.student_id WHERE r.id=$1 AND r.student_id=$2`, [body.result_id, sid])).rows[0];
  if (!r || r.grading_status !== 'confirmed' || !j(r.questions)[body.index]) return fail('확정된 성적에만 이의 신청할 수 있습니다.');
  try { await query('INSERT INTO grade_appeals(id,result_id,student_id,question_index,reason) VALUES($1,$2,$3,$4,$5)', [randomUUID(), r.id, sid, body.index, reason]); }
  catch (e) { if (e.code === '23505' || /UNIQUE/i.test(e.message)) return fail('이미 검토 중인 이의 신청이 있습니다.', 409); throw e; }
  await notify(query, r.owner_id, `이의 신청: ${r.name} · ${r.title}`, reason.slice(0, 200), '/teach/appeals', 'appeal');
  return response({ok: true});
 }

 if (path === '/student/achievements' && method === 'GET') return response(await achievements(query, sid));
 if (path === '/student/goal' && method === 'POST') {
  const t = Number(body.target); if (!Number.isInteger(t) || t < 1 || t > 50) return fail('주간 목표는 1~50 사이로 정하세요.');
  await query('INSERT INTO student_goals(student_id,weekly_target) VALUES($1,$2) ON CONFLICT(student_id) DO UPDATE SET weekly_target=$2', [sid, t]);
  return response({ok: true});
 }
 return fail('요청한 기능을 찾을 수 없습니다.', 404);
}

function conceptRates(results) {
 const m = new Map();
 for (const r of results) r.questions.forEach((q, i) => { const o = outcome(r, i); if (o == null) return; const k = q.tag || '기타'; const c = m.get(k) || {concept: k, sum: 0, n: 0, course_title: r.course_title}; c.sum += o; c.n++; m.set(k, c); });
 return [...m.values()].map(c => ({concept: c.concept, course_title: c.course_title, rate: r1(c.sum * 100 / c.n), n: c.n})).sort((a, b) => a.rate - b.rate);
}
