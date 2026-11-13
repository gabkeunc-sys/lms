// Instructor tools: today's to-do home, bulk grading, question bank, item analysis,
// student detail with notes, at-risk students and course operations (schedule drag, duplicate).
import {randomUUID} from 'node:crypto';
import {generateQuestion} from './ai.mjs';
import {computeRisk, logActivity, meteredAI} from './ops.mjs';

const UUID = /^[a-f0-9-]{36}$/;
const NOWSQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const j = v => typeof v === 'string' ? JSON.parse(v) : v;
const isText = q => q.type === 'text';
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const DIFF = ['easy', 'medium', 'hard'];

async function ownCourse(query, session, id) {
 if (!UUID.test(id || '')) return null;
 const c = (await query('SELECT * FROM courses WHERE id=$1 AND deleted_at IS NULL', [id])).rows[0];
 if (!c || (c.owner_id !== session.id && session.role !== 'admin')) return null;
 c.student_ids = j(c.student_ids);
 return c;
}
async function ownAssessment(query, session, id) {
 if (!UUID.test(id || '')) return null;
 const a = (await query('SELECT a.*,c.owner_id,c.title AS course_title FROM assessments a JOIN courses c ON c.id=a.course_id WHERE a.id=$1 AND c.deleted_at IS NULL', [id])).rows[0];
 if (!a || (a.owner_id !== session.id && session.role !== 'admin')) return null;
 a.questions = j(a.questions);
 return a;
}
const scope = session => session.role === 'admin' ? ['1=1', []] : ['c.owner_id=$1', [session.id]];

export async function teachAPI({path, method, body, session, query, response, fail, url}) {
 if (!session) return fail('로그인이 필요합니다.', 401);
 if (!['instructor', 'admin'].includes(session.role)) return fail('강사만 접근할 수 있습니다.', 403);
 let m;

 // ---------- 오늘 할 일 ----------
 if (path === '/instructor/today' && method === 'GET') {
  const [where, params] = scope(session);
  const results = (await query(`SELECT r.id,r.grading_status,r.submitted_at,r.grading,a.id AS assessment_id,a.title,a.week,c.title AS course_title,u.name AS student_name FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id JOIN app_users u ON u.id=r.student_id WHERE c.deleted_at IS NULL AND r.grading_status<>'confirmed' AND ${where} ORDER BY r.submitted_at`, params)).rows;
  const pending = results.filter(r => r.grading_status === 'pending'), review = results.filter(r => r.grading_status === 'review');
  const byExam = list => [...list.reduce((m, r) => { const k = r.assessment_id; if (!m.has(k)) m.set(k, {assessment_id: k, title: r.title, week: r.week, course_title: r.course_title, count: 0, oldest: r.submitted_at}); m.get(k).count++; return m; }, new Map()).values()];
  const proposals = review.reduce((n, r) => n + j(r.grading).filter(g => g?.status === 'proposed').length, 0);
  const learners = (await query(`SELECT DISTINCT c.id AS course_id,c.title AS course_title,u.id AS student_id,u.name AS student_name,g.published,g.updated_at FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id JOIN app_users u ON u.id=r.student_id LEFT JOIN learning_guidance g ON g.course_id=c.id AND g.student_id=u.id WHERE c.deleted_at IS NULL AND r.grading_status='confirmed' AND ${where}`, params)).rows;
  const missing = learners.filter(l => !l.published);
  const risk = await computeRisk(query, session.role === 'admin' ? null : session.id);
  const exams = (await query(`SELECT a.id,a.title,a.kind,a.week,a.opens_at,a.closes_at,a.published,c.title AS course_title,(SELECT count(*) FROM assessment_results r WHERE r.assessment_id=a.id) AS taken,json_array_length(c.student_ids) AS enrolled FROM assessments a JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL AND ${where} AND ((a.opens_at BETWEEN strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days') AND strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days')) OR (a.closes_at BETWEEN ${NOWSQL} AND strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days'))) ORDER BY a.opens_at`, params)).rows;
  const notes = (await query("SELECT id,title,body,link,kind,created_at,read_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5", [session.id])).rows;
  return response({pending: byExam(pending), pending_count: pending.length, review: byExam(review), review_count: review.length, proposals, oldest_pending: pending[0]?.submitted_at || null, guidance_missing: missing.slice(0, 8), guidance_missing_count: missing.length, guidance_total: learners.length, risk: risk.students.filter(x => x.level !== 'low').slice(0, 6), risk_summary: risk.summary, exams, notifications: notes});
 }

 // ---------- 일괄 채점 ----------
 if (path === '/instructor/grading' && method === 'GET') {
  const [where, params] = scope(session);
  const list = (await query(`SELECT a.id,a.title,a.week,a.kind,c.title AS course_title,a.questions,sum(CASE WHEN r.grading_status<>'confirmed' THEN 1 ELSE 0 END) AS open,count(r.id) AS submitted FROM assessments a JOIN courses c ON c.id=a.course_id JOIN assessment_results r ON r.assessment_id=a.id WHERE c.deleted_at IS NULL AND ${where} GROUP BY a.id ORDER BY open DESC,a.week`, params)).rows;
  return response({assessments: list.filter(a => j(a.questions).some(isText)).map(a => ({id: a.id, title: a.title, week: a.week, kind: a.kind, course_title: a.course_title, open: a.open, submitted: a.submitted, text_questions: j(a.questions).filter(isText).length}))});
 }
 if ((m = path.match(/^\/instructor\/grading\/([a-f0-9-]{36})$/)) && method === 'GET') {
  const a = await ownAssessment(query, session, m[1]);
  if (!a) return fail('시험을 찾을 수 없습니다.', 404);
  const rows = (await query('SELECT r.id,r.revision,r.grading_status,r.answers,r.grading,r.questions,r.submitted_at,u.name AS student_name FROM assessment_results r JOIN app_users u ON u.id=r.student_id WHERE r.assessment_id=$1 ORDER BY u.name', [a.id])).rows;
  const questions = a.questions.map((q, i) => ({index: i, ...q})).filter(isText);
  return response({assessment: {id: a.id, title: a.title, week: a.week, course_title: a.course_title}, questions, answers: rows.map(r => ({id: r.id, revision: r.revision, status: r.grading_status, student_name: r.student_name, submitted_at: r.submitted_at, answers: j(r.answers), grading: j(r.grading)}))});
 }
 if (path === '/instructor/grading/bulk' && method === 'POST') {
  const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
  if (!items.length) return fail('채점할 답안을 선택하세요.');
  const byResult = new Map();
  for (const it of items) { if (!UUID.test(it.result_id || '') || !Number.isInteger(it.index)) return fail('채점 항목을 확인하세요.'); if (!byResult.has(it.result_id)) byResult.set(it.result_id, []); byResult.get(it.result_id).push(it); }
  let saved = 0, finalized = 0, conflicts = 0;
  for (const [id, list] of byResult) {
   const r = (await query('SELECT r.*,c.owner_id FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE r.id=$1', [id])).rows[0];
   if (!r || (r.owner_id !== session.id && session.role !== 'admin')) { conflicts++; continue; }
   const qs = j(r.questions), answers = j(r.answers), grading = [...j(r.grading)];
   if (r.grading_status === 'confirmed' || list.some(it => it.revision !== r.revision)) { conflicts++; continue; }
   let aiUsed = 0, aiChanged = 0, bad = false;
   for (const it of list) {
    const q = qs[it.index], prev = grading[it.index] || {};
    if (!q || !isText(q)) { bad = true; break; }
    const score = it.accept_ai ? prev.score : it.score, feedback = it.accept_ai ? prev.feedback : (it.feedback ?? prev.feedback ?? '');
    if (!Number.isInteger(score) || score < 0 || score > q.points || typeof feedback !== 'string' || feedback.length > 8000) { bad = true; break; }
    if (prev.status === 'proposed') { aiUsed++; if (prev.score !== score) aiChanged++; }
    grading[it.index] = {...prev, score, feedback, status: 'confirmed', reviewed_by: session.id, reviewed_at: new Date().toISOString()};
    saved++;
   }
   if (bad) return fail('점수는 0점부터 배점까지 정수로 입력하세요.');
   const done = qs.every((q, i) => !isText(q) || grading[i]?.status === 'confirmed');
   let total = 0;
   qs.forEach((q, i) => { if (isText(q)) total += grading[i]?.status === 'confirmed' ? grading[i].score : 0; else { const p = answers[i] === q.answer ? q.points : 0; grading[i] = {score: p, status: 'confirmed'}; total += p; } });
   const status = done ? 'confirmed' : 'review';
   const ch = await query(`UPDATE assessment_results SET grading=$1,score=$2,grading_status=$3,confirmed_at=CASE WHEN $3='confirmed' THEN ${NOWSQL} ELSE confirmed_at END,revision=revision+1 WHERE id=$4 AND revision=$5 RETURNING id`, [JSON.stringify(grading), done ? total : r.score, status, id, r.revision]);
   if (!ch.rows.length) { conflicts++; continue; }
   if (done) { finalized++; await logActivity(query, session.id, 'grade.confirm', id, {score: total, ai_used: aiUsed, ai_changed: aiChanged, bulk: true}); }
  }
  return response({ok: true, saved, finalized, conflicts});
 }

 // ---------- 문항 분석 ----------
 if ((m = path.match(/^\/instructor\/analysis\/([a-f0-9-]{36})$/)) && method === 'GET') {
  const a = await ownAssessment(query, session, m[1]);
  if (!a) return fail('시험을 찾을 수 없습니다.', 404);
  const rows = (await query('SELECT r.score,r.total,r.answers,r.grading,r.grading_status,r.questions FROM assessment_results r WHERE r.assessment_id=$1', [a.id])).rows.map(r => ({...r, answers: j(r.answers), grading: j(r.grading), questions: j(r.questions)}));
  const n = rows.length, sorted = [...rows].sort((x, y) => y.score / y.total - x.score / x.total), k = Math.max(1, Math.round(n * 0.27));
  const upper = sorted.slice(0, k), lower = sorted.slice(-k);
  const qs = a.questions.map((q, i) => {
   const got = r => { const qq = r.questions[i] || q; if (isText(qq)) { const g = r.grading[i]; return g?.status === 'confirmed' ? g.score / qq.points : null; } return r.answers[i] === qq.answer ? 1 : 0; };
   const vals = rows.map(got).filter(v => v != null);
   const rate = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
   const avg = list => { const v = list.map(got).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
   const hi = avg(upper), lo = avg(lower), disc = hi != null && lo != null && n >= 4 ? hi - lo : null;
   const dist = isText(q) ? null : q.options.map((o, oi) => ({text: o, count: rows.filter(r => r.answers[i] === oi).length, correct: oi === q.answer}));
   const blank = isText(q) ? rows.filter(r => !String(r.answers[i] || '').trim()).length : rows.filter(r => r.answers[i] == null).length;
   const wrong = dist ? dist.filter(d => !d.correct).sort((x, y) => y.count - x.count)[0] : null;
   const flags = [];
   if (rate != null && rate < 0.4) flags.push('어려움');
   if (rate != null && rate > 0.9) flags.push('너무 쉬움');
   if (disc != null && disc < 0.2) flags.push('변별도 낮음');
   if (disc != null && disc < 0) flags.push('문항 검토 필요');
   if (wrong && n && wrong.count / n >= 0.3) flags.push('매력적인 오답');
   return {index: i, type: q.type || 'choice', tag: q.tag || '', prompt: q.prompt, points: q.points, rate: r1(rate == null ? null : rate * 100), discrimination: r1(disc), distribution: dist, blank, graded: vals.length, top_wrong: wrong && wrong.count ? wrong : null, flags};
  });
  const concepts = [...qs.reduce((m, q) => { if (q.rate == null) return m; const t = q.tag || '기타'; const c = m.get(t) || {tag: t, sum: 0, n: 0}; c.sum += q.rate; c.n++; m.set(t, c); return m; }, new Map()).values()].map(c => ({tag: c.tag, rate: r1(c.sum / c.n)})).sort((x, y) => x.rate - y.rate);
  return response({assessment: {id: a.id, title: a.title, week: a.week, course_title: a.course_title}, respondents: n, average: n ? r1(rows.reduce((s, r) => s + r.score * 100 / r.total, 0) / n) : null, questions: qs, concepts});
 }

 // ---------- 문제 은행 ----------
 if (path === '/instructor/bank' && method === 'GET') {
  const own = session.role === 'admin' ? '1=1' : 'b.owner_id=$1';
  const rows = (await query(`SELECT b.id,b.course_id,b.concept,b.difficulty,b.question,b.source,b.used_count,b.created_at,c.title AS course_title FROM question_bank b LEFT JOIN courses c ON c.id=b.course_id WHERE b.deleted_at IS NULL AND ${own} ORDER BY b.created_at DESC`, session.role === 'admin' ? [] : [session.id])).rows;
  return response({items: rows.map(r => ({...r, question: j(r.question)}))});
 }
 if (path === '/instructor/bank' && method === 'POST') {
  const q = body.question;
  if (!q || typeof q.prompt !== 'string' || !q.prompt.trim() || !['choice', 'text'].includes(q.type || 'choice')) return fail('문항 내용을 확인하세요.');
  if (body.course_id && !(await ownCourse(query, session, body.course_id))) return fail('과정을 확인하세요.');
  const diff = DIFF.includes(body.difficulty) ? body.difficulty : 'medium', concept = String(body.concept || q.tag || '').slice(0, 80);
  const clean = {type: q.type || 'choice', prompt: q.prompt.slice(0, 8000), points: Math.min(100, Math.max(1, q.points | 0 || 10)), tag: concept, explanation: String(q.explanation || '').slice(0, 4000), ...(q.type === 'text' ? {model_answer: String(q.model_answer || ''), rubric: String(q.rubric || '')} : {options: (q.options || []).slice(0, 4).map(String), answer: q.answer | 0})};
  const id = randomUUID();
  await query('INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, session.id, body.course_id || null, concept, diff, JSON.stringify(clean), ['exam', 'ai'].includes(body.source) ? body.source : 'manual']);
  return response({id});
 }
 if (path === '/instructor/bank/import' && method === 'POST') {
  const a = await ownAssessment(query, session, body.assessment_id);
  if (!a) return fail('시험을 찾을 수 없습니다.', 404);
  const have = new Set((await query('SELECT question FROM question_bank WHERE owner_id=$1 AND deleted_at IS NULL', [session.id])).rows.map(r => j(r.question).prompt));
  let added = 0;
  for (const q of a.questions) { if (have.has(q.prompt)) continue; await query('INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), session.id, a.course_id, String(q.tag || '').slice(0, 80), 'medium', JSON.stringify(q), 'exam']); added++; }
  return response({added});
 }
 if ((m = path.match(/^\/instructor\/bank\/([a-f0-9-]{36})\/(delete|similar|update|used)$/)) && method === 'POST') {
  const b = (await query('SELECT * FROM question_bank WHERE id=$1 AND deleted_at IS NULL', [m[1]])).rows[0];
  if (!b || (b.owner_id !== session.id && session.role !== 'admin')) return fail('문항을 찾을 수 없습니다.', 404);
  if (m[2] === 'delete') { await query(`UPDATE question_bank SET deleted_at=${NOWSQL} WHERE id=$1`, [b.id]); return response({ok: true}); }
  if (m[2] === 'used') { await query('UPDATE question_bank SET used_count=used_count+1 WHERE id=$1', [b.id]); return response({ok: true}); }
  if (m[2] === 'update') {
   await query('UPDATE question_bank SET concept=$1,difficulty=$2 WHERE id=$3', [String(body.concept ?? b.concept).slice(0, 80), DIFF.includes(body.difficulty) ? body.difficulty : b.difficulty, b.id]);
   return response({ok: true});
  }
  const setting = (await query('SELECT * FROM ai_settings WHERE id=1 AND enabled=true')).rows[0];
  if (!setting) return fail('관리자가 AI API를 등록하고 활성화해야 합니다.', 503);
  const diff = DIFF.includes(body.difficulty) ? body.difficulty : b.difficulty;
  let out;
  try { out = await meteredAI(query, setting, 'question', session.id, () => generateQuestion(setting, {question: j(b.question), concept: b.concept, difficulty: diff})); } catch (e) { return fail(e.message, e.status || 502); }
  const id = randomUUID();
  await query('INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, session.id, b.course_id, b.concept, diff, JSON.stringify(out.question), 'ai']);
  return response({id, question: out.question});
 }

 // ---------- 학생 목록·상세·메모 ----------
 if (path === '/instructor/roster' && method === 'GET') {
  const [where, params] = scope(session);
  const rows = (await query(`SELECT c.id AS course_id,c.title AS course_title,u.id,u.name,u.email,(SELECT count(*) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=c.id AND r.student_id=u.id) AS taken,(SELECT round(avg(r.score*100.0/r.total),1) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=c.id AND r.student_id=u.id AND r.grading_status='confirmed') AS average,(SELECT max(r.submitted_at) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=c.id AND r.student_id=u.id) AS last_submit,(SELECT count(*) FROM student_notes n WHERE n.student_id=u.id AND n.course_id=c.id) AS notes FROM courses c, json_each(c.student_ids) jj JOIN app_users u ON u.id=jj.value WHERE c.deleted_at IS NULL AND ${where} ORDER BY c.title,u.name`, params)).rows;
  const risk = await computeRisk(query, session.role === 'admin' ? null : session.id);
  const lv = new Map(risk.students.map(s => [s.student_id + ':' + s.course_id, s.level]));
  return response({students: rows.map(r => ({...r, risk: lv.get(r.id + ':' + r.course_id) || null}))});
 }
 if ((m = path.match(/^\/instructor\/students\/([a-f0-9-]{36})\/detail$/)) && method === 'GET') {
  const [where, params] = scope(session);
  const courses = (await query(`SELECT c.id,c.title,c.start_date,c.end_date FROM courses c WHERE c.deleted_at IS NULL AND ${where} AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$${params.length + 1}) ORDER BY c.start_date`, [...params, m[1]])).rows;
  if (!courses.length) return fail('담당 과정의 학생이 아닙니다.', 404);
  const student = (await query('SELECT id,name,email,created_at FROM app_users WHERE id=$1', [m[1]])).rows[0];
  const ids = courses.map(c => c.id), ph = ids.map((_, i) => '$' + (i + 2)).join(',');
  const results = (await query(`SELECT r.id,r.score,r.total,r.grading_status,r.submitted_at,r.questions,r.answers,r.grading,a.id AS assessment_id,a.title,a.week,a.kind,a.course_id,(SELECT round(avg(x.score*100.0/x.total),1) FROM assessment_results x WHERE x.assessment_id=a.id AND x.grading_status='confirmed') AS class_avg FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE r.student_id=$1 AND a.course_id IN (${ph}) ORDER BY r.submitted_at`, [m[1], ...ids])).rows;
  const guidance = (await query(`SELECT course_id,content,published,updated_at FROM learning_guidance WHERE student_id=$1 AND course_id IN (${ph})`, [m[1], ...ids])).rows;
  const notes = (await query(`SELECT n.id,n.course_id,n.kind,n.body,n.created_at,u.name AS author_name FROM student_notes n JOIN app_users u ON u.id=n.author_id WHERE n.student_id=$1 AND (n.course_id IS NULL OR n.course_id IN (${ph})) ORDER BY n.created_at DESC`, [m[1], ...ids])).rows;
  const risk = (await computeRisk(query, session.role === 'admin' ? null : session.id)).students.filter(s => s.student_id === m[1]);
  return response({student, courses, results: results.map(r => ({...r, questions: j(r.questions), answers: j(r.answers), grading: j(r.grading)})), guidance, notes, risk});
 }
 if (path === '/instructor/notes' && method === 'POST') {
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text || text.length > 4000) return fail('메모 내용을 입력하세요.');
  const c = await ownCourse(query, session, body.course_id);
  if (!c || !c.student_ids.includes(body.student_id)) return fail('담당 과정의 학생인지 확인하세요.', 404);
  const id = randomUUID();
  await query('INSERT INTO student_notes(id,course_id,student_id,author_id,kind,body) VALUES($1,$2,$3,$4,$5,$6)', [id, c.id, body.student_id, session.id, body.kind === 'counsel' ? 'counsel' : 'note', text]);
  if (body.kind === 'counsel') await logActivity(query, session.id, 'student.counsel', c.title, {student_id: body.student_id});
  return response({id});
 }

 // ---------- 위험 학생 (강사) ----------
 if (path === '/instructor/risk' && method === 'GET') {
  const risk = await computeRisk(query, session.role === 'admin' ? null : session.id);
  const alerts = (await query("SELECT id,title,body,created_at,read_at FROM notifications WHERE user_id=$1 AND kind='risk' ORDER BY created_at DESC LIMIT 20", [session.id])).rows;
  const [where, params] = scope(session);
  const counsel = (await query(`SELECT n.id,n.student_id,n.course_id,n.body,n.created_at,u.name AS student_name,c.title AS course_title FROM student_notes n JOIN app_users u ON u.id=n.student_id JOIN courses c ON c.id=n.course_id WHERE n.kind='counsel' AND ${where} ORDER BY n.created_at DESC LIMIT 30`, params)).rows;
  const lastCounsel = new Map(); for (const n of counsel) { const k = n.student_id + ':' + n.course_id; if (!lastCounsel.has(k)) lastCounsel.set(k, n.created_at); }
  return response({...risk, students: risk.students.map(s => ({...s, counseled_at: lastCounsel.get(s.student_id + ':' + s.course_id) || null})), alerts, counsel});
 }

 // ---------- 과정 운영 도구 ----------
 if ((m = path.match(/^\/instructor\/course-plan\/([a-f0-9-]{36})$/))) {
  const c = await ownCourse(query, session, m[1]);
  if (!c) return fail('담당 과정을 찾을 수 없습니다.', 404);
  if (method === 'GET') {
   const modules = (await query('SELECT id,week,title FROM course_modules WHERE course_id=$1 ORDER BY week', [c.id])).rows;
   const assessments = (await query('SELECT id,title,kind,week,opens_at,closes_at,published,(SELECT count(*) FROM assessment_results r WHERE r.assessment_id=assessments.id) AS taken FROM assessments WHERE course_id=$1 ORDER BY week,opens_at', [c.id])).rows;
   return response({course: {id: c.id, title: c.title, start_date: c.start_date, end_date: c.end_date, status: c.status, students: c.student_ids.length}, modules, assessments});
  }
  if (method === 'POST') {
   const moves = Array.isArray(body.assessments) ? body.assessments.slice(0, 100) : [], mods = Array.isArray(body.modules) ? body.modules.slice(0, 100) : [];
   for (const x of moves) {
    const a = (await query('SELECT id,opens_at,closes_at FROM assessments WHERE id=$1 AND course_id=$2', [x.id, c.id])).rows[0];
    if (!a) return fail('시험을 확인하세요.');
    const opens = x.opens_at ? new Date(x.opens_at) : null; if (!opens || !Number.isFinite(opens.getTime())) return fail('날짜를 확인하세요.');
    const span = a.opens_at && a.closes_at ? Date.parse(a.closes_at) - Date.parse(a.opens_at) : 7 * 864e5;
    await query('UPDATE assessments SET opens_at=$1,closes_at=$2,week=$3 WHERE id=$4', [opens.toISOString(), new Date(opens.getTime() + span).toISOString(), Math.min(100, Math.max(1, x.week | 0 || 1)), a.id]);
   }
   if (mods.length) {
    // (course_id, week) is unique, so rewrite the module list with the new weeks in one pass.
    const cur = (await query('SELECT * FROM course_modules WHERE course_id=$1', [c.id])).rows, want = new Map(mods.map(x => [x.id, Math.min(100, Math.max(1, x.week | 0))]));
    const next = cur.map(x => ({...x, week: want.get(x.id) ?? x.week}));
    if (new Set(next.map(x => x.week)).size !== next.length) return fail('같은 주차에 모듈이 두 개 있을 수 없습니다.');
    await query('DELETE FROM course_modules WHERE course_id=$1', [c.id]);
    for (const x of next) await query('INSERT INTO course_modules(id,course_id,week,title,description,benchmark) VALUES($1,$2,$3,$4,$5,$6)', [x.id, c.id, x.week, x.title, x.description, x.benchmark]);
   }
   await logActivity(query, session.id, 'course.schedule', c.title, {assessments: moves.length, modules: mods.length});
   return response({ok: true});
  }
 }
 if ((m = path.match(/^\/instructor\/courses\/([a-f0-9-]{36})\/duplicate$/)) && method === 'POST') {
  const c = await ownCourse(query, session, m[1]);
  if (!c) return fail('담당 과정을 찾을 수 없습니다.', 404);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 160) : c.title + ' (복제)';
  const start = /^\d{4}-\d{2}-\d{2}$/.test(body.start_date || '') ? body.start_date : null;
  const shift = start && c.start_date ? Math.round((Date.parse(start) - Date.parse(c.start_date)) / 864e5) : 0;
  const addDays = (d, n) => d ? new Date(Date.parse(d) + n * 864e5).toISOString() : null;
  const end = c.end_date ? addDays(c.end_date, shift).slice(0, 10) : null;
  const id = randomUUID();
  await query("INSERT INTO courses(id,owner_id,title,description,start_date,end_date,status,student_ids) VALUES($1,$2,$3,$4,$5,$6,'preparing','[]')", [id, c.owner_id, title, c.description, start || c.start_date, end]);
  const modules = (await query('SELECT week,title,description,benchmark FROM course_modules WHERE course_id=$1', [c.id])).rows;
  for (const x of modules) await query('INSERT INTO course_modules(id,course_id,week,title,description,benchmark) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), id, x.week, x.title, x.description, x.benchmark]);
  const exams = (await query('SELECT title,kind,week,duration,opens_at,closes_at,questions FROM assessments WHERE course_id=$1', [c.id])).rows;
  for (const a of exams) await query('INSERT INTO assessments(id,course_id,title,kind,week,duration,opens_at,closes_at,questions,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0)', [randomUUID(), id, a.title, a.kind, a.week, a.duration, addDays(a.opens_at, shift), addDays(a.closes_at, shift), JSON.stringify(j(a.questions))]);
  await logActivity(query, session.id, 'course.duplicate', title, {from: c.title, modules: modules.length, assessments: exams.length, shift_days: shift});
  return response({id, modules: modules.length, assessments: exams.length, shift_days: shift});
 }
 return fail('요청한 기능을 찾을 수 없습니다.', 404);
}
