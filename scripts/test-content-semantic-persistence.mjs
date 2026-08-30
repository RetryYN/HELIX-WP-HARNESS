import assert from "node:assert/strict";
import {openDashboardDb,projectDashboard} from "./keyword-dashboard-db.mjs";

const dbPath=".helix/keyword-dashboard.sqlite";
const snapshot=()=>{
  const db=openDashboardDb(dbPath);
  try{
    const data=projectDashboard(db),resolvedGroups=data.groups.filter((row)=>row.main_keyword),reviews=data.content_semantic_reviews,tasks=data.content_semantic_resolution_tasks;
    assert.equal(reviews.length,resolvedGroups.length);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM content_semantic_reviews").get().count,reviews.length);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM content_semantic_resolution_tasks").get().count,tasks.length);
    assert(tasks.length>0);
    assert(tasks.every((row)=>row.task_digest.length===64&&row.concept.supporting_keyword_ids.length>0&&row.concept.supporting_keyword_samples.length>0&&row.concept.path_digests.length>0&&!row.auto_resolution&&!row.auto_group_assignment&&!row.auto_selection&&!row.auto_content_mutation));
    return {review_digests:reviews.map((row)=>[row.group_id,row.review_digest]),task_digests:tasks.map((row)=>[row.task_id,row.task_digest,row.priority_score,row.priority_band])};
  }finally{db.close()}
};

const before=snapshot(),after=snapshot();
assert.deepEqual(after,before,"persisted semantic reviews and task priority/digests must survive close/reopen identically");
console.log(`content semantic persistence: OK (${before.review_digests.length} groups, ${before.task_digests.length} tasks, restart-identical digests/priorities/source lineage)`);
