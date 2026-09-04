// A census of one review queue, not a sample for whole-population accuracy.
export function selectSemanticReviewStratum(pairs,decision){
  if(!["merge_review","split_review"].includes(decision))throw new Error("review-stratum must be merge_review or split_review");
  const selected=pairs.filter(row=>row.decision===decision),seen=new Set();
  for(const row of selected){
    const key=JSON.stringify([row.left_task_id,row.right_task_id].sort());
    if(!row.left_task_id||!row.right_task_id||row.left_task_id===row.right_task_id||seen.has(key))throw new Error("invalid or duplicate review pair");
    seen.add(key);
  }
  return selected.toSorted((a,b)=>JSON.stringify([a.left_task_id,a.right_task_id].sort()).localeCompare(JSON.stringify([b.left_task_id,b.right_task_id].sort())));
}
