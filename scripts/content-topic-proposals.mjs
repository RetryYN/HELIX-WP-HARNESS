import { createHash } from "node:crypto";
import { tokenizeMatchText } from "./keyword-article-matching.mjs";
import { genericMatchTokens } from "./keyword-policy.mjs";

const generic=new Set(genericMatchTokens);
const distinctTokens=(value)=>new Set(tokenizeMatchText(value).filter((token)=>!generic.has(token)));
const titleAxisNoise=new Set(["?","なに","何","どれ","誰","いつ","くん","する","てる","ある","いる","なる","わかる","やすい","解説","検索","ニーズ","整理","です","ます","で"]);
const topicAxisTokens=(mainKeyword,topic)=>{const main=new Set(tokenizeMatchText(mainKeyword)),tokens=[...new Set(tokenizeMatchText(topic).filter((token)=>!main.has(token)&&!generic.has(token)&&!titleAxisNoise.has(token)))],merged=[];for(const token of tokens){if(token==="卒"&&merged.length)merged[merged.length-1]=`${merged.at(-1)}卒`;else merged.push(token)}return merged};
const topicAxis=(mainKeyword,topic)=>topicAxisTokens(mainKeyword,topic).slice(0,3).join("・");
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

const editorialTerms=new Set(["メリット","デメリット","注意点","対策","方法","理由","原因","選び方","使い方","違い","比較","ランキング","評判","口コミ","年収","仕事内容","資格","面接","例文","時期","流れ","準備","構成","選考","内定","業界","企業","職種","アピール","勉強","取得","服装","印象","結び方"]);
export function buildEvidenceBoundGenerationCandidates(groups,proposals,competitorTerms,{maxCompetitorHeadings=3,featureItems=[]}={}){
  const results=[];
  for(const group of groups.filter((item)=>item.main_keyword)){
    const competitive=(competitorTerms.get(group.id)??[]).filter((term)=>editorialTerms.has(term.term)&&!normalizeForContains(group.main_keyword).includes(normalizeForContains(term.term))).slice(0,maxCompetitorHeadings),strictTopics=proposals.filter((item)=>item.group_id===group.id&&item.relation==="same_group"),topics=(strictTopics.length?strictTopics:competitive.length<3?proposals.filter((item)=>item.group_id===group.id):[]).slice(0,8),topicAssignmentPolicy=strictTopics.length?"same_group_lexical":"source_task_fallback",primaryTitleAxes=[...new Set(topics.slice(0,2).flatMap((item)=>topicAxisTokens(group.main_keyword,item.display_topic)))].slice(0,3),titleText=primaryTitleAxes.length?`${group.main_keyword}の${primaryTitleAxes.join("・")}をわかりやすく解説`:group.main_keyword;
    const add=(contentType,level,textValue,evidenceType,evidenceIds,coverage,variantKey)=>{const generation={variant_key:variantKey,generator_kind:"deterministic_rule",generator_version:"evidence-bound-generation.v4",input_digest:digest({group_id:group.id,main_keyword:group.main_keyword,evidence_type:evidenceType,evidence_ids:evidenceIds,coverage})};results.push({candidate_id:digest([group.id,contentType,level,textValue,evidenceType,evidenceIds,variantKey]).slice(0,24),group_id:group.id,content_type:contentType,heading_level:level,text:textValue,evidence_type:evidenceType,evidence_ids:evidenceIds,coverage,generation,status:"proposed",candidate_digest:digest([group.id,contentType,level,textValue,evidenceType,evidenceIds,coverage,generation])})};
    if(topics.length){const titleEvidence=topics.slice(0,2).map((item)=>item.proposal_id),coverage={topic_count:Math.min(2,topics.length),axes:primaryTitleAxes,topic_assignment_policy:topicAssignmentPolicy};add("title",null,titleText,"serp_demand",titleEvidence,coverage,`${topicAssignmentPolicy}:demand_compound`);const leadAxis=topicAxis(group.main_keyword,topics[0].display_topic),leadText=leadAxis?`${group.main_keyword}とは？${leadAxis}をわかりやすく解説`:`${group.main_keyword}とは？検索ニーズを整理`;add("title",null,leadText,"serp_demand",[topics[0].proposal_id],{topic_count:1,lead_topic_kind:topics[0].topic_kind,axis:leadAxis,topic_assignment_policy:topicAssignmentPolicy},`${topicAssignmentPolicy}:demand_explainer`)}
    topics.forEach((item,index)=>add("heading",index===0?2:3,item.display_topic,"serp_demand",[item.proposal_id],{occurrence_count:item.occurrence_count,task_count:item.task_count,topic_assignment_policy:topicAssignmentPolicy},`${topicAssignmentPolicy}:${item.topic_kind==="paa"?"question_topic":"related_topic"}`));
    for(const term of competitive)add("heading",2,`${group.main_keyword}の${term.term}`,"competitor_term",term.evidence_page_ids,{page_count:term.page_count,title_count:term.title_count,heading_count:term.heading_count,title_page_count:term.title_page_count,heading_page_count:term.heading_page_count},"competitor_axis");
    const titleTerms=competitive.filter((term)=>term.title_page_count>=2).slice(0,2);if(titleTerms.length)add("title",null,`${group.main_keyword}の${titleTerms.map((term)=>term.term).join("・")}を解説`,"competitor_term",[...new Set(titleTerms.flatMap((term)=>term.evidence_page_ids))],{terms:titleTerms.map((term)=>term.term),minimum_title_page_count:Math.min(...titleTerms.map((term)=>term.title_page_count))},"competitor_explainer");else if(competitive.length){const term=competitive[0];add("title",null,`${group.main_keyword}の${term.term}をわかりやすく解説`,"competitor_term",term.evidence_page_ids,{terms:[term.term],heading_page_count:term.heading_page_count,page_count:term.page_count},"competitor_heading_fallback")}
    const observedFeatures=featureItems.filter((item)=>item.group_id===group.id),featuresByType=Map.groupBy(observedFeatures,(item)=>item.feature_type);for(const item of (featuresByType.get("people_also_search")??[]).slice(0,6)){add("title",null,`${group.main_keyword}と${item.text}の違い・選び方`,"serp_feature_item",[item.feature_item_id],{feature_type:item.feature_type,observed_value:item.text,review_required:true},"serp_people_also_search_comparison");add("heading",2,`${item.text}との違いと選ぶ基準`,"serp_feature_item",[item.feature_item_id],{feature_type:item.feature_type,observed_value:item.text,review_required:true},"serp_people_also_search_axis")}
    const addFormatHeading=(type,textValue,variantKey)=>{const rows=featuresByType.get(type)??[];if(rows.length)add("heading",2,textValue,"serp_feature_item",rows.map((item)=>item.feature_item_id),{feature_type:type,observed_item_count:rows.length,review_required:true},variantKey)};addFormatHeading("images",`${group.main_keyword}を画像で確認するポイント`,"serp_image_format");addFormatHeading("video",`${group.main_keyword}を動画で理解するポイント`,"serp_video_format");addFormatHeading("knowledge_graph",`${group.main_keyword}の定義と根拠`,"serp_entity_definition");
  }
  return results;
}

const normalizeForContains=(value)=>String(value??"").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s\p{P}\p{S}]+/gu,"");
