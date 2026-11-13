import {guidanceAPI} from './guidance.mjs';
import {assessmentAPI} from './assessment.mjs';
import {settingsAPI} from './ai.mjs';
import {resultsAPI} from './results.mjs';
import {instructorAPI} from './instructor.mjs';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
const COOKIE = '__Host-lms_session';
const publicUser = u => ({id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,created_at:u.created_at});
export async function hashPassword(password) {
 const salt=randomBytes(16).toString('hex');
 const hash=await scrypt(password,salt,64);
 return `${salt}:${hash.toString('hex')}`;
}
async function verify(password, stored) {
 const [salt,hash]=stored.split(':');
 const actual=await scrypt(password,salt,64);
 const expected=Buffer.from(hash,'hex');
 return actual.length===expected.length && timingSafeEqual(actual,expected);
}
const dummyPromise=hashPassword(randomBytes(32).toString('hex'));
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
   const session=token && /^[a-f0-9]{64}$/.test(token) ? (await query('SELECT u.* FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[digest(token)])).rows[0] : null;
   if(path==='/me' && method==='GET') return session ? response({user:publicUser(session)}) : fail('로그인이 필요합니다.',401);
   if(path==='/logout' && method==='POST') {
    if(token) await query('DELETE FROM app_sessions WHERE token_hash=$1',[digest(token)]);
    return response({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
   }
   if(['/register','/login'].includes(path) && method==='POST') {
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const password=body.password;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<10||password.length>128) return fail('올바른 이메일과 10~128자 비밀번호를 입력하세요.');
    for(const [key,max] of [[`ip:${context.ip||'unknown'}`,40],[`email:${email}`,12]]) {
     const keyHash=digest(key);
     const count=(await query(`INSERT INTO auth_limits(key,hits,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN auth_limits.expires_at<now() THEN 1 ELSE auth_limits.hits+1 END, expires_at=CASE WHEN auth_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE auth_limits.expires_at END RETURNING hits`,[keyHash])).rows[0].hits;
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
    const valid=await verify(password,user?.password_hash||await dummyPromise);
    if(!user||!valid||!user.active) return fail('이메일 또는 비밀번호가 올바르지 않거나 비활성 계정입니다.',401);
    const fresh=randomBytes(32).toString('hex');
    if(token) await query('DELETE FROM app_sessions WHERE token_hash=$1',[digest(token)]);
    await query('DELETE FROM app_sessions WHERE expires_at<now()');
    await query(`INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')`,[digest(fresh),user.id]);
    return response({user:publicUser(user)},200,{'Set-Cookie':`${COOKIE}=${fresh}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`});
   }
   if(path==='/me/password' && method==='POST') {
    if(!session) return fail('로그인이 필요합니다.',401);
    if(typeof body.currentPassword!=='string'||body.currentPassword.length>128||typeof body.password!=='string'||body.password.length<10||body.password.length>128) return fail('현재 비밀번호와 10~128자의 새 비밀번호를 입력하세요.');
    const key=digest('password:'+session.id);
    const hits=(await query(`INSERT INTO auth_limits(key,hits,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN auth_limits.expires_at<now() THEN 1 ELSE auth_limits.hits+1 END, expires_at=CASE WHEN auth_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE auth_limits.expires_at END RETURNING hits`,[key])).rows[0].hits;
    if(hits>8) return fail('시도가 너무 많습니다. 15분 후 다시 시도하세요.',429);
    if(!await verify(body.currentPassword,session.password_hash)) return fail('현재 비밀번호가 일치하지 않습니다.',400);
    if(body.password===body.currentPassword) return fail('현재 비밀번호와 다른 비밀번호를 입력하세요.');
    const changed=await query(`WITH changed AS (UPDATE app_users SET password_hash=$1 WHERE id=$2 AND password_hash=$3 AND active=true RETURNING id), revoked AS (DELETE FROM app_sessions WHERE user_id IN (SELECT id FROM changed)) SELECT id FROM changed`,[await hashPassword(body.password),session.id,session.password_hash]);
    if(!changed.rows.length) return fail('계정 정보가 변경되었습니다. 다시 로그인하세요.',409);
    return response({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
   }
   if(/^\/(instructor|student)\/guidance(?:\/generate)?$/.test(path))return await guidanceAPI({path,method,body,session,query,response,fail});
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
     const result=await query(`WITH changed AS (UPDATE app_users SET password_hash=$1 WHERE id=$2 AND role='student' RETURNING id), revoked AS (DELETE FROM app_sessions WHERE user_id IN (SELECT id FROM changed)) SELECT id FROM changed`,[await hashPassword(body.password),resetMatch[1]]);
     if(!result.rows.length) return fail('학생 계정만 변경할 수 있습니다.',400);
     return response({ok:true});
    }
    if(path==='/admin/users' && method==='GET') {
     const search=(url.searchParams.get('q')||'').slice(0,80);
     const page=Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page')||'1',10)||1));
     const params=['%'+search+'%'];
     const total=Number((await query('SELECT count(*) AS count FROM app_users WHERE name ILIKE $1 OR email ILIKE $1',params)).rows[0].count);
     const users=(await query('SELECT id,name,email,role,active,created_at FROM app_users WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY created_at DESC,id LIMIT 10 OFFSET $2',[...params,(page-1)*10])).rows;
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
       const result=await query(`WITH changed AS (UPDATE app_users SET name=$1,email=$2 WHERE id=$3 AND role='student' RETURNING id), revoked AS (DELETE FROM app_sessions WHERE user_id IN (SELECT id FROM changed)) SELECT id FROM changed`,[name,email,match[1]]);
       if(!result.rows.length) return fail('학생 계정만 변경할 수 있습니다.',400);
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



