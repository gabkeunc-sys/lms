import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
test('mixed question editor and previews render without exposing answer in student preview',async()=>{
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',addEventListener(){},querySelector(){return element('#child');},showModal(){},remove(){}});return elements.get(id);};
 const context=vm.createContext({structuredClone,console,document:{querySelectorAll:()=>[],createElement:()=>element('#dialog'),body:{append(){}}},$:element,escape:s=>String(s??'').replaceAll('<','&lt;'),confirm:()=>true});
 vm.runInContext(await readFile(new URL('../public/instructor.js',import.meta.url),'utf8'),context);
 vm.runInContext("teacherCourses=[{id:'c',title:'Course'}];editExam({title:'Test',questions:[{type:'text',prompt:'Explain',model_answer:'SECRET',rubric:'Rubric',points:10,tag:'',explanation:''}]});",context);
 assert.ok(element('#main').innerHTML.includes('모범답안'));assert.ok(element('#main').innerHTML.includes('SECRET'));assert.ok(element('#main').innerHTML.includes('채점 기준'));
 vm.runInContext("captureExam=()=>{};previewExam();",context);assert.ok(element('#dialog').innerHTML.includes('textarea'));assert.ok(!element('#dialog').innerHTML.includes('SECRET'));
 vm.runInContext('editExam();',context);assert.ok(element('#main').innerHTML.includes('보기 4'));
});
