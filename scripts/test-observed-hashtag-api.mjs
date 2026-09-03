import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { researchOpenApi, routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const db = openDashboardDb(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite");
try {
  const data = projectDashboard(db), site = data.sites[0], oracle = site.observed_hashtag_evidence;
  assert.equal(researchOpenApi.info.version, "2.117.0");
  assert(oracle.summary.hashtag_count > 0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM observed_hashtag_evidence WHERE site_id=?").get(site.site_id).count, oracle.summary.hashtag_count);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM observed_hashtag_occurrences WHERE site_id=?").get(site.site_id).count, oracle.summary.occurrence_count);
  assert(oracle.rows.every((row) => row.review_required && !row.popularity_inferred && !row.trend_inferred && !row.search_volume_inferred && !row.auto_content_use && row.evidence_digest.length === 64));
  const url = new URL(`/api/v1/observed-hashtags?site_id=${site.site_id}&classification=social_or_topic_observed&limit=100`, "http://localhost"), api = routeResearchApi(url.pathname, url, data, db);
  assert.equal(api.status, 200);
  assert.equal(api.body.meta.total, oracle.summary.social_or_topic_count);
  assert(api.body.data.every((row) => row.classification === "social_or_topic_observed"));
  assert.equal(api.body.external_social_dataset_connected, false);
  assert.equal(api.body.external_acquisition_triggered, false);
  const mcp = handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_observed_hashtags", arguments: { site_id: site.site_id, source: "competitor_heading", limit: 100 } } }, data);
  assert.equal(mcp.result.isError, false);
  assert(mcp.result.structuredContent.data.every((row) => row.source_kinds.includes("competitor_heading")));
  const html = readFileSync("docs/prototypes/wp-ops-dashboard/index.html", "utf8"), js = readFileSync("docs/prototypes/wp-ops-dashboard/observed-hashtags.js", "utf8");
  assert.match(html, /data-view="observed-hashtags"/u);
  assert.match(html, /SNS全体の人気・トレンド・検索量・順位効果ではありません/u);
  assert.match(js, /\/api\/v1\/observed-hashtags/u);
  assert.match(js, /自動利用なし/u);
  console.log(`observed hashtag API/MCP/UI: OK (${oracle.summary.hashtag_count} tags, ${oracle.summary.occurrence_count} retained occurrences, no social inference)`);
} finally { db.close(); }
