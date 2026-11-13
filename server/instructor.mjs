import {randomUUID} from 'node:crypto';
import {NOW,toTimestamp} from './db.mjs';
import {logActivity} from './ops.mjs';
import {syncExamToBank} from './teach.mjs';
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export async function instructorAPI({path,method,body,session,query,response,fail}){
 if(!session)return fail('로그인이 필요합니다.',401);
 if(path==='/admin/role'&&method==='PATCH'){
  if(session.role!=='admin')return fail('관리자만 변경할 수 있습니다.',403);
  if(!uuid(body.id)||!['student','instructor'].includes(body.role))return fail('변경할 회원과 권한을 확인하세요.');
  if(body.role==='student'&&(await query('SELECT id FROM courses WHERE owner_id=$1 LIMIT 1',[body.id])).rows.length)return fail('담당 과정이 있는 강사의 권한은 변경할 수 없습니다.');
  const r=await query(`UPDATE app_users SET role=$1 WHERE id=$2 AND role<>'admin' RETURNING id`,[body.role,body.id]);
  if(!r.rows.length)return fail('변경할 회원을 찾을 수 없습니다.',404);
  await query('DELETE FROM app_sessions WHERE user_id=$1',[body.id]);
  const who=(await query('SELECT name,email FROM app_users WHERE id=$1',[body.id])).rows[0];
  await logActivity(query,session.id,'member.role',who?.email||body.id,{name:who?.name,role:body.role});
  return response({ok:true});
 }
 if(!['admin','instructor'].includes(session.role))return fail('강사만 접근할 수 있습니다.',403);
 const course=async id=>uuid(id)?(await query('SELECT * FROM courses WHERE id=$1 AND deleted_at IS NULL AND (owner_id=$2 OR $3=true)',[id,session.id,session.role==='admin'])).rows[0]:null;
 if(path==='/instructor/courses/deleted'&&method==='GET')return response({courses:(await query('SELECT id,title,deleted_at FROM courses WHERE deleted_at IS NOT NULL AND (owner_id=$1 OR $2=true) ORDER BY deleted_at DESC',[session.id,session.role==='admin'])).rows});
 const deletion=path.match(/^\/instructor\/courses\/([a-f0-9-]{36})\/(delete|restore)$/);
 if(deletion&&method==='POST'){
  const deleting=deletion[2]==='delete';
  const result=await query(`UPDATE courses SET deleted_at=${deleting?NOW:'NULL'} WHERE id=$1 AND (owner_id=$2 OR $3=true) AND deleted_at IS ${deleting?'NULL':'NOT NULL'} RETURNING id`,[deletion[1],session.id,session.role==='admin']);
  if(!result.rows.length)return fail('과정을 찾을 수 없거나 상태가 변경되었습니다.',404);
  await query('UPDATE assessments SET published=0 WHERE course_id=$1',[deletion[1]]);
  return response({ok:true});
 }
 if(path==='/instructor/students'&&method==='GET')return response({users:(await query("SELECT id,name,email FROM app_users WHERE role='student' AND active=1 ORDER BY name")).rows});
 if(path==='/instructor/courses'&&method==='GET')return response({courses:(await query('SELECT * FROM courses WHERE deleted_at IS NULL AND (owner_id=$1 OR $2=true) ORDER BY created_at DESC',[session.id,session.role==='admin'])).rows});
 if(path==='/instructor/courses'&&method==='POST'){
  if(!text(body.title,160)||typeof body.description!=='string'||body.description.length>4000||!['preparing','active','ended'].includes(body.status))return fail('과정명, 설명, 운영 상태를 확인하세요.');
  for(const key of ['start_date','end_date'])if(body[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(body[key])||!Number.isFinite(Date.parse(body[key]))||new Date(body[key]).toISOString().slice(0,10)!==body[key]))return fail('교육 기간을 확인하세요.');
  if(body.start_date&&body.end_date&&body.start_date>body.end_date)return fail('종료일은 시작일 이후여야 합니다.');
  if(!Array.isArray(body.student_ids)||body.student_ids.length>500||!body.student_ids.every(uuid))return fail('수강생 선택을 확인하세요.');
  const ids=[...new Set(body.student_ids)];
  if(ids.length!==Number((await query("SELECT count(*) AS n FROM app_users WHERE id IN (SELECT value FROM json_each($1)) AND role='student' AND active=1",[JSON.stringify(ids)])).rows[0].n))return fail('활성 학생 계정만 배정할 수 있습니다.');
  if(body.id&&!await course(body.id))return fail('과정을 찾을 수 없습니다.',404);
  const titleEn=typeof body.title_en==='string'&&body.title_en.trim()?body.title_en.trim().slice(0,160):null;
  const vals=[body.title.trim(),body.description,body.start_date||null,body.end_date||null,body.status,JSON.stringify(ids),titleEn];
  const r=body.id?await query('UPDATE courses SET title=$1,description=$2,start_date=$3,end_date=$4,status=$5,student_ids=$6,title_en=$7 WHERE id=$8 RETURNING *',[...vals,body.id]):await query('INSERT INTO courses(title,description,start_date,end_date,status,student_ids,title_en,id,owner_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[...vals,randomUUID(),session.id]);
  await logActivity(query,session.id,body.id?'course.update':'course.create',body.title.trim(),{students:ids.length});
  return response({course:r.rows[0]});
 }
 if(path==='/instructor/assessments'&&method==='GET')return response({assessments:(await query('SELECT a.*,c.title AS course_title,c.start_date AS course_start,c.end_date AS course_end,(SELECT count(*) FROM assessment_results r WHERE r.assessment_id=a.id) AS result_count FROM assessments a JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL AND (c.owner_id=$1 OR $2=true) ORDER BY a.created_at DESC',[session.id,session.role==='admin'])).rows});
 if(path==='/instructor/assessments'&&method==='POST'){
  if(!await course(body.course_id))return fail('담당 과정을 선택하세요.',403);
  if(!text(body.title,160)||!['exam','quiz'].includes(body.kind)||!Number.isInteger(body.week)||body.week<1||body.week>100||!Number.isInteger(body.duration)||body.duration<1||body.duration>240)return fail('평가 제목, 주차, 제한 시간을 확인하세요.');
  for(const k of ['opens_at','closes_at'])if(body[k]&&!Number.isFinite(Date.parse(body[k])))return fail('응시 기간을 확인하세요.');
  if(body.opens_at&&body.closes_at&&Date.parse(body.opens_at)>=Date.parse(body.closes_at))return fail('종료 시각은 시작 시각 이후여야 합니다.');
  if(!Array.isArray(body.questions)||body.questions.length>50)return fail('문항은 최대 50개까지 저장할 수 있습니다.');
  const questions=[];
  for(const q of body.questions){
   if(typeof q.prompt!=='string'||q.prompt.length>4000||!Number.isInteger(q.points)||q.points<1||q.points>100||typeof q.explanation!=='string'||q.explanation.length>4000||typeof q.tag!=='string'||q.tag.length>160)return fail('문항 내용·배점을 확인하세요.');
   const type=q.type||'choice';
   if(type==='text'){
    if(typeof q.model_answer!=='string'||q.model_answer.length>8000||typeof q.rubric!=='string'||q.rubric.length>4000)return fail('모범답안과 채점 기준을 확인하세요.');
    questions.push({type,prompt:q.prompt,model_answer:q.model_answer,rubric:q.rubric,points:q.points,explanation:q.explanation,tag:q.tag});
   }else if(type==='choice'){
    if(!Array.isArray(q.options)||q.options.length!==4||!q.options.every(o=>typeof o==='string'&&o.length<=1000)||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)return fail('보기와 정답을 확인하세요.');
    questions.push({type,prompt:q.prompt,options:q.options,answer:q.answer,points:q.points,explanation:q.explanation,tag:q.tag});
   }else return fail('문항 유형을 확인하세요.');
  }
  if(body.id){
   if(!uuid(body.id))return fail('평가를 확인하세요.');
   const a=(await query('SELECT course_id,published FROM assessments WHERE id=$1',[body.id])).rows[0];
   if(!a||!await course(a.course_id))return fail('평가를 찾을 수 없습니다.',404);
   if(a.published)return fail('공개한 시험은 수정할 수 없습니다. 공개를 해제하세요.',409);
   if((await query('SELECT assessment_id FROM assessment_attempts WHERE assessment_id=$1 LIMIT 1',[body.id])).rows.length)return fail('응시가 시작된 시험은 수정할 수 없습니다.',409);
  }
  if(body.id&&(await query('SELECT id FROM assessment_results WHERE assessment_id=$1 LIMIT 1',[body.id])).rows.length)return fail('응시 결과가 있는 시험은 수정할 수 없습니다. 새 시험을 작성하세요.',409);
  const vals=[body.course_id,body.title.trim(),body.kind,body.week,body.duration,toTimestamp(body.opens_at),toTimestamp(body.closes_at),JSON.stringify(questions)];
  const r=body.id?await query('UPDATE assessments SET course_id=$1,title=$2,kind=$3,week=$4,duration=$5,opens_at=$6,closes_at=$7,questions=$8 WHERE id=$9 RETURNING *',[...vals,body.id]):await query('INSERT INTO assessments(course_id,title,kind,week,duration,opens_at,closes_at,questions,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[...vals,randomUUID()]);
  try{await syncExamToBank(query,r.rows[0].id);}catch{} // keep the question bank in step with exams
  return response({assessment:r.rows[0]});
 }
 return fail('요청한 기능을 찾을 수 없습니다.',404);
}

