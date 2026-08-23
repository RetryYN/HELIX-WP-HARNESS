import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function createDashboardDb(fixturePath) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE sites (site_id TEXT PRIMARY KEY, label TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL, is_pinned INTEGER NOT NULL, display_order INTEGER NOT NULL);
    CREATE TABLE keyword_groups (group_id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(site_id), main_keyword TEXT NOT NULL, main_origin TEXT NOT NULL, category TEXT NOT NULL, source_order_file INTEGER NOT NULL, source_order_sheet INTEGER NOT NULL, source_order_row INTEGER NOT NULL, source_location TEXT NOT NULL, search_volume_json TEXT NOT NULL, search_volume_source TEXT NOT NULL, confidence TEXT NOT NULL, overlap_shared INTEGER NOT NULL, overlap_depth INTEGER NOT NULL, overlap_ratio REAL NOT NULL, wp_article_id INTEGER, cost REAL NOT NULL);
    CREATE TABLE group_keywords (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), keyword TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('intent','sibling','comparison')), position INTEGER NOT NULL, PRIMARY KEY(group_id, role, position));
    CREATE TABLE strategy_decisions (group_id TEXT PRIMARY KEY REFERENCES keyword_groups(group_id), decision TEXT NOT NULL, article_count INTEGER NOT NULL, main_basis TEXT NOT NULL, aio_observed_queries INTEGER NOT NULL, aio_checked_queries INTEGER NOT NULL, click_opportunity TEXT NOT NULL);
    CREATE TABLE gate_runs (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), gate_order INTEGER NOT NULL, gate_label TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pass','pending','blocked')), detail TEXT NOT NULL, PRIMARY KEY(group_id, gate_order));
    CREATE TABLE dfs_tasks (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), task_order INTEGER NOT NULL, task_id TEXT NOT NULL, PRIMARY KEY(group_id, task_order));
    CREATE TABLE shared_urls (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), url_order INTEGER NOT NULL, url TEXT NOT NULL, PRIMARY KEY(group_id, url_order));
    CREATE TABLE article_links (link_id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(site_id), source_group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), target_group_id TEXT REFERENCES keyword_groups(group_id), trigger_type TEXT NOT NULL, trigger_text TEXT NOT NULL, source_section TEXT, state TEXT NOT NULL);
  `);
  const insertSite = db.prepare("INSERT INTO sites VALUES (?, ?, ?, ?, ?, ?)");
  for (const site of fixture.sites) insertSite.run(site.site_id, site.label, site.domain, site.status, Number(site.is_pinned), site.display_order);
  const insertGroup = db.prepare("INSERT INTO keyword_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertKeyword = db.prepare("INSERT INTO group_keywords VALUES (?, ?, ?, ?)");
  const insertStrategy = db.prepare("INSERT INTO strategy_decisions VALUES (?, ?, ?, ?, ?, ?, ?)");
  const insertGate = db.prepare("INSERT INTO gate_runs VALUES (?, ?, ?, ?, ?)");
  const insertTask = db.prepare("INSERT INTO dfs_tasks VALUES (?, ?, ?)");
  const insertUrl = db.prepare("INSERT INTO shared_urls VALUES (?, ?, ?)");
  for (const group of fixture.groups) {
    insertGroup.run(group.id, group.site_id, group.main_keyword, group.main_origin, group.category, group.source_order.file, group.source_order.sheet, group.source_order.row, group.source_location, JSON.stringify(group.search_volume), group.search_volume_source, group.confidence, group.overlap.shared, group.overlap.depth, group.overlap.ratio, group.wp_article_id, group.cost);
    for (const [role, values] of [["intent", group.intent_keywords], ["sibling", group.sibling_keywords], ["comparison", group.comparison_keywords]]) values.forEach((value, index) => insertKeyword.run(group.id, value, role, index));
    insertStrategy.run(group.id, group.strategy.decision, group.strategy.article_count, group.strategy.main_basis, group.strategy.aio_observed_queries, group.strategy.aio_checked_queries, group.strategy.click_opportunity);
    group.article_gate.conditions.forEach((gate, index) => insertGate.run(group.id, index, gate.label, gate.status, gate.detail));
    group.task_ids.forEach((task, index) => insertTask.run(group.id, index, task));
    group.shared_urls.forEach((url, index) => insertUrl.run(group.id, index, url));
  }
  return { db, generatedAt: fixture.generated_at, normalizationAliases: fixture.normalization_aliases ?? [] };
}

export function projectDashboard({ db, generatedAt, normalizationAliases }) {
  const sites = db.prepare("SELECT site_id, label, domain, status, is_pinned, display_order FROM sites ORDER BY display_order").all().map((site) => ({ ...site, is_pinned: Boolean(site.is_pinned) }));
  const groups = db.prepare("SELECT * FROM keyword_groups ORDER BY source_order_file, source_order_sheet, source_order_row").all().map((row) => {
    const keywords = db.prepare("SELECT keyword, role FROM group_keywords WHERE group_id = ? ORDER BY role, position").all(row.group_id);
    const list = (role) => keywords.filter((item) => item.role === role).map((item) => item.keyword);
    const strategy = db.prepare("SELECT decision, article_count, main_basis, aio_observed_queries, aio_checked_queries, click_opportunity FROM strategy_decisions WHERE group_id = ?").get(row.group_id);
    const conditions = db.prepare("SELECT gate_label AS label, status, detail FROM gate_runs WHERE group_id = ? ORDER BY gate_order").all(row.group_id);
    const task_ids = db.prepare("SELECT task_id FROM dfs_tasks WHERE group_id = ? ORDER BY task_order").all(row.group_id).map((item) => item.task_id);
    const shared_urls = db.prepare("SELECT url FROM shared_urls WHERE group_id = ? ORDER BY url_order").all(row.group_id).map((item) => item.url);
    return { id: row.group_id, site_id: row.site_id, main_keyword: row.main_keyword, main_origin: row.main_origin, source_order: { file: row.source_order_file, sheet: row.source_order_sheet, row: row.source_order_row }, source_location: row.source_location, search_volume: JSON.parse(row.search_volume_json), search_volume_source: row.search_volume_source, intent_keywords: list("intent"), sibling_keywords: list("sibling"), comparison_keywords: list("comparison"), confidence: row.confidence, overlap: { shared: row.overlap_shared, depth: row.overlap_depth, ratio: row.overlap_ratio }, state: row.wp_article_id == null ? "新規記事候補" : "記事ID割当済み", wp_article_id: row.wp_article_id, category: row.category, strategy, article_gate: { status: conditions.every((item) => item.status === "pass") ? "成立" : "未成立", conditions }, cost: row.cost, task_ids, shared_urls };
  });
  const article_links = db.prepare("SELECT * FROM article_links ORDER BY link_id").all();
  return { generated_at: generatedAt, sites, groups, normalization_aliases: normalizationAliases, article_links };
}
