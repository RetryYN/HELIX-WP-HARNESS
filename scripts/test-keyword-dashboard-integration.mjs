import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { categoryPathForKeywords, categoryPathsForIds, wpCategoryTaxonomy } from "./keyword-category-taxonomy.mjs";
import { aggregateNormalizedQueries,primaryQueryScore, primaryQueryStats, rankPrimaryQueries } from "./gsc-primary-query.mjs";

assert.equal(wpCategoryTaxonomy.length,17);
assert.deepEqual(categoryPathForKeywords(["it 就活 文系"]),["IT就活","文系就活"]);
assert.deepEqual(categoryPathForKeywords(["it 就活 面接","it 就活 逆質問"]),["就活対策","面接対策"]);
assert.deepEqual(categoryPathForKeywords(["it 就活 企業 ランキング"]),["IT業界研究","IT企業分析"]);
assert.deepEqual(categoryPathForKeywords(["it 就活エージェント 比較"]),["IT就活エージェント","比較・ランキング"]);
assert.deepEqual(categoryPathsForIds([6,5]),[["就活対策","キャリア"]]);
assert.deepEqual(categoryPathsForIds([1,9]),[["就活対策","面接対策"],["IT就活"]]);
const rankingFixture=[
  {query:"高表示",normalized_query:"高表示",clicks:0,impressions:53,position:2},
  {query:"少数クリック",normalized_query:"少数クリック",clicks:1,impressions:3,position:1},
  {query:"均衡",normalized_query:"均衡",clicks:1,impressions:9,position:3},
];
assert.equal(primaryQueryStats(rankingFixture).impression_p95,53);
assert.equal(rankPrimaryQueries(rankingFixture,14)[0].query,"均衡","one click plus meaningful impressions should beat impressions alone");
assert.ok(primaryQueryScore(rankingFixture[0],14)>primaryQueryScore(rankingFixture[1],14),"tiny-sample CTR must not dominate a high-impression query");
const normalizedAggregate=aggregateNormalizedQueries([
  {site_id:"s",wp_article_id:1,query:"ｿﾌﾄ",normalized_query:"ソフト",clicks:1,impressions:10,ctr:.1,position:2,window_days:28,observed_at:"x"},
  {site_id:"s",wp_article_id:1,query:"ソフト",normalized_query:"ソフト",clicks:2,impressions:30,ctr:.066,position:4,window_days:28,observed_at:"x"},
]);
assert.equal(normalizedAggregate.length,1);assert.equal(normalizedAggregate[0].query,"ソフト");assert.equal(normalizedAggregate[0].clicks,3);assert.equal(normalizedAggregate[0].impressions,40);assert.deepEqual(normalizedAggregate[0].raw_queries,["ｿﾌﾄ","ソフト"]);

const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "wp-dashboard-db-")), "dashboard.sqlite");
buildDashboardDb({ dbPath, fixturePath: path.resolve("docs/prototypes/wp-ops-dashboard/data.json"), artifactRoot: path.resolve("artifacts/poc") }).close();
const persisted = new DatabaseSync(dbPath, { readOnly: true });
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks").get().count, 4);
assert.equal(persisted.prepare("SELECT SUM(aio_present) AS count FROM dfs_tasks").get().count, 3);
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE snapshot_path = ''").get().count, 0);
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE recommended_page_type = '' OR serp_pages_json = '[]'").get().count,0);
persisted.close();

const pocDbPath = path.join(mkdtempSync(path.join(tmpdir(), "wp-dashboard-poc-db-")), "dashboard.sqlite");
const buildPoc = spawnSync(process.execPath, ["scripts/build-keyword-dashboard-db.mjs"], { env: { ...process.env, WP_DASHBOARD_DB: pocDbPath }, encoding: "utf8" });
assert.equal(buildPoc.status, 0, buildPoc.stderr);
const missingEvidenceBuild=spawnSync(process.execPath,["scripts/build-keyword-dashboard-db.mjs"],{env:{...process.env,WP_DASHBOARD_DB:path.join(mkdtempSync(path.join(tmpdir(),"wp-dashboard-no-gsc-")),"dashboard.sqlite"),WP_GSC_EVIDENCE:path.join(tmpdir(),"missing-gsc-evidence.json"),WP_ALLOW_EMPTY_GSC:"0"},encoding:"utf8"});
assert.notEqual(missingEvidenceBuild.status,0,"dashboard build must fail closed without GSC evidence");
assert.match(missingEvidenceBuild.stderr,/GSC evidence is required/);
const missingHeadingBuild=spawnSync(process.execPath,["scripts/build-keyword-dashboard-db.mjs"],{env:{...process.env,WP_DASHBOARD_DB:path.join(mkdtempSync(path.join(tmpdir(),"wp-dashboard-no-headings-")),"dashboard.sqlite"),WP_HEADING_EVIDENCE:path.join(tmpdir(),"missing-heading-evidence.json"),WP_ALLOW_EMPTY_HEADINGS:"0"},encoding:"utf8"});
assert.notEqual(missingHeadingBuild.status,0,"dashboard build must fail closed without WP heading evidence");
assert.match(missingHeadingBuild.stderr,/WP heading evidence is required/);
const mismatchedAnchorDir=mkdtempSync(path.join(tmpdir(),"wp-dashboard-gsc-anchor-"));
const mismatchedAnchorPath=path.join(mismatchedAnchorDir,"gsc-summary.json");
const mismatchedAnchor=JSON.parse(readFileSync(path.resolve("artifacts/poc/gsc-page-query-28d-summary.json"),"utf8"));
mismatchedAnchor.local_evidence_tree_sha256="0".repeat(64);
writeFileSync(mismatchedAnchorPath,JSON.stringify(mismatchedAnchor));
const mismatchedAnchorVerify=spawnSync(process.execPath,["scripts/verify-poc-evidence.mjs"],{env:{...process.env,WP_GSC_SUMMARY:mismatchedAnchorPath},encoding:"utf8"});
assert.notEqual(mismatchedAnchorVerify.status,0,"GSC fixture derivation anchor mismatch must fail closed");
assert.match(mismatchedAnchorVerify.stderr,/fixture must declare the original export tree it was derived from/);
const pocDb = new DatabaseSync(pocDbPath, { readOnly: true });
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM imported_keywords WHERE site_id = 'it-shukatu.com'").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_hierarchy").get().count,100,"every imported keyword must have a hierarchy row");
assert.equal(pocDb.prepare("SELECT COUNT(DISTINCT root_source_keyword_id) AS count FROM keyword_hierarchy").get().count,1,"display trie has one lexical root");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_hierarchy WHERE context_scope_id='context:it'").get().count,84);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_hierarchy WHERE context_scope_id='context:general'").get().count,16);
assert.equal(pocDb.prepare("SELECT h.term_count FROM keyword_hierarchy h JOIN imported_keywords k USING(source_keyword_id) WHERE k.raw_keyword='就活ねくたい'").get().term_count,2,"domain compounds must not inherit raw morphological mis-segmentation");
assert.equal(pocDb.prepare("SELECT p.raw_keyword AS parent FROM keyword_hierarchy h JOIN imported_keywords k ON k.source_keyword_id=h.source_keyword_id LEFT JOIN imported_keywords p ON p.source_keyword_id=h.parent_source_keyword_id WHERE k.raw_keyword='it ニュース 就活'").get().parent,"it 就活");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM imported_keywords WHERE site_id = 'it-shukatu.com' AND processing_state = '施策KW群割当済み'").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com'").get().count, 64);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com' AND resolution_state = 'resolved' AND main_keyword IS NOT NULL").get().count, 63, "every real group currently resolves to an actual main keyword");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE main_keyword IS NULL OR resolution_state = 'unresolved'").get().count, 1);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com' AND action_state = '未施策'").get().count,64,"article matching must not infer workflow state");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com' AND action_state = '公開中'").get().count,0,"published state requires separate WP lifecycle evidence");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_article_match_runs WHERE state = '確定'").get().count,13);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE action_state NOT IN ('未施策','予約済','下書き','公開中')").get().count, 0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE group_id IN (SELECT group_id FROM keyword_groups WHERE site_id = 'it-shukatu.com')").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE main_keyword GLOB 'topic-*' OR main_keyword GLOB 'keyword-*'").get().count, 0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM articles WHERE site_id = 'it-shukatu.com' AND gsc_status = 'ok'").get().count,59);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM gsc_query_results WHERE site_id = 'it-shukatu.com'").get().count,681);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM gsc_query_results WHERE source_file = '' OR window_days != 28").get().count,0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM gsc_query_results WHERE normalized_query = ''").get().count,0);
{
  const actual=projectDashboard(pocDb);
  assert.equal(actual.groups.length,64);assert.equal(actual.groups.filter((group)=>group.resolution_state==="resolved").length,63);assert.equal(actual.groups.filter((group)=>group.resolution_state==="unresolved").length,1,"tree projection must not change the SERP article boundary");
  assert.equal(actual.groups.find((group)=>group.main_keyword==="就活ねくたい").display_keyword,"就活 ネクタイ","keyword list uses normalized display tokens while retaining raw main_keyword");
  assert.ok(actual.groups.filter((group)=>group.category_path[0]==="就活").every((group)=>!group.category_path.includes("IT就活")),"general job-search scope must not fall back into the IT category");
  assert.equal(actual.article_query_summaries.length,59,"one summary row is required per WP article");
  assert.equal(actual.article_query_summaries.reduce((sum,row)=>sum+row.query_count,0),678,"raw 681 rows must project to 678 normalized query groups");
  assert.equal(actual.article_query_summaries.filter((row)=>row.primary_query).length,52);
  assert.equal(actual.article_query_summaries.filter((row)=>!row.primary_query).length,7,"unobserved articles must remain visible");
  assert.equal(actual.article_query_summaries.filter((row)=>row.keyword_acquisition.group_id).length,13,"confirmed keyword groups must join article details by WP ID");
  assert.equal(actual.article_query_summaries.reduce((sum,row)=>sum+row.headings.length,0),1470,"actual WP H2/H3 evidence must remain attached to its article ID");
  assert.equal(actual.article_query_summaries.find((row)=>row.wp_article_id===132).keyword_acquisition.coverage_rate,1,"actual GSC queries must produce keyword acquisition coverage");
  assert.equal(actual.article_query_summaries.find((row)=>row.wp_article_id===17).keyword_acquisition.coverage_rate,null,"unobserved GSC must not be displayed as 0% coverage");
  assert.equal(actual.primary_query_ranking["it-shukatu.com"].impression_p95,41,"ranking threshold must be derived from normalized actual GSC distribution");
  const confirmed=new Map(actual.groups.filter((group)=>group.site_id==="it-shukatu.com"&&group.article_match?.state==="確定").map((group)=>[group.main_keyword,group.wp_article_id]));
  assert.equal(confirmed.size,13);assert.equal(confirmed.get("it 就活"),195);assert.equal(confirmed.get("it パスポート 就活"),1112);assert.equal(confirmed.get("就活の軸it"),130);assert.equal(confirmed.get("就活nnt"),793);assert.equal(confirmed.get("it 就活エージェント"),17);assert.equal(confirmed.get("it 就活 新卒"),559);assert.equal(confirmed.get("就活 入社後にしたいこと it"),1020);assert.equal(confirmed.get("就活ツイッター"),132);assert.equal(confirmed.get("就活 it やりたいこと"),92);
  assert.equal(confirmed.get("就活 人気企業 it"),628);assert.equal(confirmed.get("it 就活 文系"),267);assert.equal(confirmed.get("it 就活 職種"),499);assert.equal(confirmed.get("it 就活 質問"),1207);
  assert.equal(actual.groups.find((group)=>group.main_keyword==="it 就活 流れ").article_match.state,"同一記事候補","one WP article must belong to the better-supported keyword group");
}
{
  const modifier=pocDb.prepare("SELECT group_id,resolution_state,main_keyword,derived_parent_candidate,confidence,overlap_ratio,wp_article_id FROM keyword_groups WHERE derived_parent_candidate='it 就活'").get();
  assert.equal(modifier.resolution_state,"unresolved");assert.equal(modifier.main_keyword,null);assert.equal(modifier.confidence,"single");assert.equal(modifier.wp_article_id,null);
  assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_article_match_runs WHERE group_id=?").get(modifier.group_id).count,0,"a separate modifier SERP must not be article-matched through its lexical parent");
  assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_article_match_candidates WHERE matched_role NOT IN ('main','intent')").get().count,0);
}
pocDb.close();

// §5: a derived_parent_candidate group must persist as unresolved, stay visible, and never be matched to or assigned a WP article.
{
  const baseFixture=JSON.parse(readFileSync(path.resolve("docs/prototypes/wp-ops-dashboard/data.json"),"utf8"));
  const template=baseFixture.groups.find((group)=>group.site_id==="it-shukatu.com");
  const unresolvedGroup={...template,id:"unresolved-001",resolution_state:"unresolved",main_keyword:null,derived_parent_candidate:"転職 サイト",main_origin:"derived_parent_candidate（修飾語KWのみ・実在親KWなし・main未確定）",search_volume:null,intent_keywords:["転職 サイト おすすめ"],sibling_keywords:[],comparison_keywords:["転職 サイト おすすめ"],wp_article_id:null,state:"未施策",task_ids:[],shared_urls:[],
    strategy:{...template.strategy,decision:"親KW未確定（PO確定またはDFS取得待ち）",main_basis:"derived_parent_candidate（未昇格）"},
    article_gate:{status:"未成立",conditions:[{label:"対象KW群の確定",status:"blocked",detail:"main未確定"},...template.article_gate.conditions.slice(1)]}};
  const dir=mkdtempSync(path.join(tmpdir(),"wp-dashboard-unresolved-"));
  const fixturePath=path.join(dir,"fixture.json");
  writeFileSync(fixturePath,JSON.stringify({...baseFixture,groups:[...baseFixture.groups,unresolvedGroup]}));
  const db=buildDashboardDb({dbPath:path.join(dir,"dashboard.sqlite"),fixturePath,artifactRoot:path.resolve("artifacts/poc")});
  const projected=projectDashboard(db).groups.find((group)=>group.id==="unresolved-001");
  assert.equal(projected.resolution_state,"unresolved");
  assert.equal(projected.main_keyword,null,"derived parent must not be promoted to main_keyword");
  assert.equal(projected.derived_parent_candidate,"転職 サイト");
  assert.equal(projected.article_match,null,"unresolved groups are excluded from article matching");
  assert.equal(projected.wp_article_id,null);
  assert.equal(projected.article_gate.status,"未成立");
  assert.throws(()=>db.exec("INSERT INTO keyword_groups (group_id,site_id,resolution_state,main_keyword,derived_parent_candidate,main_origin,category,category_path_json,source_order_file,source_order_sheet,source_order_row,source_location,search_volume_json,search_volume_source,confidence,overlap_shared,overlap_depth,overlap_ratio,action_state,wp_article_id,cost) VALUES ('bad','it-shukatu.com','resolved',NULL,NULL,'x','c','[]',0,0,0,'l','null','s','single',0,5,0,'未施策',NULL,0)"),/CHECK/,"a resolved group without a main keyword must be rejected by the schema");
  db.close();
}

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
assert.match(html, /<th>推奨ページ<\/th>/);
assert.match(html, /<th>親カテゴリー<\/th><th id="category-child-head">子カテゴリー<\/th><th id="category-grandchild-head">孫カテゴリー<\/th>/);
assert.match(app, /\/api\/dashboard/);
assert.match(app, /aio_observed_queries>0/);
assert.match(app,/serp_classification/);assert.match(app,/SERPページ分類（上位10件）/);assert.match(app,/recommended_page_type/);
assert.match(app, /visibleRows=rows\.slice/);
assert.match(app, /categoryDepth=Math\.max/);
assert.match(app, /category-grandchild-head/);
assert.match(app, /syncCategoryFilters/);
assert.match(app, /data\.article_query_summaries/);
assert.match(app,/data\.keyword_hierarchy/);assert.match(app,/mermaid\.render/);assert.match(app,/lines=\["mindmap"\]/);assert.match(app,/branchForRow/);assert.match(html,/data-view="keyword-tree"/);assert.match(html,/id="tree-branch-filter"/);
assert.match(app, /query-page-size/);
assert.match(app, /syncQueryCategoryFilters/);
assert.match(app, /empty\.hidden=rows\.length>0/);
assert.match(html, /id="query-detail-dialog"/);
assert.match(html, /<th>主クエリ<\/th>/);
assert.match(html, /<th>自サイト記事<\/th>/);
assert.match(app, /renderQueryDetail/);
assert.match(app, /articleMatchLabel/);
assert.match(app, /title_matches/);
assert.match(app, /query_matches/);
assert.match(app, /const escapeHtml=/);
assert.match(app, /escapeHtml\(row\.query\)/,"GSC queries must be escaped before HTML insertion");
assert.match(app, /escapeHtml\(row\.title\)/,"WP titles must be escaped before HTML insertion");
assert.doesNotMatch(app, /内包:\s*\$\{row\.group\.intent_keywords/, "contained keyword text must only appear in detail view");
await stop(server);
console.log("persistent SQLite→API→frontend contract: OK (DFS raw provenance, restart persistence, site isolation, strategy, gates, no fabricated links)");
