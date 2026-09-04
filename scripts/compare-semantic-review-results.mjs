// Exact retained URLs only: do not infer canonical identity or semantic sameness.
export function compareSemanticReviewResults(left = [], right = []) {
  const urls = (rows) => new Set(rows.map((row) => row.url).filter((value) => {
    if (typeof value !== "string" || !value.trim()) return false;
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  }));
  const a = urls(left), b = urls(right);
  const shared = [...a].filter((url) => b.has(url)).sort();
  const union = new Set([...a, ...b]);
  return {
    matching: "exact_retained_http_url",
    left_distinct_url_count: a.size,
    right_distinct_url_count: b.size,
    shared_urls: shared,
    left_only_urls: [...a].filter((url) => !b.has(url)).sort(),
    right_only_urls: [...b].filter((url) => !a.has(url)).sort(),
    url_jaccard: a.size && b.size ? shared.length / union.size : null,
    evidence_state: a.size && b.size ? "both_sides_observed" : "insufficient_url_evidence",
    semantic_equivalence_proven: false,
    article_merge_recommended: false,
  };
}
