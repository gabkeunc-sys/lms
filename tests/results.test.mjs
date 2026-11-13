import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createHandler,hashPassword} from '../server/auth.mjs';import {createTestDatabase} from './helpers/d1.mjs';
test('results seed, score consistency and ownership boundaries',async()=>{
 const db=await createTestDatabase();
 const password='Testing-password-2026',hash=await hashPassword(password);
 // Demo accounts ship with disabled passwords; give the ones this test uses a known password and email.
 const demo=[['2316c163-ca5b-49e3-94b2-8d0852576799','teacher@example.com'],['9bd479c5-b6bd-45cb-a5f1-7a73cb4a9e1d','one@example.com'],['611ca32e-62a2-42c9-8adc-a0760d033208','two@example.com']];
 for(const [id,email] of demo)await db.query('UPDATE app_users SET email=$1,password_hash=$2 WHERE id=$3',[email,hash,id]);
 for(const [role,email,name] of [['admin','owner@example.com','Owner'],['instructor','other@example.com','Other']])await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),name,email,hash,role]);
 assert.equal((await db.query('SELECT count(*) AS n FROM app_users WHERE password_hash=$1',['!disabled'])).rows[0].n,7);
 const sample=(await db.query("SELECT questions FROM assessments WHERE id='f8cf20ce-2d01-4a7e-bc87-993d4a240918'")).rows[0];assert.equal(sample.questions.length,3);
 const results=(await db.query("SELECT * FROM assessment_results WHERE assessment_id='ad06a855-9a44-4dfa-aeda-43abfe37dd06' ORDER BY score DESC")).rows;assert.equal(results.length,9);
 for(const r of results){assert.equal(r.score,r.questions.reduce((sum,q,i)=>sum+(q.answer===r.answers[i]?q.points:0),0));assert.equal(r.total,100);}
 assert.equal((await db.query('SELECT count(*) AS n FROM assessment_results')).rows[0].n,18);
 const handler=createHandler(db),cookies={};
 const call=(path,cookie='',method='GET',body)=>handler(new Request('https://lms.test/api'+path,{method,headers:{cookie,origin:'https://lms.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{ip:randomUUID()});
 for(const email of ['teacher@example.com','one@example.com','two@example.com','owner@example.com','other@example.com']){const r=await call('/login','','POST',{email,password});assert.equal(r.status,200);cookies[email]=r.headers.get('set-cookie').split(';')[0];assert.ok((await r.json()).user.name);}
 assert.equal((await call('/login','','POST',{email:'student03@example.com',password})).status,401);
 const one=cookies['one@example.com'],two=cookies['two@example.com'],teacher=cookies['teacher@example.com'],other=cookies['other@example.com'];
 assert.equal((await call('/student/results')).status,401);assert.equal((await call('/instructor/results',one)).status,403);
 const mine=(await (await call('/student/results',one)).json()).results;assert.equal(mine.length,2);assert.equal(mine[0].questions,undefined);
 const exam=mine.find(r=>r.assessment_id==='ad06a855-9a44-4dfa-aeda-43abfe37dd06');
 assert.equal((await call('/student/results/'+exam.id,two)).status,404);
 assert.equal((await call('/instructor/results/'+exam.id,other)).status,404);
 assert.equal((await (await call('/instructor/results',teacher)).json()).results.length,18);
 assert.equal((await (await call('/instructor/results',other)).json()).results.length,0);
 const detail=(await (await call('/student/results/'+exam.id,one)).json()).result;assert.equal(detail.answers.length,10);assert.equal(detail.questions.length,10);assert.equal(detail.origin,undefined);
 const assessment=(await db.query("SELECT * FROM assessments WHERE id='ad06a855-9a44-4dfa-aeda-43abfe37dd06'")).rows[0];assert.equal((await call('/instructor/assessments',teacher,'POST',assessment)).status,409);
});
