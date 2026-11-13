export async function resultsAPI({path,method,session,query,response,fail}){
 if(!session)return fail('로그인이 필요합니다.',401);
 if(method!=='GET')return fail('허용되지 않는 요청입니다.',405);
 const teacher=path.startsWith('/instructor/');
 if(teacher&&!['admin','instructor'].includes(session.role))return fail('강사만 접근할 수 있습니다.',403);
 const match=path.match(/\/results\/([a-f0-9-]{36})$/);
 const scope=teacher?'(c.owner_id=$1 OR $2=true)':'r.student_id=$1';
 const params=teacher?[session.id,session.role==='admin']:[session.id];
 if(match){params.push(match[1]);}
 const rows=(await query(`SELECT r.id,r.assessment_id,r.student_id,r.score,r.total,r.submitted_at,r.duration_seconds,r.grading_status,r.revision,
 a.title,a.kind,a.week,c.title AS course_title,c.start_date AS course_start,c.end_date AS course_end,u.name AS student_name
 ${match?',r.questions,r.answers,r.grading':''}
 FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id JOIN app_users u ON u.id=r.student_id
 WHERE ${scope}${match?' AND r.id=$'+params.length:''} ORDER BY r.submitted_at DESC,u.name`,params)).rows;
 for(const r of rows){if(!teacher){if(r.grading_status!=='confirmed'){r.score=null;if(r.grading)r.grading=r.grading.map(g=>g.status==='confirmed'?{score:g.score,status:g.status}:{status:'pending'});}else if(r.grading)r.grading=r.grading.map(g=>({score:g.score,status:g.status,feedback:g.feedback}));}}
 if(match)return rows.length?response({result:rows[0]}):fail('성적을 찾을 수 없습니다.',404);
 return response({results:rows});
}
