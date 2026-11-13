import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/d1.mjs';
import {createHandler} from '../server/auth.mjs';
import {randomUUID} from 'node:crypto';
test('instructor course ownership, role boundaries, assessment answers and persistence',async()=>{
 const db=await createTestDatabase({migrations:['0001_schema.sql','0007_operations.sql','0008_teaching_tools.sql']});try{
const handler=createHandler(db);
 const call=(path,method='GET',body,cookie='')=>handler(new Request('https://lms.test/api'+path,{method,headers:{origin:'https://lms.test','content-type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})}),{ip:randomUUID()});
 async function account(role,email){const a={name:role,email,password:'Password-test-2026'};await call('/register','POST',a);await db.query('UPDATE app_users SET role=$1 WHERE email=$2',[role,email]);const r=await call('/login','POST',a);return {cookie:r.headers.get('set-cookie').split(';')[0],user:(await r.json()).user};}
 const admin=await account('admin','admin@example.com'),teacher=await account('instructor','teacher@example.com'),other=await account('instructor','other@example.com'),student=await account('student','student@example.com');
 const c={title:'Full stack',description:'Goals',status:'preparing',start_date:'2026-11-12',end_date:'2026-12-12',student_ids:[student.user.id]};
 assert.equal((await call('/instructor/courses')).status,401);
 assert.equal((await call('/instructor/courses','POST',c,student.cookie)).status,403);
 let r=await call('/instructor/courses','POST',c,teacher.cookie);assert.equal(r.status,200);const course=(await r.json()).course;
 assert.equal((await call('/instructor/courses','POST',{...c,id:course.id},other.cookie)).status,404);
 assert.equal((await (await call('/instructor/courses','GET',null,other.cookie)).json()).courses.length,0);
 assert.equal((await (await call('/instructor/courses','GET',null,admin.cookie)).json()).courses.length,1);
 const exam={course_id:course.id,title:'Week 1',kind:'exam',week:1,duration:30,questions:[{prompt:'2+2?',options:['1','2','3','4'],answer:3,points:10,explanation:'Sum',tag:'Math'}]};
 r=await call('/instructor/assessments','POST',exam,teacher.cookie);assert.equal(r.status,200);const saved=(await r.json()).assessment;assert.equal(saved.questions[0].answer,3);
 assert.equal((await call('/instructor/assessments','POST',{...exam,id:saved.id},other.cookie)).status,403);
 assert.equal((await call('/instructor/assessments','GET',null,student.cookie)).status,403);
 assert.equal((await (await call('/instructor/assessments','GET',null,other.cookie)).json()).assessments.length,0);
 assert.equal((await call('/instructor/assessments','POST',{...exam,questions:[{...exam.questions[0],answer:5}]},teacher.cookie)).status,400);
 assert.equal((await call('/admin/role','PATCH',{id:student.user.id,role:'instructor'},teacher.cookie)).status,403);
 assert.equal((await call('/admin/role','PATCH',{id:admin.user.id,role:'student'},admin.cookie)).status,404);
 assert.equal((await call('/admin/role','PATCH',{id:teacher.user.id,role:'student'},admin.cookie)).status,400);
 assert.equal((await call('/admin/role','PATCH',{id:student.user.id,role:'instructor'},admin.cookie)).status,200);
 assert.equal((await call('/me','GET',null,student.cookie)).status,401);
 }finally{}
});
