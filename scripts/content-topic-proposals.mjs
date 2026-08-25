import { createHash } from "node:crypto";
import { tokenizeMatchText } from "./keyword-article-matching.mjs";
import { genericMatchTokens } from "./keyword-policy.mjs";

const generic=new Set(genericMatchTokens);
const distinctTokens=(value)=>new Set(tokenizeMatchText(value).filter((token)=>!generic.has(token)));
const overlapScore=(topicTokens,groupTokens)=>topicTokens.size?[...topicTokens].filter((token)=>groupTokens.has(token)).length/topicTokens.size:0;
const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildContentTopicProposals(groups,occurrences){
  const groupTokens=new Map(groups.map((group)=>[group.id,new Set([group.main_keyword,...(group.intent_keywords??[])].filter(Boolean).flatMap((value)=>[...distinctTokens(value)]))]));
  const grouped=new Map();
  for(const occurrence of occurrences){const key=`${occurrence.group_id}\0${occurrence.demand_type}\0${occurrence.normalized_value}`;const row=grouped.get(key)??{group_id:occurrence.group_id,topic_kind:occurrence.demand_type,normalized_topic:occurrence.normalized_value,display_topic:occurrence.value,occurrences:[]};row.occurrences.push(occurrence);grouped.set(key,row)}
  const proposals=[];
  for(const row of grouped.values()){
    const tokens=distinctTokens(row.normalized_topic),scores=groups.map((group)=>({group_id:group.id,score:overlapScore(tokens,groupTokens.get(group.id))})).filter((item)=>item.score>0).sort((a,b)=>b.score-a.score||a.group_id.localeCompare(b.group_id));
    const own=scores.find((item)=>item.group_id===row.group_id)?.score??0,best=scores[0]?.score??0;
    const relation=own>0&&own>=best?"same_group":best>0?"cross_group":"unmatched";
    const taskIds=[...new Set(row.occurrences.map((item)=>item.task_id))].sort(),targetGroupIds=scores.filter((item)=>item.group_id!==row.group_id&&item.score===best).map((item)=>item.group_id);
    const priority=Math.round((row.topic_kind==="paa"?30:20)+Math.min(taskIds.length,10)*5+own*100+(relation==="cross_group"?10:0));
    const evidence=row.occurrences.map((item)=>({occurrence_id:item.occurrence_id,task_id:item.task_id,snapshot_digest:item.snapshot_digest})).sort((a,b)=>a.occurrence_id.localeCompare(b.occurrence_id));
    proposals.push({proposal_id:digest([row.group_id,row.topic_kind,row.normalized_topic]).slice(0,24),group_id:row.group_id,topic_kind:row.topic_kind,normalized_topic:row.normalized_topic,display_topic:row.display_topic,relation,occurrence_count:row.occurrences.length,task_count:taskIds.length,relevance_score:own,priority_score:priority,target_group_ids:targetGroupIds,status:"proposed",evidence_digest:digest(evidence),evidence});
  }
  return proposals.sort((left,right)=>right.priority_score-left.priority_score||right.occurrence_count-left.occurrence_count||left.normalized_topic.localeCompare(right.normalized_topic,"ja"));
}

export function buildContentStructureCandidates(groups,proposals,{maxHeadings=8,maxTitleTopics=2}={}){
  return groups.filter((group)=>group.main_keyword).map((group)=>{
    const ranked=proposals.filter((item)=>item.group_id===group.id&&item.relation==="same_group").slice(0,maxHeadings);
    const titleTopics=ranked.slice(0,maxTitleTopics).map((item)=>item.display_topic);
    const title=titleTopics.length?`${group.main_keyword}｜${titleTopics.join("・")}`:group.main_keyword;
    return{group_id:group.id,title_candidate:title,heading_candidates:ranked.map((item,index)=>({level:index===0?2:3,text:item.display_topic,topic_proposal_id:item.proposal_id,evidence_digest:item.evidence_digest})),source_topic_ids:ranked.map((item)=>item.proposal_id),status:"proposed",candidate_digest:digest([group.id,title,ranked.map((item)=>item.evidence_digest)])};
  });
}
