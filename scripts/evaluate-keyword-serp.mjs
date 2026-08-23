import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, groupBySerp, normalizeForCoverage, normalizeKeyword, organicUrls } from "./keyword-serp-core.mjs";

const outputDir = path.resolve(process.argv[2] ?? "artifacts/poc/keyword-serp");
const rawDir = path.join(outputDir, "raw");
const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
const tasks = [];
const importedKeywordMetrics = new Map([
  ["bec89ab9:キーワード割り当て:7", { search_volume_min: 100, search_volume_max: 1000 }],
  ["bec89ab9:キーワード割り当て:8", { search_volume_min: 1000, search_volume_max: 10000 }],
]);
for (const file of files) {
  const body = JSON.parse(await readFile(path.join(rawDir, file), "utf8"));
  const task = body.tasks?.[0];
  if (!task?.data?.tag || !task.result) continue;
  tasks.push({
    source_keyword_id: task.data.tag,
    keyword: task.data.keyword,
    normalized_keyword: normalizeKeyword(task.data.keyword),
    task_id: task.id,
    organic_urls: organicUrls(body, 5),
    raw_file: `raw/${file}`,
    response_digest: digest(body),
    cost: task.cost ?? 0,
    ...(importedKeywordMetrics.get(task.data.tag) ?? {}),
  });
}
tasks.sort((a, b) => a.source_keyword_id.localeCompare(b.source_keyword_id));
const grouping = groupBySerp(tasks, { highThreshold: 0.8, possibleThreshold: 0.6, comparisonDepth: 5 });
const byId = new Map(tasks.map((task) => [task.source_keyword_id, task]));
const normalizationAliases = [];
const intentModifiers = ["おすすめ", "比較", "ランキング", "口コミ", "評判", "選び方", "方法"];
function classifyArticleGroup(members) {
  const keywords = members.map((id) => byId.get(id).keyword);
  const classified = keywords.map((keyword) => {
    const normalized = normalizeKeyword(keyword);
    const modifier = intentModifiers.find((candidate) => normalized.endsWith(` ${candidate}`));
    return { keyword, modifier: modifier ?? null, parent: modifier ? normalized.slice(0, -(modifier.length + 1)) : null };
  });
  const parents = [...new Set(classified.map((item) => item.parent).filter(Boolean))];
  if (parents.length === 1 && classified.every((item) => item.parent === parents[0])) {
    return { main_keyword: parents[0], main_keyword_origin: "derived_parent", intent_keywords: keywords, modifiers: classified.map((item) => item.modifier), sibling_keywords: [] };
  }
  const ranked = members
    .map((id) => byId.get(id))
    .filter((item) => Number.isFinite(item.search_volume_max))
    .sort((left, right) => right.search_volume_max - left.search_volume_max || left.source_keyword_id.localeCompare(right.source_keyword_id));
  if (ranked.length === members.length && ranked.length > 0) {
    return { main_keyword: ranked[0].keyword, main_keyword_origin: "highest_search_volume", intent_keywords: ranked.slice(1).map((item) => item.keyword), modifiers: [], sibling_keywords: [] };
  }
  return { main_keyword: null, main_keyword_origin: "unresolved", intent_keywords: [], modifiers: [], sibling_keywords: keywords };
}
const articleKeywordGroups = grouping.clusters
  .map((members) => {
    const canonical = new Map();
    for (const id of members) {
      const task = byId.get(id);
      const key = normalizeForCoverage(task.keyword);
      if (!canonical.has(key)) canonical.set(key, []);
      canonical.get(key).push(id);
    }
    for (const ids of canonical.values()) {
      if (ids.length > 1) normalizationAliases.push({ canonical: normalizeForCoverage(byId.get(ids[0]).keyword), source_keyword_ids: ids, variants: ids.map((id) => byId.get(id).keyword) });
    }
    return [...canonical.values()].map((ids) => ids[0]);
  })
  .filter((members) => members.length > 1)
  .map((members, index) => ({
    group_id: `poc-article-group-${index + 1}`,
    evidence: "likely_same_intent",
    source_keyword_ids: members,
    ...classifyArticleGroup(members),
    normalized_keywords: members.map((id) => byId.get(id).normalized_keyword),
  }));
const evidence = {
  schema_version: "wp-keyword-serp-poc.v1",
  generated_at: new Date().toISOString(),
  query_contract: { provider: "DataForSEO", queue: "standard", location_code: 2392, language_code: "ja", device: "desktop", fetched_depth: 10, comparison_depth: 5 },
  normalization: { version: "nfkc-space-casefold.v1", coverage_version: "nfkc-space-casefold-compact.v1", input_count: tasks.length },
  tasks,
  grouping: { algorithm: "top5-url-overlap-intent-components.v3", decision: "上位5 URLの一致率が60%以上なら同一施策KW群。80%以上はhigh、60%以上80%未満はpossible、60%未満はseparate", ...grouping },
  normalization_aliases: normalizationAliases,
  article_keyword_groups: articleKeywordGroups,
};
evidence.reproducibility_digest = digest({ tasks: tasks.map(({ source_keyword_id, response_digest }) => ({ source_keyword_id, response_digest })), grouping, normalizationAliases, articleKeywordGroups });
await writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ tasks: tasks.length, likely_same_intent_groups: articleKeywordGroups, total_cost: tasks.reduce((sum, task) => sum + Number(task.cost), 0), reproducibility_digest: evidence.reproducibility_digest }, null, 2));
