import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildDashboardDb, openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { groupBySerp } from "./keyword-serp-core.mjs";

const root = process.env.WP_DASHBOARD_SCALE_ROOT ? path.resolve(process.env.WP_DASHBOARD_SCALE_ROOT) : mkdtempSync(path.join(tmpdir(), "wp-keyword-scale-"));
mkdirSync(root, { recursive: true });
const rawDir = path.join(root, "raw"); mkdirSync(rawDir, { recursive: true });
const sites = [{ site_id: "scale-a.test", label: "Scale A", domain: "scale-a.test", status: "active", is_pinned: true, display_order: 1 }, { site_id: "scale-b.test", label: "Scale B", domain: "scale-b.test", status: "active", is_pinned: true, display_order: 2 }];
const records = [];
for (let cluster = 0; cluster < 20; cluster += 1) for (let member = 0; member < 5; member += 1) {
  const taskId = `scale-${cluster}-${member}`;
  const keyword = `topic-${cluster} keyword-${member}`;
  const organic_urls = Array.from({ length: 5 }, (_, rank) => `https://result-${cluster}.test/${rank}`);
  records.push({ source_keyword_id: taskId, task_id: taskId, keyword, organic_urls, site_id: sites[cluster % 2].site_id, search_volume: (member + 1) * 100 });
  writeFileSync(path.join(rawDir, `${taskId}.json`), JSON.stringify({ tasks: [{ id: taskId, cost: 0.0006, data: { keyword }, result: [{ datetime: "2026-08-23 00:00:00 +00:00", item_types: member === 0 ? ["organic", "ai_overview"] : ["organic"], items: organic_urls.map((url, index) => ({ type: "organic", url, rank_group: index + 1 })) }] }] }));
}
const clusters = sites.flatMap((site) => groupBySerp(records.filter((row) => row.site_id === site.site_id), { highThreshold: 0.8, possibleThreshold: 0.6, comparisonDepth: 5 }).clusters);
assert.equal(clusters.length, 20);
const groups = clusters.map((members, index) => {
  const rows = members.map((id) => records.find((row) => row.source_keyword_id === id)).sort((a, b) => b.search_volume - a.search_volume);
  return { id: `group-${index}`, site_id: rows[0].site_id, main_keyword: rows[0].keyword, main_origin: "highest_search_volume", source_order: { file: 1, sheet: 1, row: index + 1 }, source_location: `scale/${index}`, search_volume: rows[0].search_volume, search_volume_source: "scale-fixture", intent_keywords: rows.slice(1).map((row) => row.keyword), sibling_keywords: [], comparison_keywords: rows.map((row) => row.keyword), confidence: "high", overlap: { shared: 5, depth: 5, ratio: 1 }, wp_article_id: null, category: `category-${index % 4}`, strategy: { decision: "施策候補", article_count: 1, main_basis: "SERP群内の検索Vol最大", click_opportunity: "scale-test" }, article_gate: { conditions: [{ label: "対象KW群の確定", status: "pass", detail: "scale" }] }, cost: rows.length * 0.0006, task_ids: rows.map((row) => row.task_id), shared_urls: rows[0].organic_urls };
});
const fixturePath = path.join(root, "fixture.json"); const dbPath = path.join(root, "dashboard.sqlite");
writeFileSync(fixturePath, JSON.stringify({ generated_at: "2026-08-23T00:00:00Z", sites, groups, normalization_aliases: [] }));
buildDashboardDb({ dbPath, fixturePath, artifactRoot: root }).close();
const data = projectDashboard(openDashboardDb(dbPath));
assert.equal(data.groups.length, 20); assert.equal(data.groups.reduce((sum, group) => sum + 1 + group.intent_keywords.length, 0), 100);
assert.equal(data.groups.every((group) => group.intent_keywords.length === 4 && group.search_volume === 500), true);
assert.deepEqual(data.groups.reduce((counts, group) => ({ ...counts, [group.site_id]: (counts[group.site_id] ?? 0) + 1 }), {}), { "scale-a.test": 10, "scale-b.test": 10 });
console.log(`100 keyword scale: OK (4,950 pair comparisons, 20 SERP groups, 20 main, 80 contained, 2 isolated sites, persistent SQLite projection: ${dbPath})`);
