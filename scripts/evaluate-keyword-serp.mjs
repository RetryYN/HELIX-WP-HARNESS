import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, groupBySerp, normalizeForCoverage, normalizeKeyword, organicUrls } from "./keyword-serp-core.mjs";

const outputDir = path.resolve(process.argv[2] ?? "artifacts/poc/keyword-serp");
const rawDir = path.join(outputDir, "raw");
const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
const tasks = [];
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
  });
}
tasks.sort((a, b) => a.source_keyword_id.localeCompare(b.source_keyword_id));
const grouping = groupBySerp(tasks, { threshold: 0.8, comparisonDepth: 5 });
const byId = new Map(tasks.map((task) => [task.source_keyword_id, task]));
const normalizationAliases = [];
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
    main_keyword: byId.get(members[0]).keyword,
    sub_keywords: members.slice(1).map((id) => byId.get(id).keyword),
    normalized_keywords: members.map((id) => byId.get(id).normalized_keyword),
  }));
const evidence = {
  schema_version: "wp-keyword-serp-poc.v1",
  generated_at: new Date().toISOString(),
  query_contract: { provider: "DataForSEO", queue: "standard", location_code: 2392, language_code: "ja", device: "desktop", fetched_depth: 10, comparison_depth: 5 },
  normalization: { version: "nfkc-space-casefold.v1", coverage_version: "nfkc-space-casefold-compact.v1", input_count: tasks.length },
  tasks,
  grouping: { algorithm: "top5-url-overlap-likely-intent-components.v1", decision: "5位以内のURL一致率が80%を超える場合、同一検索意図に内包される可能性が高い", ...grouping },
  normalization_aliases: normalizationAliases,
  article_keyword_groups: articleKeywordGroups,
};
evidence.reproducibility_digest = digest({ tasks: tasks.map(({ source_keyword_id, response_digest }) => ({ source_keyword_id, response_digest })), grouping, normalizationAliases, articleKeywordGroups });
await writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ tasks: tasks.length, likely_same_intent_groups: articleKeywordGroups, total_cost: tasks.reduce((sum, task) => sum + Number(task.cost), 0), reproducibility_digest: evidence.reproducibility_digest }, null, 2));
