import {guidanceAPI} from './guidance.mjs';
import {pathAPI} from './path.mjs';
import {assessmentAPI} from './assessment.mjs';
import {settingsAPI} from './ai.mjs';
import {resultsAPI} from './results.mjs';
import {instructorAPI} from './instructor.mjs';
import {adminOverviewAPI} from './admin.mjs';
import { randomBytes, randomUUID, timingSafeEqual, createHash, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
import { NOW, nowPlus } from './db.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const COOKIE = '__Host-lms_session';
const publicUser = u => ({id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,created_at:u.created_at});
// PBKDF2-SHA256 through WebCrypto keeps login inside the Workers free-plan CPU budget (Workers caps iterations at 100000).
// The iteration count is stored in each hash, so it can be changed later without breaking existing accounts.
const MAX_ITERATIONS = 100000;
const iterations = () => Math.min(MAX_ITERATIONS, Math.max(10000, Number(globalThis.process?.env?.PBKDF2_ITERATIONS) || MAX_ITERATIONS));
async function pbkdf2(password, salt, count) {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
 return Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:Buffer.from(salt,'hex'), iterations:count}, key, 256));
}
export async function hashPassword(password) {
 const salt=randomBytes(16).toString('hex'), count=iterations();
 return `pbkdf2_sha256$${count}$${salt}$${(await pbkdf2(password,salt,count)).toString('hex')}`;
}
// Hashes migrated from the Netlify version are scrypt "salt:hash"; they are verified once and replaced on login.
const isLegacy = stored => /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(String(stored));
async function verify(password, stored) {
 if(isLegacy(stored)) {
  const [salt,hash]=stored.split(':'), actual=await scrypt(password,salt,64);
  return timingSafeEqual(actual,Buffer.from(hash,'hex'));
 }
 const [scheme,count,salt,hash]=String(stored).split('$');
 const valid=scheme==='pbkdf2_sha256' && /^\d+$/.test(count) && Number(count)>0 && Number(count)<=MAX_ITERATIONS && /^[a-f0-9]{32}$/.test(salt) && /^[a-f0-9]{64}$/.test(hash);
 // Unknown or disabled hashes still cost the same work, so response time does not reveal which accounts exist.
 const actual=await pbkdf2(password, valid?salt:'00'.repeat(16), valid?Number(count):iterations());
 return valid && timingSafeEqual(actual,Buffer.from(hash,'hex'));
}
export function createHandler(db) {
 const query=(sql,params=[])=>db.query(sql,params);
 return async (request, context={}) => {
  const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
  const fail=(message,status=400)=>response({error:message},status);
  const url=new URL(request.url), path=url.pathname.replace(/^\/api/,'');
  const method=request.method;
  try {
   if (!['GET','POST','PATCH'].includes(method)) return fail('허용되지 않는 요청입니다.',405);
   if(method!=='GET' && (request.headers.get('origin')!==url.origin || !request.headers.get('content-type')?.startsWith('application/json'))) return fail('요청 출처를 확인할 수 없습니다.',403);
   let body={};
   if(method!=='GET') {
    const text=await request.text();
    if(text.length>(/^\/api\/(instructor|student)\//.test(url.pathname)?600000:4096)) return fail('입력 크기를 초과했습니다.',413);
    try {body=JSON.parse(text);} catch {return fail('올바른 입력이 아닙니다.');}
    if(!body || typeof body!=='object' || Array.isArray(body)) return fail('올바른 입력이 아닙니다.');
   }
   const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
   const session=token && /^[a-f0-9]{64}$/.test(token) ? (await query(`SELECT u.* FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>${NOW} AND u.active=1`,[digest(token)])).rows[0] : null;
   if(path==='/me' && method==='GET') return session ? response({user:publicUser(session)}) : fail('로그인이 필요합니다.',401);
   if(path==='/logout' && method==='POST') {
    if(token) await query('DELETE FROM app_sessions WHERE token_hash=$1',[digest(token)]);
    return response({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
   }
   if(['/register','/login'].includes(path) && method==='POST') {
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const password=body.password;
    if(!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||(path==='/login'&&/^[a-z0-9._-]{3,40}$/.test(email)))||email.length>254||typeof password!=='string'||password.length<10||password.length>128) return fail('올바른 이메일과 10~128자 비밀번호를 입력하세요.');
    for(const [key,max] of [[`ip:${context.ip||'unknown'}`,40],[`email:${email}`,12]]) {
     const keyHash=digest(key);
     const count=(await query(`INSERT INTO auth_limits(key,hits,expires_at) VALUES($1,1,${nowPlus('+15 minutes')}) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN auth_limits.expires_at<${NOW} THEN 1 ELSE auth_limits.hits+1 END, expires_at=CASE WHEN auth_limits.expires_at<${NOW} THEN ${nowPlus('+15 minutes')} ELSE auth_limits.expires_at END RETURNING hits`,[keyHash])).rows[0].hits;
     if(count>max) return fail('시도가 너무 많습니다. 15분 후 다시 시도하세요.',429);
    }
    if(path==='/register') {
     const name=typeof body.name==='string'?body.name.trim():'';
     if(!name||name.length>80) return fail('이름은 1~80자로 입력하세요.');
     const passwordHash=await hashPassword(password);
     const inserted=await query(`INSERT INTO app_users(id,name,email,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id`,[randomUUID(),name,email,passwordHash]);
     if(!inserted.rows.length) return fail('이미 등록된 이메일입니다.',409);
     return response({ok:true},201);
    }
    const user=(await query('SELECT * FROM app_users WHERE email=$1',[email])).rows[0];
    const valid=await verify(password,user?.password_hash||'');
    if(!user||!valid||!user.active) return fail('이메일 또는 비밀번호가 올바르지 않거나 비활성 계정입니다.',401);
    if(isLegacy(user.password_hash)) await query('UPDATE app_users SET password_hash=$1 WHERE id=$2 AND password_hash=$3',[await hashPassword(password),user.id,user.password_hash]);
    const fresh=randomBytes(32).toString('hex');
    if(token) await query('DELETE FROM app_sessions WHERE token_hash=$1',[digest(token)]);
    await query(`DELETE FROM app_sessions WHERE expires_at<${NOW}`);
    await query(`INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,${nowPlus('+8 hours')})`,[digest(fresh),user.id]);
    return response({user:publicUser(user)},200,{'Set-Cookie':`${COOKIE}=${fresh}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`});
   }
   if(path==='/me/password' && method==='POST') {
    if(!session) return fail('로그인이 필요합니다.',401);
    if(typeof body.currentPassword!=='string'||body.currentPassword.length>128||typeof body.password!=='string'||body.password.length<10||body.password.length>128) return fail('현재 비밀번호와 10~128자의 새 비밀번호를 입력하세요.');
    const key=digest('password:'+session.id);
    const hits=(await query(`INSERT INTO auth_limits(key,hits,expires_at) VALUES($1,1,${nowPlus('+15 minutes')}) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN auth_limits.expires_at<${NOW} THEN 1 ELSE auth_limits.hits+1 END, expires_at=CASE WHEN auth_limits.expires_at<${NOW} THEN ${nowPlus('+15 minutes')} ELSE auth_limits.expires_at END RETURNING hits`,[key])).rows[0].hits;
    if(hits>8) return fail('시도가 너무 많습니다. 15분 후 다시 시도하세요.',429);
    if(!await verify(body.currentPassword,session.password_hash)) return fail('현재 비밀번호가 일치하지 않습니다.',400);
    if(body.password===body.currentPassword) return fail('현재 비밀번호와 다른 비밀번호를 입력하세요.');
    const changed=await query(`UPDATE app_users SET password_hash=$1 WHERE id=$2 AND password_hash=$3 AND active=1 RETURNING id`,[await hashPassword(body.password),session.id,session.password_hash]);
    if(!changed.rows.length) return fail('계정 정보가 변경되었습니다. 다시 로그인하세요.',409);
    await query('DELETE FROM app_sessions WHERE user_id=$1',[session.id]);
    return response({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
   }
   if(path==='/student/learning-path'||/^\/instructor\/(learning-path\/[^/]+|courses\/[^/]+\/modules)$/.test(path))return await pathAPI({path,method,body,session,query,response,fail});
   if(/^\/(instructor|student)\/guidance(?:\/generate|\/prompts)?$/.test(path))return await guidanceAPI({path,method,body,session,query,response,fail});
   if(path==='/admin/overview') return await adminOverviewAPI({method,session,query,response,fail});
   if(path.startsWith('/admin/ai')) return await settingsAPI({path,method,body,session,query,response,fail});
   if(/^\/(instructor|student)\/assessments(?:\/|$)/.test(path)&&!(path==='/instructor/assessments')) return await assessmentAPI({path,method,body,session,query,response,fail});
   if(/^\/instructor\/results\/[^/]+\/(analyze|confirm)$/.test(path)) return await assessmentAPI({path,method,body,session,query,response,fail});
   if(/^\/(instructor|student)\/results(?:\/[a-f0-9-]{36})?$/.test(path)) return await resultsAPI({path,method,session,query,response,fail});
   if(path.startsWith('/instructor/')||path==='/admin/role') return await instructorAPI({path,method,body,session,query,response,fail});
   if(path.startsWith('/admin/')) {
    if(!session) return fail('로그인이 필요합니다.',401);
    if(session.role!=='admin') return fail('관리자만 접근할 수 있습니다.',403);
    if(path==='/admin/users' && method==='POST') {
     const name=typeof body.name==='string'?body.name.trim():'';
     const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
     if(!name||name.length>80) return fail('이름은 1~80자로 입력하세요.');
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return fail('올바른 이메일을 입력하세요.');
     if(typeof body.password!=='string'||body.password.length<10||body.password.length>128) return fail('비밀번호는 10~128자로 입력하세요.');
     const inserted=await query(`INSERT INTO app_users(id,name,email,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id,name,email,role,active,created_at`,[randomUUID(),name,email,await hashPassword(body.password)]);
     if(!inserted.rows.length) return fail('이미 등록된 이메일입니다.',409);
     return response({user:inserted.rows[0]},201);
    }
    const resetMatch=path.match(/^\/admin\/users\/([a-f0-9-]{36})\/password$/);
    if(resetMatch && method==='POST') {
     if(typeof body.password!=='string'||body.password.length<10||body.password.length>128) return fail('비밀번호는 10~128자로 입력하세요.');
     const result=await query(`UPDATE app_users SET password_hash=$1 WHERE id=$2 AND role='student' RETURNING id`,[await hashPassword(body.password),resetMatch[1]]);
     if(!result.rows.length) return fail('학생 계정만 변경할 수 있습니다.',400);
     await query('DELETE FROM app_sessions WHERE user_id=$1',[resetMatch[1]]);
     return response({ok:true});
    }
    if(path==='/admin/users' && method==='GET') {
     const search=(url.searchParams.get('q')||'').slice(0,80);
     const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page')||'1',10)||1));
     const params=['%'+search+'%'];
     const total=Number((await query('SELECT count(*) AS count FROM app_users WHERE name LIKE $1 OR email LIKE $1',params)).rows[0].count);
     const users=(await query('SELECT id,name,email,role,active,created_at FROM app_users WHERE name LIKE $1 OR email LIKE $1 ORDER BY created_at DESC,id LIMIT 10 OFFSET $2',[...params,(page-1)*10])).rows;
     return response({users,total,page});
    }
    const match=path.match(/^\/admin\/users\/([a-f0-9-]{36})$/);
    if(match && method==='PATCH') {
     if(Object.hasOwn(body,'name') || Object.hasOwn(body,'email')) {
      const name=typeof body.name==='string'?body.name.trim():'';
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      if(!name||name.length>80) return fail('이름은 1~80자로 입력하세요.');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return fail('올바른 이메일을 입력하세요.');
      try {
       const result=await query(`UPDATE app_users SET name=$1,email=$2 WHERE id=$3 AND role='student' RETURNING id`,[name,email,match[1]]);
       if(!result.rows.length) return fail('학생 계정만 변경할 수 있습니다.',400);
       await query('DELETE FROM app_sessions WHERE user_id=$1',[match[1]]);
       return response({ok:true});
      } catch(error) {if(error.code==='23505') return fail('이미 등록된 이메일입니다.',409);throw error;}
     }
     if(typeof body.active!=='boolean') return fail('계정 상태를 지정하세요.');
     const updated=await query(`UPDATE app_users SET active=$1 WHERE id=$2 AND role='student' RETURNING id`,[body.active,match[1]]);
     if(!updated.rows.length) return fail('학생 계정만 변경할 수 있습니다.',400);
     if(!body.active) await query('DELETE FROM app_sessions WHERE user_id=$1',[match[1]]);
     return response({ok:true});
    }
   }
   return fail('요청한 기능을 찾을 수 없습니다.',404);
  } catch(error) {
   console.error('LMS request failed',{code:error.code||'internal'});
   return fail('서버 연결을 확인해 주세요. 잠시 후 다시 시도하세요.',503);
  }
 };
}



