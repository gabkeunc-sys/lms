// Question images: stored in D1 as base64, served by id, and loaded for AI grading.
import {randomUUID} from 'node:crypto';
const DATA_URL=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
export const IMAGE_TOKEN=/!\[[^\]]*\]\(\/api\/images\/([a-f0-9-]{36})\)/g;
export async function imagesAPI({method,body,session,query,response,fail}){
 if(!session)return fail('로그인이 필요합니다.',401);
 if(!['instructor','admin'].includes(session.role))return fail('강사만 이미지를 올릴 수 있습니다.',403);
 if(method!=='POST')return fail('허용되지 않는 요청입니다.',405);
 const m=typeof body.data==='string'&&body.data.match(DATA_URL);
 if(!m)return fail('PNG·JPEG·WebP·GIF 이미지만 올릴 수 있습니다.');
 const bytes=Math.floor(m[2].length*3/4);
 if(bytes>440000)return fail('이미지가 너무 큽니다. 더 작은 이미지를 사용하세요.',413);
 const id=randomUUID();
 await query('INSERT INTO question_images(id,mime,data,bytes,created_by) VALUES($1,$2,$3,$4,$5)',[id,m[1],m[2],bytes,session.id]);
 return response({id,url:'/api/images/'+id});
}
// Data URLs for every image referenced in the given texts (max 4), for vision-capable AI grading.
export async function imagesForTexts(query,texts){
 const ids=[...new Set(texts.flatMap(t=>[...String(t||'').matchAll(IMAGE_TOKEN)].map(x=>x[1])))].slice(0,4);
 const out=[];
 for(const id of ids){const r=(await query('SELECT mime,data FROM question_images WHERE id=$1',[id])).rows[0];if(r)out.push(`data:${r.mime};base64,${r.data}`);}
 return out;
}
