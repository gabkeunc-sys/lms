import {test} from 'node:test';import assert from 'node:assert/strict';import {createTestDatabase} from './helpers/d1.mjs';import {guidanceAPI} from '../server/guidance.mjs';
test('guidance ownership, publication, revision conflicts and student isolation',async()=>{
 const db=await createTestDatabase({migrations:['0001_schema.sql','0007_operations.sql','0008_teaching_tools.sql','0009_learning_tools.sql','0010_certificates.sql','0011_english_names.sql']});try{
 const teacher='10000000-0000-4000-8000-000000000001',student='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',course='20000000-0000-4000-8000-000000000001';
 for(const [id,role]of [[teacher,'instructor'],[student,'student'],[other,'instructor']])await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[id,role,id+'@example.com','unused',role]);
 await db.query('INSERT INTO courses(id,owner_id,title,student_ids) VALUES($1,$2,$3,$4)',[course,teacher,'웹 기초',JSON.stringify([student])]);
 const call=(path,method,session,body={})=>guidanceAPI({path,method,session,body,query:db.query,response:data=>({status:200,data}),fail:(error,status=400)=>({status,error})});
 const t={id:teacher,role:'instructor'},s={id:student,role:'student'},o={id:other,role:'instructor'},body={course_id:course,student_id:student,content:'HTTP 요청과 응답을 복습하세요.',published:false,revision:0};
 assert.equal((await call('/instructor/guidance','GET',s)).status,403);
 assert.equal((await call('/instructor/guidance','GET',o)).data.learners.length,0);
 assert.equal((await call('/instructor/guidance','POST',o,body)).status,404);
 assert.equal((await call('/instructor/guidance','POST',t,body)).data.revision,1);
 assert.equal((await call('/student/guidance','GET',s)).data.guidance.length,0);
 assert.equal((await call('/instructor/guidance','POST',t,body)).status,409);
 assert.equal((await call('/instructor/guidance','POST',t,{...body,revision:1,published:true})).data.revision,2);
 assert.equal((await call('/student/guidance','GET',s)).data.guidance[0].content,body.content);
 assert.equal((await call('/student/guidance','GET',{id:other,role:'student'})).data.guidance.length,0);
 await db.query("UPDATE courses SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$1",[course]);
 assert.equal((await call('/student/guidance','GET',s)).data.guidance.length,0);
 }finally{}
});
test('AI guidance uses coaching instructions and returns editable content',async()=>{
 const {generate,encryptKey}=await import('../server/ai.mjs');const old=process.env.LMS_SETTINGS_KEY;process.env.LMS_SETTINGS_KEY='b'.repeat(64);
 try{const result=await generate({provider:'openai',model:'test-model',encrypted_key:encryptKey('test-key-with-sufficient-length')},{task:'learning_guidance',maxPoints:0,evaluations:[{score:70,total:100}]},async(url,options)=>{const body=JSON.parse(options.body);assert.match(body.instructions,/learning coach/);assert.equal(body.store,false);return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({score:0,feedback:'현재 학습 상태: HTTP 개념을 복습하세요.'})}]}]}));});assert.match(result.feedback,/HTTP/);}finally{if(old===undefined)delete process.env.LMS_SETTINGS_KEY;else process.env.LMS_SETTINGS_KEY=old;}
});
