import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/dashboard.js',import.meta.url),'utf8'),context);
const summarize=context.summarizeStudentResults;
test('dashboard excludes pending grades and computes normalized scores and weighted concepts',()=>{
 const data=[{id:'a',grading_status:'confirmed',score:30,total:40,submitted_at:'2026-01-01',questions:[{tag:'HTTP',points:10,answer:1},{type:'text',tag:'HTTP',points:30}],answers:[1,'text'],grading:[{}, {score:20}]},{id:'b',grading_status:'confirmed',score:50,total:100,submitted_at:'2026-01-02',questions:[{tag:'JS',points:100,answer:1}],answers:[0]},{grading_status:'pending',score:100,total:100}];
 const s=summarize(data);assert.equal(s.average,62.5);assert.equal(s.latest,50);assert.equal(s.change,-25);assert.equal(s.pending,1);assert.equal(s.concepts.find(c=>c.tag==='HTTP').rate,75);assert.equal(s.full,1);assert.equal(s.partial,1);assert.equal(s.zero,1);assert.equal(s.types.text.earned,20);
});
test('dashboard handles no results, one assessment, and no subjective questions',()=>{assert.equal(summarize([]).average,null);const s=summarize([{grading_status:'confirmed',score:10,total:10,submitted_at:'2026-01-01',questions:[{points:10,answer:0}],answers:[0]}]);assert.equal(s.change,null);assert.equal(s.types.text.total,0);assert.equal(s.concepts[0].rate,100);});
