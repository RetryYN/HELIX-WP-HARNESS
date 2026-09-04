// Exact identifiable retained URLs only. Non-unique redaction placeholders cannot
// prove page identity; original titles/URLs remain available in the review packet.
import {hasRedactedUrlIdentity} from "./retained-url-identity.mjs";
export function compareSemanticReviewResults(left = [], right = []) {
  const urls = (rows) => {
    const valid=new Set();let redacted=0;
    for(const {url:value} of rows){
      if(typeof value!=="string"||!value.trim())continue;
      if(hasRedactedUrlIdentity(value)){redacted++;continue;}
      try{if(["http:","https:"].includes(new URL(value).protocol))valid.add(value);}catch{/* Not a retained HTTP URL. */}
    }
    return{valid,redacted};
  };
  const leftIdentity=urls(left),rightIdentity=urls(right),a=leftIdentity.valid,b=rightIdentity.valid;
  const shared = [...a].filter((url) => b.has(url)).sort();
  const union = new Set([...a, ...b]);
  return {
    matching: "exact_identifiable_retained_http_url",
    left_redacted_url_count: leftIdentity.redacted,
    right_redacted_url_count: rightIdentity.redacted,
    left_distinct_url_count: a.size,
    right_distinct_url_count: b.size,
    shared_urls: shared,
    left_only_urls: [...a].filter((url) => !b.has(url)).sort(),
    right_only_urls: [...b].filter((url) => !a.has(url)).sort(),
    url_jaccard: a.size && b.size ? shared.length / union.size : null,
    url_jaccard_scope: "identifiable_retained_urls_only",
    evidence_state: a.size && b.size ? leftIdentity.redacted||rightIdentity.redacted ? "partial_url_identity" : "both_sides_observed" : "insufficient_url_evidence",
    semantic_equivalence_proven: false,
    article_merge_recommended: false,
  };
}
