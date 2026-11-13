// Admin operations overview: instructors, students and assessment operations across all courses.
const pct = v => v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10;
export async function adminOverviewAPI({method, session, query, response, fail}) {
 if (!session) return fail('로그인이 필요합니다.', 401);
 if (session.role !== 'admin') return fail('관리자만 접근할 수 있습니다.', 403);
 if (method !== 'GET') return fail('허용되지 않는 요청입니다.', 405);
 const live = 'c.deleted_at IS NULL';
 const instructors = (await query(`SELECT u.id,u.name,u.email,u.role,u.active,
  (SELECT count(*) FROM courses c WHERE c.owner_id=u.id AND ${live}) AS courses,
  (SELECT count(DISTINCT j.value) FROM courses c, json_each(c.student_ids) j WHERE c.owner_id=u.id AND ${live}) AS students,
  (SELECT count(*) FROM assessments a JOIN courses c ON c.id=a.course_id WHERE c.owner_id=u.id AND ${live}) AS assessments,
  (SELECT count(*) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE c.owner_id=u.id AND ${live}) AS submissions,
  (SELECT count(*) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE c.owner_id=u.id AND ${live} AND r.grading_status<>'confirmed') AS pending
  FROM app_users u WHERE u.role='instructor' OR EXISTS(SELECT 1 FROM courses c WHERE c.owner_id=u.id AND ${live})
  ORDER BY u.name`)).rows;
 const courses = (await query(`SELECT c.id,c.title,c.status,c.start_date,c.end_date,c.created_at,u.name AS owner_name,
  (SELECT count(*) FROM assessments a WHERE a.course_id=c.id) AS assessments,
  (SELECT count(*) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=c.id AND r.grading_status<>'confirmed') AS pending,json_array_length(c.student_ids) AS enrolled,
  (SELECT count(*) FROM assessments a WHERE a.course_id=c.id AND a.published=1) AS published_assessments,
  (SELECT count(*) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=c.id AND a.published=1) AS taken,
  (SELECT avg(r.score*100.0/r.total) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=c.id AND r.grading_status='confirmed') AS average
  FROM courses c JOIN app_users u ON u.id=c.owner_id WHERE ${live} ORDER BY c.created_at DESC,c.title`)).rows
  .map(c => ({...c, average: pct(c.average), participation: c.enrolled && c.published_assessments ? pct(c.taken * 100 / (c.enrolled * c.published_assessments)) : null}));
 const students = (await query(`SELECT u.id,u.name,u.email,u.active,
  (SELECT count(*) FROM courses c, json_each(c.student_ids) j WHERE j.value=u.id AND ${live}) AS courses,
  (SELECT count(*) FROM assessments a JOIN courses c ON c.id=a.course_id, json_each(c.student_ids) j WHERE j.value=u.id AND ${live} AND a.published=1) AS assigned,
  (SELECT count(*) FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE r.student_id=u.id AND a.published=1) AS taken,
  (SELECT avg(r.score*100.0/r.total) FROM assessment_results r WHERE r.student_id=u.id AND r.grading_status='confirmed') AS average
  FROM app_users u WHERE u.role='student' ORDER BY u.name`)).rows
  .map(s => ({...s, average: pct(s.average)}));
 const assessments = (await query(`SELECT a.id,a.title,a.kind,a.week,a.published,c.title AS course_title,c.start_date AS course_start,c.end_date AS course_end,u.id AS owner_id,u.name AS owner_name,
  json_array_length(c.student_ids) AS enrolled,
  (SELECT count(*) FROM json_each(a.questions) q WHERE json_extract(q.value,'$.type')='text') AS text_questions,
  count(r.id) AS takers,
  coalesce(sum(r.grading_status='confirmed'),0) AS confirmed,
  coalesce(sum(r.grading_status='review'),0) AS review,
  coalesce(sum(r.grading_status='pending'),0) AS pending,
  avg(CASE WHEN r.grading_status='confirmed' THEN r.score*100.0/r.total END) AS average
  FROM assessments a JOIN courses c ON c.id=a.course_id JOIN app_users u ON u.id=c.owner_id
  LEFT JOIN assessment_results r ON r.assessment_id=a.id
  WHERE ${live} GROUP BY a.id ORDER BY u.name,c.title,a.week,a.title`)).rows
  .map(a => ({...a, average: pct(a.average), not_taken: Math.max(0, a.enrolled - a.takers)}));
 const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
 const confirmedAverages = students.filter(s => s.average !== null);
 const summary = {
  instructors: instructors.filter(i => i.role === 'instructor').length,
  students: students.length,
  active_students: students.filter(s => s.active).length,
  courses: courses.length,
  assessments: assessments.length,
  published_assessments: assessments.filter(a => a.published).length,
  submissions: sum(assessments, 'takers'),
  pending: sum(assessments, 'pending'),
  review: sum(assessments, 'review'),
  participation: sum(students, 'assigned') ? pct(sum(students, 'taken') * 100 / sum(students, 'assigned')) : null,
  average: confirmedAverages.length ? pct(confirmedAverages.reduce((s, x) => s + x.average, 0) / confirmedAverages.length) : null,
 };
 return response({summary, instructors, courses, students, assessments});
}

// Operations schedule for a Gantt timeline: admins see every course, instructors the courses they teach,
// students the courses they are enrolled in (published assessments only).
export async function scheduleAPI({path, method, session, query, response, fail}) {
 if (!session) return fail('로그인이 필요합니다.', 401);
 if (method !== 'GET') return fail('허용되지 않는 요청입니다.', 405);
 const scope = path.split('/')[1];
 if (scope === 'admin' && session.role !== 'admin') return fail('관리자만 접근할 수 있습니다.', 403);
 if (scope === 'instructor' && !['admin', 'instructor'].includes(session.role)) return fail('강사만 접근할 수 있습니다.', 403);
 const where = scope === 'admin' ? '' : scope === 'instructor' ? ' AND c.owner_id=$1' : ' AND EXISTS(SELECT 1 FROM json_each(c.student_ids) j WHERE j.value=$1)';
 const params = scope === 'admin' ? [] : [session.id];
 const courses = (await query(`SELECT c.id,c.title,c.status,c.start_date,c.end_date,u.name AS owner_name,json_array_length(c.student_ids) AS enrolled
  FROM courses c JOIN app_users u ON u.id=c.owner_id WHERE c.deleted_at IS NULL${where} ORDER BY coalesce(c.start_date,'9999'),c.title`, params)).rows;
 const ids = new Set(courses.map(c => c.id));
 const modules = (await query(`SELECT course_id,week,title FROM course_modules ORDER BY week`)).rows.filter(m => ids.has(m.course_id));
 const assessments = (await query(`SELECT course_id,title,kind,week,opens_at,closes_at,published FROM assessments ORDER BY week`)).rows
  .filter(a => ids.has(a.course_id) && (scope !== 'student' || a.published));
 // Meetings on the timeline: scheduled or held. Students see only their own.
 const meets = (await query(`SELECT m.course_id,m.topic,m.status,coalesce(m.held_at,m.scheduled_at) AS at,u.name AS student_name FROM meetings m JOIN app_users u ON u.id=m.student_id WHERE m.status IN ('scheduled','done') AND coalesce(m.held_at,m.scheduled_at) IS NOT NULL${scope === 'student' ? ' AND m.student_id=$1' : ''}`, scope === 'student' ? [session.id] : [])).rows.filter(x => ids.has(x.course_id));
 return response({courses: courses.map(c => ({...c, modules: modules.filter(m => m.course_id === c.id).map(({week, title}) => ({week, title})), assessments: assessments.filter(a => a.course_id === c.id).map(({course_id, ...a}) => a), meetings: meets.filter(x => x.course_id === c.id).map(({course_id, ...x}) => x)}))});
}
