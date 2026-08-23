import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, groupBySerp, normalizeKeyword, organicUrls } from "./keyword-serp-core.mjs";

const API = "https://api.dataforseo.com/v3";
const outputDir = path.resolve(process.argv[2] ?? "artifacts/poc/keyword-serp");
const login = process.env.DFS_LOGIN;
const password = process.env.DFS_PASSWORD;
if (!login || !password) throw new Error("DFS_LOGIN and DFS_PASSWORD are required");

const input = [
  { source_keyword_id: "bec89ab9:キーワード割り当て:2", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 2, keyword: "seo 記事" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:3", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 3, keyword: "seo ライティング" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:5", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 5, keyword: "seo 外注" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:6", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 6, keyword: "seo 代行" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:7", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 7, keyword: "記事作成 副業" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:8", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 8, keyword: "ライター 副業" },
  { source_keyword_id: "4769dfab:IT就活:16", source_file_digest: "4769dfab", source_sheet: "IT就活", source_row: 16, keyword: "it 就活サイト" },
  { source_keyword_id: "4769dfab:IT就活:17", source_file_digest: "4769dfab", source_sheet: "IT就活", source_row: 17, keyword: "it 就活 サイト" },
].map((row) => ({ ...row, normalized_keyword: normalizeKeyword(row.keyword) }));

const auth = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
async function request(endpoint, init = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    ...init,
    headers: { Authorization: auth, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.status_code !== 20000) throw new Error(`${endpoint}: API ${body.status_code} ${body.status_message}`);
  return body;
}

await mkdir(path.join(outputDir, "raw"), { recursive: true });
const posted = await request("/serp/google/organic/task_post", {
  method: "POST",
  body: JSON.stringify(input.map((row) => ({
    keyword: row.keyword,
    location_code: 2392,
    language_code: "ja",
    device: "desktop",
    os: "windows",
    depth: 10,
    tag: row.source_keyword_id,
  }))),
});
const inputByTag = new Map(input.map((row) => [row.source_keyword_id, row]));
const tasks = posted.tasks.map((task) => {
  const tag = task.data?.tag;
  const source = inputByTag.get(tag);
  if (!source) throw new Error(`task_post response has unknown tag: ${tag ?? "missing"}`);
  return { ...source, task_id: task.id, post_status_code: task.status_code };
});

const deadline = Date.now() + 180_000;
const completed = [];
while (completed.length < tasks.length && Date.now() < deadline) {
  for (const task of tasks) {
    if (completed.some((item) => item.task_id === task.task_id)) continue;
    const body = await request(`/serp/google/organic/task_get/advanced/${task.task_id}`);
    if (!body.tasks?.[0]?.result) continue;
    const rawPath = path.join(outputDir, "raw", `${task.task_id}.json`);
    await writeFile(rawPath, `${JSON.stringify(body, null, 2)}\n`);
    completed.push({
      ...task,
      organic_urls: organicUrls(body, 5),
      raw_file: path.relative(outputDir, rawPath),
      response_digest: digest(body),
      cost: body.cost ?? body.tasks?.[0]?.cost ?? 0,
    });
  }
  if (completed.length < tasks.length) await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (completed.length !== tasks.length) throw new Error(`timeout: ${completed.length}/${tasks.length} tasks completed`);

completed.sort((a, b) => a.source_keyword_id.localeCompare(b.source_keyword_id));
const grouping = groupBySerp(completed, { highThreshold: 0.8, possibleThreshold: 0.6, comparisonDepth: 5 });
const evidence = {
  schema_version: "wp-keyword-serp-poc.v1",
  generated_at: new Date().toISOString(),
  query_contract: { provider: "DataForSEO", queue: "standard", location_code: 2392, language_code: "ja", device: "desktop", depth: 10 },
  normalization: { version: "nfkc-space-casefold.v1", input_count: input.length, input_digest: digest(input) },
  sources: [
    { file: "大人のひとりビジネスラボ.xlsx", file_sha256: "bec89ab9d505d50cc687893733ba21f1512a3ee8ac5e366fea1755c27a8c39ca" },
    { file: "IT就活大学キーワードマップ.xlsx", file_sha256: "4769dfab9c9213d77d3442499b03909cf77ad9c536155ec1c43dfa38e701342e" },
  ],
  tasks: completed,
  grouping: { algorithm: "top5-url-overlap-intent-components.v3", decision: "上位5 URLの一致率が60%以上なら同一施策KW群。80%以上はhigh、60%以上80%未満はpossible、60%未満はseparate", ...grouping },
  reproducibility_digest: digest({ input, snapshots: completed.map(({ source_keyword_id, response_digest }) => ({ source_keyword_id, response_digest })), grouping }),
};
await writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ output: path.join(outputDir, "result.json"), tasks: completed.length, clusters: grouping.clusters, total_cost: completed.reduce((sum, row) => sum + Number(row.cost), 0) }, null, 2));
