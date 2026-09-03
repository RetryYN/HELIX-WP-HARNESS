import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { researchOpenApi, routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const db = openDashboardDb(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db), site = data.sites[0], oracle = site.observed_tag_content_coverage;
  assert.equal(researchOpenApi.info.version, "2.118.0");
  assert.equal(oracle.summary.decision_count, 125);
  assert.equal(oracle.summary.assigned_article_count, 66);
  assert.equal(oracle.summary.lexical_term_covered_count, 6);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM observed_tag_content_coverage WHERE site_id=?").get(site.site_id).count, oracle.summary.decision_count);
  assert(oracle.rows.every((row) => !row.popularity_inferred && !row.ranking_effect_inferred && !row.auto_content_use && row.coverage_digest.length === 64));
  const url = new URL(`/api/v1/observed-tag-content-coverage?site_id=${site.site_id}&action=verify_claim_before_consideration&limit=100`, "http://localhost"), api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(api.status, 200);
  assert.equal(api.body.meta.total, oracle.summary.claim_verification_required_count);
  assert(api.body.data.every((row) => row.claim_verification_required && row.review_action === "verify_claim_before_consideration"));
  assert.equal(api.body.claim_verification_fail_closed, true);
  assert.equal(api.body.external_acquisition_triggered, false);
  const mcp = handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "review_observed_tag_content_coverage", arguments: { site_id: site.site_id, action: "classify_before_consideration", limit: 100 } } }, data);
  assert.equal(mcp.result.isError, false);
  assert.equal(mcp.result.structuredContent.meta.total, oracle.summary.classification_review_required_count);
  const html = readFileSync("docs/prototypes/wp-ops-dashboard/index.html", "utf8"), js = readFileSync("docs/prototypes/wp-ops-dashboard/observed-hashtags.js", "utf8");
  assert.match(html, /記事タイトル・見出しcoverage判断/u);
  assert.match(js, /\/api\/v1\/observed-tag-content-coverage/u);
  assert.match(js, /自動利用なし・順位効果推論なし/u);
  console.log(`observed tag content coverage API/MCP/UI: OK (${oracle.summary.decision_count} decisions, ${oracle.summary.assigned_article_count} article links, ${oracle.summary.lexical_term_covered_count} lexical coverage)`);
} finally { db.close(); }
