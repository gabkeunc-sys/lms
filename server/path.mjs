// Weekly module plans (designed by instructors) and the learning path built from them.
import {randomUUID} from 'node:crypto';
const UUID=/^[a-f0-9-]{36}$/;

async function buildPaths(query,studentId,ownerId=null){
 const courses=(await query(`SELECT c.id,c.title,c.start_date,c.end_date,c.status FROM courses c WHERE c.deleted_at IS NULL AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) AND ($2 IS NULL OR c.owner_id=$2) ORDER BY c.start_date,c.title`,[studentId,ownerId])).rows;
 const out=[];
 for(const c of courses){
  const modules=(await query('SELECT id,week,title,description FROM course_modules WHERE course_id=$1 ORDER BY week',[c.id])).rows;
  const assessments=(await query(`SELECT a.id,a.title,a.kind,a.week,a.published,a.opens_at,a.closes_at,r.score,r.total,r.grading_status,r.submitted_at,r.attempts,r.first_score FROM assessments a LEFT JOIN assessment_results r ON r.assessment_id=a.id AND r.student_id=$2 WHERE a.course_id=$1 ORDER BY a.week,a.kind DESC,a.title`,[c.id,studentId])).rows;
  // Weeks that have assessments but no designed module still appear, so nothing taken is hidden.
  const weeks=new Map(modules.map(m=>[m.week,{...m,planned:true,assessments:[]}]));
  for(const a of assessments){
   if(!weeks.has(a.week))weeks.set(a.week,{id:null,week:a.week,title:`${a.week}주차`,description:'',planned:false,assessments:[]});
   const confirmed=a.grading_status==='confirmed';
   weeks.get(a.week).assessments.push({id:a.id,title:a.title,kind:a.kind,published:!!a.published,opens_at:a.opens_at,closes_at:a.closes_at,taken:!!a.submitted_at,status:a.submitted_at?a.grading_status:null,score:confirmed?a.score:null,total:a.total??null,percent:confirmed&&a.total?Math.round(a.score*1000/a.total)/10:null,submitted_at:a.submitted_at||null,attempts:a.attempts||(a.submitted_at?1:0),first_percent:confirmed&&a.first_score!=null&&a.total?Math.round(a.first_score*1000/a.total)/10:null});
  }
  out.push({course_id:c.id,course_title:c.title,course_start:c.start_date,course_end:c.end_date,status:c.status,steps:[...weeks.values()].sort((a,b)=>a.week-b.week)});
 }
 return out;
}

export async function pathAPI({path,method,body,session,query,response,fail}){
 if(!session)return fail('로그인이 필요합니다.',401);
 if(path==='/student/class-stats'){if(method!=='GET')return fail('허용되지 않는 요청입니다.',405);return response(await classStats(query,session.id));}
 if(path==='/student/learning-path'){
  if(method!=='GET')return fail('허용되지 않는 요청입니다.',405);
  return response({paths:await buildPaths(query,session.id)});
 }
 if(!['instructor','admin'].includes(session.role))return fail('강사만 접근할 수 있습니다.',403);
 let m=path.match(/^\/instructor\/learning-path\/([a-f0-9-]{36})$/);
 if(m){
  if(method!=='GET')return fail('허용되지 않는 요청입니다.',405);
  return response({paths:await buildPaths(query,m[1],session.role==='admin'?null:session.id)});
 }
 m=path.match(/^\/instructor\/courses\/([a-f0-9-]{36})\/modules$/);
 if(!m)return fail('요청한 기능을 찾을 수 없습니다.',404);
 const course=(await query('SELECT id,owner_id FROM courses WHERE id=$1 AND deleted_at IS NULL',[m[1]])).rows[0];
 if(!course||(course.owner_id!==session.id&&session.role!=='admin'))return fail('담당 과정을 찾을 수 없습니다.',404);
 const list=async()=>({modules:(await query('SELECT id,week,title,description FROM course_modules WHERE course_id=$1 ORDER BY week',[course.id])).rows,assessments:(await query('SELECT id,title,kind,week,published FROM assessments WHERE course_id=$1 ORDER BY week,title',[course.id])).rows});
 if(method==='GET')return response(await list());
 if(method!=='POST')return fail('허용되지 않는 요청입니다.',405);
 const mods=body.modules;
 if(!Array.isArray(mods)||mods.length>52)return fail('모듈은 최대 52개까지 등록할 수 있습니다.');
 const weeks=new Set();
 for(const x of mods){
  if(!Number.isInteger(x.week)||x.week<1||x.week>100)return fail('주차는 1~100 사이 숫자로 입력하세요.');
  if(weeks.has(x.week))return fail(`${x.week}주차가 중복되었습니다.`);weeks.add(x.week);
  if(typeof x.title!=='string'||!x.title.trim()||x.title.length>120)return fail('모듈 이름(1~120자)을 입력하세요.');
  if(x.description!=null&&(typeof x.description!=='string'||x.description.length>1000))return fail('모듈 설명은 1000자 이내로 입력하세요.');
 }
 await query('DELETE FROM course_modules WHERE course_id=$1',[course.id]);
 for(const x of mods)await query('INSERT INTO course_modules(id,course_id,week,title,description) VALUES($1,$2,$3,$4,$5)',[typeof x.id==='string'&&UUID.test(x.id)?x.id:randomUUID(),course.id,x.week,x.title.trim(),(x.description||'').trim()]);
 return response({ok:true,...await list()});
}

// Class comparison for the student dashboard: class averages, anonymised classmate points and concept rates.
export async function classStats(query,studentId){
 const rows=(await query(`SELECT r.assessment_id,r.student_id,r.score,r.total,r.duration_seconds,r.questions,r.answers,r.grading,a.title,a.week,a.kind FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id JOIN courses c ON c.id=a.course_id WHERE c.deleted_at IS NULL AND r.grading_status='confirmed' AND r.total>0 AND EXISTS(SELECT 1 FROM json_each(c.student_ids) WHERE value=$1) AND a.id IN (SELECT assessment_id FROM assessment_results WHERE student_id=$1)`,[studentId])).rows;
 const byA=new Map(),concepts=new Map(),types={choice:{e:0,t:0},text:{e:0,t:0}},points=[];
 for(const r of rows){
  const pct=100*r.score/r.total,me=r.student_id===studentId;
  const a=byA.get(r.assessment_id)||{assessment_id:r.assessment_id,title:r.title,week:r.week,kind:r.kind,sum:0,n:0};a.sum+=pct;a.n++;byA.set(r.assessment_id,a);
  points.push({assessment_id:r.assessment_id,title:r.title,percent:Math.round(pct*10)/10,minutes:Math.round(r.duration_seconds/6)/10,me});
  if(me)continue;
  for(const [i,q] of (r.questions||[]).entries()){
   const total=Number(q.points);if(!(total>0))continue;const kind=q.type==='text'?'text':'choice';
   const earned=kind==='text'?Number(r.grading?.[i]?.score):(r.answers?.[i]===q.answer?total:0);if(!Number.isFinite(earned))continue;
   const tag=q.tag?.trim()||'미분류',c=concepts.get(tag)||{e:0,t:0};c.e+=Math.max(0,Math.min(total,earned));c.t+=total;concepts.set(tag,c);
   types[kind].e+=Math.max(0,Math.min(total,earned));types[kind].t+=total;
  }
 }
 return {
  assessments:[...byA.values()].map(a=>({assessment_id:a.assessment_id,title:a.title,week:a.week,kind:a.kind,class_average:Math.round(a.sum/a.n*10)/10,takers:a.n})),
  points,
  concepts:Object.fromEntries([...concepts].map(([k,v])=>[k,Math.round(1000*v.e/v.t)/10])),
  types:Object.fromEntries(Object.entries(types).filter(([,v])=>v.t>0).map(([k,v])=>[k,Math.round(1000*v.e/v.t)/10]))
 };
}
