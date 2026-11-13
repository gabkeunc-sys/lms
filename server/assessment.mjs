import {randomUUID} from 'node:crypto';
import {generate} from './ai.mjs';
import {NOW,nowPlus} from './db.mjs';
const isText=q=>q.type==='text';
const safeQuestions=qs=>qs.map(q=>({type:q.type||'choice',prompt:q.prompt,points:q.points,tag:q.tag,...(!isText(q)?{options:q.options}:{})}));
export async function assessmentAPI({path,method,body,session,query,response,fail}){
 if(!session)return fail('로그인이 필요합니다.',401);
 const teacher=path.startsWith('/instructor/');
 if(teacher&&!['admin','instructor'].includes(session.role))return fail('강사만 접근할 수 있습니다.',403);
 if(!teacher&&session.role!=='student')return fail('학생 계정으로 응시하세요.',403);
 const match=path.match(/^\/(?:instructor|student)\/(assessments|results)\/([a-f0-9-]{36})(?:\/(start|submit|publish|analyze|confirm))?$/);
 if(path==='/student/assessments'&&method==='GET')return response({assessments:(await query(`SELECT a.id,a.title,a.kind,a.week,a.duration,a.opens_at,a.closes_at,c.title AS course_title,r.id AS result_id FROM assessments a JOIN courses c ON c.id=a.course_id LEFT JOIN assessment_results r ON r.assessment_id=a.id AND r.student_id=$1 WHERE c.deleted_at IS NULL AND a.published=1 AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) ORDER BY a.created_at DESC`,[session.id])).rows});
 if(!match)return fail('요청을 찾을 수 없습니다.',404);
 const [,resource,id,action]=match;
 if(resource==='results'){
  if(method!=='POST')return fail('허용되지 않는 요청입니다.',405);
  const r=(await query('SELECT r.*,u.name,u.email FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id JOIN app_users u ON u.id=r.student_id WHERE r.id=$1 AND (c.owner_id=$2 OR $3=true)',[id,session.id,session.role==='admin'])).rows[0];
  if(!r)return fail('성적을 찾을 수 없습니다.',404);
  if(body.revision!==r.revision)return fail('성적이 변경되었습니다. 다시 열어 확인하세요.',409);
  const index=body.index,q=r.questions[index];
  if(action==='analyze'){
   if(!Number.isInteger(index)||!q||!isText(q))return fail('주관식 문항을 선택하세요.');
   if(r.grading_status==='confirmed')return fail('확정된 성적은 재분석할 수 없습니다.',409);
   if(body.privacyChecked!==true||typeof body.answer!=='string'||body.answer.length>10000)return fail('전송할 답안에서 개인정보를 확인하세요.');
   const setting=(await query('SELECT * FROM ai_settings WHERE id=1 AND enabled=true')).rows[0];if(!setting)return fail('관리자가 AI 채점 API를 등록하고 활성화해야 합니다.',503);
   // One project-wide request at a time window; failed requests do not overwrite saved grading.
   const limit=await query(`INSERT INTO auth_limits(key,hits,expires_at) VALUES('ai-grading',1,${nowPlus('+10 seconds')}) ON CONFLICT(key) DO UPDATE SET hits=1,expires_at=${nowPlus('+10 seconds')} WHERE auth_limits.expires_at<${NOW} RETURNING hits`);
   if(!limit.rows.length)return fail('분석 요청을 처리 중입니다. 10초 후 다시 시도하세요.',429);
   const redact=s=>s.replaceAll(r.email,'[이메일 제외]').replaceAll(r.name,'[이름 제외]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 제외]').replace(/01[016789][- ]?\d{3,4}[- ]?\d{4}/g,'[연락처 제외]');
   let proposed;try{proposed=await generate(setting,{question:redact(q.prompt),exemplar:redact(q.model_answer),rubric:redact(q.rubric),answer:redact(body.answer),maxPoints:q.points});}catch(e){return fail(e.message,e.status||502);}
   const grading=[...r.grading];grading[index]={...proposed,status:'proposed',provider:setting.provider||'gemini',model:setting.model,analyzed_at:new Date().toISOString()};
   const changed=await query("UPDATE assessment_results SET grading=$1,grading_status='review',revision=revision+1 WHERE id=$2 AND revision=$3 RETURNING id",[JSON.stringify(grading),id,r.revision]);
   return changed.rows.length?response({ok:true}):fail('성적이 변경되었습니다. 다시 열어 확인하세요.',409);
  }
  if(action==='confirm'){
   if(!Array.isArray(body.grading)||body.grading.length!==r.questions.length)return fail('문항별 점수를 입력하세요.');
   const grading=[];let score=0;
   for(let i=0;i<r.questions.length;i++){const question=r.questions[i],g=body.grading[i];
    if(isText(question)){
     if(!g||!Number.isInteger(g.score)||g.score<0||g.score>question.points||typeof g.feedback!=='string'||g.feedback.length>8000)return fail('주관식 점수와 피드백을 확인하세요.');
     grading.push({...r.grading[i],score:g.score,feedback:g.feedback,status:'confirmed',reviewed_by:session.id,reviewed_at:new Date().toISOString()});score+=g.score;
    }else{const points=r.answers[i]===question.answer?question.points:0;grading.push({score:points,status:'confirmed'});score+=points;}
   }
   const changed=await query("UPDATE assessment_results SET grading=$1,score=$2,grading_status='confirmed',revision=revision+1 WHERE id=$3 AND revision=$4 RETURNING id",[JSON.stringify(grading),score,id,r.revision]);
   return changed.rows.length?response({ok:true}):fail('성적이 변경되었습니다. 다시 열어 확인하세요.',409);
  }
 }
 const a=(await query('SELECT a.*,c.student_ids,c.owner_id,c.deleted_at FROM assessments a JOIN courses c ON c.id=a.course_id WHERE a.id=$1',[id])).rows[0];
 if(!a||(a.deleted_at&&action!=='submit')||(teacher?session.role!=='admin'&&a.owner_id!==session.id:(!a.published&&!(a.deleted_at&&action==='submit'))||!a.student_ids.includes(session.id)))return fail('시험을 찾을 수 없습니다.',404);
 if(teacher&&action==='publish'&&method==='POST'){
  if(typeof body.published!=='boolean')return fail('공개 상태를 확인하세요.');
  if(body.published&&(!a.questions.length||a.questions.some(q=>!q.prompt.trim()||(isText(q)?!q.model_answer.trim()||!q.rubric.trim():q.options.some(o=>!o.trim())))))return fail('문제와 정답, 채점 기준을 모두 입력한 후 공개하세요.');
  await query('UPDATE assessments SET published=$1 WHERE id=$2',[body.published,id]);return response({ok:true});
 }
 if(teacher)return fail('허용되지 않는 요청입니다.',405);
 const existing=(await query('SELECT id FROM assessment_results WHERE assessment_id=$1 AND student_id=$2',[id,session.id])).rows[0];if(existing)return fail('이미 제출한 시험입니다.',409);
 const now=Date.now();if(a.opens_at&&now<Date.parse(a.opens_at))return fail('응시 시작 전입니다.',403);
 if(action==='start'&&method==='POST'){
  if(a.closes_at&&now>Date.parse(a.closes_at))return fail('응시 기간이 종료되었습니다.',403);
  const t=(await query('INSERT INTO assessment_attempts(assessment_id,student_id) VALUES($1,$2) ON CONFLICT(assessment_id,student_id) DO UPDATE SET started_at=assessment_attempts.started_at RETURNING started_at',[id,session.id])).rows[0];
  const deadline=Math.min(Date.parse(t.started_at)+a.duration*60000,a.closes_at?Date.parse(a.closes_at):Infinity);
  if(now>deadline)return fail('응시 시간이 종료되었습니다.',403);
  return response({assessment:{id:a.id,title:a.title,questions:safeQuestions(a.questions),deadline:new Date(deadline).toISOString()}});
 }
 if(action==='submit'&&method==='POST'){
  const t=(await query('SELECT started_at FROM assessment_attempts WHERE assessment_id=$1 AND student_id=$2',[id,session.id])).rows[0];if(!t)return fail('먼저 응시를 시작하세요.');
  const deadline=Math.min(Date.parse(t.started_at)+a.duration*60000,a.closes_at?Date.parse(a.closes_at):Infinity);
  if(now>deadline+30000)return fail('제출 시간이 종료되었습니다.',403);
  if(!Array.isArray(body.answers)||body.answers.length!==a.questions.length)return fail('답안을 확인하세요.');
  let score=0;const grading=[];
  for(let i=0;i<a.questions.length;i++){const q=a.questions[i],v=body.answers[i];if(isText(q)){if(typeof v!=='string'||v.length>10000)return fail('주관식 답안은 10,000자까지 입력할 수 있습니다.');grading.push({status:'pending'});}else{if(v!==null&&(!Number.isInteger(v)||v<0||v>3))return fail('객관식 답안을 확인하세요.');const points=v===q.answer?q.points:0;score+=points;grading.push({score:points,status:'confirmed'});}}
  const resultId=randomUUID(),status=a.questions.some(isText)?'pending':'confirmed';
  const saved=await query('INSERT INTO assessment_results(id,assessment_id,student_id,questions,answers,score,total,duration_seconds,origin,grading,grading_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(assessment_id,student_id) DO NOTHING RETURNING id',[resultId,id,session.id,JSON.stringify(a.questions),JSON.stringify(body.answers),score,a.questions.reduce((s,q)=>s+q.points,0),Math.max(0,Math.floor((now-Date.parse(t.started_at))/1000)),'submitted',JSON.stringify(grading),status]);
  return saved.rows.length?response({id:resultId}):fail('이미 제출한 시험입니다.',409);
 }
 return fail('허용되지 않는 요청입니다.',405);
}
