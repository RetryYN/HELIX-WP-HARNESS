import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 4187;
const server = spawn(process.execPath, ["scripts/serve-keyword-dashboard.mjs"], { env: { ...process.env, WP_DASHBOARD_PORT: String(port) }, stdio: ["ignore", "pipe", "inherit"] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dashboard server timeout")), 5000);
    server.stdout.on("data", (chunk) => { if (String(chunk).includes(`:${port}`)) { clearTimeout(timer); resolve(); } });
    server.once("exit", (code) => reject(new Error(`dashboard server exited: ${code}`)));
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.sites.length, 2);
  assert.equal(data.groups.length, 2);
  const solo = data.groups.filter((group) => group.site_id === "solobiz-lab.com");
  assert.equal(solo.length, 1, "site_id scope must not mix groups");
  assert.equal(solo[0].main_keyword, "ライター 副業");
  assert.deepEqual(solo[0].intent_keywords, ["記事作成 副業"]);
  assert.equal(solo[0].strategy.aio_observed_queries, 1);
  assert.equal(solo[0].article_gate.status, "未成立");
  assert.equal(solo[0].article_gate.conditions.filter((gate) => gate.status === "pass").length, 1);
  assert.deepEqual(data.article_links, [], "no cross-site link may be fabricated when no same-site target exists");
  const html = await fetch(`http://127.0.0.1:${port}/`).then((item) => item.text());
  const app = await fetch(`http://127.0.0.1:${port}/app.js`).then((item) => item.text());
  assert.match(html, /keyword-rows/);
  assert.match(app, /\/api\/dashboard/);
  console.log("keyword dashboard DB→API→frontend contract: OK (2 sites, 2 groups, site isolation, strategy, gates, no fabricated links)");
} finally {
  server.kill("SIGTERM");
}
