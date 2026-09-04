import assert from "node:assert/strict";
import {hasRedactedUrlIdentity} from "./retained-url-identity.mjs";
import {buildSerpPageKeywordGraph} from "./serp-page-keyword-graph.mjs";
const tasks=[{task_id:"a",group_id:"g1",keyword:"例A"},{task_id:"b",group_id:"g2",keyword:"例B"}];
for(const url of ["https://example.test/<redacted-post>","https://example.test/%3Credacted-user%3E","https://example.test/%3CREDACTED%3E?bad=%XX"]){
  assert(hasRedactedUrlIdentity(url));
  const organic=tasks.map(t=>({task_id:t.task_id,rank_group:1,url})),before=JSON.stringify(organic),graph=buildSerpPageKeywordGraph(tasks,organic);
  assert.equal(graph.edges.length,0);
  assert.equal(graph.relations.length,0);
  assert.equal(graph.pages.length,0);
  assert.equal(graph.identity_exclusions.length,2);
  assert(graph.identity_exclusions.every(r=>r.url===url&&r.reason==="non_unique_redacted_url"));
  assert.equal(JSON.stringify(organic),before);
}
assert.equal(hasRedactedUrlIdentity("https://site-a.example/stable-page"),false);
const mixed=buildSerpPageKeywordGraph(tasks,tasks.flatMap(t=>[{task_id:t.task_id,rank_group:1,url:"https://site-a.example/stable-page"},{task_id:t.task_id,rank_group:2,url:"https://example.test/<redacted-post>"}]));
assert.equal(mixed.relations.length,1);
assert.equal(mixed.relations[0].shared_url_count,1);
assert.equal(mixed.relations[0].overlap_ratio,.1);
assert.equal(mixed.identity_exclusions.length,2);
console.log("SERP URL identity: OK (no placeholder-created edges or relations, stable pseudonyms retained, exclusions traceable)");
