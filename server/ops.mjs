// Admin operations: course setup & enrollment, at-risk students, instructor quality, AI usage/cost,
// announcements & notifications, course reports and the activity (audit) log.
import {randomUUID} from 'node:crypto';

// ---- shared helpers used by other modules ----
export async function logActivity(query, actorId, action, target = '', detail = {}) {
 try { await query('INSERT INTO activity_log(id,actor_id,action,target,detail) VALUES($1,$2,$3,$4,$5)', [randomUUID(), actorId || null, action, String(target || '').slice(0, 300), JSON.stringify(detail || {})]); } catch { /* audit must never break the request */ }
}
export async function notify(query, userId, title, body = '', link = null, kind = 'info') {
 await query('INSERT INTO notifications(id,user_id,kind,title,body,link) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), userId, kind, title.slice(0, 200), String(body).slice(0, 2000), link]);
}
// USD per 1M tokens (input, output). Unknown models use a conservative default.
const PRICES = {'gpt-4.1-mini': [0.4, 1.6], 'gpt-4.1': [2, 8], 'gpt-4.1-nano': [0.1, 0.4], 'gpt-4o-mini': [0.15, 0.6], 'gemini-3.1-flash-lite': [0.1, 0.4]};
export const estimateCost = (model, input, output) => { const [i, o] = PRICES[model] || [0.5, 2]; return Math.round((input * i + output * o) / 1e6 * 1e6) / 1e6; };
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };
// Wraps an AI call: enforces the monthly limit and records tokens, cost, latency and failures.
export async function meteredAI(query, setting, purpose, userId, call) {
 const limit = Number((await query("SELECT value FROM admin_settings WHERE key='ai_monthly_limit_usd'")).rows[0]?.value || 0);
 if (limit > 0) {
  const spent = Number((await query('SELECT coalesce(sum(cost_usd),0) AS s FROM ai_usage WHERE created_at>=$1', [monthStart()])).rows[0].s);
  if (spent >= limit) { const e = new Error(`이번 달 AI 사용 한도($${limit})에 도달했습니다. 관리자에게 문의하세요.`); e.status = 429; throw e; }
 }
 const started = Date.now();
 try {
  const result = await call();
  const u = result.usage || {}, input = u.input || 0, output = u.output || 0;
  await query('INSERT INTO ai_usage(id,provider,model,purpose,user_id,input_tokens,output_tokens,cost_usd,ok,latency_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9)', [randomUUID(), setting.provider || 'gemini', setting.model || '', purpose, userId, input, output, estimateCost(setting.model, input, output), Date.now() - started]);
  return result;
 } catch (e) {
  await query('INSERT INTO ai_usage(id,provider,model,purpose,user_id,ok,error,latency_ms) VALUES($1,$2,$3,$4,$5,0,$6,$7)', [randomUUID(), setting.provider || 'gemini', setting.model || '', purpose, userId, String(e.message).slice(0, 300), Date.now() - started]).catch(() => {});
  throw e;
 }
}

const pct = v => v == null ? null : Math.round(v * 10) / 10;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
// CSV: "이름,이메일" per line (header optional); a bare email per line also works.
function parseRoster(text) {
 const rows = [], bad = [];
 for (const [n, raw] of String(text || '').split(/\r?\n/).entries()) {
  const line = raw.trim(); if (!line) continue;
  const cells = line.split(/[,\t;]/).map(c => c.trim().replace(/^"|"$/g, ''));
  const email = cells.find(c => EMAIL.test(c))?.toLowerCase();
  if (!email) { if (n > 0 || !/이메일|email/i.test(line)) bad.push(line.slice(0, 80)); continue; }
  const name = cells.find(c => c && !EMAIL.test(c)) || email.split('@')[0];
  rows.push({name: name.slice(0, 80), email});
 }
 return {rows, bad};
}

export async function opsAPI({path, method, body, session, query, response, fail, url}) {
 if (!session) return fail('로그인이 필요합니다.', 401);

 // ---- announcements & notifications (all roles) ----
 if (path === '/announcements' && method === 'GET') {
  const mine = session.role === 'admin' ? 'SELECT id FROM courses WHERE deleted_at IS NULL'
   : session.role === 'instructor' ? 'SELECT id FROM courses WHERE deleted_at IS NULL AND (owner_id=$1 OR EXISTS(SELECT 1 FROM json_each(student_ids) WHERE value=$1))'
   : 'SELECT id FROM courses WHERE deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(student_ids) WHERE value=$1)';
  const p = session.role === 'admin' ? [] : [session.id];
  const list = (await query(`SELECT a.id,a.course_id,a.kind,a.title,a.body,a.created_at,u.name AS author_name,u.role AS author_role,c.title AS course_title FROM announcements a JOIN app_users u ON u.id=a.created_by LEFT JOIN courses c ON c.id=a.course_id WHERE a.deleted_at IS NULL AND (a.course_id IS NULL OR a.course_id IN (${mine})) ORDER BY a.created_at DESC LIMIT 100`, p)).rows;
  // Exam reminders: published assessments opening or closing in the next 7 days in the viewer's courses.
  const upcoming = (await query(`SELECT a.id,a.title,a.kind,a.week,a.opens_at,a.closes_at,c.title AS course_title FROM assessments a JOIN courses c ON c.id=a.course_id WHERE a.published=1 AND c.id IN (${mine}) AND a.opens_at IS NOT NULL AND a.opens_at BETWEEN strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day') AND strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days') ORDER BY a.opens_at`, p)).rows;
  const notes = (await query('SELECT id,kind,title,body,link,created_at,read_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [session.id])).rows;
  const courses = session.role === 'student' ? [] : (await query(`SELECT id,title FROM courses WHERE deleted_at IS NULL ${session.role === 'admin' ? '' : 'AND owner_id=$1'} ORDER BY title`, session.role === 'admin' ? [] : [session.id])).rows;
  return response({announcements: list, upcoming, notifications: notes, courses, unread: notes.filter(n => !n.read_at).length});
 }
 if (path === '/announcements' && method === 'POST') {
  if (!['admin', 'instructor'].includes(session.role)) return fail('공지는 관리자와 강사만 작성할 수 있습니다.', 403);
  const title = typeof body.title === 'string' ? body.title.trim() : '', text = typeof body.body === 'string' ? body.body.trim() : '';
  const kind = ['notice', 'exam', 'urgent'].includes(body.kind) ? body.kind : 'notice';
  if (!title || title.length > 160 || text.length > 4000) return fail('제목(1~160자)과 내용(4000자 이내)을 확인하세요.');
  let courseId = body.course_id || null;
  if (session.role === 'instructor') {
   if (!courseId) return fail('강사는 담당 과정을 골라 공지할 수 있습니다.');
   const own = (await query('SELECT id FROM courses WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL', [courseId, session.id])).rows[0];
   if (!own) return fail('담당 과정을 찾을 수 없습니다.', 404);
  } else if (courseId && !(await query('SELECT id FROM courses WHERE id=$1 AND deleted_at IS NULL', [courseId])).rows[0]) return fail('과정을 찾을 수 없습니다.', 404);
  const id = randomUUID();
  await query('INSERT INTO announcements(id,course_id,kind,title,body,created_by) VALUES($1,$2,$3,$4,$5,$6)', [id, courseId, kind, title, text, session.id]);
  await logActivity(query, session.id, 'announcement.create', title, {course_id: courseId, kind});
  return response({ok: true, id}, 201);
 }
 let m = path.match(/^\/announcements\/([a-f0-9-]{36})\/delete$/);
 if (m && method === 'POST') {
  const a = (await query('SELECT a.*,c.owner_id FROM announcements a LEFT JOIN courses c ON c.id=a.course_id WHERE a.id=$1 AND a.deleted_at IS NULL', [m[1]])).rows[0];
  if (!a || !(session.role === 'admin' || a.created_by === session.id)) return fail('공지를 찾을 수 없습니다.', 404);
  await query("UPDATE announcements SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$1", [a.id]);
  await logActivity(query, session.id, 'announcement.delete', a.title);
  return response({ok: true});
 }
 if (path === '/notifications/read' && method === 'POST') {
  await query("UPDATE notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=$1 AND read_at IS NULL", [session.id]);
  return response({ok: true});
 }

 if (session.role !== 'admin') return fail('관리자만 접근할 수 있습니다.', 403);

 // ---- 과정 개설·배정 ----
 if (path === '/admin/courses' && method === 'GET') {
  const courses = (await query(`SELECT c.id,c.title,c.description,c.start_date,c.end_date,c.status,c.owner_id,u.name AS owner_name,json_array_length(c.student_ids) AS enrolled,(SELECT count(*) FROM assessments a WHERE a.course_id=c.id) AS assessments,(SELECT count(*) FROM course_modules m WHERE m.course_id=c.id) AS modules FROM courses c JOIN app_users u ON u.id=c.owner_id WHERE c.deleted_at IS NULL ORDER BY coalesce(c.start_date,'9999') DESC,c.title`)).rows;
  const instructors = (await query("SELECT id,name,email FROM app_users WHERE role IN ('instructor','admin') AND active=1 ORDER BY role='admin',name")).rows;
  return response({courses, instructors});
 }
 if (path === '/admin/courses' && method === 'POST') {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 160) return fail('과정 이름(1~160자)을 입력하세요.');
  const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const start = date(body.start_date), end = date(body.end_date);
  if (start && end && end < start) return fail('종료일이 시작일보다 빠릅니다.');
  const owner = (await query("SELECT id,name FROM app_users WHERE id=$1 AND role IN ('instructor','admin') AND active=1", [body.owner_id])).rows[0];
  if (!owner) return fail('담당 강사를 선택하세요.');
  const id = randomUUID(), status = ['preparing', 'active', 'ended'].includes(body.status) ? body.status : 'preparing';
  await query('INSERT INTO courses(id,owner_id,title,description,start_date,end_date,status,student_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, owner.id, title, String(body.description || '').slice(0, 2000), start, end, status, '[]']);
  await logActivity(query, session.id, 'course.create', title, {owner: owner.name});
  if (owner.id !== session.id) await notify(query, owner.id, `새 과정 배정: ${title}`, '관리자가 과정을 개설하고 담당 강사로 지정했습니다.', '/teach/courses', 'assign');
  return response({ok: true, id}, 201);
 }
 m = path.match(/^\/admin\/courses\/([a-f0-9-]{36})$/);
 if (m && method === 'PATCH') {
  const c = (await query('SELECT * FROM courses WHERE id=$1 AND deleted_at IS NULL', [m[1]])).rows[0];
  if (!c) return fail('과정을 찾을 수 없습니다.', 404);
  const owner = (await query("SELECT id,name FROM app_users WHERE id=$1 AND role IN ('instructor','admin') AND active=1", [body.owner_id])).rows[0];
  if (!owner) return fail('담당 강사를 선택하세요.');
  await query('UPDATE courses SET owner_id=$1 WHERE id=$2', [owner.id, c.id]);
  await logActivity(query, session.id, 'course.assign', c.title, {owner: owner.name});
  if (owner.id !== session.id) await notify(query, owner.id, `과정 담당 지정: ${c.title}`, '관리자가 이 과정의 담당 강사로 지정했습니다.', '/teach/courses', 'assign');
  return response({ok: true});
 }
 m = path.match(/^\/admin\/courses\/([a-f0-9-]{36})\/enroll$/);
 if (m && method === 'POST') {
  const c = (await query('SELECT * FROM courses WHERE id=$1 AND deleted_at IS NULL', [m[1]])).rows[0];
  if (!c) return fail('과정을 찾을 수 없습니다.', 404);
  const {rows, bad} = parseRoster(body.csv);
  if (!rows.length) return fail('등록할 학생이 없습니다. "이름,이메일" 형식으로 입력하세요.');
  if (rows.length > 500) return fail('한 번에 500명까지 등록할 수 있습니다.');
  const ids = new Set(Array.isArray(c.student_ids) ? c.student_ids : JSON.parse(c.student_ids || '[]')), created = [], added = [], skipped = [];
  for (const r of rows) {
   let u = (await query('SELECT id,role FROM app_users WHERE email=$1', [r.email])).rows[0];
   if (!u) {
    // New accounts start with login disabled until an admin sets a password (회원 관리 > 비밀번호 초기화).
    u = {id: randomUUID(), role: 'student'};
    await query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,'!disabled','student')", [u.id, r.name, r.email]);
    created.push(r.email);
   }
   if (u.role !== 'student') { skipped.push(r.email); continue; }
   if (!ids.has(u.id)) { ids.add(u.id); added.push(r.email); }
  }
  await query('UPDATE courses SET student_ids=$1 WHERE id=$2', [JSON.stringify([...ids]), c.id]);
  await logActivity(query, session.id, 'course.enroll', c.title, {added: added.length, created: created.length, skipped: skipped.length});
  return response({ok: true, added: added.length, created: created.length, skipped, invalid: bad, enrolled: ids.size});
 }

 // ---- 위험 학생 ----
 if (path === '/admin/risk' && method === 'GET') {
  const rows = (await query(`SELECT c.id AS course_id,c.title AS course_title,c.start_date,c.end_date,c.owner_id,o.name AS owner_name,u.id AS student_id,u.name AS student_name,u.email
   FROM courses c JOIN app_users o ON o.id=c.owner_id, json_each(c.student_ids) j JOIN app_users u ON u.id=j.value
   WHERE c.deleted_at IS NULL AND c.status<>'ended' AND u.active=1`)).rows;
  const due = (await query(`SELECT a.id,a.course_id,a.week,a.title FROM assessments a JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL AND a.published=1 AND coalesce(a.opens_at,'0')<strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')`)).rows;
  const results = (await query(`SELECT r.student_id,a.course_id,a.id AS assessment_id,a.week,r.score,r.total,r.grading_status,r.submitted_at FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id`)).rows;
  const bench = (await query('SELECT course_id,week,benchmark FROM course_modules WHERE benchmark IS NOT NULL')).rows;
  const notified = (await query("SELECT target,max(created_at) AS at FROM activity_log WHERE action='risk.notify' GROUP BY target")).rows;
  const lastNotified = new Map(notified.map(n => [n.target, n.at]));
  const out = [];
  for (const r of rows) {
   const mine = results.filter(x => x.student_id === r.student_id && x.course_id === r.course_id);
   const taken = new Set(mine.map(x => x.assessment_id));
   const missed = due.filter(d => d.course_id === r.course_id && !taken.has(d.id));
   const conf = mine.filter(x => x.grading_status === 'confirmed' && x.total > 0).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)).map(x => ({week: x.week, p: x.score * 100 / x.total}));
   const reasons = [];let level = 0;
   if (missed.length >= 2) { reasons.push({type: 'missed', label: `미응시 ${missed.length}건`, detail: missed.map(x => `${x.week}주차`).join(', ')}); level += missed.length >= 3 ? 3 : 2; }
   else if (missed.length === 1) { reasons.push({type: 'missed', label: '미응시 1건', detail: `${missed[0].week}주차`}); level += 1; }
   if (conf.length >= 3) {
    const last = conf[conf.length - 1].p, prev = conf.slice(0, -1).reduce((a, b) => a + b.p, 0) / (conf.length - 1);
    if (prev - last >= 20) { reasons.push({type: 'drop', label: `점수 급락 -${Math.round(prev - last)}점`, detail: `이전 평균 ${pct(prev)} → 최근 ${pct(last)}`}); level += 2; }
   }
   const avg = conf.length ? conf.reduce((a, b) => a + b.p, 0) / conf.length : null;
   const bw = bench.filter(b => b.course_id === r.course_id && conf.some(c => c.week === b.week));
   const target = bw.length ? bw.reduce((a, b) => a + b.benchmark, 0) / bw.length : null;
   if (avg != null && target != null && target - avg >= 25) { reasons.push({type: 'gap', label: `3년차 기준 -${Math.round(target - avg)}점`, detail: `평균 ${pct(avg)} / 기준 ${pct(target)}`}); level += target - avg >= 35 ? 2 : 1; }
   if (avg != null && avg < 50) { reasons.push({type: 'low', label: `평균 ${pct(avg)}점`, detail: '확정 성적 평균 50점 미만'}); level += 1; }
   // A single missed assessment alone is not a risk signal.
   if (!reasons.length || (reasons.length === 1 && missed.length === 1)) continue;
   const key = `${r.student_id}:${r.course_id}`;
   out.push({...r, reasons, level: level >= 4 ? 'high' : level >= 2 ? 'medium' : 'low', score: level, average: pct(avg), benchmark: pct(target), taken: mine.length, missed: missed.length, notified_at: lastNotified.get(key) || null});
  }
  out.sort((a, b) => b.score - a.score || a.student_name.localeCompare(b.student_name));
  return response({students: out, summary: {high: out.filter(x => x.level === 'high').length, medium: out.filter(x => x.level === 'medium').length, low: out.filter(x => x.level === 'low').length, students: new Set(out.map(x => x.student_id)).size}});
 }
 if (path === '/admin/risk/notify' && method === 'POST') {
  const c = (await query('SELECT c.id,c.title,c.owner_id FROM courses c WHERE c.id=$1 AND c.deleted_at IS NULL', [body.course_id])).rows[0];
  const s = (await query("SELECT id,name FROM app_users WHERE id=$1 AND role='student'", [body.student_id])).rows[0];
  if (!c || !s) return fail('과정 또는 학생을 찾을 수 없습니다.', 404);
  const reasons = Array.isArray(body.reasons) ? body.reasons.filter(x => typeof x === 'string').slice(0, 6).map(x => x.slice(0, 60)) : [];
  await notify(query, c.owner_id, `위험 학생 알림: ${s.name} (${c.title})`, `${reasons.join(', ') || '학습 상태 확인 필요'}. 학습 방향 지도에서 상담·학습 방향을 확인해 주세요.`, '/teach/guidance', 'risk');
  await logActivity(query, session.id, 'risk.notify', `${s.id}:${c.id}`, {student: s.name, course: c.title, reasons});
  return response({ok: true});
 }

 // ---- 강사 운영 품질 ----
 if (path === '/admin/quality' && method === 'GET') {
  const instructors = (await query(`SELECT u.id,u.name,u.email,(SELECT count(*) FROM courses c WHERE c.owner_id=u.id AND c.deleted_at IS NULL) AS courses FROM app_users u WHERE u.role IN ('instructor','admin') AND EXISTS(SELECT 1 FROM courses c WHERE c.owner_id=u.id AND c.deleted_at IS NULL) ORDER BY u.name`)).rows;
  const res = (await query(`SELECT c.owner_id,r.grading_status,r.submitted_at,r.confirmed_at,(SELECT count(*) FROM json_each(r.questions) q WHERE json_extract(q.value,'$.type')='text') AS text_q FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL`)).rows;
  const logs = (await query("SELECT actor_id,detail FROM activity_log WHERE action='grade.confirm'")).rows;
  const guide = (await query(`SELECT c.owner_id,count(DISTINCT r.student_id||a.course_id) AS learners,(SELECT count(*) FROM learning_guidance g JOIN courses c2 ON c2.id=g.course_id WHERE c2.owner_id=c.owner_id AND g.published=1) AS n_pub,(SELECT count(*) FROM learning_guidance g JOIN courses c2 ON c2.id=g.course_id WHERE c2.owner_id=c.owner_id AND g.published=0) AS n_draft FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL GROUP BY c.owner_id`)).rows;
  const now = Date.now();
  const list = instructors.map(i => {
   const mine = res.filter(r => r.owner_id === i.id && r.text_q > 0);
   const done = mine.filter(r => r.grading_status === 'confirmed' && r.confirmed_at);
   const delays = done.map(r => (new Date(r.confirmed_at) - new Date(r.submitted_at)) / 36e5).filter(h => h >= 0);
   const waiting = mine.filter(r => r.grading_status !== 'confirmed');
   const oldest = waiting.length ? Math.max(...waiting.map(r => (now - new Date(r.submitted_at)) / 36e5)) : null;
   const ai = logs.filter(l => l.actor_id === i.id).map(l => typeof l.detail === 'string' ? JSON.parse(l.detail) : l.detail).filter(d => d.ai_used > 0);
   const used = ai.reduce((a, d) => a + d.ai_used, 0), changed = ai.reduce((a, d) => a + (d.ai_changed || 0), 0);
   const g = guide.find(x => x.owner_id === i.id) || {learners: 0, n_pub: 0, n_draft: 0};
   const median = delays.length ? delays.sort((a, b) => a - b)[Math.floor(delays.length / 2)] : null;
   return {...i, graded: done.length, avg_delay_h: delays.length ? pct(delays.reduce((a, b) => a + b, 0) / delays.length) : null, median_delay_h: pct(median), within_24h: delays.length ? pct(delays.filter(h => h <= 24).length * 100 / delays.length) : null, waiting: waiting.length, oldest_wait_h: pct(oldest), ai_used: used, ai_edit_rate: used ? pct(changed * 100 / used) : null, learners: g.learners, guidance_published: Number(g.n_pub), guidance_drafts: Number(g.n_draft), guidance_rate: g.learners ? pct(Math.min(100, g.n_pub * 100 / g.learners)) : null};
  });
  return response({instructors: list});
 }

 // ---- AI 사용량·비용 ----
 if (path === '/admin/ai-usage' && method === 'GET') {
  const days = (await query(`SELECT substr(created_at,1,10) AS day,count(*) AS calls,coalesce(sum(ok=0),0) AS failed,coalesce(sum(input_tokens),0) AS input,coalesce(sum(output_tokens),0) AS output,coalesce(sum(cost_usd),0) AS cost FROM ai_usage WHERE created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days') GROUP BY day ORDER BY day`)).rows;
  const months = (await query(`SELECT substr(created_at,1,7) AS month,count(*) AS calls,coalesce(sum(ok=0),0) AS failed,coalesce(sum(input_tokens),0) AS input,coalesce(sum(output_tokens),0) AS output,coalesce(sum(cost_usd),0) AS cost FROM ai_usage GROUP BY month ORDER BY month DESC LIMIT 6`)).rows;
  const purposes = (await query(`SELECT purpose,count(*) AS calls,coalesce(sum(cost_usd),0) AS cost FROM ai_usage WHERE created_at>=$1 GROUP BY purpose ORDER BY calls DESC`, [monthStart()])).rows;
  const failures = (await query(`SELECT a.created_at,a.purpose,a.model,a.error,u.name AS user_name FROM ai_usage a LEFT JOIN app_users u ON u.id=a.user_id WHERE a.ok=0 ORDER BY a.created_at DESC LIMIT 10`)).rows;
  const limit = Number((await query("SELECT value FROM admin_settings WHERE key='ai_monthly_limit_usd'")).rows[0]?.value || 0);
  const setting = (await query('SELECT provider,model,enabled FROM ai_settings WHERE id=1')).rows[0] || null;
  return response({days, months, purposes, failures, limit, setting});
 }
 if (path === '/admin/ai-usage/limit' && method === 'POST') {
  const v = Number(body.limit);
  if (!Number.isFinite(v) || v < 0 || v > 100000) return fail('월 한도는 0~100000 사이 숫자(USD)로 입력하세요. 0은 제한 없음입니다.');
  await query("INSERT INTO admin_settings(key,value) VALUES('ai_monthly_limit_usd',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [String(v)]);
  await logActivity(query, session.id, 'ai.limit', `$${v}`);
  return response({ok: true, limit: v});
 }

 // ---- 보고서 ----
 m = path.match(/^\/admin\/reports\/([a-f0-9-]{36})$/);
 if (path === '/admin/reports' && method === 'GET') {
  const courses = (await query(`SELECT c.id,c.title,c.start_date,c.end_date,c.status,u.name AS owner_name,json_array_length(c.student_ids) AS enrolled,(SELECT count(*) FROM assessments a WHERE a.course_id=c.id AND a.published=1) AS assessments FROM courses c JOIN app_users u ON u.id=c.owner_id WHERE c.deleted_at IS NULL ORDER BY c.start_date DESC`)).rows;
  return response({courses});
 }
 if (m && method === 'GET') {
  const c = (await query('SELECT c.*,u.name AS owner_name FROM courses c JOIN app_users u ON u.id=c.owner_id WHERE c.id=$1 AND c.deleted_at IS NULL', [m[1]])).rows[0];
  if (!c) return fail('과정을 찾을 수 없습니다.', 404);
  // Only assessments that have already opened count toward participation.
  const assessments = (await query(`SELECT id,title,kind,week FROM assessments WHERE course_id=$1 AND published=1 AND coalesce(opens_at,'0')<=strftime('%Y-%m-%dT%H:%M:%fZ','now') ORDER BY week,title`, [c.id])).rows;
  const students = (await query('SELECT u.id,u.name,u.email FROM json_each($1) j JOIN app_users u ON u.id=j.value ORDER BY u.name', [Array.isArray(c.student_ids) ? JSON.stringify(c.student_ids) : c.student_ids])).rows;
  const results = (await query('SELECT r.student_id,r.assessment_id,r.score,r.total,r.grading_status FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=$1', [c.id])).rows;
  const rows = students.map(s => {
   const scores = assessments.map(a => { const r = results.find(x => x.student_id === s.id && x.assessment_id === a.id); return r ? (r.grading_status === 'confirmed' ? pct(r.score * 100 / r.total) : '채점 중') : null; });
   const nums = scores.filter(v => typeof v === 'number'), taken = scores.filter(v => v !== null).length;
   const avg = nums.length ? pct(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
   const rate = assessments.length ? pct(taken * 100 / assessments.length) : null;
   const completion = rate != null && rate >= 80 && avg != null && avg >= 60 ? '수료' : c.status === 'ended' ? '미수료' : rate != null && rate >= 50 ? '진행 중' : '주의';
   return {name: s.name, email: s.email, scores, average: avg, participation: rate, completion};
  });
  return response({course: {id: c.id, title: c.title, start_date: c.start_date, end_date: c.end_date, status: c.status, owner_name: c.owner_name}, assessments, rows, generated_at: new Date().toISOString()});
 }

 // ---- 활동 로그 ----
 if (path === '/admin/activity' && method === 'GET') {
  return response(await activityList(query, url));
 }
 return fail('요청한 기능을 찾을 수 없습니다.', 404);
}

export async function activityList(query, url) {
 const action = (url?.searchParams.get('action') || '').slice(0, 40), q = (url?.searchParams.get('q') || '').slice(0, 80);
 const page = Math.max(1, Math.min(1000, parseInt(url?.searchParams.get('page') || '1', 10) || 1));
 const params = [];let where = '1=1';
 if (action) { params.push(action + '%'); where += ` AND l.action LIKE $${params.length}`; }
 if (q) { params.push('%' + q + '%'); where += ` AND (l.target LIKE $${params.length} OR u.name LIKE $${params.length} OR l.detail LIKE $${params.length})`; }
 const total = Number((await query(`SELECT count(*) AS n FROM activity_log l LEFT JOIN app_users u ON u.id=l.actor_id WHERE ${where}`, params)).rows[0].n);
 const rows = (await query(`SELECT l.id,l.created_at,l.action,l.target,l.detail,u.name AS actor_name,u.role AS actor_role FROM activity_log l LEFT JOIN app_users u ON u.id=l.actor_id WHERE ${where} ORDER BY l.created_at DESC LIMIT 20 OFFSET ${(page - 1) * 20}`, params)).rows;
 const counts = (await query("SELECT substr(action,1,instr(action||'.','.')-1) AS grp,count(*) AS n FROM activity_log WHERE created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days') GROUP BY grp")).rows;
 return {rows: rows.map(r => ({...r, detail: typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail})), total, page, counts};
}
