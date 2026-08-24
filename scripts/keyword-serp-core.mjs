import { createHash } from "node:crypto";

export function normalizeKeyword(value) {
  return String(value)
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/gu, " ");
}

export function normalizeForCoverage(value) {
  return normalizeKeyword(value).replace(/\s+/gu, "");
}

export function checkKeywordCoverage(content, group) {
  const normalizedContent = normalizeForCoverage(content);
  const check = (keyword) => ({ keyword, normalized: normalizeForCoverage(keyword), present: normalizedContent.includes(normalizeForCoverage(keyword)) });
  const main = check(group.main_keyword);
  const sub = group.sub_keywords.map(check);
  return { pass: main.present && sub.every((item) => item.present), main, sub, missing: [main, ...sub].filter((item) => !item.present).map((item) => item.keyword) };
}

export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function organicUrls(taskGetResponse, depth = 10) {
  const items = taskGetResponse?.tasks?.[0]?.result?.[0]?.items ?? [];
  return items
    .filter((item) => item.type === "organic" && item.url)
    .slice(0, depth)
    .map((item) => canonicalUrl(item.url))
    .filter(Boolean);
}

export function overlap(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  const shared = [...a].filter((url) => b.has(url));
  const denominator = Math.min(a.size, b.size);
  return {
    shared_urls: shared.sort(),
    shared_count: shared.length,
    denominator,
    ratio: denominator === 0 ? 0 : shared.length / denominator,
  };
}

export function serpConfidence(ratio,{highThreshold=0.8,possibleThreshold=0.6}={}){
  return ratio>=highThreshold?"high":ratio>=possibleThreshold?"possible":"separate";
}

export function groupBySerp(records, { highThreshold = 0.8, possibleThreshold = 0.6, comparisonDepth = 5, scopeById = null } = {}) {
  const pairs = [];
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const result = overlap(records[i].organic_urls.slice(0, comparisonDepth), records[j].organic_urls.slice(0, comparisonDepth));
      const comparable = result.denominator === comparisonDepth;
      const sameScope = !scopeById || scopeById.get(records[i].source_keyword_id) === scopeById.get(records[j].source_keyword_id);
      const confidence = !sameScope ? "context_separate" : !comparable ? "insufficient" : serpConfidence(result.ratio,{highThreshold,possibleThreshold});
      const candidate = confidence === "high" || confidence === "possible";
      pairs.push({ left: records[i].source_keyword_id, right: records[j].source_keyword_id, ...result, comparable, same_context: sameScope, intent_confidence: confidence, likely_same_intent: candidate });
    }
  }
  const pairByIds = new Map(pairs.map((pair) => [[pair.left, pair.right].sort().join("\0"), pair]));
  const clusters = records.map((record) => [record.source_keyword_id]);
  const candidates = pairs.filter((pair) => pair.likely_same_intent).sort((a, b) => b.ratio - a.ratio || a.left.localeCompare(b.left) || a.right.localeCompare(b.right));
  for (const edge of candidates) {
    const leftIndex = clusters.findIndex((cluster) => cluster.includes(edge.left));
    const rightIndex = clusters.findIndex((cluster) => cluster.includes(edge.right));
    if (leftIndex === rightIndex) continue;
    const completeLink = clusters[leftIndex].every((left) => clusters[rightIndex].every((right) => pairByIds.get([left, right].sort().join("\0"))?.likely_same_intent));
    if (!completeLink) continue;
    clusters[leftIndex].push(...clusters[rightIndex]);
    clusters.splice(rightIndex, 1);
  }
  const sortedClusters = clusters
    .map((members) => members.sort())
    .sort((a, b) => a[0].localeCompare(b[0]));
  return { threshold_operator: ">=", linkage: "complete", high_threshold: highThreshold, possible_threshold: possibleThreshold, comparison_depth: comparisonDepth, pairs, possible_pairs: pairs.filter((pair) => pair.intent_confidence === "possible"), clusters: sortedClusters };
}

export function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
