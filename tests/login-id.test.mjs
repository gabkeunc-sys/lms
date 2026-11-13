import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createHandler,hashPassword} from '../server/auth.mjs';import {createTestDatabase} from './helpers/d1.mjs';
test('accounts with a plain login id can log in but ids cannot be registered',async()=>{
 const db=await createTestDatabase({migrations:['0001_schema.sql','0007_operations.sql','0008_teaching_tools.sql','0009_learning_tools.sql','0010_certificates.sql','0011_english_names.sql','0012_bank_quality.sql']});
 await db.query('INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),'관리자','admin',await hashPassword('Admin-login-2026'),'admin']);
 const handler=createHandler(db),post=(path,body)=>handler(new Request('https://lms.test/api'+path,{method:'POST',headers:{origin:'https://lms.test','content-type':'application/json'},body:JSON.stringify(body)}),{ip:randomUUID()});
 const res=await post('/login',{email:'Admin',password:'Admin-login-2026'});assert.equal(res.status,200);assert.equal((await res.json()).user.role,'admin');
 assert.equal((await post('/login',{email:'admin',password:'Wrong-password-1'})).status,401);
 assert.equal((await post('/register',{name:'x',email:'someone',password:'Register-test-2026'})).status,400);
});
