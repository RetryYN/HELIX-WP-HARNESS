import {buildKeywordHierarchy} from "./keyword-hierarchy.mjs";
import {groupBySerp,normalizeKeyword} from "./keyword-serp-core.mjs";
import {KEYWORD_POLICY_VERSION,modifierTerms} from "./keyword-policy.mjs";

const pairKey=(left,right)=>[left,right].sort().join("\0");
const isModifierKeyword=(keyword)=>modifierTerms.some((modifier)=>normalizeKeyword(keyword).endsWith(modifier));

export function buildLatestKeywordGroups(records,{highThreshold=0.8,possibleThreshold=0.6,comparisonDepth=5,siteId="it-shukatu.com"}={}){
  const hierarchy=buildKeywordHierarchy(records.map((row)=>({...row,raw_keyword:row.keyword})));
  const hierarchyById=new Map(hierarchy.map((row)=>[row.source_keyword_id,row]));
  const recordById=new Map(records.map((row)=>[row.source_keyword_id,row]));
  const representatives=records.filter((row)=>hierarchyById.get(row.source_keyword_id).representative_source_keyword_id===row.source_keyword_id);
  const representativeScope=new Map(representatives.map((row)=>[row.source_keyword_id,hierarchyById.get(row.source_keyword_id).root_source_keyword_id]));
  const representativeGrouping=groupBySerp(representatives,{highThreshold,possibleThreshold,comparisonDepth,scopeById:representativeScope});
  const observedGrouping=groupBySerp(records,{highThreshold,possibleThreshold,comparisonDepth,scopeById:new Map(hierarchy.map((row)=>[row.source_keyword_id,row.root_source_keyword_id]))});
  const representativePairs=new Map(representativeGrouping.pairs.map((pair)=>[pairKey(pair.left,pair.right),pair]));
  const pairs=observedGrouping.pairs.map((pair)=>{
    const leftRepresentative=hierarchyById.get(pair.left).representative_source_keyword_id;
    const rightRepresentative=hierarchyById.get(pair.right).representative_source_keyword_id;
    if(leftRepresentative===rightRepresentative)return{...pair,decision_ratio:1,intent_confidence:"normalized_alias",likely_same_intent:true,decision_source:"normalized_term_multiset"};
    const decision=representativePairs.get(pairKey(leftRepresentative,rightRepresentative));
    return{...pair,decision_ratio:decision.ratio,same_context:decision.same_context,intent_confidence:decision.intent_confidence,likely_same_intent:decision.likely_same_intent,decision_source:"representative_serp"};
  });
  const membersByRepresentative=new Map();
  for(const row of hierarchy){const members=membersByRepresentative.get(row.representative_source_keyword_id)??[];members.push(row.source_keyword_id);membersByRepresentative.set(row.representative_source_keyword_id,members)}
  const conceptClusters=representativeGrouping.clusters.map((cluster)=>cluster.slice());
  for(let index=conceptClusters.length-1;index>=0;index-=1){
    const cluster=conceptClusters[index];
    if(!cluster.every((id)=>isModifierKeyword(recordById.get(id).keyword)))continue;
    let parentId=hierarchyById.get(cluster[0]).parent_source_keyword_id;
    while(parentId){
      const representativeParent=hierarchyById.get(parentId).representative_source_keyword_id;
      const targetIndex=conceptClusters.findIndex((candidate,candidateIndex)=>candidateIndex!==index&&candidate.includes(representativeParent));
      if(targetIndex>=0){conceptClusters[targetIndex].push(...cluster);conceptClusters.splice(index,1);break}
      parentId=hierarchyById.get(parentId).parent_source_keyword_id;
    }
  }
  const clusters=conceptClusters.map((cluster)=>cluster.flatMap((id)=>membersByRepresentative.get(id)).sort());
  const articleKeywordGroups=clusters.map((members,index)=>{
    const rows=members.map((id)=>recordById.get(id));
    const eligible=rows.filter((row)=>!isModifierKeyword(row.keyword)&&Number.isFinite(Number(row.search_volume)));
    const ranked=eligible.slice().sort((left,right)=>Number(right.search_volume)-Number(left.search_volume)||hierarchyById.get(left.source_keyword_id).depth-hierarchyById.get(right.source_keyword_id).depth||String(left.source_file_digest).localeCompare(String(right.source_file_digest))||String(left.source_sheet).localeCompare(String(right.source_sheet),"ja")||left.source_row-right.source_row);
    const main=ranked[0];
    if(!main)throw new Error(`unresolved main keyword: ${members.join(", ")}`);
    return{group_id:`article-group-${index+1}`,site_id:siteId,main_keyword:main.keyword,main_keyword_origin:"actual_keyword_highest_search_volume_after_context_hierarchy_and_modifier_exclusion",main_search_volume:main.search_volume,root_source_keyword_id:hierarchyById.get(main.source_keyword_id).root_source_keyword_id,hierarchy_depth:hierarchyById.get(main.source_keyword_id).depth,intent_keywords:rows.filter((row)=>row.source_keyword_id!==main.source_keyword_id).map((row)=>row.keyword),source_keyword_ids:members};
  });
  return{policyVersion:KEYWORD_POLICY_VERSION,hierarchy,grouping:{...representativeGrouping,pairs,possible_pairs:pairs.filter((pair)=>pair.intent_confidence==="possible"),clusters},articleKeywordGroups};
}
