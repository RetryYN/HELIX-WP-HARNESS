import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

const corpusRoot=new URL("../docs/research/public-lexical-corpus/",import.meta.url);
const digest=(value)=>createHash("sha256").update(value).digest("hex");
const normalize=(value)=>String(value??"").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");

export function buildPublicSynonymEvidence(pairText,manifest,licenseText){
  if(manifest.schema_version!=="helix-public-lexical-corpus-source.v1")throw new Error("unsupported public lexical source manifest");
  if(digest(pairText)!==manifest.pair_file_sha256)throw new Error("public synonym pair digest mismatch");
  if(!licenseText.includes("Permission to use, copy, modify and distribute"))throw new Error("public synonym license notice missing");
  const rows=pairText.trimEnd().split(/\r?\n/u).map((line,index)=>{
    const fields=line.split("\t");
    if(fields.length!==4)throw new Error(`invalid synonym pair row ${index+1}`);
    const [leftWordId,leftTerm,rightWordId,rightTerm]=fields,leftNormalized=normalize(leftTerm),rightNormalized=normalize(rightTerm);
    if(!leftWordId||!rightWordId||!leftNormalized||!rightNormalized||leftNormalized===rightNormalized)throw new Error(`invalid synonym pair values ${index+1}`);
    const canonicalTerms=[leftNormalized,rightNormalized].sort((a,b)=>a.localeCompare(b,"ja"));
    return {pair_id:digest(`${manifest.dataset_version}\0${leftWordId}\0${leftTerm}\0${rightWordId}\0${rightTerm}`),source_row:index+1,left_word_id:leftWordId,left_term:leftTerm,left_normalized:leftNormalized,right_word_id:rightWordId,right_term:rightTerm,right_normalized:rightNormalized,canonical_pair:canonicalTerms.join("\0"),relation_state:"human_reviewed_synonym_pair",context_review_required:true,auto_replacement:false,evidence_digest:digest(`${manifest.pair_file_sha256}\0${index+1}\0${line}`)};
  });
  if(rows.length!==manifest.pair_count)throw new Error(`public synonym pair count mismatch: ${rows.length}`);
  if(new Set(rows.map((row)=>row.pair_id)).size!==rows.length)throw new Error("duplicate public synonym pair identity");
  const duplicateCanonicalPairCount=rows.length-new Set(rows.map((row)=>row.canonical_pair)).size,terms=new Set(rows.flatMap((row)=>[row.left_normalized,row.right_normalized]));
  return {source:{dataset_name:manifest.dataset_name,dataset_version:manifest.dataset_version,source_page:manifest.source_page,source_archive:manifest.source_archive,source_archive_sha256:manifest.source_archive_sha256,pair_file_sha256:manifest.pair_file_sha256,license_file:manifest.license_file,attribution:manifest.attribution,retrieved_at:manifest.retrieved_at,acquisition_cost_usd:manifest.acquisition_cost_usd,source_digest:digest(JSON.stringify(manifest))},rows,summary:{pair_count:rows.length,unique_term_count:terms.size,duplicate_canonical_pair_count:duplicateCanonicalPairCount,human_reviewed_pair_count:rows.length,context_review_required_count:rows.length,auto_replacement_count:0,acquisition_cost_usd:0},policy:"public-synonym-evidence.v1",interpretation_policy:"human_reviewed_pair_is_lexical_evidence_but_query_context_still_requires_editor_review",external_public_corpus_acquired:true,auto_mutation:false};
}

export function loadPublicSynonymEvidence(){
  const manifest=JSON.parse(readFileSync(new URL("source-manifest.json",corpusRoot),"utf8"));
  return buildPublicSynonymEvidence(readFileSync(new URL(manifest.pair_file,corpusRoot),"utf8"),manifest,readFileSync(new URL(manifest.license_file,corpusRoot),"utf8"));
}
