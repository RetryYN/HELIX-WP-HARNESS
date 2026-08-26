import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const escapeHtml=(value)=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");

export function buildEvidenceDraftRevision(draftPackage){
  if(draftPackage.generation_state!=="brief_ready")return null;
  const {title,main_keyword:keyword,headings}=draftPackage.input;
  if(!title||!headings.length)return null;
  const claims=[];
  const intro=`この記事では「${keyword}」について、検索結果で観測された論点を見出しごとに整理します。各論点は公開前に一次情報との照合が必要です。`;
  claims.push({claim_id:`${draftPackage.group_id}:intro`,claim_kind:"editorial_scope",text:intro,evidence_ids:[],citation_ids:[],verification_state:"not_applicable"});
  const sections=headings.map((heading,index)=>{
    const evidenceIds=[...new Set(heading.evidence_ids??[])];
    const text=`「${heading.text}」は、保持済みの検索結果から抽出した検討論点です。この節では検索意図との適合を確認し、根拠を一次情報で検証してから具体的な説明を加えます。`;
    const claim={claim_id:`${draftPackage.group_id}:section:${index+1}`,claim_kind:"observed_search_topic",text,evidence_ids:evidenceIds,citation_ids:[],verification_state:evidenceIds.length?"pending_primary_source":"blocked_missing_evidence"};
    claims.push(claim);
    return{section_id:`${draftPackage.group_id}:section:${index+1}`,heading_candidate_id:heading.candidate_id,level:heading.level,heading:heading.text,parent_candidate_id:heading.parent_candidate_id??null,paragraphs:[{paragraph_id:`${claim.claim_id}:p1`,text,claim_ids:[claim.claim_id]}],evidence_ids:evidenceIds};
  });
  const evidenceIds=[...new Set(claims.flatMap((claim)=>claim.evidence_ids))].sort();
  const citationIds=[...new Set(draftPackage.input.citation_candidates.map((item)=>item.citation_id))].sort();
  const text=[title,"",intro,"",...sections.flatMap((section)=>[`${"#".repeat(section.level)} ${section.heading}`,"",section.paragraphs[0].text,"",`[evidence: ${section.evidence_ids.join(", ")||"missing"}]`,""])].join("\n").trim()+"\n";
  const html=`<article data-review-state="blocked"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>${sections.map((section)=>`<section data-heading-candidate-id="${escapeHtml(section.heading_candidate_id)}"><h${section.level}>${escapeHtml(section.heading)}</h${section.level}><p>${escapeHtml(section.paragraphs[0].text)}</p><small>evidence: ${escapeHtml(section.evidence_ids.join(", ")||"missing")}</small></section>`).join("")}</article>`;
  const review={publication_state:"blocked",auto_approval:false,reason_codes:["primary_source_verification_pending",...(citationIds.length?["citation_approval_pending"]:[]),...(claims.some((claim)=>claim.verification_state==="blocked_missing_evidence")?["claim_evidence_missing"]:[])],claim_count:claims.length,verified_claim_count:0,citation_candidate_count:citationIds.length,approved_citation_count:0};
  const base={group_id:draftPackage.group_id,revision:1,renderer_version:"content-evidence-draft.v1",source_package_digest:draftPackage.package_digest,title,sections,claims,evidence_ids:evidenceIds,citation_ids:citationIds,text,html,review};
  return{...base,revision_digest:digest(base)};
}
