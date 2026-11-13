import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {createHandler} from '../server/auth.mjs';import {encryptKey,decryptKey,generate} from '../server/gemini.mjs';
test('subjective exam lifecycle, hidden answers, secure API settings and review boundaries',async()=>{
 const db=new PGlite();const old=process.env.LMS_SETTINGS_KEY;process.env.LMS_SETTINGS_KEY='a'.repeat(64);
 try{
 for(const name of ['0001_auth.sql','0004_instructor.sql','0007_assessment_results.sql','0008_subjective.sql','0010_ai_provider.sql','0011_course_delete.sql']){let sql=await readFile(new URL('../netlify/database/migrations/'+name,import.meta.url),'utf8');if(name==='0007_assessment_results.sql')sql=sql.split('DO $results$')[0];await db.exec(sql);}
 const handler=createHandler(db),call=(path,cookie='',method='GET',body)=>handler(new Request('https://lms.test/api'+path,{method,headers:{cookie,origin:'https://lms.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{ip:randomUUID()});
 async function account(role,n){const body={name:n,email:n.toLowerCase()+'@example.com',password:'Password-2026-abc'};await call('/register','','POST',body);await db.query('UPDATE app_users SET role=$1 WHERE email=$2',[role,body.email]);const r=await call('/login','','POST',body);return {cookie:r.headers.get('set-cookie').split(';')[0],...(await r.json()).user};}
 const admin=await account('admin','Admin'),teacher=await account('instructor','Teacher'),student=await account('student','Student'),other=await account('instructor','Other');
 const courseRes=await call('/instructor/courses',teacher.cookie,'POST',{title:'Course',description:'',status:'active',student_ids:[student.id]});const courseBody=await courseRes.json();assert.equal(courseRes.status,200,JSON.stringify(courseBody));const course=courseBody.course;
 const draft={course_id:course.id,title:'서술형 평가',kind:'quiz',week:2,duration:20,questions:[{type:'text',prompt:'HTTP의 역할을 설명하세요.',model_answer:'클라이언트와 서버가 요청과 응답을 교환하는 프로토콜',rubric:'요청·응답 5점, 통신 규약 5점',points:10,explanation:'',tag:'HTTP'},{prompt:'1+1?',options:['1','2','3','4'],answer:1,points:10,explanation:'',tag:''}]};
 let result=await call('/instructor/assessments',teacher.cookie,'POST',draft);assert.equal(result.status,200);const a=(await result.json()).assessment;
 assert.equal((await call('/student/assessments/'+a.id+'/start',student.cookie,'POST',{})).status,404);
 assert.equal((await call('/instructor/assessments/'+a.id+'/publish',other.cookie,'POST',{published:true})).status,404);
 assert.equal((await call('/instructor/assessments/'+a.id+'/publish',teacher.cookie,'POST',{published:true})).status,200);
 const started=(await (await call('/student/assessments/'+a.id+'/start',student.cookie,'POST',{})).json()).assessment;assert.equal(started.questions[0].model_answer,undefined);assert.equal(started.questions[1].answer,undefined);assert.ok(started.deadline);
 assert.equal((await call('/instructor/assessments',teacher.cookie,'POST',{...a})).status,409);
 assert.equal((await call('/instructor/courses/'+course.id+'/delete',other.cookie,'POST',{})).status,404);
 assert.equal((await call('/instructor/courses/'+course.id+'/delete',student.cookie,'POST',{})).status,403);
 assert.equal((await call('/instructor/courses/'+course.id+'/delete',teacher.cookie,'POST',{})).status,200);
 assert.equal((await (await call('/instructor/courses',teacher.cookie)).json()).courses.length,0);
 assert.equal((await (await call('/instructor/assessments',teacher.cookie)).json()).assessments.length,0);
 assert.equal((await (await call('/student/assessments',student.cookie)).json()).assessments.length,0);
 assert.equal((await (await call('/instructor/courses/deleted',teacher.cookie)).json()).courses.length,1);
 assert.equal((await call('/student/assessments/'+a.id+'/start',student.cookie,'POST',{})).status,404);
 result=await call('/student/assessments/'+a.id+'/submit',student.cookie,'POST',{answers:['요청과 응답을 교환합니다.',1]});assert.equal(result.status,200);const id=(await result.json()).id;
 assert.equal((await call('/instructor/courses/'+course.id+'/restore',other.cookie,'POST',{})).status,404);
 assert.equal((await call('/instructor/courses/'+course.id+'/restore',teacher.cookie,'POST',{})).status,200);
 assert.equal((await db.query('SELECT published FROM assessments WHERE id=$1',[a.id])).rows[0].published,false);
 await call('/instructor/assessments/'+a.id+'/publish',teacher.cookie,'POST',{published:true});
 assert.equal((await call('/student/assessments/'+a.id+'/submit',student.cookie,'POST',{answers:['',null]})).status,409);
 let r=(await (await call('/student/results/'+id,student.cookie)).json()).result;assert.equal(r.score,null);assert.equal(r.answers[0],'요청과 응답을 교환합니다.');assert.equal(r.grading_status,'pending');
 assert.equal((await call('/admin/ai',teacher.cookie)).status,403);
 assert.equal((await call('/admin/ai',admin.cookie,'POST',{key:'test-key-1234567890123456',model:'gemini-2.5-flash',enabled:true})).status,200);
 assert.equal((await call('/admin/ai',admin.cookie,'POST',{provider:'openai',model:'chosen-model',enabled:true})).status,400);
 const config=await (await call('/admin/ai',admin.cookie)).json();assert.equal(config.configured,true);assert.equal(config.provider,'gemini');assert.ok(config.providers.openai);assert.ok(config.providers.anthropic);assert.equal(config.key,undefined);assert.equal(config.encrypted_key,undefined);
 const stored=(await db.query('SELECT * FROM ai_settings')).rows[0];assert.ok(!stored.encrypted_key.includes('test-key'));assert.equal(decryptKey(stored.encrypted_key),'test-key-1234567890123456');
 assert.equal((await call('/instructor/results/'+id+'/analyze',teacher.cookie,'POST',{index:0,revision:0,answer:'text'})).status,400);
 const originalFetch=globalThis.fetch;let sent;
 try{globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({score:7,feedback:'통신 규약 설명을 보완하세요.'})}]}}]});};assert.equal((await call('/instructor/results/'+id+'/analyze',teacher.cookie,'POST',{index:0,revision:0,privacyChecked:true,answer:'Student Student@example.com 요청과 응답'})).status,200);assert.ok(!JSON.stringify(sent).includes('Student'));}finally{globalThis.fetch=originalFetch;}
 r=(await (await call('/student/results/'+id,student.cookie)).json()).result;assert.equal(r.grading[0].score,undefined);assert.equal(r.score,null);
 const grading=[{score:8,feedback:'요청과 응답의 의미는 정확합니다.'},{}];assert.equal((await call('/instructor/results/'+id+'/confirm',other.cookie,'POST',{revision:1,grading})).status,404);
 assert.equal((await call('/instructor/results/'+id+'/confirm',teacher.cookie,'POST',{revision:0,grading})).status,409);
 assert.equal((await call('/instructor/results/'+id+'/confirm',teacher.cookie,'POST',{revision:1,grading})).status,200);
 r=(await (await call('/student/results/'+id,student.cookie)).json()).result;assert.equal(r.score,18);assert.equal(r.grading_status,'confirmed');assert.equal(r.grading[0].reviewed_by,undefined);
 assert.equal((await call('/instructor/results/'+id+'/analyze',teacher.cookie,'POST',{index:0,revision:2,privacyChecked:true,answer:'text'})).status,409);
 assert.equal((await call('/admin/ai',admin.cookie,'POST',{provider:'openai',model:'chosen-model',key:'new-provider-key-123456789',enabled:true})).status,200);const switched=(await db.query('SELECT * FROM ai_settings')).rows[0];assert.equal(switched.provider,'openai');assert.equal(decryptKey(switched.encrypted_key),'new-provider-key-123456789');
 const cipher=encryptKey('secret');assert.equal(decryptKey(cipher),'secret');await assert.rejects(generate(stored,{maxPoints:10},async()=>Response.json({candidates:[{content:{parts:[{text:'{"score":99,"feedback":"bad"}'}]}}]})));
 await assert.rejects(generate(stored,{maxPoints:10},async()=>new Response('{}',{status:429})),e=>e.status===429);
 }finally{if(old===undefined)delete process.env.LMS_SETTINGS_KEY;else process.env.LMS_SETTINGS_KEY=old;await db.close();}
});
