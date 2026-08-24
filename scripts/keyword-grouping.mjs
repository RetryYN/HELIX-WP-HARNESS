import {buildKeywordHierarchy} from "./keyword-hierarchy.mjs";
import {digest,groupBySerp,normalizeKeyword} from "./keyword-serp-core.mjs";
import {KEYWORD_POLICY_VERSION,modifierTerms} from "./keyword-policy.mjs";

export const GROUPING_ALGORITHM="normalized-context-hierarchy-top5-complete-linkage.v4";
export const GROUPING_DECISION="形態素正規化と語順alias統合、文脈root境界、語数ツリーを先に確定する。同じroot内の代表KWだけを比較し、上位5 URL一致率60%以上なら同一施策KW群。80%以上はhigh。修飾語だけの群は最寄りの実在親施策へ内包し、実在親がなければderived_parent_candidateとして未確定にする。";
const pairKey=(left,right)=>[left,right].sort().join("\0");
const trailingModifier=(keyword)=>modifierTerms.find((modifier)=>normalizeKeyword(keyword).endsWith(modifier));
const isModifierKeyword=(keyword)=>Boolean(trailingModifier(keyword));
// §5: remove only the trailing modifier phrase one level; never reduce further.
export const deriveParentCandidate=(keyword)=>{const modifier=trailingModifier(keyword);const normalized=normalizeKeyword(keyword);return modifier?normalized.slice(0,normalized.length-modifier.length).trim()||null:null};
// One digest definition shared by the live DFS run and offline regrouping so the same evidence yields the same value.
export const evidenceDigest=({tasks,algorithm,hierarchy,grouping,articleKeywordGroups})=>digest({snapshots:tasks.map(({source_keyword_id,response_digest})=>({source_keyword_id,response_digest})),algorithm,hierarchy,grouping,articleKeywordGroups});

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
    // Walk every member's ancestor chain (nearest first) so the absorption target does not depend on member order.
    const ancestors=[];
    for(const memberId of cluster){let parentId=hierarchyById.get(memberId).parent_source_keyword_id;let distance=1;while(parentId){ancestors.push({id:hierarchyById.get(parentId).representative_source_keyword_id,distance});parentId=hierarchyById.get(parentId).parent_source_keyword_id;distance+=1}}
    ancestors.sort((left,right)=>left.distance-right.distance);
    for(const ancestor of ancestors){
      const targetIndex=conceptClusters.findIndex((candidate,candidateIndex)=>candidateIndex!==index&&candidate.includes(ancestor.id));
      if(targetIndex>=0){conceptClusters[targetIndex].push(...cluster);conceptClusters.splice(index,1);break}
    }
  }
  const clusters=conceptClusters.map((cluster)=>cluster.flatMap((id)=>membersByRepresentative.get(id)).sort());
  const articleKeywordGroups=clusters.map((members,index)=>{
    const rows=members.map((id)=>recordById.get(id));
    const eligible=rows.filter((row)=>!isModifierKeyword(row.keyword)&&Number.isFinite(Number(row.search_volume)));
    const ranked=eligible.slice().sort((left,right)=>Number(right.search_volume)-Number(left.search_volume)||hierarchyById.get(left.source_keyword_id).depth-hierarchyById.get(right.source_keyword_id).depth||String(left.source_file_digest).localeCompare(String(right.source_file_digest))||String(left.source_sheet).localeCompare(String(right.source_sheet),"ja")||left.source_row-right.source_row);
    const main=ranked[0];
    if(!main){
      // §5: no actual (non-modifier, measured) keyword can be main. Keep the group as an unresolved derived_parent_candidate; never promote the derived value.
      const anchor=rows.slice().sort((left,right)=>Number(right.search_volume??0)-Number(left.search_volume??0)||left.source_row-right.source_row)[0];
      return{group_id:`article-group-${index+1}`,site_id:siteId,resolution_state:"unresolved",main_keyword:null,main_keyword_origin:"derived_parent_candidate",derived_parent_candidate:deriveParentCandidate(anchor.keyword),main_search_volume:null,root_source_keyword_id:hierarchyById.get(anchor.source_keyword_id).root_source_keyword_id,hierarchy_depth:hierarchyById.get(anchor.source_keyword_id).depth,intent_keywords:rows.map((row)=>row.keyword),source_keyword_ids:members};
    }
    return{group_id:`article-group-${index+1}`,site_id:siteId,resolution_state:"resolved",main_keyword:main.keyword,main_keyword_origin:"actual_keyword_highest_search_volume_after_context_hierarchy_and_modifier_exclusion",derived_parent_candidate:null,main_search_volume:main.search_volume,root_source_keyword_id:hierarchyById.get(main.source_keyword_id).root_source_keyword_id,hierarchy_depth:hierarchyById.get(main.source_keyword_id).depth,intent_keywords:rows.filter((row)=>row.source_keyword_id!==main.source_keyword_id).map((row)=>row.keyword),source_keyword_ids:members};
  });
  return{policyVersion:KEYWORD_POLICY_VERSION,hierarchy,grouping:{...representativeGrouping,pairs,possible_pairs:pairs.filter((pair)=>pair.intent_confidence==="possible"),clusters},articleKeywordGroups};
}
