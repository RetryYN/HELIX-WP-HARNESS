import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { categoryPathForKeywords, wpCategoryTaxonomy } from "./keyword-category-taxonomy.mjs";

assert.equal(wpCategoryTaxonomy.length,17);
assert.deepEqual(categoryPathForKeywords(["it 就活 文系"]),["IT就活","文系就活"]);
assert.deepEqual(categoryPathForKeywords(["it 就活 面接","it 就活 逆質問"]),["就活対策","面接対策"]);
assert.deepEqual(categoryPathForKeywords(["it 就活 企業 ランキング"]),["IT業界研究","IT企業分析"]);
assert.deepEqual(categoryPathForKeywords(["it 就活エージェント 比較"]),["IT就活エージェント","比較・ランキング"]);

const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "wp-dashboard-db-")), "dashboard.sqlite");
buildDashboardDb({ dbPath, fixturePath: path.resolve("docs/prototypes/wp-ops-dashboard/data.json"), artifactRoot: path.resolve("artifacts/poc") }).close();
const persisted = new DatabaseSync(dbPath, { readOnly: true });
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks").get().count, 4);
assert.equal(persisted.prepare("SELECT SUM(aio_present) AS count FROM dfs_tasks").get().count, 3);
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE snapshot_path = ''").get().count, 0);
persisted.close();

const pocDbPath = path.join(mkdtempSync(path.join(tmpdir(), "wp-dashboard-poc-db-")), "dashboard.sqlite");
const buildPoc = spawnSync(process.execPath, ["scripts/build-keyword-dashboard-db.mjs"], { env: { ...process.env, WP_DASHBOARD_DB: pocDbPath }, encoding: "utf8" });
assert.equal(buildPoc.status, 0, buildPoc.stderr);
const pocDb = new DatabaseSync(pocDbPath, { readOnly: true });
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM imported_keywords WHERE site_id = 'it-shukatu.com'").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM imported_keywords WHERE site_id = 'it-shukatu.com' AND processing_state = '施策KW群割当済み'").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com'").get().count, 67);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com' AND action_state = '未施策'").get().count, 67);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE action_state NOT IN ('未施策','予約済','下書き','公開中')").get().count, 0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE group_id IN (SELECT group_id FROM keyword_groups WHERE site_id = 'it-shukatu.com')").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE main_keyword GLOB 'topic-*' OR main_keyword GLOB 'keyword-*'").get().count, 0);
pocDb.close();

const hierarchyRoot=mkdtempSync(path.join(tmpdir(),"wp-dashboard-category-"));
const hierarchyFixturePath=path.join(hierarchyRoot,"fixture.json");
const hierarchyDbPath=path.join(hierarchyRoot,"dashboard.sqlite");
const hierarchyFixture=JSON.parse(readFileSync(path.resolve("docs/prototypes/wp-ops-dashboard/data.json"),"utf8"));
hierarchyFixture.groups[0].category_path=["親","子","孫"];
writeFileSync(hierarchyFixturePath,JSON.stringify(hierarchyFixture));
buildDashboardDb({dbPath:hierarchyDbPath,fixturePath:hierarchyFixturePath,artifactRoot:path.resolve("artifacts/poc")}).close();
const hierarchyDb=new DatabaseSync(hierarchyDbPath,{readOnly:true});
assert.equal(hierarchyDb.prepare("SELECT category FROM keyword_groups WHERE group_id = ?").get(hierarchyFixture.groups[0].id).category,"孫");
assert.equal(hierarchyDb.prepare("SELECT category_path_json FROM keyword_groups WHERE group_id = ?").get(hierarchyFixture.groups[0].id).category_path_json,'["親","子","孫"]');
assert.equal(projectDashboard(hierarchyDb).groups.find((group)=>group.id===hierarchyFixture.groups[0].id).category,"親 ＞ 子 ＞ 孫");
hierarchyDb.close();

async function start(port) {
  const server = spawn(process.execPath, ["scripts/serve-keyword-dashboard.mjs"], { env: { ...process.env, WP_DASHBOARD_PORT: String(port), WP_DASHBOARD_DB: dbPath }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dashboard server timeout")), 5000);
    server.stdout.on("data", (chunk) => { if (String(chunk).includes(`:${port}`)) { clearTimeout(timer); resolve(); } });
    server.once("exit", (code) => reject(new Error(`dashboard server exited: ${code}`)));
  });
  return server;
}

async function stop(server) {
  await new Promise((resolve) => { server.once("exit", resolve); server.kill("SIGTERM"); });
}

async function readDashboard(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard`);
  assert.equal(response.status, 200);
  return response.json();
}

const port = 4187;
let server = await start(port);
const first = await readDashboard(port);
assert.equal(first.sites.length, 2);
assert.equal(first.groups.length, 2);
const solo = first.groups.filter((group) => group.site_id === "solobiz-lab.com");
assert.equal(solo.length, 1, "site_id scope must not mix groups");
assert.equal(solo[0].main_keyword, "ライター 副業");
assert.deepEqual(solo[0].intent_keywords, ["記事作成 副業"]);
assert.equal(solo[0].strategy.aio_observed_queries, 1, "AIO count must be derived from DFS raw rows");
assert.equal(solo[0].article_gate.status, "未成立");
assert.deepEqual(first.article_links, [], "no cross-site link may be fabricated when no same-site target exists");
await stop(server);

server = await start(port);
const afterRestart = await readDashboard(port);
assert.deepEqual(afterRestart, first, "persistent SQLite projection must survive server restart");
const html = await fetch(`http://127.0.0.1:${port}/`).then((item) => item.text());
const app = await fetch(`http://127.0.0.1:${port}/app.js`).then((item) => item.text());
assert.match(html, /keyword-rows/);
assert.match(html, /id="page-size"/);
assert.match(html, /id="category-parent-filter"/);
assert.match(html, /id="category-child-filter"/);
assert.match(html, /id="category-grandchild-filter"/);
assert.match(html, /<th>AIO<\/th>/);
assert.match(html, /<th>親カテゴリー<\/th><th id="category-child-head">子カテゴリー<\/th><th id="category-grandchild-head">孫カテゴリー<\/th>/);
assert.match(app, /\/api\/dashboard/);
assert.match(app, /aio_observed_queries>0/);
assert.match(app, /visibleRows=rows\.slice/);
assert.match(app, /categoryDepth=Math\.max/);
assert.match(app, /category-grandchild-head/);
assert.match(app, /syncCategoryFilters/);
assert.doesNotMatch(app, /内包:\s*\$\{row\.group\.intent_keywords/, "contained keyword text must only appear in detail view");
await stop(server);
console.log("persistent SQLite→API→frontend contract: OK (DFS raw provenance, restart persistence, site isolation, strategy, gates, no fabricated links)");
