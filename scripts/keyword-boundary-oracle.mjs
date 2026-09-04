import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pairKey=(left,right)=>[left,right].sort().join("\0");

export function buildKeywordBoundaryOracle(legacyRows,intentPairs,retainedEdges=[]){
  const urlsByTask=new Map();
  for(const edge of retainedEdges){
    const url=edge.canonical_url??edge.url;
    if(!url||!(edge.rank>=1&&edge.rank<=10))continue;
    const urls=urlsByTask.get(edge.task_id)??new Set();urls.add(url);urlsByTask.set(edge.task_id,urls);
  }
  const legacy=new Map(legacyRows.filter((row)=>row.kind==="serp_pair").map((row)=>[pairKey(row.source_task_id,row.target_task_id),row]));
  const intent=new Map(intentPairs.map((row)=>[pairKey(row.left_task_id,row.right_task_id),row]));
  const actionableKeys=new Set([
    ...[...legacy].filter(([,row])=>row.review_required).map(([key])=>key),
    ...[...intent].filter(([,row])=>row.review_required).map(([key])=>key),
  ]),rows=[];
  for(const key of actionableKeys){
    let urlEvidence=legacy.get(key)??null;const intentEvidence=intent.get(key)??null;
    if(!urlEvidence&&!intentEvidence)continue;
    if(!urlEvidence&&intentEvidence){
      const left=[...(urlsByTask.get(intentEvidence.left_task_id)??[])].sort(),right=[...(urlsByTask.get(intentEvidence.right_task_id)??[])].sort();
      if(left.length&&right.length){
        const rightSet=new Set(right),shared=left.filter(url=>rightSet.has(url)).length;
        urlEvidence={overlap_ratio:shared/10,shared_url_count:shared,evidence_digest:digest({scope:"identifiable_retained_top_10",left_task_id:intentEvidence.left_task_id,right_task_id:intentEvidence.right_task_id,left_urls:left,right_urls:right})};
      }
    }
    const sameGroup=intentEvidence?.current_same_group??urlEvidence.current_same_group,urlOverlap=urlEvidence?.overlap_ratio??null,intentScore=intentEvidence?.intent_similarity_score??null;
    let decision,recommendedAction,reasonCodes;
    if(urlOverlap==null){decision="insufficient_url_evidence_review";recommendedAction="inspect_url_evidence";reasonCodes=["exact_url_comparison_unavailable"]}
    else if(sameGroup){
      if(urlOverlap<.3&&intentScore!=null&&intentScore<.38){decision="split_consensus_review";recommendedAction="consider_split";reasonCodes=["weak_exact_url_overlap","weak_composite_intent"]}
      else{decision="current_group_boundary_review";recommendedAction="verify_before_keep";reasonCodes=[urlOverlap<.6?"exact_url_overlap_below_merge_threshold":"composite_intent_below_merge_threshold"]}
    }else if(urlOverlap>=.6&&intentScore!=null&&intentScore>=.62){decision="merge_consensus_review";recommendedAction="consider_merge";reasonCodes=["strong_exact_url_overlap","strong_composite_intent"]}
    else if(urlOverlap>=.6){decision="url_only_merge_review";recommendedAction="inspect_intent_gap";reasonCodes=["strong_exact_url_overlap","composite_intent_not_confirmed"]}
    else if(intentScore!=null&&intentScore>=.62&&urlOverlap>=.3){decision="merge_signal_conflict_review";recommendedAction="keep_separate_or_internal_link";reasonCodes=["strong_composite_intent","exact_url_overlap_below_merge_threshold"]}
    else if(intentScore!=null&&intentScore>=.62){decision="semantic_adjacency_review";recommendedAction="keep_separate_related_topic";reasonCodes=["strong_composite_intent","weak_exact_url_overlap"]}
    else{decision="internal_link_boundary_review";recommendedAction="consider_internal_link";reasonCodes=["moderate_exact_url_overlap","composite_intent_not_confirmed"]}
    const leftTaskId=intentEvidence?.left_task_id??urlEvidence.source_task_id,rightTaskId=intentEvidence?.right_task_id??urlEvidence.target_task_id,leftKeyword=intentEvidence?.left_keyword??urlEvidence.source_keyword,rightKeyword=intentEvidence?.right_keyword??urlEvidence.target_keyword,record={left_task_id:leftTaskId,right_task_id:rightTaskId,left_group_id:intentEvidence?.left_group_id??urlEvidence.source_group_id,right_group_id:intentEvidence?.right_group_id??urlEvidence.target_group_id,left_keyword:leftKeyword,right_keyword:rightKeyword,current_same_group:Boolean(sameGroup),url_overlap_ratio:urlOverlap,shared_url_count:urlEvidence?.shared_url_count??null,intent_similarity_score:intentScore,intent_components:intentEvidence?.components??null,decision,recommended_action:recommendedAction,reason_codes:reasonCodes,url_evidence_digest:urlEvidence?.evidence_digest??null,intent_evidence_digest:intentEvidence?.pair_digest??null,policy:"keyword-boundary-consensus.v1",review_required:true,auto_mutation:false};
    rows.push({...record,boundary_digest:digest(record)});
  }
  const priority={merge_consensus_review:0,split_consensus_review:1,merge_signal_conflict_review:2,url_only_merge_review:3,current_group_boundary_review:4,semantic_adjacency_review:5,internal_link_boundary_review:6,insufficient_url_evidence_review:7};
  rows.sort((a,b)=>priority[a.decision]-priority[b.decision]||(b.intent_similarity_score??-1)-(a.intent_similarity_score??-1)||b.url_overlap_ratio-a.url_overlap_ratio||a.left_task_id.localeCompare(b.left_task_id));
  return{policy:"keyword-boundary-consensus.v1",rows,summary:{review_count:rows.length,merge_consensus_count:rows.filter((row)=>row.decision==="merge_consensus_review").length,split_consensus_count:rows.filter((row)=>row.decision==="split_consensus_review").length,signal_conflict_count:rows.filter((row)=>["merge_signal_conflict_review","url_only_merge_review"].includes(row.decision)).length,semantic_adjacency_count:rows.filter((row)=>row.decision==="semantic_adjacency_review").length,current_group_boundary_count:rows.filter((row)=>row.decision==="current_group_boundary_review").length,internal_link_boundary_count:rows.filter((row)=>row.decision==="internal_link_boundary_review").length,auto_mutation:false}};
}
