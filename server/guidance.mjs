import {generate} from './ai.mjs';
export async function guidanceAPI({path,method,body,session,query,response,fail}){
 if(!session)return fail('로그인이 필요합니다.',401);
 if(path==='/student/guidance'){
  if(method!=='GET')return fail('허용되지 않는 요청입니다.',405);
  return response({guidance:(await query(`SELECT g.content,g.updated_at,c.title AS course_title,u.name AS instructor_name FROM learning_guidance g JOIN courses c ON c.id=g.course_id JOIN app_users u ON u.id=g.updated_by WHERE g.student_id=$1 AND g.published=true AND c.deleted_at IS NULL AND c.student_ids @> $2::jsonb ORDER BY g.updated_at DESC`,[session.id,JSON.stringify([session.id])])).rows});
 }
 if(!['instructor','admin'].includes(session.role))return fail('강사만 접근할 수 있습니다.',403);
 if(path==='/instructor/guidance'&&method==='GET')return response({learners:(await query(`SELECT c.id AS course_id,c.title AS course_title,u.id AS student_id,u.name AS student_name,g.content,g.published,g.revision,g.updated_at FROM courses c JOIN app_users u ON c.student_ids @> jsonb_build_array(u.id::text) LEFT JOIN learning_guidance g ON g.course_id=c.id AND g.student_id=u.id WHERE c.deleted_at IS NULL AND (c.owner_id=$1 OR $2=true) AND u.role='student' AND u.active=true ORDER BY c.title,u.name`,[session.id,session.role==='admin'])).rows});
 if(!['/instructor/guidance','/instructor/guidance/generate'].includes(path)||method!=='POST')return fail('허용되지 않는 요청입니다.',405);
 if(![body.course_id,body.student_id].every(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)))return fail('과정과 학생을 선택하세요.');
 const target=(await query(`SELECT c.id,u.name,u.email FROM courses c JOIN app_users u ON u.id=$2 AND c.student_ids @> jsonb_build_array(u.id::text) WHERE c.id=$1 AND c.deleted_at IS NULL AND (c.owner_id=$3 OR $4=true) AND u.role='student' AND u.active=true`,[body.course_id,body.student_id,session.id,session.role==='admin'])).rows[0];
 if(!target)return fail('담당 과정의 수강생을 찾을 수 없습니다.',404);
 if(path.endsWith('/generate')){
  if(body.privacyChecked!==true)return fail('AI 전송 항목을 확인하세요.');
  const setting=(await query('SELECT * FROM ai_settings WHERE id=1')).rows[0];if(!setting?.enabled)return fail('관리자가 AI 설정을 활성화해야 합니다.',503);
  const rows=(await query(`SELECT r.score,r.total,r.questions,r.answers,r.grading,a.week,a.kind FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=$1 AND r.student_id=$2 AND r.grading_status='confirmed' ORDER BY r.submitted_at DESC LIMIT 10`,[body.course_id,body.student_id])).rows;
  if(!rows.length)return fail('확정된 성적이 있어야 AI 학습 방향을 작성할 수 있습니다.');
  const limit=await query("INSERT INTO auth_limits(key,hits,expires_at) VALUES('ai-guidance',1,now()+interval '10 seconds') ON CONFLICT(key) DO UPDATE SET hits=1,expires_at=now()+interval '10 seconds' WHERE auth_limits.expires_at<now() RETURNING hits");if(!limit.rows.length)return fail('잠시 후 다시 작성하세요.',429);
  const redact=v=>String(v||'').replaceAll(target.name,'[이름 제외]').replaceAll(target.email,'[이메일 제외]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 제외]').replace(/01[016789][- ]?\d{3,4}[- ]?\d{4}/g,'[연락처 제외]');
  const evaluations=rows.map(r=>({week:r.week,kind:r.kind,score:r.score,total:r.total,concepts:r.questions.map((q,i)=>({concept:redact(q.tag||'미분류'),type:q.type==='text'?'text':'choice',points:q.points,earned:q.type==='text'?r.grading?.[i]?.score:(r.answers?.[i]===q.answer?q.points:0)}))}));
  try{const result=await generate(setting,{task:'learning_guidance',maxPoints:0,evaluations});return response({content:result.feedback});}catch(e){return fail(e.message,e.status||502);}
 }
 if(typeof body.content!=='string'||!body.content.trim()||body.content.length>8000||typeof body.published!=='boolean'||!Number.isInteger(body.revision)||body.revision<0)return fail('학습 방향(1~8000자)과 공개 상태를 확인하세요.');
 const params=[body.course_id,body.student_id,body.content.trim(),body.published,session.id,body.revision];
 const saved=body.revision===0?await query(`INSERT INTO learning_guidance(course_id,student_id,content,published,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING revision,updated_at`,params.slice(0,5)):await query(`UPDATE learning_guidance SET content=$3,published=$4,updated_by=$5,updated_at=now(),revision=revision+1 WHERE course_id=$1 AND student_id=$2 AND revision=$6 RETURNING revision,updated_at`,params);
 if(!saved.rows.length)return fail('다른 곳에서 수정되었습니다. 목록을 다시 열어 확인하세요.',409);
 return response({ok:true,...saved.rows[0]});
}
