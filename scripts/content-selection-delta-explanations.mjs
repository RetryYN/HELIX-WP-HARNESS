import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const round=(value)=>Math.round(value*100)/100;
const labels={quality:"higher_candidate_quality",review:"stronger_review_state",evidence:"broader_retained_evidence",evidence_resolved:"resolved_evidence_reference",demand:"stronger_demand_history",competitive:"stronger_competitor_persistence",serp_pattern:"observed_serp_morphology_support",copy_risk:"lower_copy_risk"};
const normalized=(value)=>String(value??"").normalize("NFKC").toLocaleLowerCase("ja-JP").replaceAll(/[\p{P}\p{S}\s]+/gu,"");
const grams=(value)=>{const valueText=normalized(value);if(valueText.length<3)return new Set(valueText?[valueText]:[]);return new Set(Array.from({length:valueText.length-2},(_,index)=>valueText.slice(index,index+3)))};
const jaccard=(left,right)=>{const a=grams(left),b=grams(right);if(!a.size&&!b.size)return 1;const shared=[...a].filter((value)=>b.has(value)).length;return round(shared/(a.size+b.size-shared))};

function pairingEvidence(current,recommended){
  if(!current||!recommended)return{pairing_method:"unpaired",pairing_score:null,pairing_components:{heading_level_match:false,evidence_type_match:false,lexical_similarity:0}};
  const level=current.heading_level===recommended.heading_level,evidence=current.evidence_type===recommended.evidence_type,lexical=jaccard(current.text,recommended.text);
  return{pairing_method:"maximum_structural_similarity",pairing_score:round((level?50:0)+(evidence?20:0)+lexical*30),pairing_components:{heading_level_match:level,evidence_type_match:evidence,lexical_similarity:lexical}};
}

function optimalPairs(removed,added,candidates){
  if(!removed.length)return added.map((id)=>[null,id]);
  if(!added.length)return removed.map((id)=>[id,null]);
  const splitUnsupported=(pairs)=>pairs.flatMap(([left,right])=>left&&right&&(pairingEvidence(candidates.get(left),candidates.get(right)).pairing_score??0)===0?[[left,null],[null,right]]:[[left,right]]);
  const solve=(small,large,swapped)=>{
    const memo=new Map();
    const visit=(index,mask)=>{if(index===small.length)return{score:0,pairs:[]};const key=`${index}:${mask}`;if(memo.has(key))return memo.get(key);let best=null;for(let largeIndex=0;largeIndex<large.length;largeIndex++){if(mask&(1<<largeIndex))continue;const left=swapped?large[largeIndex]:small[index],right=swapped?small[index]:large[largeIndex],pairScore=pairingEvidence(candidates.get(left),candidates.get(right)).pairing_score??0,next=visit(index+1,mask|(1<<largeIndex)),candidate={score:pairScore+next.score,pairs:[[left,right],...next.pairs]};if(!best||candidate.score>best.score||(candidate.score===best.score&&JSON.stringify(candidate.pairs)<JSON.stringify(best.pairs)))best=candidate}memo.set(key,best);return best};
    const selected=visit(0,0).pairs,usedLeft=new Set(selected.map(([left])=>left)),usedRight=new Set(selected.map(([,right])=>right));return[...selected,...removed.filter((id)=>!usedLeft.has(id)).map((id)=>[id,null]),...added.filter((id)=>!usedRight.has(id)).map((id)=>[null,id])];
  };
  if(Math.max(removed.length,added.length)>20){const remaining=new Set(added),pairs=[];for(const left of removed){const right=[...remaining].sort((a,b)=>(pairingEvidence(candidates.get(left),candidates.get(b)).pairing_score??0)-(pairingEvidence(candidates.get(left),candidates.get(a)).pairing_score??0)||a.localeCompare(b))[0]??null;pairs.push([left,right]);if(right)remaining.delete(right)}return splitUnsupported([...pairs,...[...remaining].map((id)=>[null,id])])}return splitUnsupported(removed.length<=added.length?solve(removed,added,false):solve(added,removed,true));
}

function explain(group,kind,current,recommended,position){
  const comparable=Boolean(current&&recommended),keys=comparable?[...new Set([...Object.keys(current.score_components??{}),...Object.keys(recommended.score_components??{})])]:[],componentDeltas=Object.fromEntries(keys.map((key)=>[key,round((recommended.score_components?.[key]??0)-(current.score_components?.[key]??0))])),gains=keys.filter((key)=>componentDeltas[key]>0).sort((a,b)=>componentDeltas[b]-componentDeltas[a]||a.localeCompare(b)),losses=keys.filter((key)=>componentDeltas[key]<0).sort((a,b)=>componentDeltas[a]-componentDeltas[b]||a.localeCompare(b)),scoreDelta=comparable?round(recommended.ensemble_score-current.ensemble_score):null,pairing=kind==="heading"?pairingEvidence(current,recommended):{pairing_method:"direct_title_selection",pairing_score:null,pairing_components:null},reasonCodes=comparable?gains.map((key)=>labels[key]??`stronger_${key}`):[current?"heading_removed_without_structural_pair":"heading_added_without_structural_pair"],base={explanation_id:`selection-delta:${group.group_id}:${kind}:${position}`,group_id:group.group_id,main_keyword:group.main_keyword,content_type:kind,current_candidate_id:current?.candidate_id??null,recommended_candidate_id:recommended?.candidate_id??null,current_text:current?.text??null,recommended_text:recommended?.text??null,current_score:current?.ensemble_score??null,recommended_score:recommended?.ensemble_score??null,score_delta:scoreDelta,component_deltas:componentDeltas,gain_components:gains,loss_components:losses,reason_codes:reasonCodes,dominant_gain:gains[0]??null,dominant_tradeoff:losses[0]??null,comparison_state:!comparable?"unpaired_selection_change":scoreDelta>0?"net_evidence_gain":scoreDelta===0?"deterministic_tie_break":"tradeoff_review",...pairing,editor_decision_required:true,auto_apply:false,auto_content_mutation:false,ranking_effect_inferred:false,policy:"content-selection-delta-explanation.v2"};return{...base,explanation_digest:digest(base)};
}

export function buildContentSelectionDeltaExplanations(ensemble){
  const candidates=new Map((ensemble.candidate_rows??[]).map((row)=>[row.candidate_id,row])),rows=[];
  for(const group of ensemble.group_rows??[]){
    if(group.title_selection_changed)rows.push(explain(group,"title",candidates.get(group.current_title_candidate_id),candidates.get(group.recommended_title_candidate_id),1));
    const pairs=optimalPairs([...group.heading_remove_ids].sort(),[...group.heading_add_ids].sort(),candidates).sort(([leftA,rightA],[leftB,rightB])=>(leftA??"").localeCompare(leftB??"")||(rightA??"").localeCompare(rightB??""));
    pairs.forEach(([currentId,recommendedId],index)=>rows.push(explain(group,"heading",candidates.get(currentId),candidates.get(recommendedId),index+1)));
  }
  rows.sort((a,b)=>a.group_id.localeCompare(b.group_id)||a.content_type.localeCompare(b.content_type)||a.explanation_id.localeCompare(b.explanation_id));
  return{rows,summary:{group_count:new Set(rows.map((row)=>row.group_id)).size,explanation_count:rows.length,title_explanation_count:rows.filter((row)=>row.content_type==="title").length,heading_explanation_count:rows.filter((row)=>row.content_type==="heading").length,net_evidence_gain_count:rows.filter((row)=>row.comparison_state==="net_evidence_gain").length,deterministic_tie_break_count:rows.filter((row)=>row.comparison_state==="deterministic_tie_break").length,tradeoff_review_count:rows.filter((row)=>row.comparison_state==="tradeoff_review").length,unpaired_change_count:rows.filter((row)=>row.comparison_state==="unpaired_selection_change").length,structurally_paired_heading_count:rows.filter((row)=>row.content_type==="heading"&&row.pairing_method==="maximum_structural_similarity").length,dominant_gain_counts:Object.fromEntries(Object.entries(Object.groupBy(rows.filter((row)=>row.dominant_gain),(row)=>row.dominant_gain)).map(([key,items])=>[key,items.length]))},policy:"content-selection-delta-explanation.v2",pairing_policy:"maximum-heading-level-evidence-type-character-trigram-similarity.v1",auto_apply:false};
}
