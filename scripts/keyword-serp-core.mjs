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

export function groupBySerp(records, { highThreshold = 0.8, possibleThreshold = 0.6, comparisonDepth = 5 } = {}) {
  const parent = records.map((_, index) => index);
  const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const pairs = [];
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const result = overlap(records[i].organic_urls.slice(0, comparisonDepth), records[j].organic_urls.slice(0, comparisonDepth));
      const comparable = result.denominator === comparisonDepth;
      const confidence = !comparable ? "insufficient" : result.ratio >= highThreshold ? "high" : result.ratio >= possibleThreshold ? "possible" : "separate";
      const candidate = confidence === "high" || confidence === "possible";
      pairs.push({ left: records[i].source_keyword_id, right: records[j].source_keyword_id, ...result, comparable, intent_confidence: confidence, likely_same_intent: candidate });
      if (candidate) union(i, j);
    }
  }
  const grouped = new Map();
  records.forEach((record, index) => {
    const root = find(index);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root).push(record.source_keyword_id);
  });
  const clusters = [...grouped.values()]
    .map((members) => members.sort())
    .sort((a, b) => a[0].localeCompare(b[0]));
  return { threshold_operator: ">=", high_threshold: highThreshold, possible_threshold: possibleThreshold, comparison_depth: comparisonDepth, pairs, possible_pairs: pairs.filter((pair) => pair.intent_confidence === "possible"), clusters };
}

export function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
