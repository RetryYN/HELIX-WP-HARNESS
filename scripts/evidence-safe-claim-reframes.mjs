import {createHash} from "node:crypto";
const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rules=[
  {kind:"private_quantitative_fact",match:/department-head salary|bonus-month figure/u,scope:"公開されている報酬制度と数値の確認可能範囲を説明し、非公開の役職別金額や賞与月数は断定しない"},
  {kind:"entity_disambiguation_required",match:/Multiple employment-review services|assigning a company/u,scope:"対象サービスの正式名称とURLを先に特定し、運営主体を公式情報で確認できる場合だけ記載する"},
  {kind:"unknowable_personal_intent",match:/individual's motivation/u,scope:"個人の動機を推測せず、採用時に論点となり得る条件と確認方法を一般論として整理する"},
  {kind:"institution_specific_rule",match:/tattoo-specific nationwide expulsion rule/u,scope:"全国一律の退学結果を断定せず、対象大学の学則・懲戒規程と個別判断が必要だと説明する"},
  {kind:"unbounded_future_outcome",match:/guarantee non-discovery/u,scope:"発覚しない保証をせず、職種・服装・安全衛生・就業規則など確認すべき条件を列挙する"},
  {kind:"anecdotal_generalization",match:/User-generated answers/u,scope:"投稿例を一般的な採用結果へ拡張せず、一次情報・公的指針と照合する手順を提示する"}
];

export function buildEvidenceSafeClaimReframes(publicSourceEvidence){
  const unsupported=(publicSourceEvidence.rows??[]).filter((row)=>row.direct_support_state==="not_supported"),rows=unsupported.map((row)=>{const rule=rules.find((item)=>item.match.test(row.decision_reason));if(!rule)throw new Error(`unclassified unsupported claim: ${row.claim_id}`);const base={reframe_id:`claim-reframe:${row.claim_id}`,claim_id:row.claim_id,group_id:row.group_id,priority_band:row.priority_band,failure_kind:rule.kind,original_query:row.query,executed_query:row.executed_query,decision_reason:row.decision_reason,proposed_editorial_scope:rule.scope,source_requirement:row.source_requirement,source_evidence_digest:row.evidence_digest,source_candidate_digest:row.candidate_digest,review_state:"editor_review_required",unsupported_answer_removed:true,factual_answer_inferred:false,auto_replacement:false,auto_approval:false,auto_publication:false,external_acquisition_triggered:false,policy:"evidence-safe-claim-reframe.v1"};return{...base,reframe_digest:digest(base)}}).sort((a,b)=>a.priority_band.localeCompare(b.priority_band)||a.claim_id.localeCompare(b.claim_id));
  return{rows,summary:{unsupported_claim_count:unsupported.length,classified_claim_count:rows.length,failure_kind_counts:Object.fromEntries([...Map.groupBy(rows,(row)=>row.failure_kind)].map(([key,items])=>[key,items.length])),editor_review_required_count:rows.length,unclassified_count:unsupported.length-rows.length,auto_replacement_count:0,auto_approval_count:0,external_acquisition_triggered:false},policy:"evidence-safe-claim-reframe.v1",reframe_set_digest:digest(rows)};
}
