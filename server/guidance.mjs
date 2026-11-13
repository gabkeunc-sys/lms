import {generate} from './ai.mjs';
import {logActivity,meteredAI} from './ops.mjs';
import {NOW,nowPlus} from './db.mjs';
import {randomUUID} from 'node:crypto';
export async function guidanceAPI({path,method,body,session,query,response,fail}){
 if(!session)return fail('로그인이 필요합니다.',401);
 if(path==='/student/guidance'){
  if(method!=='GET')return fail('허용되지 않는 요청입니다.',405);
  return response({guidance:(await query(`SELECT g.course_id,g.content,g.updated_at,c.title AS course_title,c.start_date AS course_start,c.end_date AS course_end,u.name AS instructor_name FROM learning_guidance g JOIN courses c ON c.id=g.course_id JOIN app_users u ON u.id=g.updated_by WHERE g.student_id=$1 AND g.published=1 AND c.deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) ORDER BY g.updated_at DESC`,[session.id])).rows});
 }
 if(!['instructor','admin'].includes(session.role))return fail('강사만 접근할 수 있습니다.',403);
 // Instruction documents (Markdown) used to steer AI drafts; several can be registered, e.g. one per course.
 if(path==='/instructor/guidance/prompts'){
  if(method==='GET')return response({prompts:(await query(`SELECT p.id,p.title,p.content,p.course_id,p.is_default,p.updated_at,c.title AS course_title,c.start_date AS course_start,c.end_date AS course_end,u.name AS author_name FROM guidance_prompts p LEFT JOIN courses c ON c.id=p.course_id LEFT JOIN app_users u ON u.id=p.created_by WHERE p.deleted_at IS NULL ORDER BY p.is_default DESC,p.updated_at DESC`)).rows});
  if(method!=='POST')return fail('허용되지 않는 요청입니다.',405);
  if(body.delete===true){if(typeof body.id!=='string')return fail('지시문을 선택하세요.');const r=await query(`UPDATE guidance_prompts SET deleted_at=${NOW} WHERE id=$1 AND is_default=0 AND deleted_at IS NULL RETURNING id`,[body.id]);return r.rows.length?response({ok:true}):fail('기본 지시문은 삭제할 수 없습니다.',400);}
  if(typeof body.title!=='string'||!body.title.trim()||body.title.length>120||typeof body.content!=='string'||!body.content.trim()||body.content.length>20000)return fail('지시문 제목(1~120자)과 내용(1~20000자)을 입력하세요.');
  const courseId=body.course_id||null;
  if(courseId&&!(await query('SELECT 1 FROM courses WHERE id=$1 AND deleted_at IS NULL',[courseId])).rows.length)return fail('과정을 찾을 수 없습니다.',404);
  const r=body.id?await query(`UPDATE guidance_prompts SET title=$1,content=$2,course_id=$3,updated_at=${NOW} WHERE id=$4 AND deleted_at IS NULL RETURNING id`,[body.title.trim(),body.content,courseId,body.id]):await query('INSERT INTO guidance_prompts(id,title,content,course_id,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[randomUUID(),body.title.trim(),body.content,courseId,session.id]);
  return r.rows.length?response({ok:true,id:r.rows[0].id}):fail('지시문을 찾을 수 없습니다.',404);
 }
 if(path==='/instructor/guidance'&&method==='GET')return response({learners:(await query(`SELECT c.id AS course_id,c.title AS course_title,c.start_date AS course_start,c.end_date AS course_end,u.id AS student_id,u.name AS student_name,g.content,g.published,g.revision,g.updated_at FROM courses c JOIN app_users u ON EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=u.id) LEFT JOIN learning_guidance g ON g.course_id=c.id AND g.student_id=u.id WHERE c.deleted_at IS NULL AND (c.owner_id=$1 OR $2=true) AND u.role='student' AND u.active=true ORDER BY c.title,u.name`,[session.id,session.role==='admin'])).rows});
 if(!['/instructor/guidance','/instructor/guidance/generate'].includes(path)||method!=='POST')return fail('허용되지 않는 요청입니다.',405);
 if(![body.course_id,body.student_id].every(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)))return fail('과정과 학생을 선택하세요.');
 const target=(await query(`SELECT c.id,u.name,u.email FROM courses c JOIN app_users u ON u.id=$2 AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=u.id) WHERE c.id=$1 AND c.deleted_at IS NULL AND (c.owner_id=$3 OR $4=true) AND u.role='student' AND u.active=true`,[body.course_id,body.student_id,session.id,session.role==='admin'])).rows[0];
 if(!target)return fail('담당 과정의 수강생을 찾을 수 없습니다.',404);
 if(path.endsWith('/generate')){
  if(body.privacyChecked!==true)return fail('AI 전송 항목을 확인하세요.');
  const setting=(await query('SELECT * FROM ai_settings WHERE id=1')).rows[0];if(!setting?.enabled)return fail('관리자가 AI 설정을 활성화해야 합니다.',503);
  const rows=(await query(`SELECT r.score,r.total,r.questions,r.answers,r.grading,a.week,a.kind FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.course_id=$1 AND r.student_id=$2 AND r.grading_status='confirmed' ORDER BY r.submitted_at DESC LIMIT 10`,[body.course_id,body.student_id])).rows;
  if(!rows.length)return fail('시험 기록이 없어 학습 방향을 작성할 수 없습니다.');
  const prompt=(await query(`SELECT content FROM guidance_prompts WHERE deleted_at IS NULL AND (id=$1 OR ($1 IS NULL AND (course_id=$2 OR is_default=1))) ORDER BY (id=$1) DESC,(course_id=$2) DESC,is_default DESC LIMIT 1`,[typeof body.prompt_id==='string'?body.prompt_id:null,body.course_id])).rows[0];
  const limit=await query(`INSERT INTO auth_limits(key,hits,expires_at) VALUES('ai-guidance',1,${nowPlus('+10 seconds')}) ON CONFLICT(key) DO UPDATE SET hits=1,expires_at=${nowPlus('+10 seconds')} WHERE auth_limits.expires_at<${NOW} RETURNING hits`);if(!limit.rows.length)return fail('잠시 후 다시 작성하세요.',429);
  const redact=v=>String(v||'').replaceAll(target.name,'[이름 제외]').replaceAll(target.email,'[이메일 제외]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 제외]').replace(/01[016789][- ]?\d{3,4}[- ]?\d{4}/g,'[연락처 제외]');
  const evaluations=rows.map(r=>({week:r.week,kind:r.kind,score:r.score,total:r.total,concepts:r.questions.map((q,i)=>({concept:redact(q.tag||'미분류'),type:q.type==='text'?'text':'choice',points:q.points,earned:q.type==='text'?r.grading?.[i]?.score:(r.answers?.[i]===q.answer?q.points:0)}))}));
  try{const result=await meteredAI(query,setting,'guidance',session.id,()=>generate(setting,{task:'learning_guidance',maxPoints:0,evaluations,instructions:prompt?.content}));return response({content:result.feedback});}catch(e){return fail(e.message,e.status||502);}
 }
 if(typeof body.content!=='string'||!body.content.trim()||body.content.length>8000||typeof body.published!=='boolean'||!Number.isInteger(body.revision)||body.revision<0)return fail('학습 방향(1~8000자)과 공개 상태를 확인하세요.');
 const params=[body.course_id,body.student_id,body.content.trim(),body.published,session.id,body.revision];
 const saved=body.revision===0?await query(`INSERT INTO learning_guidance(course_id,student_id,content,published,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING revision,updated_at`,params.slice(0,5)):await query(`UPDATE learning_guidance SET content=$3,published=$4,updated_by=$5,updated_at=${NOW},revision=revision+1 WHERE course_id=$1 AND student_id=$2 AND revision=$6 RETURNING revision,updated_at`,params);
 if(!saved.rows.length)return fail('다른 곳에서 수정되었습니다. 목록을 다시 열어 확인하세요.',409);
 await logActivity(query,session.id,params[3]?'guidance.publish':'guidance.save',`${params[1]}:${params[0]}`,{});
 return response({ok:true,...saved.rows[0]});
}
