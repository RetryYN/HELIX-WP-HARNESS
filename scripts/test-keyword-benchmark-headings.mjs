import assert from 'node:assert/strict';
import {contextualizeBenchmarkHeadings} from './audit-keyword-benchmark-readiness.mjs';
const headings=[
 {page_id:'a',position:0,level:1,text:'回答の作り方'},
 {page_id:'a',position:1,level:2,text:'職種A'},
 {page_id:'a',position:2,level:4,text:'例文'},
 {page_id:'a',position:3,level:6,text:'経験の根拠'},
 {page_id:'a',position:4,level:2,text:'職種B'},
 {page_id:'a',position:5,level:4,text:'例文'},
 {page_id:'b',position:0,level:3,text:'例文'},
];
const before=JSON.stringify(headings),rows=contextualizeBenchmarkHeadings([...headings].reverse());
assert.equal(rows.length,6);
assert.equal(JSON.stringify(headings),before);
assert.deepEqual(rows.find(h=>h.page_id==='a'&&h.position===2).ancestors.map(h=>h.text),['回答の作り方','職種A']);
assert.deepEqual(rows.find(h=>h.page_id==='a'&&h.position===5).ancestors.map(h=>h.text),['回答の作り方','職種B']);
assert.equal(rows.find(h=>h.page_id==='b').ancestors.length,0);
assert.equal(rows.filter(h=>h.text==='例文').length,3);
assert.ok(rows.every(h=>h.semantic_match_state==='not_reviewed'));
assert.throws(()=>contextualizeBenchmarkHeadings([headings[0],headings[0]]),/duplicate/);
assert.throws(()=>contextualizeBenchmarkHeadings([{...headings[0],level:7}]),/invalid/);
console.log('benchmark headings: OK (H4-H6 retained, ancestor context, repeated text distinct, page isolation)');
