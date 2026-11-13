import {test} from 'node:test';import assert from 'node:assert/strict';import {scryptSync,randomBytes,randomUUID} from 'node:crypto';
import {createHandler} from '../server/auth.mjs';import {createTestDatabase} from './helpers/d1.mjs';
test('accounts migrated with Netlify scrypt hashes log in once and are upgraded to PBKDF2',async()=>{
 const db=await createTestDatabase({migrations:['0001_schema.sql','0007_operations.sql']});
 const salt=randomBytes(16).toString('hex'),legacy=`${salt}:${scryptSync('Legacy-pass-2026',salt,64).toString('hex')}`,id=randomUUID();
 await db.query('INSERT INTO app_users(id,name,email,password_hash) VALUES($1,$2,$3,$4)',[id,'기존 회원','old@example.com',legacy]);
 const handler=createHandler(db),login=password=>handler(new Request('https://lms.test/api/login',{method:'POST',headers:{origin:'https://lms.test','content-type':'application/json'},body:JSON.stringify({email:'old@example.com',password})}),{ip:'legacy'});
 assert.equal((await login('Wrong-pass-2026')).status,401);
 assert.equal((await db.query('SELECT password_hash FROM app_users WHERE id=$1',[id])).rows[0].password_hash,legacy);
 assert.equal((await login('Legacy-pass-2026')).status,200);
 assert.match((await db.query('SELECT password_hash FROM app_users WHERE id=$1',[id])).rows[0].password_hash,/^pbkdf2_sha256\$/);
 assert.equal((await login('Legacy-pass-2026')).status,200);
});
