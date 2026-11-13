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

// ---------- 문제 은행 helpers ----------
export const COVER_TARGET = 5; // goal: questions per concept per difficulty
const DIFF_KO = {'쉬움': 'easy', '보통': 'medium', '어려움': 'hard', easy: 'easy', medium: 'medium', hard: 'hard'};
const TYPE_KO = {'객관식': 'choice', '주관식': 'text', choice: 'choice', text: 'text'};
const cleanQ = (q, concept) => ({type: q.type || 'choice', prompt: String(q.prompt).slice(0, 8000), points: Math.min(100, Math.max(1, q.points | 0 || 10)), tag: concept, explanation: String(q.explanation || '').slice(0, 4000), ...(q.type === 'text' ? {model_answer: String(q.model_answer || ''), rubric: String(q.rubric || '')} : {options: (q.options || []).slice(0, 4).map(String), answer: q.answer | 0})});
const parseResult = r => ({...r, answers: j(r.answers), grading: j(r.grading), questions: j(r.questions)});

// Per-question difficulty, discrimination and flags for one exam (rows = its results).
function analyze(a, rows) {
 const n = rows.length, sorted = [...rows].sort((x, y) => y.score / y.total - x.score / x.total), k = Math.max(1, Math.round(n * 0.27));
 const upper = sorted.slice(0, k), lower = sorted.slice(-k);
 const questions = a.questions.map((q, i) => {
  const got = r => { const qq = r.questions[i] || q; if (isText(qq)) { const g = r.grading[i]; return g?.status === 'confirmed' ? g.score / qq.points : null; } return r.answers[i] === qq.answer ? 1 : 0; };
  const vals = rows.map(got).filter(v => v != null);
  const rate = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  const avg = list => { const v = list.map(got).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const hi = avg(upper), lo = avg(lower), disc = hi != null && lo != null && n >= 4 ? hi - lo : null;
  const dist = isText(q) ? null : (q.options || []).map((o, oi) => ({text: o, count: rows.filter(r => r.answers[i] === oi).length, correct: oi === q.answer}));
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
 return {n, average: n ? r1(rows.reduce((s, r) => s + r.score * 100 / r.total, 0) / n) : null, questions};
}
async function analyzeAssessment(query, a) {
 const rows = (await query('SELECT r.score,r.total,r.answers,r.grading,r.grading_status,r.questions FROM assessment_results r WHERE r.assessment_id=$1', [a.id])).rows.map(parseResult);
 return analyze(a, rows);
}
const guessDiff = rate => rate == null ? 'medium' : rate >= 80 ? 'easy' : rate < 50 ? 'hard' : 'medium';

// Copy one exam's questions into the bank (owner = course owner) and keep them in sync.
// Linked by (source_assessment_id, source_index); an unlinked item with the same prompt in the course is adopted.
async function syncAssessment(query, a, bankRows, resultRows) {
 bankRows ||= (await query('SELECT id,course_id,question,source,source_assessment_id,source_index,concept FROM question_bank WHERE course_id=$1 AND deleted_at IS NULL', [a.course_id])).rows;
 const linked = new Map(bankRows.filter(b => b.source_assessment_id === a.id).map(b => [b.source_index, b]));
 const byPrompt = new Map(bankRows.map(b => [j(b.question).prompt, b]));
 let added = 0, stats = null;
 for (const [i, q] of a.questions.entries()) {
  if (!q || !q.prompt) continue;
  const concept = String(q.tag || '').slice(0, 80), json = JSON.stringify(q), cur = linked.get(i);
  if (cur) { if (cur.source === 'exam' && (cur.question !== json || cur.concept !== concept)) await query('UPDATE question_bank SET question=$1,concept=$2 WHERE id=$3', [json, concept, cur.id]); continue; }
  const same = byPrompt.get(q.prompt);
  if (same) { if (!same.source_assessment_id) { await query('UPDATE question_bank SET source_assessment_id=$1,source_index=$2 WHERE id=$3', [a.id, i, same.id]); same.source_assessment_id = a.id; } continue; }
  if (!stats) stats = resultRows ? analyze(a, resultRows) : await analyzeAssessment(query, a);
  const id = randomUUID();
  await query('INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source,source_assessment_id,source_index) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, a.owner_id, a.course_id, concept, guessDiff(stats.questions[i]?.rate), json, 'exam', a.id, i]);
  const row = {id, course_id: a.course_id, question: json, source: 'exam', source_assessment_id: a.id, source_index: i, concept};
  bankRows.push(row); byPrompt.set(q.prompt, row); added++;
 }
 // Questions removed from a not-yet-taken exam: drop their synced copies.
 for (const [i, b] of linked) if (i >= a.questions.length && b.source === 'exam') await query(`UPDATE question_bank SET deleted_at=${NOWSQL} WHERE id=$1`, [b.id]);
 return added;
}
async function scopedExams(query, session) {
 const [where, params] = scope(session);
 return (await query(`SELECT a.id,a.course_id,a.title,a.questions,c.owner_id FROM assessments a JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL AND ${where}`, params)).rows.map(a => ({...a, questions: j(a.questions) || []}));
}
async function scopedResults(query, session) {
 const [where, params] = scope(session);
 const rows = (await query(`SELECT r.assessment_id,r.score,r.total,r.answers,r.grading,r.grading_status,r.questions FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL AND ${where}`, params)).rows.map(parseResult);
 return rows.reduce((m, r) => { (m.get(r.assessment_id) || m.set(r.assessment_id, []).get(r.assessment_id)).push(r); return m; }, new Map());
}
// Sync every exam in the caller's scope (all courses, including ones whose bank is still empty).
export async function syncBank(query, session) {
 const exams = await scopedExams(query, session);
 if (!exams.length) return 0;
 const [where, params] = scope(session);
 const bank = (await query(`SELECT b.id,b.course_id,b.question,b.source,b.source_assessment_id,b.source_index,b.concept FROM question_bank b JOIN courses c ON c.id=b.course_id WHERE b.deleted_at IS NULL AND ${where}`, params)).rows;
 const byCourse = bank.reduce((m, b) => { (m.get(b.course_id) || m.set(b.course_id, []).get(b.course_id)).push(b); return m; }, new Map());
 let results = null, added = 0;
 for (const a of exams) {
  const rows = byCourse.get(a.course_id) || byCourse.set(a.course_id, []).get(a.course_id);
  const known = new Set(rows.map(b => j(b.question).prompt)), linked = new Set(rows.filter(b => b.source_assessment_id === a.id).map(b => b.source_index));
  const needs = a.questions.some((q, i) => q?.prompt && (!known.has(q.prompt) || !linked.has(i))) || rows.some(b => b.source_assessment_id === a.id && b.source === 'exam' && (b.source_index >= a.questions.length || b.question !== JSON.stringify(a.questions[b.source_index])));
  if (!needs) continue;
  results ||= await scopedResults(query, session);
  added += await syncAssessment(query, a, rows, results.get(a.id) || []);
 }
 return added;
}
export async function syncExamToBank(query, assessmentId) {
 const a = (await query('SELECT a.id,a.course_id,a.questions,c.owner_id FROM assessments a JOIN courses c ON c.id=a.course_id WHERE a.id=$1', [assessmentId])).rows[0];
 if (a) await syncAssessment(query, {...a, questions: j(a.questions) || []});
}
// Item-analysis stats for bank items: key "aid#index" and "course|prompt" -> {rate, discrimination, flags, n, exam}.
async function bankStats(query, session) {
 const exams = await scopedExams(query, session), results = await scopedResults(query, session), out = new Map();
 for (const a of exams) {
  const rows = results.get(a.id); if (!rows?.length) continue;
  analyze(a, rows).questions.forEach((q, i) => { const s = {rate: q.rate, discrimination: q.discrimination, flags: q.flags, n: rows.length, exam: a.title}; out.set(`${a.id}#${i}`, s); const k = `${a.course_id}|${q.prompt}`; if (!out.has(k)) out.set(k, s); });
 }
 return out;
}

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
  const {n, average, questions: qs} = await analyzeAssessment(query, a);
  const concepts = [...qs.reduce((m, q) => { if (q.rate == null) return m; const t = q.tag || '기타'; const c = m.get(t) || {tag: t, sum: 0, n: 0}; c.sum += q.rate; c.n++; m.set(t, c); return m; }, new Map()).values()].map(c => ({tag: c.tag, rate: r1(c.sum / c.n)})).sort((x, y) => x.rate - y.rate);
  return response({assessment: {id: a.id, title: a.title, week: a.week, course_title: a.course_title}, respondents: n, average, questions: qs, concepts});
 }

 // ---------- 문제 은행 ----------
 if (path === '/instructor/bank' && method === 'GET') {
  const synced = await syncBank(query, session);
  const admin = session.role === 'admin';
  const rows = (await query(`SELECT b.id,b.owner_id,b.course_id,b.concept,b.difficulty,b.question,b.source,b.used_count,b.created_at,b.status,b.share,b.via,b.reviewed_at,b.source_assessment_id,b.source_index,c.title AS course_title,u.name AS owner_name FROM question_bank b LEFT JOIN courses c ON c.id=b.course_id LEFT JOIN app_users u ON u.id=b.owner_id WHERE b.deleted_at IS NULL AND ${admin ? '1=1' : "(b.owner_id=$1 OR (b.share='all' AND b.status<>'draft'))"} ORDER BY b.created_at DESC`, admin ? [] : [session.id])).rows;
  // Item-analysis flags, joined by exam link or (course, prompt).
  const stats = await bankStats(query, session);
  const items = rows.map(r => { const q = j(r.question); const st = stats.get(`${r.source_assessment_id}#${r.source_index}`) || stats.get(`${r.course_id}|${q.prompt}`) || null; return {...r, question: q, mine: r.owner_id === session.id || admin, stats: st}; });
  return response({items, synced, target: COVER_TARGET});
 }
 if (path === '/instructor/bank' && method === 'POST') {
  const q = body.question;
  if (!q || typeof q.prompt !== 'string' || !q.prompt.trim() || !['choice', 'text'].includes(q.type || 'choice')) return fail('문항 내용을 확인하세요.');
  if (body.course_id && !(await ownCourse(query, session, body.course_id))) return fail('과정을 확인하세요.');
  const diff = DIFF.includes(body.difficulty) ? body.difficulty : 'medium', concept = String(body.concept || q.tag || '').slice(0, 80);
  const id = randomUUID();
  await query('INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source,share) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, session.id, body.course_id || null, concept, diff, JSON.stringify(cleanQ(q, concept)), ['exam', 'ai'].includes(body.source) ? body.source : 'manual', body.share === 'all' ? 'all' : 'course']);
  return response({id});
 }
 if (path === '/instructor/bank/import' && method === 'POST') {
  const a = await ownAssessment(query, session, body.assessment_id);
  if (!a) return fail('시험을 찾을 수 없습니다.', 404);
  return response({added: await syncAssessment(query, a)});
 }
 // Excel bulk upload: rows parsed in the browser; validate every row, insert the valid ones unless dry_run.
 if (path === '/instructor/bank/bulk' && method === 'POST') {
  if (!Array.isArray(body.rows) || !body.rows.length) return fail('업로드할 행이 없습니다.');
  if (body.rows.length > 500) return fail('한 번에 500행까지 올릴 수 있습니다.');
  const [where, params] = scope(session);
  const courses = (await query(`SELECT c.id,c.title FROM courses c WHERE c.deleted_at IS NULL AND ${where}`, params)).rows;
  const byTitle = new Map(courses.map(c => [c.title.trim(), c.id]));
  const have = new Set((await query('SELECT course_id,question FROM question_bank WHERE owner_id=$1 AND deleted_at IS NULL', [session.id])).rows.map(r => `${r.course_id}|${j(r.question).prompt}`));
  const errors = [], ok = [];
  body.rows.forEach((raw, i) => {
   const row = Number(raw._row) || i + 2, v = k => String(raw?.[k] ?? '').trim(), errs = [];
   const course = v('과정'), courseId = course ? byTitle.get(course) : null;
   if (course && !courseId) errs.push(`과정 "${course.slice(0, 30)}"을(를) 찾을 수 없습니다`);
   const concept = v('개념'); if (!concept) errs.push('개념이 비어 있습니다'); else if (concept.length > 80) errs.push('개념은 80자 이하');
   const diff = DIFF_KO[v('난이도')] || DIFF_KO[v('난이도').toLowerCase()]; if (!diff) errs.push('난이도는 쉬움·보통·어려움 중 하나');
   const type = TYPE_KO[v('유형')] || TYPE_KO[v('유형').toLowerCase()]; if (!type) errs.push('유형은 객관식·주관식 중 하나');
   const prompt = v('문제'); if (!prompt) errs.push('문제가 비어 있습니다');
   const points = v('배점') ? Number(v('배점')) : 10; if (!Number.isInteger(points) || points < 1 || points > 100) errs.push('배점은 1~100 정수');
   let q = null;
   if (type === 'choice') {
    const options = [1, 2, 3, 4].map(k => v('보기' + k));
    if (options.some(o => !o)) errs.push('객관식은 보기1~4를 모두 채워야 합니다');
    const a = v('정답'), num = Number(a), answer = Number.isInteger(num) && num >= 1 && num <= 4 ? num - 1 : options.indexOf(a);
    if (answer < 0) errs.push('정답은 1~4 번호(또는 보기 내용)');
    q = {type, prompt, points, options, answer, explanation: v('해설')};
   } else if (type === 'text') {
    if (!v('채점기준') && !v('해설')) errs.push('주관식은 해설(모범 답안) 또는 채점기준이 필요합니다');
    q = {type, prompt, points, model_answer: v('해설'), rubric: v('채점기준') || v('해설'), explanation: v('해설')};
   }
   if (!errs.length && have.has(`${courseId || null}|${prompt}`)) errs.push('이미 같은 문제가 은행에 있습니다');
   if (errs.length) errors.push({row, prompt: prompt.slice(0, 40), errors: errs});
   else { have.add(`${courseId || null}|${prompt}`); ok.push({courseId, concept, diff, q: cleanQ(q, concept)}); }
  });
  if (!body.dry_run) for (const r of ok) await query('INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source,via,share) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), session.id, r.courseId, r.concept, r.diff, JSON.stringify(r.q), 'manual', 'excel', body.share === 'all' ? 'all' : 'course']);
  return response({total: body.rows.length, valid: ok.length, added: body.dry_run ? 0 : ok.length, errors});
 }
 if ((m = path.match(/^\/instructor\/bank\/([a-f0-9-]{36})\/(delete|similar|update|used|review)$/)) && method === 'POST') {
  const b = (await query('SELECT * FROM question_bank WHERE id=$1 AND deleted_at IS NULL', [m[1]])).rows[0];
  if (!b) return fail('문항을 찾을 수 없습니다.', 404);
  const mine = b.owner_id === session.id || session.role === 'admin';
  if (m[2] === 'used' && (mine || b.share === 'all')) { await query('UPDATE question_bank SET used_count=used_count+1 WHERE id=$1', [b.id]); return response({ok: true}); }
  if (!mine) return fail('문항을 찾을 수 없습니다.', 404);
  if (m[2] === 'delete') { await query(`UPDATE question_bank SET deleted_at=${NOWSQL} WHERE id=$1`, [b.id]); return response({ok: true}); }
  if (m[2] === 'review') { const undo = body.undo === true; await query(`UPDATE question_bank SET status=$1,reviewed_at=${undo ? 'NULL' : NOWSQL} WHERE id=$2`, [undo ? 'active' : 'reviewed', b.id]); return response({ok: true}); }
  if (m[2] === 'update') {
   await query('UPDATE question_bank SET concept=$1,difficulty=$2,share=$3 WHERE id=$4', [String(body.concept ?? b.concept).slice(0, 80), DIFF.includes(body.difficulty) ? body.difficulty : b.difficulty, ['course', 'all'].includes(body.share) ? body.share : b.share, b.id]);
   return response({ok: true});
  }
  const setting = (await query('SELECT * FROM ai_settings WHERE id=1 AND enabled=true')).rows[0];
  if (!setting) return fail('관리자가 AI API를 등록하고 활성화해야 합니다.', 503);
  const diff = DIFF.includes(body.difficulty) ? body.difficulty : b.difficulty;
  let out;
  try { out = await meteredAI(query, setting, 'question', session.id, () => generateQuestion(setting, {question: j(b.question), concept: b.concept, difficulty: diff})); } catch (e) { return fail(e.message, e.status || 502); }
  const id = randomUUID();
  // AI questions start as drafts: they are not used in practice or exams until an instructor reviews them.
  await query('INSERT INTO question_bank(id,owner_id,course_id,concept,difficulty,question,source,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, session.id, b.course_id, b.concept, diff, JSON.stringify(out.question), 'ai', 'draft']);
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
