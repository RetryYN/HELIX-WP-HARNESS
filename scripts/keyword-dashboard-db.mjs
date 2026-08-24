import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { parseCsv } from "./read-csv.mjs";
import { normalizeKeyword } from "./keyword-serp-core.mjs";
import { categoryPathsForIds } from "./keyword-category-taxonomy.mjs";
import { aggregateNormalizedQueries,primaryQueryStats, rankPrimaryQueries } from "./gsc-primary-query.mjs";
import { assessKeywordAcquisition, matchKeywordGroupToArticles, reconcileArticleAssignments } from "./keyword-article-matching.mjs";
import {buildKeywordHierarchy} from "./keyword-hierarchy.mjs";
import {keywordDisplayText} from "./keyword-policy.mjs";
import {classifySerpResult,recommendPageType} from "./serp-page-classification.mjs";

const schemaVersion = "keyword-dashboard.v8";
const replaceableSchemaVersions=new Set([schemaVersion,"keyword-dashboard.v7"]);
const numeric=(value,label)=>{const parsed=Number(String(value).replaceAll(",","").replace("%",""));if(!Number.isFinite(parsed))throw new Error(`GSC ${label} is not numeric: ${value}`);return parsed};

function rawSnapshots(artifactRoot) {
  const snapshots = new Map();
  for (const entry of readdirSync(artifactRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || path.basename(entry.parentPath) !== "raw") continue;
    const file = `${entry.parentPath}/${entry.name}`;
    const body = JSON.parse(readFileSync(file, "utf8"));
    const task = body.tasks?.[0];
    const result = task?.result?.[0];
    if (!task?.id || !result) continue;
    const serpPages=classifySerpResult(result,10);
    if(snapshots.has(task.id))throw new Error(`duplicate DFS task snapshot ${task.id}: ${snapshots.get(task.id).snapshot_path} and ${file}`);
    snapshots.set(task.id, { task_id: task.id, keyword: task.data?.keyword, snapshot_path: file, observed_at: result.datetime, aio_present: Number(result.item_types?.includes("ai_overview") ?? false), cost: Number(task.cost ?? 0),serp_pages:serpPages,recommended_page_type:recommendPageType(serpPages) });
  }
  return snapshots;
}

export function buildDashboardDb({ dbPath, fixturePath, artifactRoot, importedKeywords = [], gscEvidencePath, headingEvidencePath }) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const snapshots = rawSnapshots(artifactRoot);
  if(existsSync(dbPath)&&statSync(dbPath).size>0){
    let existing;
    try{
      existing=new DatabaseSync(dbPath,{readOnly:true});
      const version=existing.prepare("SELECT value FROM dashboard_metadata WHERE key = 'schema_version'").get()?.value;
      if(!replaceableSchemaVersions.has(version))throw new Error(`refusing to replace non-dashboard DB: schema ${version??"missing"}`);
    }catch(error){
      if(String(error.message).startsWith("refusing to replace"))throw error;
      throw new Error(`refusing to replace unrecognized DB at ${dbPath}: ${error.message}`);
    }finally{existing?.close()}
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS keyword_article_match_candidates; DROP TABLE IF EXISTS keyword_article_match_runs; DROP TABLE IF EXISTS gsc_query_results; DROP TABLE IF EXISTS articles; DROP TABLE IF EXISTS keyword_hierarchy; DROP TABLE IF EXISTS imported_keywords; DROP TABLE IF EXISTS article_links; DROP TABLE IF EXISTS shared_urls; DROP TABLE IF EXISTS dfs_tasks; DROP TABLE IF EXISTS gate_runs; DROP TABLE IF EXISTS strategy_decisions; DROP TABLE IF EXISTS group_keywords; DROP TABLE IF EXISTS keyword_groups; DROP TABLE IF EXISTS sites; DROP TABLE IF EXISTS dashboard_metadata;
    PRAGMA foreign_keys = ON;
    CREATE TABLE dashboard_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE imported_keywords (source_keyword_id TEXT PRIMARY KEY, site_id TEXT NOT NULL, source_sheet TEXT NOT NULL, source_row INTEGER NOT NULL, raw_keyword TEXT NOT NULL, search_volume INTEGER, cpc REAL, competition REAL, processing_state TEXT NOT NULL);
    CREATE TABLE keyword_hierarchy (source_keyword_id TEXT PRIMARY KEY REFERENCES imported_keywords(source_keyword_id), representative_source_keyword_id TEXT NOT NULL, parent_source_keyword_id TEXT, root_source_keyword_id TEXT NOT NULL, context_scope_id TEXT NOT NULL, normalized_terms_json TEXT NOT NULL, tree_path_json TEXT NOT NULL, term_count INTEGER NOT NULL, depth INTEGER NOT NULL, relation TEXT NOT NULL CHECK(relation IN ('root','child','reordered_alias')));
    CREATE TABLE sites (site_id TEXT PRIMARY KEY, label TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL, is_pinned INTEGER NOT NULL, display_order INTEGER NOT NULL);
    CREATE TABLE articles (site_id TEXT NOT NULL REFERENCES sites(site_id), wp_article_id INTEGER NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL, category_ids_json TEXT NOT NULL, headings_json TEXT NOT NULL, gsc_status TEXT NOT NULL CHECK(gsc_status IN ('ok','error')), PRIMARY KEY(site_id, wp_article_id), UNIQUE(site_id, url));
    CREATE TABLE gsc_query_results (site_id TEXT NOT NULL, wp_article_id INTEGER NOT NULL, query TEXT NOT NULL, normalized_query TEXT NOT NULL, clicks INTEGER NOT NULL, impressions INTEGER NOT NULL, ctr REAL NOT NULL, position REAL NOT NULL, window_days INTEGER NOT NULL, observed_at TEXT NOT NULL, source_file TEXT NOT NULL, PRIMARY KEY(site_id, wp_article_id, query, window_days, observed_at), FOREIGN KEY(site_id, wp_article_id) REFERENCES articles(site_id, wp_article_id));
    CREATE TABLE keyword_groups (group_id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(site_id), resolution_state TEXT NOT NULL CHECK(resolution_state IN ('resolved','unresolved')), main_keyword TEXT, derived_parent_candidate TEXT, main_origin TEXT NOT NULL, category TEXT NOT NULL, category_path_json TEXT NOT NULL, source_order_file INTEGER NOT NULL, source_order_sheet INTEGER NOT NULL, source_order_row INTEGER NOT NULL, source_location TEXT NOT NULL, search_volume_json TEXT NOT NULL, search_volume_source TEXT NOT NULL, confidence TEXT NOT NULL, overlap_shared INTEGER NOT NULL, overlap_depth INTEGER NOT NULL, overlap_ratio REAL NOT NULL, action_state TEXT NOT NULL CHECK(action_state IN ('未施策','予約済','下書き','公開中')), wp_article_id INTEGER, cost REAL NOT NULL, CHECK((resolution_state = 'resolved' AND main_keyword IS NOT NULL) OR (resolution_state = 'unresolved' AND main_keyword IS NULL)));
    CREATE TABLE group_keywords (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), keyword TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('intent','sibling','comparison')), position INTEGER NOT NULL, PRIMARY KEY(group_id, role, position));
    CREATE TABLE strategy_decisions (group_id TEXT PRIMARY KEY REFERENCES keyword_groups(group_id), decision TEXT NOT NULL, article_count INTEGER NOT NULL, main_basis TEXT NOT NULL, click_opportunity TEXT NOT NULL);
    CREATE TABLE gate_runs (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), gate_order INTEGER NOT NULL, gate_label TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pass','pending','blocked')), detail TEXT NOT NULL, PRIMARY KEY(group_id, gate_order));
    CREATE TABLE dfs_tasks (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), task_order INTEGER NOT NULL, task_id TEXT NOT NULL, keyword TEXT NOT NULL, snapshot_path TEXT NOT NULL, observed_at TEXT NOT NULL, aio_present INTEGER NOT NULL, cost REAL NOT NULL, recommended_page_type TEXT NOT NULL, serp_pages_json TEXT NOT NULL, PRIMARY KEY(group_id, task_order));
    CREATE TABLE shared_urls (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), url_order INTEGER NOT NULL, url TEXT NOT NULL, PRIMARY KEY(group_id, url_order));
    CREATE TABLE article_links (link_id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(site_id), source_group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), target_group_id TEXT REFERENCES keyword_groups(group_id), trigger_type TEXT NOT NULL, trigger_text TEXT NOT NULL, source_section TEXT, state TEXT NOT NULL);
    CREATE TABLE keyword_article_match_runs (group_id TEXT PRIMARY KEY REFERENCES keyword_groups(group_id), state TEXT NOT NULL CHECK(state IN ('確定','タイトル一致のみ','見出し一致のみ','複数候補','同一記事候補','新規記事候補')), selected_wp_article_id INTEGER);
    CREATE TABLE keyword_article_match_candidates (group_id TEXT NOT NULL REFERENCES keyword_groups(group_id), wp_article_id INTEGER NOT NULL, matched_keyword TEXT NOT NULL, matched_role TEXT NOT NULL CHECK(matched_role IN ('main','intent')), title_score INTEGER NOT NULL, title_matches_json TEXT NOT NULL, query_matches_json TEXT NOT NULL, heading_score INTEGER NOT NULL, heading_matches_json TEXT NOT NULL, coverage_rate REAL NOT NULL, coverage_json TEXT NOT NULL, PRIMARY KEY(group_id,wp_article_id,matched_keyword));
  `);
  const metadata = db.prepare("INSERT INTO dashboard_metadata VALUES (?, ?)");
  metadata.run("schema_version", schemaVersion); metadata.run("generated_at", fixture.generated_at); metadata.run("normalization_aliases", JSON.stringify(fixture.normalization_aliases ?? []));
  const insertSite = db.prepare("INSERT INTO sites VALUES (?, ?, ?, ?, ?, ?)");
  for (const site of fixture.sites) insertSite.run(site.site_id, site.label, site.domain, site.status, Number(site.is_pinned), site.display_order);
  const headingManifest=headingEvidencePath?JSON.parse(readFileSync(headingEvidencePath,"utf8")):null;
  const headingsByArticle=new Map((headingManifest?.articles??[]).map((article)=>[`${article.site_id}\0${article.wp_article_id}`,article.headings]));
  if(gscEvidencePath){
    const manifest=JSON.parse(readFileSync(gscEvidencePath,"utf8"));
    const root=path.dirname(gscEvidencePath);
    const insertArticle=db.prepare("INSERT INTO articles VALUES (?, ?, ?, ?, ?, ?, ?)");
    const insertQuery=db.prepare("INSERT INTO gsc_query_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for(const article of manifest.articles){
      insertArticle.run(article.site_id,article.wp_article_id,article.url,article.title,JSON.stringify(article.categories??[]),JSON.stringify(headingsByArticle.get(`${article.site_id}\0${article.wp_article_id}`)??[]),article.status);
      if(article.status!=="ok")continue;
      const queryPath=path.join(root,article.query_file);
      for(const row of parseCsv(readFileSync(queryPath,"utf8"))){
        const expected=["上位のクエリ","クリック数","表示回数","CTR","掲載順位"];
        if(!expected.every((field)=>field in row))throw new Error(`GSC query CSV schema mismatch: ${queryPath}`);
        insertQuery.run(article.site_id,article.wp_article_id,row["上位のクエリ"],normalizeKeyword(row["上位のクエリ"]),numeric(row["クリック数"],"clicks"),numeric(row["表示回数"],"impressions"),numeric(row["CTR"],"CTR")/100,numeric(row["掲載順位"],"position"),manifest.days,manifest.generated_at,queryPath);
      }
    }
  }
  const insertImported=db.prepare("INSERT INTO imported_keywords VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const processedKeywords=new Set(fixture.groups.flatMap((group)=>group.comparison_keywords.map((keyword)=>`${group.site_id}\0${keyword}`)));
  importedKeywords.forEach((row)=>insertImported.run(row.source_keyword_id,row.site_id,row.source_sheet,row.source_row,row.raw_keyword,row.search_volume,row.cpc,row.competition,processedKeywords.has(`${row.site_id}\0${row.raw_keyword}`)?"施策KW群割当済み":"SERP未取得"));
  const insertHierarchy=db.prepare("INSERT INTO keyword_hierarchy VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for(const site of fixture.sites)for(const row of buildKeywordHierarchy(importedKeywords.filter((item)=>item.site_id===site.site_id)))insertHierarchy.run(row.source_keyword_id,row.representative_source_keyword_id,row.parent_source_keyword_id,row.root_source_keyword_id,row.context_scope_id,JSON.stringify(row.normalized_terms),JSON.stringify(row.tree_path),row.term_count,row.depth,row.relation);
  const insertGroup = db.prepare("INSERT INTO keyword_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertKeyword = db.prepare("INSERT INTO group_keywords VALUES (?, ?, ?, ?)");
  const insertStrategy = db.prepare("INSERT INTO strategy_decisions VALUES (?, ?, ?, ?, ?)");
  const insertGate = db.prepare("INSERT INTO gate_runs VALUES (?, ?, ?, ?, ?)");
  const insertTask = db.prepare("INSERT INTO dfs_tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertUrl = db.prepare("INSERT INTO shared_urls VALUES (?, ?, ?)");
  for (const group of fixture.groups) {
    const actionState={"新規記事候補":"未施策","記事ID割当済み":"予約済"}[group.state]??group.state;
    const categoryPath=group.category_path?.length?group.category_path:[group.category];
    const resolutionState=group.resolution_state??(group.main_keyword!=null?"resolved":"unresolved");
    insertGroup.run(group.id, group.site_id, resolutionState, group.main_keyword??null, group.derived_parent_candidate??null, group.main_origin, categoryPath.at(-1), JSON.stringify(categoryPath), group.source_order.file, group.source_order.sheet, group.source_order.row, group.source_location, JSON.stringify(group.search_volume), group.search_volume_source, group.confidence, group.overlap.shared, group.overlap.depth, group.overlap.ratio, actionState, group.wp_article_id, group.cost);
    for (const [role, values] of [["intent", group.intent_keywords], ["sibling", group.sibling_keywords], ["comparison", group.comparison_keywords]]) values.forEach((value, index) => insertKeyword.run(group.id, value, role, index));
    insertStrategy.run(group.id, group.strategy.decision, group.strategy.article_count, group.strategy.main_basis, group.strategy.click_opportunity);
    group.article_gate.conditions.forEach((gate, index) => insertGate.run(group.id, index, gate.label, gate.status, gate.detail));
    group.task_ids.forEach((taskId, index) => {
      const snapshot = snapshots.get(taskId);
      if (!snapshot) throw new Error(`DFS raw snapshot not found for task ${taskId}`);
      if (!group.comparison_keywords.includes(snapshot.keyword)) throw new Error(`DFS task keyword is not in group ${group.id}: ${snapshot.keyword}`);
      insertTask.run(group.id, index, taskId, snapshot.keyword, snapshot.snapshot_path, snapshot.observed_at, snapshot.aio_present, snapshot.cost,snapshot.recommended_page_type,JSON.stringify(snapshot.serp_pages));
    });
    group.shared_urls.forEach((url, index) => insertUrl.run(group.id, index, url));
  }
  const beforeMatch=projectDashboard(db);
  const insertMatchRun=db.prepare("INSERT INTO keyword_article_match_runs VALUES (?, ?, ?)");
  const insertMatchCandidate=db.prepare("INSERT INTO keyword_article_match_candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const assignArticle=db.prepare("UPDATE keyword_groups SET wp_article_id = ? WHERE group_id = ?");
  for(const site of fixture.sites){
    const articles=beforeMatch.article_query_summaries.filter((article)=>article.site_id===site.site_id);
    // Unresolved groups have no main keyword; they must not be matched to or assigned an article (§5: derived value never promoted).
    const siteGroups=beforeMatch.groups.filter((item)=>item.site_id===site.site_id&&item.resolution_state==="resolved");
    const matches=reconcileArticleAssignments(siteGroups.map((group)=>matchKeywordGroupToArticles(group,articles)));
    for(const match of matches){
      insertMatchRun.run(match.group_id,match.state,match.wp_article_id);
      match.candidates.forEach((candidate)=>insertMatchCandidate.run(match.group_id,candidate.wp_article_id,match.main_keyword,"main",candidate.title_score,JSON.stringify(candidate.title_matches),JSON.stringify(candidate.query_matches),candidate.heading_score,JSON.stringify(candidate.heading_matches),candidate.coverage_rate,JSON.stringify(candidate.planned_keyword_coverage)));
      // Intent-keyword sub-candidates are evidence only; they never participate in selection or wp_article_id assignment.
      (match.intent_candidates??[]).filter((candidate)=>!match.candidates.some((item)=>item.wp_article_id===candidate.wp_article_id&&match.main_keyword===candidate.matched_keyword)).forEach((candidate)=>insertMatchCandidate.run(match.group_id,candidate.wp_article_id,candidate.matched_keyword,"intent",candidate.title_score,"[]","[]",0,"[]",0,"[]"));
      if(match.state==="確定")assignArticle.run(match.wp_article_id,match.group_id);
    }
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
  const keywordHierarchy=db.prepare("SELECT h.*,k.site_id,k.raw_keyword,k.search_volume,p.raw_keyword AS parent_keyword,r.raw_keyword AS stored_root_keyword FROM keyword_hierarchy h JOIN imported_keywords k USING(source_keyword_id) LEFT JOIN imported_keywords p ON p.source_keyword_id=h.parent_source_keyword_id LEFT JOIN imported_keywords r ON r.source_keyword_id=h.root_source_keyword_id ORDER BY k.site_id,h.depth,k.source_sheet,k.source_row").all().map(({normalized_terms_json,tree_path_json,stored_root_keyword,...row})=>{const treePath=JSON.parse(tree_path_json);return{...row,normalized_terms:JSON.parse(normalized_terms_json),tree_path:treePath,root_keyword:stored_root_keyword??treePath[0]}});
  const groups = db.prepare("SELECT * FROM keyword_groups ORDER BY source_order_file, source_order_sheet, source_order_row").all().map((row) => {
    const keywords = db.prepare("SELECT keyword, role FROM group_keywords WHERE group_id = ? ORDER BY role, position").all(row.group_id);
    const list = (role) => keywords.filter((item) => item.role === role).map((item) => item.keyword);
    const strategy = db.prepare("SELECT decision, article_count, main_basis, click_opportunity FROM strategy_decisions WHERE group_id = ?").get(row.group_id);
    const aio = db.prepare("SELECT SUM(aio_present) AS observed, COUNT(*) AS checked FROM dfs_tasks WHERE group_id = ?").get(row.group_id);
    const serpTasks=db.prepare("SELECT keyword,recommended_page_type,serp_pages_json FROM dfs_tasks WHERE group_id=? ORDER BY task_order").all(row.group_id).map(({serp_pages_json,...task})=>({...task,pages:JSON.parse(serp_pages_json)}));
    const recommendedPageType=recommendPageType(serpTasks.flatMap((task)=>task.pages));
    const conditions = db.prepare("SELECT gate_label AS label, status, detail FROM gate_runs WHERE group_id = ? ORDER BY gate_order").all(row.group_id);
    const task_ids = db.prepare("SELECT task_id FROM dfs_tasks WHERE group_id = ? ORDER BY task_order").all(row.group_id).map((item) => item.task_id);
    const shared_urls = db.prepare("SELECT url FROM shared_urls WHERE group_id = ? ORDER BY url_order").all(row.group_id).map((item) => item.url);
    const categoryPath=JSON.parse(row.category_path_json);
    const mainHierarchy=row.main_keyword?keywordHierarchy.find((item)=>item.site_id===row.site_id&&item.raw_keyword===row.main_keyword):null;
    const matchRun=db.prepare("SELECT state,selected_wp_article_id FROM keyword_article_match_runs WHERE group_id = ?").get(row.group_id);
    const allCandidates=db.prepare("SELECT wp_article_id,matched_keyword,matched_role,title_score,title_matches_json,query_matches_json,heading_score,heading_matches_json,coverage_rate,coverage_json FROM keyword_article_match_candidates WHERE group_id = ? ORDER BY title_score DESC,heading_score DESC,coverage_rate DESC,wp_article_id").all(row.group_id).map(({title_matches_json,query_matches_json,heading_matches_json,coverage_json,...candidate})=>({...candidate,title_matches:JSON.parse(title_matches_json),query_matches:JSON.parse(query_matches_json),heading_matches:JSON.parse(heading_matches_json),planned_keyword_coverage:JSON.parse(coverage_json)}));
    const matchCandidates=allCandidates.filter((candidate)=>candidate.matched_role==="main");
    const intentCandidates=allCandidates.filter((candidate)=>candidate.matched_role==="intent").map(({wp_article_id,matched_keyword,title_score})=>({wp_article_id,matched_keyword,title_score}));
    return { id: row.group_id, site_id: row.site_id, resolution_state: row.resolution_state, main_keyword: row.main_keyword, display_keyword:mainHierarchy?keywordDisplayText(row.main_keyword,mainHierarchy.normalized_terms):row.main_keyword, derived_parent_candidate: row.derived_parent_candidate, main_origin: row.main_origin, source_order: { file: row.source_order_file, sheet: row.source_order_sheet, row: row.source_order_row }, source_location: row.source_location, search_volume: JSON.parse(row.search_volume_json), search_volume_source: row.search_volume_source, intent_keywords: list("intent"), sibling_keywords: list("sibling"), comparison_keywords: list("comparison"), confidence: row.confidence, overlap: { shared: row.overlap_shared, depth: row.overlap_depth, ratio: row.overlap_ratio }, state: row.action_state, wp_article_id: row.wp_article_id, article_match:matchRun?{state:matchRun.state,selected_wp_article_id:matchRun.selected_wp_article_id,candidates:matchCandidates,intent_candidates:intentCandidates}:null, category: categoryPath.join(" ＞ "), category_path: categoryPath, strategy: { ...strategy, aio_observed_queries: Number(aio.observed), aio_checked_queries: Number(aio.checked),recommended_page_type:recommendedPageType,serp_classification:serpTasks }, article_gate: { status: conditions.every((item) => item.status === "pass") ? "成立" : "未成立", conditions }, cost: row.cost, task_ids, shared_urls };
  });
  const rawArticleQueries=db.prepare("SELECT q.site_id,q.wp_article_id,a.url,a.title,a.category_ids_json,q.query,q.normalized_query,q.clicks,q.impressions,q.ctr,q.position,q.window_days,q.observed_at FROM gsc_query_results q JOIN articles a USING(site_id,wp_article_id) ORDER BY q.site_id,q.wp_article_id,q.query").all().map(({category_ids_json,...row})=>({...row,category_paths:categoryPathsForIds(JSON.parse(category_ids_json))}));
  const articleQueries=aggregateNormalizedQueries(rawArticleQueries);
  const gscArticles=db.prepare("SELECT site_id,wp_article_id,url,title,category_ids_json,headings_json,gsc_status FROM articles ORDER BY site_id,wp_article_id").all();
  const rankingBySite=Object.fromEntries(sites.map((site)=>[site.site_id,primaryQueryStats(articleQueries.filter((row)=>row.site_id===site.site_id))]));
  const articleQuerySummaries=gscArticles.map(({category_ids_json,headings_json,...article})=>{
    const queries=rankPrimaryQueries(articleQueries.filter((row)=>row.site_id===article.site_id&&row.wp_article_id===article.wp_article_id),rankingBySite[article.site_id].impression_p95);
    const primary=queries[0]??null;
    const group=groups.find((item)=>item.site_id===article.site_id&&item.wp_article_id===article.wp_article_id);
    const keywordAcquisition=assessKeywordAcquisition(group,queries);
    return {...article,headings:JSON.parse(headings_json),category_paths:categoryPathsForIds(JSON.parse(category_ids_json)),query_count:queries.length,total_clicks:queries.reduce((sum,row)=>sum+row.clicks,0),total_impressions:queries.reduce((sum,row)=>sum+row.impressions,0),window_days:primary?.window_days??null,observed_at:primary?.observed_at??null,primary_query:primary,queries,keyword_acquisition:keywordAcquisition};
  });
  return { generated_at: metadata.generated_at, sites, groups, keyword_inventory: db.prepare("SELECT * FROM imported_keywords ORDER BY site_id, source_sheet, source_row").all(), keyword_hierarchy:keywordHierarchy, normalization_aliases: JSON.parse(metadata.normalization_aliases), article_links: db.prepare("SELECT * FROM article_links ORDER BY link_id").all(), article_queries: articleQueries, article_query_summaries: articleQuerySummaries, primary_query_ranking: Object.fromEntries(Object.entries(rankingBySite).map(([siteId,ranking])=>[siteId,{...ranking,method:"log_impressions_plus_clicks_at_p95"}])), gsc_articles: gscArticles.map(({category_ids_json,headings_json,...article})=>article) };
}
