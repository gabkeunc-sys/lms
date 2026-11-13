import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/d1.mjs';
import {createHandler} from '../server/auth.mjs';
test('self password change requires current password and revokes all sessions',async()=>{
 const db=await createTestDatabase({migrations:['0001_schema.sql','0007_operations.sql','0008_teaching_tools.sql']});
 try {
 const handler=createHandler(db);
 const call=(path,body,cookie='')=>handler(new Request('https://lms.test/api'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://lms.test',cookie},body:JSON.stringify(body)}),{ip:'self-test'});
 const account={name:'Password test',email:'self@example.com',password:'Original-test-2026'};
 await call('/register',account);
 const login=await call('/login',account),cookie=login.headers.get('set-cookie').split(';')[0];
 const second=await call('/login',account),cookie2=second.headers.get('set-cookie').split(';')[0];
 const change={currentPassword:account.password,password:'Replacement-test-2026'};
 assert.equal((await call('/me/password',change)).status,401);
 assert.equal((await call('/me/password',{...change,currentPassword:'Wrong-password'},cookie)).status,400);
 assert.equal((await call('/me/password',{...change,password:'short'},cookie)).status,400);
 assert.equal((await call('/me/password',{...change,password:account.password},cookie)).status,400);
 assert.equal((await call('/me/password',change,cookie)).status,200);
 assert.equal((await call('/me/password',change,cookie2)).status,401);
 assert.equal((await db.query('SELECT * FROM app_sessions')).rows.length,0);
 assert.equal((await call('/login',account)).status,401);
 assert.equal((await call('/login',{...account,password:change.password})).status,200);
 } finally {}
});
