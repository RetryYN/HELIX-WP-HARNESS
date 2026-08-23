import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const schemaVersion = "keyword-dashboard.v1";

function rawSnapshots(artifactRoot) {
  const snapshots = new Map();
  for (const entry of readdirSync(artifactRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "result.json") continue;
    const file = `${entry.parentPath}/${entry.name}`;
    const body = JSON.parse(readFileSync(file, "utf8"));
    const task = body.tasks?.[0];
    const result = task?.result?.[0];
    if (!task?.id || !result) continue;
    snapshots.set(task.id, { task_id: task.id, keyword: task.data?.keyword, snapshot_path: file, observed_at: result.datetime, aio_present: Number(result.item_types?.includes("ai_overview") ?? false), cost: Number(task.cost ?? 0) });
  }
  return snapshots;
}

export function buildDashboardDb({ dbPath, fixturePath, artifactRoot, importedKeywords = [] }) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const snapshots = rawSnapshots(artifactRoot);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS imported_keywords; DROP TABLE IF EXISTS article_links; DROP TABLE IF EXISTS shared_urls; DROP TABLE IF EXISTS dfs_tasks; DROP TABLE IF EXISTS gate_runs; DROP TABLE IF EXISTS strategy_decisions; DROP TABLE IF EXISTS group_keywords; DROP TABLE IF EXISTS keyword_groups; DROP TABLE IF EXISTS sites; DROP TABLE IF EXISTS dashboard_metadata;
    PRAGMA foreign_keys = ON;
    CREATE TABLE dashboard_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE imported_keywords (source_keyword_id TEXT PRIMARY KEY, site_id TEXT NOT NULL, source_sheet TEXT NOT NULL, source_row INTEGER NOT NULL, raw_keyword TEXT NOT NULL, search_volume INTEGER, cpc REAL, competition REAL, processing_state TEXT NOT NULL);
    CREATE TABLE sites (site_id TEXT PRIMARY KEY, label TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL, is_pinned INTEGER NOT NULL, display_order INTEGER NOT NULL);
    CREATE TABLE keyword_groups (group_id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(site_id), main_keyword TEXT NOT NULL, main_origin TEXT NOT NULL, category TEXT NOT NULL, source_order_file INTEGER NOT NULL, source_order_sheet INTEGER NOT NULL, source_order_row INTEGER NOT NULL, source_location TEXT NOT NULL, search_volume_json TEXT NOT NULL, search_volume_source TEXT NOT NULL, confidence TEXT NOT NULL, overlap_shared INTEGER NOT NULL, overlap_depth INTEGER NOT NULL, overlap_ratio REAL NOT NULL, action_state TEXT NOT NULL CHECK(action_state IN ('未施策','予約済','下書き','公開中')), wp_article_id INTEGER, cost REAL NOT NULL);
    CREATE TABLE group_keywords (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), keyword TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('intent','sibling','comparison')), position INTEGER NOT NULL, PRIMARY KEY(group_id, role, position));
    CREATE TABLE strategy_decisions (group_id TEXT PRIMARY KEY REFERENCES keyword_groups(group_id), decision TEXT NOT NULL, article_count INTEGER NOT NULL, main_basis TEXT NOT NULL, click_opportunity TEXT NOT NULL);
    CREATE TABLE gate_runs (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), gate_order INTEGER NOT NULL, gate_label TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pass','pending','blocked')), detail TEXT NOT NULL, PRIMARY KEY(group_id, gate_order));
    CREATE TABLE dfs_tasks (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), task_order INTEGER NOT NULL, task_id TEXT NOT NULL, keyword TEXT NOT NULL, snapshot_path TEXT NOT NULL, observed_at TEXT NOT NULL, aio_present INTEGER NOT NULL, cost REAL NOT NULL, PRIMARY KEY(group_id, task_order));
    CREATE TABLE shared_urls (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), url_order INTEGER NOT NULL, url TEXT NOT NULL, PRIMARY KEY(group_id, url_order));
    CREATE TABLE article_links (link_id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(site_id), source_group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), target_group_id TEXT REFERENCES keyword_groups(group_id), trigger_type TEXT NOT NULL, trigger_text TEXT NOT NULL, source_section TEXT, state TEXT NOT NULL);
  `);
  const metadata = db.prepare("INSERT INTO dashboard_metadata VALUES (?, ?)");
  metadata.run("schema_version", schemaVersion); metadata.run("generated_at", fixture.generated_at); metadata.run("normalization_aliases", JSON.stringify(fixture.normalization_aliases ?? []));
  const insertSite = db.prepare("INSERT INTO sites VALUES (?, ?, ?, ?, ?, ?)");
  for (const site of fixture.sites) insertSite.run(site.site_id, site.label, site.domain, site.status, Number(site.is_pinned), site.display_order);
  const insertImported=db.prepare("INSERT INTO imported_keywords VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const processedKeywords=new Set(fixture.groups.flatMap((group)=>group.comparison_keywords.map((keyword)=>`${group.site_id}\0${keyword}`)));
  importedKeywords.forEach((row)=>insertImported.run(row.source_keyword_id,row.site_id,row.source_sheet,row.source_row,row.raw_keyword,row.search_volume,row.cpc,row.competition,processedKeywords.has(`${row.site_id}\0${row.raw_keyword}`)?"施策KW群割当済み":"SERP未取得"));
  const insertGroup = db.prepare("INSERT INTO keyword_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertKeyword = db.prepare("INSERT INTO group_keywords VALUES (?, ?, ?, ?)");
  const insertStrategy = db.prepare("INSERT INTO strategy_decisions VALUES (?, ?, ?, ?, ?)");
  const insertGate = db.prepare("INSERT INTO gate_runs VALUES (?, ?, ?, ?, ?)");
  const insertTask = db.prepare("INSERT INTO dfs_tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insertUrl = db.prepare("INSERT INTO shared_urls VALUES (?, ?, ?)");
  for (const group of fixture.groups) {
    const actionState={"新規記事候補":"未施策","記事ID割当済み":"予約済"}[group.state]??group.state;
    insertGroup.run(group.id, group.site_id, group.main_keyword, group.main_origin, group.category, group.source_order.file, group.source_order.sheet, group.source_order.row, group.source_location, JSON.stringify(group.search_volume), group.search_volume_source, group.confidence, group.overlap.shared, group.overlap.depth, group.overlap.ratio, actionState, group.wp_article_id, group.cost);
    for (const [role, values] of [["intent", group.intent_keywords], ["sibling", group.sibling_keywords], ["comparison", group.comparison_keywords]]) values.forEach((value, index) => insertKeyword.run(group.id, value, role, index));
    insertStrategy.run(group.id, group.strategy.decision, group.strategy.article_count, group.strategy.main_basis, group.strategy.click_opportunity);
    group.article_gate.conditions.forEach((gate, index) => insertGate.run(group.id, index, gate.label, gate.status, gate.detail));
    group.task_ids.forEach((taskId, index) => {
      const snapshot = snapshots.get(taskId);
      if (!snapshot) throw new Error(`DFS raw snapshot not found for task ${taskId}`);
      if (!group.comparison_keywords.includes(snapshot.keyword)) throw new Error(`DFS task keyword is not in group ${group.id}: ${snapshot.keyword}`);
      insertTask.run(group.id, index, taskId, snapshot.keyword, snapshot.snapshot_path, snapshot.observed_at, snapshot.aio_present, snapshot.cost);
    });
    group.shared_urls.forEach((url, index) => insertUrl.run(group.id, index, url));
  }
  db.exec("PRAGMA optimize");
  return db;
}

export function openDashboardDb(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const version = db.prepare("SELECT value FROM dashboard_metadata WHERE key = 'schema_version'").get()?.value;
  if (version !== schemaVersion) throw new Error(`dashboard DB schema mismatch: ${version ?? "missing"}`);
  return db;
}

export function projectDashboard(db) {
  const metadata = Object.fromEntries(db.prepare("SELECT key, value FROM dashboard_metadata").all().map((row) => [row.key, row.value]));
  const sites = db.prepare("SELECT site_id, label, domain, status, is_pinned, display_order FROM sites ORDER BY display_order").all().map((site) => ({ ...site, is_pinned: Boolean(site.is_pinned) }));
  const groups = db.prepare("SELECT * FROM keyword_groups ORDER BY source_order_file, source_order_sheet, source_order_row").all().map((row) => {
    const keywords = db.prepare("SELECT keyword, role FROM group_keywords WHERE group_id = ? ORDER BY role, position").all(row.group_id);
    const list = (role) => keywords.filter((item) => item.role === role).map((item) => item.keyword);
    const strategy = db.prepare("SELECT decision, article_count, main_basis, click_opportunity FROM strategy_decisions WHERE group_id = ?").get(row.group_id);
    const aio = db.prepare("SELECT SUM(aio_present) AS observed, COUNT(*) AS checked FROM dfs_tasks WHERE group_id = ?").get(row.group_id);
    const conditions = db.prepare("SELECT gate_label AS label, status, detail FROM gate_runs WHERE group_id = ? ORDER BY gate_order").all(row.group_id);
    const task_ids = db.prepare("SELECT task_id FROM dfs_tasks WHERE group_id = ? ORDER BY task_order").all(row.group_id).map((item) => item.task_id);
    const shared_urls = db.prepare("SELECT url FROM shared_urls WHERE group_id = ? ORDER BY url_order").all(row.group_id).map((item) => item.url);
    return { id: row.group_id, site_id: row.site_id, main_keyword: row.main_keyword, main_origin: row.main_origin, source_order: { file: row.source_order_file, sheet: row.source_order_sheet, row: row.source_order_row }, source_location: row.source_location, search_volume: JSON.parse(row.search_volume_json), search_volume_source: row.search_volume_source, intent_keywords: list("intent"), sibling_keywords: list("sibling"), comparison_keywords: list("comparison"), confidence: row.confidence, overlap: { shared: row.overlap_shared, depth: row.overlap_depth, ratio: row.overlap_ratio }, state: row.action_state, wp_article_id: row.wp_article_id, category: row.category, strategy: { ...strategy, aio_observed_queries: Number(aio.observed), aio_checked_queries: Number(aio.checked) }, article_gate: { status: conditions.every((item) => item.status === "pass") ? "成立" : "未成立", conditions }, cost: row.cost, task_ids, shared_urls };
  });
  return { generated_at: metadata.generated_at, sites, groups, keyword_inventory: db.prepare("SELECT * FROM imported_keywords ORDER BY site_id, source_sheet, source_row").all(), normalization_aliases: JSON.parse(metadata.normalization_aliases), article_links: db.prepare("SELECT * FROM article_links ORDER BY link_id").all() };
}
