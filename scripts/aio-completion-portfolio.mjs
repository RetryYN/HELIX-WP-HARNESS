import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildAioCompletionPortfolio(rows,taskScopes,{batchSize=100,retentionDays=30}={}){
  const scopeByTask=new Map(taskScopes.map((row)=>[row.task_id,row])),candidates=[];
  for(const row of rows.filter((item)=>item.response_state==="async_pending")){
    const scope=scopeByTask.get(row.task_id)??{},base={completion_candidate_id:`aio-completion:${row.task_id}`,task_id:row.task_id,group_id:scope.group_id??null,source_keyword:scope.keyword??null,response_state:row.response_state,request:{method:"GET",endpoint:`/v3/serp/google/organic/task_get/advanced/${row.task_id}`},provider_charge_usd:0,cost_semantics:"task_get_free_within_provider_retention_window",retention_days:retentionDays,retention_deadline_verification_required:true,lifecycle_state:"planned_not_polled",external_retrieval_triggered:false,auto_polling:false,auto_merge:false,policy:"aio-completion-portfolio.v1"};
    candidates.push({...base,candidate_digest:digest(base)});
  }
  candidates.sort((a,b)=>(a.source_keyword??"").localeCompare(b.source_keyword??"","ja")||a.task_id.localeCompare(b.task_id));
  const batches=[];for(let offset=0;offset<candidates.length;offset+=batchSize){const members=candidates.slice(offset,offset+batchSize),base={batch_id:`aio-completion-batch-${String(batches.length+1).padStart(3,"0")}`,candidate_ids:members.map((row)=>row.completion_candidate_id),task_count:members.length,request_method:"GET",provider_charge_usd:0,lifecycle_state:"planned_not_polled",retention_deadline_verification_required:true,external_retrieval_triggered:false,policy:"aio-completion-portfolio.v1"};batches.push({...base,batch_digest:digest(base)})}
  const resolvedCount=rows.filter((row)=>row.response_state==="resolved").length;
  return{candidates,batches,summary:{observed_container_count:rows.length,resolved_count:resolvedCount,async_pending_count:candidates.length,completion_task_count:candidates.length,avoided_repost_count:candidates.length,batch_count:batches.length,provider_charge_usd:0,retention_days:retentionDays,planned_count:candidates.length,polled_count:0,completed_count:0,failed_count:0,external_retrieval_triggered_count:0,retention_deadline_verification_required:true},policy:"aio-completion-portfolio.v1"};
}
