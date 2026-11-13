// Course completion certificates: eligibility, auto-issue after a course ends, manual issue/revoke,
// and public verification by certificate number (QR code on the certificate links to /verify/<no>).
import {randomUUID, randomInt} from 'node:crypto';
import {logActivity, notify} from './ops.mjs';

export const PASS_AVERAGE = 60;
const UUID = /^[a-f0-9-]{36}$/;
const CERT_NO = /^GCL-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const NOWSQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const j = v => typeof v === 'string' ? JSON.parse(v || '[]') : (v || []);
const r1 = v => Math.round(v * 10) / 10;
export const kstToday = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
export function letterGrade(avg) {
 for (const [min, g] of [[95, 'A+'], [90, 'A'], [85, 'B+'], [80, 'B'], [75, 'C+'], [70, 'C'], [65, 'D+'], [60, 'D']]) if (avg >= min) return g;
 return 'F';
}
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chunk = () => Array.from({length: 4}, () => ALPHA[randomInt(ALPHA.length)]).join('');
const newCertNo = date => `GCL-${String(date).slice(0, 4)}-${chunk()}-${chunk()}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Rule: the course has ended, the student took every published assessment, and the average is at least 60.
async function courseStatus(query, course) {
 const today = kstToday(), ended = !!course.end_date && course.end_date < today;
 const exams = (await query('SELECT id FROM assessments WHERE course_id=$1 AND published=1', [course.id])).rows;
 const rows = (await query('SELECT r.student_id,r.assessment_id,r.score,r.total FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=$1 AND a.published=1', [course.id])).rows;
 const ids = j(course.student_ids);
 const names = new Map(ids.length ? (await query(`SELECT id,name,email FROM app_users WHERE id IN (SELECT value FROM json_each($1))`, [JSON.stringify(ids)])).rows.map(u => [u.id, u]) : []);
 const certs = new Map((await query('SELECT * FROM certificates WHERE course_id=$1', [course.id])).rows.map(c => [c.student_id, c]));
 const students = ids.filter(id => names.has(id)).map(id => {
  const mine = rows.filter(r => r.student_id === id), taken = new Set(mine.map(r => r.assessment_id)).size;
  const average = mine.length ? r1(mine.reduce((a, r) => a + (r.total ? r.score / r.total * 100 : 0), 0) / mine.length) : 0;
  const tookAll = exams.length > 0 && taken >= exams.length;
  return {id, name: names.get(id).name, email: names.get(id).email, taken, required: exams.length, average, grade: letterGrade(average), took_all: tookAll, passed: average >= PASS_AVERAGE, eligible: ended && tookAll && average >= PASS_AVERAGE, certificate: certs.get(id) || null};
 });
 return {ended, today, required: exams.length, students};
}

async function insertCert(query, course, s, {method, by}) {
 const completed = course.end_date && course.end_date < kstToday() ? course.end_date : kstToday();
 for (let i = 0; i < 5; i++) {
  const row = (await query(`INSERT INTO certificates(id,cert_no,course_id,student_id,student_name,course_title,average,grade,completed_on,method,issued_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(course_id,student_id) DO NOTHING RETURNING *`,
   [randomUUID(), newCertNo(completed), course.id, s.id, s.name, course.title, s.average, s.grade, completed, method, by || null]).catch(e => { if (/cert_no/.test(e.message)) return {rows: null}; throw e; })).rows;
  if (row === null) continue; // certificate number collision, try another
  if (row[0]) await notify(query, s.id, `수료증이 발급되었습니다: ${course.title}`, `수료증 번호 ${row[0].cert_no}. PDF와 이미지로 내려받을 수 있습니다.`, '/learn/certificates', 'success');
  return row[0] || null;
 }
 throw new Error('수료증 번호를 만들지 못했습니다.');
}

// Issue certificates for everyone who qualifies in ended courses. Revoked rows are kept, so they are not re-issued.
async function autoIssue(query, courses) {
 for (const c of courses) {
  if (!c.end_date || c.end_date >= kstToday()) continue;
  const st = await courseStatus(query, c);
  for (const s of st.students) if (s.eligible && !s.certificate) await insertCert(query, c, s, {method: 'auto'});
 }
}

const certView = c => c && ({id: c.id, cert_no: c.cert_no, student_name: c.student_name, course_title: c.course_title, average: c.average, grade: c.grade, completed_on: c.completed_on, method: c.method, issued_at: c.issued_at, revoked_at: c.revoked_at, revoke_reason: c.revoke_reason});
const COURSE_COLS = 'c.id,c.title,c.start_date,c.end_date,c.owner_id,c.student_ids';

export async function certsAPI({path, method, body, session, query, response, fail}) {
 const verify = path.match(/^\/certificates\/verify\/([A-Z0-9-]{1,40})$/);
 if (verify && method === 'GET') {
  const c = await findCert(query, verify[1]);
  return c ? response({valid: !c.revoked_at, certificate: {cert_no: c.cert_no, student_name: c.student_name, course_title: c.course_title, average: c.average, grade: c.grade, completed_on: c.completed_on, issued_at: c.issued_at, revoked_at: c.revoked_at, instructor: c.instructor}}): response({valid: false, certificate: null}, 404);
 }
 if (!session) return fail('로그인이 필요합니다.', 401);

 if (path === '/student/certificates' && method === 'GET') {
  const courses = (await query(`SELECT ${COURSE_COLS},u.name AS instructor FROM courses c LEFT JOIN app_users u ON u.id=c.owner_id WHERE c.deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) ORDER BY c.end_date`, [session.id])).rows;
  await autoIssue(query, courses);
  const out = [];
  for (const c of courses) {
   const st = await courseStatus(query, c), me = st.students.find(s => s.id === session.id);
   if (!me) continue;
   out.push({course_id: c.id, title: c.title, start_date: c.start_date, end_date: c.end_date, instructor: c.instructor, ended: st.ended, taken: me.taken, required: me.required, average: me.average, grade: me.grade, took_all: me.took_all, passed: me.passed, certificate: me.certificate && !me.certificate.revoked_at ? {...certView(me.certificate), instructor: c.instructor} : null, revoked: !!me.certificate?.revoked_at});
  }
  return response({pass_average: PASS_AVERAGE, today: kstToday(), courses: out});
 }

 if (/^\/(instructor|admin)\/certificates(\/|$)/.test(path)) {
  if (!['instructor', 'admin'].includes(session.role)) return fail('강사 또는 관리자만 접근할 수 있습니다.', 403);
  if (path.startsWith('/admin/') && session.role !== 'admin') return fail('관리자만 접근할 수 있습니다.', 403);
  const admin = session.role === 'admin';
  const owned = async () => (await query(`SELECT ${COURSE_COLS},u.name AS instructor FROM courses c LEFT JOIN app_users u ON u.id=c.owner_id WHERE c.deleted_at IS NULL ${admin && path.startsWith('/admin/') ? '' : 'AND c.owner_id=$1'} ORDER BY c.end_date`, admin && path.startsWith('/admin/') ? [] : [session.id])).rows;

  if (path === '/instructor/certificates' && method === 'GET') {
   const courses = await owned(); await autoIssue(query, courses);
   const list = [];
   for (const c of courses) { const st = await courseStatus(query, c); list.push({id: c.id, title: c.title, start_date: c.start_date, end_date: c.end_date, ended: st.ended, required: st.required, students: st.students.map(s => ({...s, certificate: certView(s.certificate)}))}); }
   return response({pass_average: PASS_AVERAGE, today: kstToday(), courses: list, instructor: session.name});
  }
  if (path === '/admin/certificates' && method === 'GET') {
   const courses = await owned(); await autoIssue(query, courses);
   const certs = (await query(`SELECT t.*,u.name AS instructor,s.email AS student_email FROM certificates t JOIN courses c ON c.id=t.course_id LEFT JOIN app_users u ON u.id=c.owner_id LEFT JOIN app_users s ON s.id=t.student_id ORDER BY t.issued_at DESC`)).rows;
   const stats = [];
   for (const c of courses) { const st = await courseStatus(query, c); stats.push({id: c.id, title: c.title, instructor: c.instructor, end_date: c.end_date, ended: st.ended, students: st.students.length, eligible: st.students.filter(s => s.eligible).length, issued: st.students.filter(s => s.certificate && !s.certificate.revoked_at).length}); }
   return response({pass_average: PASS_AVERAGE, today: kstToday(), certificates: certs.map(c => ({...certView(c), instructor: c.instructor, student_email: c.student_email, course_id: c.course_id})), courses: stats});
  }
  const canManage = async courseId => { const c = (await query(`SELECT ${COURSE_COLS},u.name AS instructor FROM courses c LEFT JOIN app_users u ON u.id=c.owner_id WHERE c.id=$1 AND c.deleted_at IS NULL`, [courseId])).rows[0]; return c && (admin || c.owner_id === session.id) ? c : null; };
  if (path === '/instructor/certificates/issue' && method === 'POST') {
   if (!UUID.test(body.course_id || '') || !UUID.test(body.student_id || '')) return fail('과정과 학생을 확인하세요.');
   const c = await canManage(body.course_id); if (!c) return fail('수료증을 발급할 수 없는 과정입니다.', 403);
   const st = await courseStatus(query, c), s = st.students.find(x => x.id === body.student_id);
   if (!s) return fail('과정에 등록된 학생이 아닙니다.', 404);
   if (s.certificate) return fail('이미 수료증이 있습니다. 취소된 수료증은 복구하세요.', 409);
   const cert = await insertCert(query, c, s, {method: 'manual', by: session.id});
   await logActivity(query, session.id, 'cert.issue', cert.cert_no, {course: c.title, student: s.name, eligible: s.eligible});
   return response({certificate: certView(cert)}, 201);
  }
  const act = path.match(/^\/instructor\/certificates\/([a-f0-9-]{36})\/(revoke|restore)$/);
  if (act && method === 'POST') {
   const cert = (await query('SELECT * FROM certificates WHERE id=$1', [act[1]])).rows[0];
   if (!cert || !await canManage(cert.course_id)) return fail('수료증을 찾을 수 없습니다.', 404);
   if (act[2] === 'revoke') {
    const reason = String(body.reason || '').trim().slice(0, 300); if (!reason) return fail('취소 사유를 입력하세요.');
    await query(`UPDATE certificates SET revoked_at=${NOWSQL},revoked_by=$2,revoke_reason=$3 WHERE id=$1`, [cert.id, session.id, reason]);
    await notify(query, cert.student_id, `수료증이 취소되었습니다: ${cert.course_title}`, reason, '/learn/certificates', 'warning');
   } else {
    await query('UPDATE certificates SET revoked_at=NULL,revoked_by=NULL,revoke_reason=NULL WHERE id=$1', [cert.id]);
    await notify(query, cert.student_id, `수료증이 다시 유효해졌습니다: ${cert.course_title}`, `수료증 번호 ${cert.cert_no}`, '/learn/certificates', 'success');
   }
   await logActivity(query, session.id, 'cert.' + act[2], cert.cert_no, {course: cert.course_title, student: cert.student_name});
   return response({ok: true});
  }
 }
 return fail('요청한 기능을 찾을 수 없습니다.', 404);
}

async function findCert(query, no) {
 if (!CERT_NO.test(no)) return null;
 return (await query('SELECT t.*,u.name AS instructor FROM certificates t JOIN courses c ON c.id=t.course_id LEFT JOIN app_users u ON u.id=c.owner_id WHERE t.cert_no=$1', [no])).rows[0] || null;
}

// Public verification page (server-rendered, no login). The certificate itself is redrawn by /cert.js.
export async function verifyPage(query, no) {
 const c = await findCert(query, String(no || '').toUpperCase());
 const status = !c ? ['none', '확인되지 않은 수료증', '이 번호로 발급된 수료증이 없습니다. 번호를 다시 확인하세요.'] : c.revoked_at ? ['revoked', '취소된 수료증', '이 수료증은 발급 기관에서 취소하여 더 이상 유효하지 않습니다.'] : ['valid', '유효한 수료증', 'GAP CODING LAB 배움길 LMS에서 발급한 정식 수료증입니다.'];
 const date = d => d ? d.replace(/-/g, '. ') + '.' : '-';
 const rows = c ? [['수료자', c.student_name], ['과정', c.course_title], ['수료일', date(c.completed_on)], ['성적', `${c.grade} (${c.average})`], ['수료증 번호', c.cert_no], ['강사', c.instructor || '-'], ['발급일', date(c.issued_at.slice(0, 10))]] : [['조회한 번호', no]];
 const data = c ? ` data-no="${esc(c.cert_no)}" data-name="${esc(c.student_name)}" data-course="${esc(c.course_title)}" data-date="${esc(c.completed_on)}" data-grade="${esc(c.grade)}" data-average="${esc(c.average)}" data-revoked="${c.revoked_at ? '1' : ''}"` : '';
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>수료증 확인 · 배움길 LMS</title><link rel="icon" type="image/png" href="/images/profile_logo.png"><link rel="stylesheet" href="/verify.css"><script src="/vendor/qrcode.js" defer></script><script src="/cert.js" defer></script><script src="/verify.js" defer></script></head>
<body><main class="vf"><div class="vf-brand"><img src="/images/profile_logo.png" alt="" width="36" height="36"><span>배움길 <b>LMS</b></span><small>수료증 진위 확인</small></div>
<section class="vf-card vf-${status[0]}"><div class="vf-status"><span class="vf-mark" aria-hidden="true">${status[0] === 'valid' ? '✓' : status[0] === 'revoked' ? '!' : '?'}</span><div><h1>${status[1]}</h1><p>${status[2]}${c?.revoked_at ? ` (취소일 ${date(c.revoked_at.slice(0, 10))})` : ''}</p></div></div>
<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
${c ? `<section class="vf-preview"><canvas id="vf-cert"${data} aria-label="수료증 이미지"></canvas></section>` : ''}
<p class="vf-foot">이 페이지는 수료증의 QR 코드로 열립니다. 문의: 배움길 LMS 운영팀</p></main></body></html>`;
}
