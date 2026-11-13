// Student-instructor meetings (면담) and counseling logs. No AI.
// Students request a meeting; the instructor accepts (sets a time), reschedules or declines, then writes a log:
// a private note for instructors only, and a summary + agreed to-dos that the student can see once shared.
import {randomUUID} from 'node:crypto';
import {computeRisk, logActivity, notify} from './ops.mjs';

const UUID = /^[a-f0-9-]{36}$/;
const ID = /^[a-z0-9-]{3,60}$/;
const NOWSQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const KINDS = ['study', 'career', 'attendance', 'life', 'other'];
const j = v => typeof v === 'string' ? JSON.parse(v) : v;
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const when = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? undefined : d.toISOString(); };
const cleanActions = list => (Array.isArray(list) ? list : []).map(a => ({text: str(typeof a === 'string' ? a : a?.text, 200), done: !!a?.done})).filter(a => a.text).slice(0, 10);
const SELECT = `SELECT m.*,c.title AS course_title,s.name AS student_name,s.email AS student_email,i.name AS instructor_name FROM meetings m JOIN courses c ON c.id=m.course_id JOIN app_users s ON s.id=m.student_id JOIN app_users i ON i.id=m.instructor_id`;
const forStudent = m => ({id: m.id, course_id: m.course_id, course_title: m.course_title, instructor_name: m.instructor_name, requested_by: m.requested_by, topic: m.topic, request_note: m.request_note, preferred_at: m.preferred_at, scheduled_at: m.scheduled_at, status: m.status, kind: m.kind, held_at: m.held_at, decline_reason: m.decline_reason, created_at: m.created_at, ...(m.status === 'done' && m.published ? {summary: m.summary, actions: j(m.actions), next_at: m.next_at} : {})});
const full = m => ({...m, actions: j(m.actions), published: !!m.published});

// Recent counseling per student+course, used by the risk screens and admin quality.
export async function meetingStats(query, ownerId = null) {
 const rows = (await query(`SELECT m.student_id,m.course_id,m.instructor_id,m.status,coalesce(m.held_at,m.updated_at) AS at FROM meetings m JOIN courses c ON c.id=m.course_id WHERE c.deleted_at IS NULL AND ($1 IS NULL OR c.owner_id=$1)`, [ownerId])).rows;
 const last = new Map(), next = new Map();
 for (const r of rows) {
  const k = r.student_id + ':' + r.course_id;
  if (r.status === 'done' && (!last.has(k) || last.get(k) < r.at)) last.set(k, r.at);
  if (['requested', 'scheduled'].includes(r.status)) next.set(k, r.status);
 }
 return {rows, last, next};
}

export async function meetingsAPI({path, method, body, session, query, response, fail}) {
 if (!session) return fail('로그인이 필요합니다.', 401);
 let m;

 // ---------- 학생 ----------
 if (path.startsWith('/student/')) {
  if (session.role !== 'student') return fail('학생만 이용할 수 있습니다.', 403);
  const sid = session.id;
  if (path === '/student/meetings' && method === 'GET') {
   const courses = (await query(`SELECT c.id,c.title,c.owner_id,u.name AS instructor_name FROM courses c JOIN app_users u ON u.id=c.owner_id WHERE c.deleted_at IS NULL AND c.status<>'ended' AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) ORDER BY c.start_date`, [sid])).rows;
   const meetings = (await query(`${SELECT} WHERE m.student_id=$1 AND c.deleted_at IS NULL ORDER BY coalesce(m.scheduled_at,m.preferred_at,m.created_at) DESC`, [sid])).rows.map(forStudent);
   return response({courses: courses.map(({owner_id, ...c}) => c), meetings});
  }
  if (path === '/student/meetings' && method === 'POST') {
   const c = UUID.test(body.course_id || '') && (await query('SELECT id,title,owner_id FROM courses WHERE id=$1 AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(student_ids) WHERE value=$2)', [body.course_id, sid])).rows[0];
   if (!c) return fail('수강 중인 과정을 선택하세요.');
   const topic = str(body.topic, 200); if (!topic) return fail('면담 주제를 입력하세요.');
   const pref = when(body.preferred_at); if (pref === undefined) return fail('희망 일시를 확인하세요.');
   const open = (await query("SELECT count(*) AS n FROM meetings WHERE student_id=$1 AND status='requested'", [sid])).rows[0].n;
   if (Number(open) >= 3) return fail('대기 중인 신청이 3건 있습니다. 강사님 답변 후 다시 신청하세요.', 409);
   const id = randomUUID();
   await query('INSERT INTO meetings(id,course_id,student_id,instructor_id,requested_by,topic,request_note,preferred_at,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, c.id, sid, c.owner_id, 'student', topic, str(body.note, 2000), pref, KINDS.includes(body.kind) ? body.kind : 'study']);
   await notify(query, c.owner_id, `면담 신청: ${session.name} (${c.title})`, `${topic}${pref ? ` · 희망 ${new Date(pref).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}` : ''}`, '/teach/meetings', 'meeting');
   return response({id});
  }
  if ((m = path.match(/^\/student\/meetings\/([a-z0-9-]{3,60})\/(cancel|action)$/)) && method === 'POST') {
   const mt = (await query('SELECT * FROM meetings WHERE id=$1 AND student_id=$2', [m[1], sid])).rows[0];
   if (!mt) return fail('면담을 찾을 수 없습니다.', 404);
   if (m[2] === 'cancel') {
    if (!['requested', 'scheduled'].includes(mt.status)) return fail('이미 끝난 면담입니다.', 409);
    await query(`UPDATE meetings SET status='cancelled',updated_at=${NOWSQL} WHERE id=$1`, [mt.id]);
    await notify(query, mt.instructor_id, `면담 취소: ${session.name}`, mt.topic, '/teach/meetings', 'meeting');
    return response({ok: true});
   }
   if (mt.status !== 'done' || !mt.published) return fail('공개된 상담 내용이 아닙니다.', 409);
   const acts = j(mt.actions), i = Number(body.index);
   if (!Number.isInteger(i) || !acts[i]) return fail('할 일을 확인하세요.');
   acts[i].done = !!body.done;
   await query('UPDATE meetings SET actions=$1 WHERE id=$2', [JSON.stringify(acts), mt.id]);
   return response({ok: true, actions: acts});
  }
  return fail('요청한 기능을 찾을 수 없습니다.', 404);
 }

 // ---------- 강사 ----------
 if (!['instructor', 'admin'].includes(session.role)) return fail('강사만 접근할 수 있습니다.', 403);
 const admin = session.role === 'admin';
 const own = async id => { const mt = ID.test(id || '') && (await query(`${SELECT} WHERE m.id=$1`, [id])).rows[0]; return mt && (admin || mt.instructor_id === session.id) ? mt : null; };
 const ownCourse = async (cid, sid) => { const c = UUID.test(cid || '') && (await query('SELECT id,title,owner_id,student_ids FROM courses WHERE id=$1 AND deleted_at IS NULL', [cid])).rows[0]; if (!c || (!admin && c.owner_id !== session.id)) return null; return j(c.student_ids).includes(sid) ? c : null; };

 if (path === '/instructor/meetings' && method === 'GET') {
  const meetings = (await query(`${SELECT} WHERE c.deleted_at IS NULL ${admin ? '' : 'AND c.owner_id=$1'} ORDER BY coalesce(m.scheduled_at,m.preferred_at,m.created_at) DESC`, admin ? [] : [session.id])).rows.map(full);
  const risk = await computeRisk(query, admin ? null : session.id), {last, next} = await meetingStats(query, admin ? null : session.id);
  const roster = risk.students.map(s => ({student_id: s.student_id, student_name: s.student_name, course_id: s.course_id, course_title: s.course_title, level: s.level, reasons: s.reasons.map(r => r.label), counseled_at: last.get(s.student_id + ':' + s.course_id) || null, pending: next.get(s.student_id + ':' + s.course_id) || null}));
  const students = (await query(`SELECT c.id AS course_id,c.title AS course_title,u.id AS student_id,u.name AS student_name FROM courses c, json_each(c.student_ids) jj JOIN app_users u ON u.id=jj.value WHERE c.deleted_at IS NULL AND c.status<>'ended' ${admin ? '' : 'AND c.owner_id=$1'} ORDER BY c.title,u.name`, admin ? [] : [session.id])).rows;
  return response({meetings, roster, students});
 }
 // Instructor-initiated: schedule a meeting, or (with log) record one that already happened.
 if (path === '/instructor/meetings' && method === 'POST') {
  const c = await ownCourse(body.course_id, body.student_id);
  if (!c) return fail('담당 과정의 학생인지 확인하세요.', 404);
  const topic = str(body.topic, 200) || '면담'; const at = when(body.scheduled_at); if (at === undefined) return fail('일시를 확인하세요.');
  const id = randomUUID();
  await query('INSERT INTO meetings(id,course_id,student_id,instructor_id,requested_by,topic,scheduled_at,status,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, c.id, body.student_id, c.owner_id, 'instructor', topic, at || new Date().toISOString(), 'scheduled', KINDS.includes(body.kind) ? body.kind : 'study']);
  if (body.notify !== false && at) await notify(query, body.student_id, `면담 일정 안내 (${c.title})`, `${topic} · ${new Date(at).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}`, '/learn/meetings', 'meeting');
  return response({id});
 }
 if ((m = path.match(/^\/instructor\/meetings\/([a-z0-9-]{3,60})\/(schedule|decline|log)$/)) && method === 'POST') {
  const mt = await own(m[1]);
  if (!mt) return fail('면담을 찾을 수 없습니다.', 404);
  if (m[2] === 'schedule') {
   const at = when(body.scheduled_at); if (!at) return fail('면담 일시를 입력하세요.');
   if (!['requested', 'scheduled'].includes(mt.status)) return fail('이미 끝난 면담입니다.', 409);
   await query(`UPDATE meetings SET status='scheduled',scheduled_at=$1,updated_at=${NOWSQL} WHERE id=$2`, [at, mt.id]);
   await notify(query, mt.student_id, `${mt.status === 'requested' ? '면담 확정' : '면담 일정 변경'} (${mt.course_title})`, `${mt.topic} · ${new Date(at).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}${body.message ? ` · ${str(body.message, 300)}` : ''}`, '/learn/meetings', 'meeting');
   return response({ok: true});
  }
  if (m[2] === 'decline') {
   if (mt.status !== 'requested') return fail('대기 중인 신청만 거절할 수 있습니다.', 409);
   await query(`UPDATE meetings SET status='declined',decline_reason=$1,updated_at=${NOWSQL} WHERE id=$2`, [str(body.reason, 500), mt.id]);
   await notify(query, mt.student_id, `면담 신청 답변 (${mt.course_title})`, `${mt.topic} · ${str(body.reason, 300) || '다른 방법으로 안내드릴게요.'}`, '/learn/meetings', 'meeting');
   return response({ok: true});
  }
  // log: write or edit the counseling record
  const held = when(body.held_at) || mt.scheduled_at || new Date().toISOString();
  const next = when(body.next_at); if (next === undefined) return fail('다음 면담일을 확인하세요.');
  const summary = str(body.summary, 4000), note = str(body.private_note, 8000);
  if (!summary && !note) return fail('상담 내용을 입력하세요.');
  const published = body.published === true && !!summary ? 1 : 0, actions = cleanActions(body.actions);
  await query(`UPDATE meetings SET status='done',held_at=$1,kind=$2,private_note=$3,summary=$4,actions=$5,published=$6,next_at=$7,topic=$8,updated_at=${NOWSQL} WHERE id=$9`, [held, KINDS.includes(body.kind) ? body.kind : mt.kind, note, summary, JSON.stringify(actions), published, next, str(body.topic, 200) || mt.topic, mt.id]);
  let followUp = null;
  if (next && mt.status !== 'done') { // first time logged: book the follow-up automatically
   followUp = randomUUID();
   await query('INSERT INTO meetings(id,course_id,student_id,instructor_id,requested_by,topic,scheduled_at,status,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [followUp, mt.course_id, mt.student_id, mt.instructor_id, 'instructor', `후속 면담: ${mt.topic}`.slice(0, 200), next, 'scheduled', KINDS.includes(body.kind) ? body.kind : mt.kind]);
  }
  if (published && !mt.published) await notify(query, mt.student_id, `면담 요약이 공유되었습니다 (${mt.course_title})`, `${mt.topic}${actions.length ? ` · 할 일 ${actions.length}개` : ''}`, '/learn/meetings', 'meeting');
  if (mt.status !== 'done') await logActivity(query, session.id, 'student.counsel', mt.course_title, {student_id: mt.student_id, meeting: mt.id});
  return response({ok: true, follow_up: followUp});
 }
 return fail('요청한 기능을 찾을 수 없습니다.', 404);
}
