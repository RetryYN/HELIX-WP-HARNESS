import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {selectSemanticReviewStratum} from "./select-semantic-review-stratum.mjs";
const pairs=[{left_task_id:"a",right_task_id:"b",decision:"merge_review",intent_similarity_score:.8},{left_task_id:"a",right_task_id:"c",decision:"merge_review",intent_similarity_score:.7},{left_task_id:"b",right_task_id:"c",decision:"split_review"},{left_task_id:"c",right_task_id:"d",decision:"not_retained"}];
const before=JSON.stringify(pairs);
assert.equal(selectSemanticReviewStratum(pairs,"merge_review").length,2);
assert.equal(selectSemanticReviewStratum(pairs,"split_review").length,1);
assert.deepEqual(selectSemanticReviewStratum([...pairs].reverse(),"merge_review"),selectSemanticReviewStratum(pairs,"merge_review"));
assert.equal(JSON.stringify(pairs),before);
assert.deepEqual(selectSemanticReviewStratum([],"merge_review"),[]);
assert.throws(()=>selectSemanticReviewStratum(pairs,"unknown"),/review-stratum/);
assert.throws(()=>selectSemanticReviewStratum([...pairs,{...pairs[0],left_task_id:"b",right_task_id:"a"}],"merge_review"),/duplicate/);
assert.throws(()=>selectSemanticReviewStratum([{left_task_id:"a",right_task_id:"a",decision:"merge_review"}],"merge_review"),/invalid/);
for(const args of [["--review-stratum","unknown"],["--review-stratum","merge_review","--sample-size","1","--seed","s"]]){
  const result=spawnSync(process.execPath,[new URL("./export-semantic-evaluation-cases.mjs",import.meta.url).pathname,...args],{encoding:"utf8",env:{...process.env,WP_DASHBOARD_DB:"/nonexistent/semantic-review-test.sqlite"}});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/review-stratum/);
  assert.doesNotMatch(result.stderr,/unable to open database/);
}
console.log("semantic review stratum: OK (complete queue, deterministic, no mutation, incompatible CLI modes rejected)");
