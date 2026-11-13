import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {createHandler,hashPassword} from '../server/auth.mjs';
const sql=async f=>await readFile(new URL('../netlify/database/migrations/'+f,import.meta.url),'utf8');
test('results seed, score consistency and ownership boundaries',async()=>{
 const db=new PGlite();try{
 for(const f of ['0001_auth.sql','0004_instructor.sql'])await db.exec(await sql(f));
 const password='Testing-password-2026',hash=await hashPassword(password);
 const entries=[[randomUUID(),'admin','gabkeunc@gmail.com','Owner'],['2316c163-ca5b-49e3-94b2-8d0852576799','instructor','teacher@example.com','조현우'],['9bd479c5-b6bd-45cb-a5f1-7a73cb4a9e1d','student','one@example.com','Student One'],['611ca32e-62a2-42c9-8adc-a0760d033208','student','two@example.com','Student Two'],[randomUUID(),'instructor','other@example.com','Other']];
 for(const [id,role,email,name] of entries)await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[id,name,email,hash,role]);
 for(const f of ['0005_sample_course_exam.sql','0007_assessment_results.sql','0008_subjective.sql','0011_course_delete.sql'])await db.exec(await sql(f));
 await db.query("UPDATE courses SET owner_id='2316c163-ca5b-49e3-94b2-8d0852576799' WHERE id=(SELECT course_id FROM assessments WHERE id='ad06a855-9a44-4dfa-aeda-43abfe37dd06')");
 await db.exec(await sql('0009_subjective_questions.sql'));
 const sample=(await db.query("SELECT questions FROM assessments WHERE id='f8cf20ce-2d01-4a7e-bc87-993d4a240918'")).rows[0];assert.equal(sample.questions.length,3);
 const results=(await db.query('SELECT * FROM assessment_results ORDER BY score DESC')).rows;assert.equal(results.length,2);assert.deepEqual(results.map(r=>r.score),[100,90]);
 for(const r of results){assert.equal(r.score,r.questions.reduce((sum,q,i)=>sum+(q.answer===r.answers[i]?q.points:0),0));assert.equal(r.total,100);}
 const handler=createHandler(db),cookies={};
 const call=(path,cookie='',method='GET',body)=>handler(new Request('https://lms.test/api'+path,{method,headers:{cookie,origin:'https://lms.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{ip:randomUUID()});
 for(const [,role,email]of entries){const r=await call('/login','','POST',{email,password});cookies[email]=r.headers.get('set-cookie').split(';')[0];assert.ok((await r.json()).user.name);}
 const one=cookies['one@example.com'],two=cookies['two@example.com'],teacher=cookies['teacher@example.com'],other=cookies['other@example.com'];
 assert.equal((await call('/student/results')).status,401);assert.equal((await call('/instructor/results',one)).status,403);
 const mine=(await (await call('/student/results',one)).json()).results;assert.equal(mine.length,1);assert.equal(mine[0].questions,undefined);
 assert.equal((await call('/student/results/'+mine[0].id,two)).status,404);
 assert.equal((await call('/instructor/results/'+mine[0].id,other)).status,404);
 assert.equal((await (await call('/instructor/results',teacher)).json()).results.length,2);
 const detail=(await (await call('/student/results/'+mine[0].id,one)).json()).result;assert.equal(detail.answers.length,10);assert.equal(detail.questions.length,10);assert.equal(detail.origin,undefined);
 const assessment=(await db.query('SELECT * FROM assessments')).rows[0];assert.equal((await call('/instructor/assessments',teacher,'POST',assessment)).status,409);
 }finally{await db.close();}
});
