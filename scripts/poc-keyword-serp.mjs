import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { digest, groupBySerp, normalizeKeyword, organicUrls } from "./keyword-serp-core.mjs";
import { readXlsxKeywordSheet } from "./read-xlsx-keywords.mjs";

const API = "https://api.dataforseo.com/v3";
const outputDir = path.resolve(process.argv[2] ?? "artifacts/poc/keyword-serp");
const login = process.env.DFS_LOGIN;
const password = process.env.DFS_PASSWORD;
if (!login || !password) throw new Error("DFS_LOGIN and DFS_PASSWORD are required");

const fixedInput = [
  { source_keyword_id: "bec89ab9:キーワード割り当て:2", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 2, keyword: "seo 記事" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:3", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 3, keyword: "seo ライティング" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:5", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 5, keyword: "seo 外注" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:6", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 6, keyword: "seo 代行" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:7", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 7, keyword: "記事作成 副業" },
  { source_keyword_id: "bec89ab9:キーワード割り当て:8", source_file_digest: "bec89ab9", source_sheet: "キーワード割り当て", source_row: 8, keyword: "ライター 副業" },
  { source_keyword_id: "4769dfab:IT就活:16", source_file_digest: "4769dfab", source_sheet: "IT就活", source_row: 16, keyword: "it 就活サイト" },
  { source_keyword_id: "4769dfab:IT就活:17", source_file_digest: "4769dfab", source_sheet: "IT就活", source_row: 17, keyword: "it 就活 サイト" },
];
const workbookPath=process.env.WP_KEYWORD_WORKBOOK;
const input=(workbookPath?readXlsxKeywordSheet(workbookPath,{sheetNumber:Number(process.env.WP_KEYWORD_SHEET_NUMBER??1),sheetName:process.env.WP_KEYWORD_SHEET_NAME??"IT就活",limit:Number(process.env.WP_KEYWORD_LIMIT??100)}).map((row)=>({source_keyword_id:`it-shukatu.com:${row.source_sheet}:${row.source_row}`,source_file_digest:"4769dfab9c9213d77d3442499b03909cf77ad9c536155ec1c43dfa38e701342e",source_sheet:row.source_sheet,source_row:row.source_row,keyword:row.raw_keyword,search_volume:row.search_volume,cpc:row.cpc,competition:row.competition})):fixedInput).map((row) => ({ ...row, normalized_keyword: normalizeKeyword(row.keyword) }));

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
const inputByTag = new Map(input.map((row) => [row.source_keyword_id, row]));
const recoverReady = process.env.WP_DFS_RECOVER_READY === "1";
const live = process.env.WP_DFS_LIVE === "1";
let posted;
if (live) {
  const liveResponses = new Array(input.length);
  if (process.env.WP_DFS_LIVE_RESUME === "1") {
    const previous = JSON.parse(await readFile(path.join(outputDir, "live-response.json"), "utf8"));
    const previousByTag = new Map((previous.tasks ?? []).map((task) => [task.data?.tag, task]));
    for (let index = 0; index < input.length; index += 1) {
      const task = previousByTag.get(input[index].source_keyword_id);
      if (task?.status_code === 20000) liveResponses[index] = { status_code: 20000, status_message: "Resumed live response", cost: task.cost ?? 0, tasks: [task] };
    }
  }
  let cursor = 0;
  const worker = async () => {
    while (cursor < input.length) {
      const index = cursor;
      cursor += 1;
      if (liveResponses[index]) continue;
      const row = input[index];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await request("/serp/google/organic/live/advanced", {
          method: "POST",
          body: JSON.stringify([{
            keyword: row.keyword,
            location_code: 2392,
            language_code: "ja",
            device: "desktop",
            os: "windows",
            depth: 10,
            tag: row.source_keyword_id,
          }]),
        });
        liveResponses[index] = response;
        if (response.tasks?.[0]?.status_code === 20000) break;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(10, input.length) }, () => worker()));
  posted = { status_code: 20000, status_message: "Aggregated live responses", cost: liveResponses.reduce((sum, body) => sum + Number(body.cost ?? 0), 0), tasks: liveResponses.flatMap((body) => body.tasks ?? []) };
  await writeFile(path.join(outputDir, "live-response.json"), `${JSON.stringify(posted, null, 2)}\n`);
} else if (recoverReady) {
  const ready = await request("/serp/google/organic/tasks_ready");
  const results = (ready.tasks ?? []).flatMap((task) => task.result ?? []);
  posted = { tasks: results.filter((task) => inputByTag.has(task.tag)).map((task) => ({ ...task, status_code: 20100, status_message: "Recovered ready task", data: { tag: task.tag } })) };
} else {
  posted = await request("/serp/google/organic/task_post", {
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
  await writeFile(path.join(outputDir, "task-post.json"), `${JSON.stringify(posted, null, 2)}\n`);
}
const acceptedStatus = live ? 20000 : 20100;
const rejected = (posted.tasks ?? []).filter((task) => task.status_code !== acceptedStatus);
if (rejected.length) {
  throw new Error(`task_post rejected ${rejected.length}/${posted.tasks.length}: ${rejected.map((task) => `${task.status_code} ${task.status_message}`).join("; ")}`);
}
const tasks = posted.tasks.map((task) => {
  const tag = task.data?.tag;
  const source = inputByTag.get(tag);
  if (!source) throw new Error(`task_post response has unknown tag: ${tag ?? "missing"}`);
  return { ...source, task_id: task.id, post_status_code: task.status_code };
});
if (tasks.length !== input.length) throw new Error(`${live ? "live" : recoverReady ? "tasks_ready" : "task_post"}: ${tasks.length}/${input.length} tasks available`);
await writeFile(path.join(outputDir, "task-manifest.json"), `${JSON.stringify(tasks, null, 2)}\n`);

const deadline = Date.now() + Number(process.env.WP_DFS_TIMEOUT_MS ?? 900_000);
const completed = [];
if (live) {
  for (let index = 0; index < posted.tasks.length; index += 1) {
    const task = tasks[index];
    const taskBody = { ...posted, tasks: [posted.tasks[index]] };
    const rawPath = path.join(outputDir, "raw", `${task.task_id}.json`);
    await writeFile(rawPath, `${JSON.stringify(taskBody, null, 2)}\n`);
    completed.push({
      ...task,
      organic_urls: organicUrls(taskBody, 5),
      raw_file: path.relative(outputDir, rawPath),
      response_digest: digest(taskBody),
      cost: posted.tasks[index].cost ?? 0,
    });
  }
}
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
const byId=new Map(completed.map((row)=>[row.source_keyword_id,row]));
const modifiers=["おすすめ","比較","ランキング","口コミ","評判","選び方","方法"];
const articleKeywordGroups=grouping.clusters.map((members,index)=>{const rows=members.map((id)=>byId.get(id));const eligible=rows.filter((row)=>!modifiers.some((modifier)=>normalizeKeyword(row.keyword).endsWith(modifier)));const ranked=(eligible.length?eligible:rows).slice().sort((a,b)=>(b.search_volume??-1)-(a.search_volume??-1)||a.source_row-b.source_row);const main=ranked[0];return{group_id:`article-group-${index+1}`,site_id:"it-shukatu.com",main_keyword:main.keyword,main_keyword_origin:"highest_search_volume",main_search_volume:main.search_volume,intent_keywords:rows.filter((row)=>row.source_keyword_id!==main.source_keyword_id).map((row)=>row.keyword),source_keyword_ids:members}});
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
  article_keyword_groups: articleKeywordGroups,
  reproducibility_digest: digest({ input, snapshots: completed.map(({ source_keyword_id, response_digest }) => ({ source_keyword_id, response_digest })), grouping, articleKeywordGroups }),
};
await writeFile(path.join(outputDir, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ output: path.join(outputDir, "result.json"), tasks: completed.length, clusters: grouping.clusters.length, article_keyword_groups:articleKeywordGroups.length,total_cost: completed.reduce((sum, row) => sum + Number(row.cost), 0) }, null, 2));
