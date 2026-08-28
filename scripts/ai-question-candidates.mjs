import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stripQuestion=(value)=>String(value).trim().replace(/[？?]+$/u,"");
function deriveQuestion(topic){const base=stripQuestion(topic);if(/(?:違い|比較)/u.test(base))return `${base}を比較すると何が違う？`;if(/(?:おすすめ|ランキング|選び方)/u.test(base))return `${base}は何を基準に選ぶ？`;if(/(?:いつ|時期|何月)/u.test(base))return `${base}はいつ確認・準備する？`;if(/(?:方法|やり方|対策|準備)/u.test(base))return `${base}はどう進める？`;if(/(?:理由|原因|なぜ)/u.test(base))return `${base}はなぜ重要？`;return `${base}について押さえるべきポイントは？`}

export function buildAiQuestionCandidates(groups,topicProposals,{maxPerGroup=12}={}){
  const candidates=[];
  for(const group of groups.filter((row)=>row.main_keyword)){
    const topics=topicProposals.filter((row)=>row.group_id===group.id&&row.relation==="same_group").slice(0,maxPerGroup),seen=new Set();
    for(const topic of topics){const observed=topic.topic_kind==="paa",question=observed?`${stripQuestion(topic.display_topic)}？`:deriveQuestion(topic.display_topic),normalized=question.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s\p{P}\p{S}]+/gu,"");if(!normalized||seen.has(normalized))continue;seen.add(normalized);const generator_kind=observed?"observed_passthrough":"deterministic_rule",generator_version=observed?"observed-paa.v1":"evidence-bound-question.v1",input={group_id:group.id,main_keyword:group.main_keyword,source_topic_id:topic.proposal_id,source_kind:topic.topic_kind,source_evidence_digest:topic.evidence_digest},input_digest=digest(input),review_state=question.length<=80?"ready":"needs_review",evidence_occurrence_ids=topic.evidence.map((row)=>row.occurrence_id);
      candidates.push({question_id:digest([group.id,topic.proposal_id,question,generator_version]).slice(0,24),group_id:group.id,question_text:question,candidate_kind:observed?"observed_question":"derived_question",source_topic_id:topic.proposal_id,source_kind:topic.topic_kind,evidence_occurrence_ids,generator_kind,generator_version,input_digest,status:observed?"observed":"proposed",review_state,evidence_digest:digest({input,question,evidence_occurrence_ids})});
    }
  }
  return candidates;
}
