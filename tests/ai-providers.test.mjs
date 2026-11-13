import {test} from 'node:test';import assert from 'node:assert/strict';import {encryptKey,generate} from '../server/ai.mjs';
test('provider adapters use isolated hosts, authentication and validated structured grades',async()=>{
 const old=process.env.LMS_SETTINGS_KEY;process.env.LMS_SETTINGS_KEY='b'.repeat(64);
 try{
 const encrypted_key=encryptKey('test-provider-key'),payload={answer:'answer',maxPoints:10};
 for(const provider of ['gemini','openai','anthropic']){
  const grade={score:8,feedback:'설명을 보완하세요.'};let request;
  const fetcher=async(url,options)=>{request={url,...options,body:JSON.parse(options.body)};return Response.json(provider==='gemini'?{candidates:[{content:{parts:[{text:JSON.stringify(grade)}]}}]}:provider==='openai'?{status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(grade)}]}]}:{stop_reason:'tool_use',content:[{type:'tool_use',name:'submit_grade',input:grade}]});};
  assert.deepEqual(await generate({provider,model:'chosen-model',encrypted_key},payload,fetcher),grade);
  assert.equal(new URL(request.url).hostname,{gemini:'generativelanguage.googleapis.com',openai:'api.openai.com',anthropic:'api.anthropic.com'}[provider]);
  assert.ok(!request.url.includes('test-provider-key'));assert.ok(!JSON.stringify(request.body).includes('test-provider-key'));
  if(provider==='openai'){assert.equal(request.headers.Authorization,'Bearer test-provider-key');assert.equal(request.body.store,false);assert.equal(request.body.text.format.strict,true);}
  else assert.equal(request.headers['x-goog-api-key']||request.headers['x-api-key'],'test-provider-key');
 }
 for(const provider of ['openai','anthropic']){
  await assert.rejects(generate({provider,model:'model',encrypted_key},payload,async()=>Response.json({status:'incomplete',stop_reason:'max_tokens',output:[],content:[]})));
 }
 let called=false;await assert.rejects(generate({provider:'unknown',model:'model',encrypted_key},payload,async()=>{called=true;}));assert.equal(called,false);
 }finally{if(old===undefined)delete process.env.LMS_SETTINGS_KEY;else process.env.LMS_SETTINGS_KEY=old;}
});
