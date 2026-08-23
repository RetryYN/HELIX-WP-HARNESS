import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildDashboardDb } from "./keyword-dashboard-db.mjs";

const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "wp-dashboard-db-")), "dashboard.sqlite");
buildDashboardDb({ dbPath, fixturePath: path.resolve("docs/prototypes/wp-ops-dashboard/data.json"), artifactRoot: path.resolve("artifacts/poc") }).close();
const persisted = new DatabaseSync(dbPath, { readOnly: true });
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks").get().count, 4);
assert.equal(persisted.prepare("SELECT SUM(aio_present) AS count FROM dfs_tasks").get().count, 3);
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE snapshot_path = ''").get().count, 0);
persisted.close();

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
assert.match(app, /\/api\/dashboard/);
await stop(server);
console.log("persistent SQLite→API→frontend contract: OK (DFS raw provenance, restart persistence, site isolation, strategy, gates, no fabricated links)");
