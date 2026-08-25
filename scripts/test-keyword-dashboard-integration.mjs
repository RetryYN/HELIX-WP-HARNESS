import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE length(snapshot_digest) != 64").get().count, 0);
assert.equal(persisted.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE recommended_page_type = '' OR serp_pages_json = '[]'").get().count,0);
persisted.close();

const competitorRoot=mkdtempSync(path.join(tmpdir(),"wp-dashboard-competitor-"));
const competitorManifestPath=path.join(competitorRoot,"manifest.json");
const competitorFixture=JSON.parse(readFileSync(path.resolve("docs/prototypes/wp-ops-dashboard/data.json"),"utf8")),competitorGroup=competitorFixture.groups[0].id,competitorTask=competitorFixture.groups[0].task_ids[0];
const competitorPage=(suffix,rank)=>({url:`https://competitor.example/article-${suffix}`,domain:"competitor.example",status:"ok",fetched_at:"2026-08-26T00:00:00.000Z",http_status:200,content_type:"text/html",final_url:`https://competitor.example/article-${suffix}`,title:"競合記事",canonical_url:null,snapshot_path:`/evidence/${suffix}.html`,snapshot_digest:suffix.repeat(64),text_length:100,text_digest:(suffix==="a"?"b":"c").repeat(64),internal_link_count:2,external_link_count:1,headings:[{position:0,level:1,text:"SEO記事"},{position:1,level:2,text:"構成案"}],terms:[{term:"構成",count:4,title_count:1,heading_count:1,in_title:true,in_heading:true},{term:"検索意図",count:2,title_count:0,heading_count:0,in_title:false,in_heading:false}],groups:[{group_id:competitorGroup,best_rank:rank,task_ids:[competitorTask],tasks:[{task_id:competitorTask,best_rank:rank}]}]});
writeFileSync(competitorManifestPath,JSON.stringify({schema_version:"competitor-content-evidence.v2",parser_version:"competitor-content-core.v2",generated_at:"2026-08-26T00:00:00.000Z",selection:{max_rank:3,page_limit:2,selected_count:2},pages:[competitorPage("a",1),competitorPage("d",2)]}));
const competitorDbPath=path.join(competitorRoot,"dashboard.sqlite");
buildDashboardDb({dbPath:competitorDbPath,fixturePath:path.resolve("docs/prototypes/wp-ops-dashboard/data.json"),artifactRoot:path.resolve("artifacts/poc"),competitorEvidencePath:competitorManifestPath}).close();
const competitorDb=new DatabaseSync(competitorDbPath,{readOnly:true});
assert.equal(competitorDb.prepare("SELECT COUNT(*) AS count FROM competitor_pages WHERE status='ok' AND length(snapshot_digest)=64 AND length(text_digest)=64").get().count,2);
assert.equal(competitorDb.prepare("SELECT COUNT(*) AS count FROM competitor_headings").get().count,4);
const competitorTerm=competitorDb.prepare("SELECT page_count,title_count,heading_count,title_page_count,heading_page_count FROM competitor_terms WHERE group_id=? AND term='構成'").get(competitorGroup);assert.equal(competitorTerm.page_count,2);assert.equal(competitorTerm.title_count,2);assert.equal(competitorTerm.heading_count,2);assert.equal(competitorTerm.title_page_count,2);assert.equal(competitorTerm.heading_page_count,2);
assert.equal(competitorDb.prepare("SELECT COUNT(*) AS count FROM competitor_page_task_evidence").get().count,2);assert.equal(competitorDb.prepare("SELECT page_count FROM competitor_task_terms WHERE task_id=? AND term='構成'").get(competitorTask).page_count,2);
const competitorProjection=projectDashboard(competitorDb);assert.equal(competitorProjection.competitor_pages.length,2);assert.deepEqual(competitorProjection.competitor_page_evidence[0].task_ids,[competitorTask]);assert.equal(competitorProjection.competitor_terms[0].evidence_page_ids.length,2);assert.equal(competitorProjection.competitor_task_terms[0].evidence_page_ids.length,2);
assert.ok(competitorProjection.content_generation_candidates.some((item)=>item.group_id===competitorGroup&&item.evidence_type==="competitor_term"&&item.content_type==="heading"&&item.evidence_ids.length===2));assert.ok(competitorProjection.content_generation_candidates.every((item)=>item.status==="proposed"&&item.candidate_digest.length===64));
assert.ok(competitorProjection.content_generation_candidates.every((item)=>item.review&&item.review.review_digest.length===64));assert.ok(competitorProjection.content_generation_candidates.every((item)=>["ready","needs_review","blocked"].includes(item.review.review_state)));
assert.ok(competitorProjection.content_generation_candidates.every((item)=>item.generation?.generator_kind==="deterministic_rule"&&item.generation.input_digest.length===64));assert.ok(competitorProjection.content_generation_candidates.some((item)=>item.generation.variant_key==="demand_explainer"));
assert.deepEqual(competitorProjection.competitor_summary,{page_count:2,successful_page_count:2,heading_count:4,term_count:2,task_term_count:2,projected_term_count:2,group_count:1,task_count:1});
competitorDb.close();

const enrichmentRoot=mkdtempSync(path.join(tmpdir(),"wp-dashboard-enrichment-")),enrichmentRaw=path.join(enrichmentRoot,"raw");mkdirSync(enrichmentRaw);const enrichmentJobs=[];
const addEnrichment=(kind,body)=>{const jobId=`${kind}:1`,file=`raw/${kind}.json`,raw=JSON.stringify(body,null,2);writeFileSync(path.join(enrichmentRoot,file),raw);enrichmentJobs.push({kind,job_id:jobId,raw_file:file,raw_digest:createHash("sha256").update(raw).digest("hex")});return jobId},ok=(result)=>({status_code:20000,tasks:[{status_code:20000,result}]});
const marketJob=addEnrichment("keyword_metrics",ok([{keyword:"it 就活サイト 比較",location_code:2392,language_code:"ja",search_partners:false,competition:"MEDIUM",competition_index:50,search_volume:90,cpc:1.2,low_top_of_page_bid:.5,high_top_of_page_bid:2,monthly_searches:[{year:2026,month:7,search_volume:90},{year:2026,month:6,search_volume:70}]}])),difficultyJob=addEnrichment("keyword_difficulty",ok([{se_type:"google",location_code:2392,language_code:"ja",items:[{keyword:"it 就活サイト 比較",keyword_difficulty:44}]}])),rankedJob=addEnrichment("ranked_keywords",ok([{target:"it-shukatu.com",location_code:2392,language_code:"ja",total_count:2,items_count:1,metrics:{organic:{etv:8}},items:[{keyword_data:{keyword:"it 就活",location_code:2392,language_code:"ja",keyword_info:{search_volume:390,cpc:2,competition:.4,competition_level:"MEDIUM"},keyword_properties:{keyword_difficulty:39},search_intent_info:{main_intent:"commercial",foreign_intent:["informational"]}},ranked_serp_element:{serp_item:{type:"organic",rank_group:2,rank_absolute:3,domain:"it-shukatu.com",url:"https://it-shukatu.com/a",relative_url:"/a",title:"IT就活",etv:8,estimated_paid_traffic_cost:16,rank_changes:{previous_rank_absolute:5,is_up:true},backlinks_info:{referring_domains:3}}}}]}]));
const enrichmentManifest={schema_version:"dfs-enrichment-evidence.v1",status:"complete",generated_at:"2026-08-26T00:00:00.000Z",reported_cost_usd:.246,plan:{jobs:[{kind:"keyword_metrics",payload:[{keywords:["it 就活サイト 比較"]}]},{kind:"keyword_difficulty",payload:[{keywords:["it 就活サイト 比較"]}]},{kind:"ranked_keywords",payload:[{target:"it-shukatu.com"}]}]},jobs:enrichmentJobs};const enrichmentManifestPath=path.join(enrichmentRoot,"manifest.json");writeFileSync(enrichmentManifestPath,JSON.stringify(enrichmentManifest));const enrichmentDbPath=path.join(enrichmentRoot,"dashboard.sqlite"),enrichmentDb=buildDashboardDb({dbPath:enrichmentDbPath,fixturePath:path.resolve("docs/prototypes/wp-ops-dashboard/data.json"),artifactRoot:path.resolve("artifacts/poc"),dfsEnrichmentEvidencePath:enrichmentManifestPath});assert.equal(enrichmentDb.prepare("SELECT COUNT(*) AS count FROM keyword_market_metrics").get().count,1);assert.equal(enrichmentDb.prepare("SELECT COUNT(*) AS count FROM keyword_monthly_searches").get().count,2);assert.equal(enrichmentDb.prepare("SELECT keyword_difficulty FROM keyword_difficulty_enrichment").get().keyword_difficulty,44);assert.equal(enrichmentDb.prepare("SELECT rank_absolute FROM domain_ranked_keywords").get().rank_absolute,3);const enrichmentProjection=projectDashboard(enrichmentDb);assert.equal(enrichmentProjection.dfs_enrichment_status.state,"acquired");assert.equal(enrichmentProjection.keyword_market_metrics[0].search_volume,90);assert.equal(enrichmentProjection.domain_ranked_keywords[0].main_intent,"commercial");assert.equal(enrichmentProjection.dfs_enrichment_status.coverage.ranked_keywords.truncated,true);enrichmentDb.close();

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
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM raw_snapshot_inventory").get().count,110,"every acquired raw snapshot must appear in the acquisition ledger");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM raw_snapshot_inventory WHERE analysis_status='connected'").get().count,100,"the current workbook tasks must be explicitly connected");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM raw_snapshot_inventory WHERE analysis_status='unconnected'").get().count,10,"independently acquired PoC tasks must remain visible without contaminating the current site analysis");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM raw_snapshot_inventory WHERE analysis_status='unconnected' AND item_types_json LIKE '%jobs%'").get().count,1,"the orphaned jobs SERP feature must be discoverable in the ledger");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM imported_keywords WHERE site_id = 'it-shukatu.com'").get().count,10694);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_hierarchy").get().count,10694,"every imported keyword across all 15 sheets must have a hierarchy row");
assert.equal(pocDb.prepare("SELECT COUNT(DISTINCT source_sheet) AS count FROM imported_keywords").get().count,15);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_hierarchy WHERE context_scope_id='context:it'").get().count,2048);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_hierarchy WHERE context_scope_id='context:general'").get().count,8646);
assert.equal(pocDb.prepare("SELECT h.term_count FROM keyword_hierarchy h JOIN imported_keywords k USING(source_keyword_id) WHERE k.raw_keyword='就活ねくたい'").get().term_count,2,"domain compounds must not inherit raw morphological mis-segmentation");
assert.equal(pocDb.prepare("SELECT p.raw_keyword AS parent FROM keyword_hierarchy h JOIN imported_keywords k ON k.source_keyword_id=h.source_keyword_id LEFT JOIN imported_keywords p ON p.source_keyword_id=h.parent_source_keyword_id WHERE k.raw_keyword='it ニュース 就活'").get().parent,"it 就活");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM imported_keywords WHERE site_id = 'it-shukatu.com' AND processing_state = '施策KW群割当済み'").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM imported_keywords WHERE site_id = 'it-shukatu.com' AND processing_state = 'SERP未取得'").get().count,10594,"unacquired workbook rows must remain explicit rather than disappearing");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_variant_clusters WHERE site_id='it-shukatu.com'").get().count,921);assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_term_associations WHERE site_id='it-shukatu.com'").get().count,1636);assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_term_associations WHERE term='.' OR (term GLOB '[0-9]*' AND term NOT GLOB '*[^0-9]*')").get().count,0,"punctuation/numeric corpus noise must not enter the association ranking");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM related_keyword_proposals").get().count,792);assert.equal(pocDb.prepare("SELECT COUNT(DISTINCT group_id) AS count FROM related_keyword_proposals").get().count,60);assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM related_keyword_proposals WHERE status!='proposed' OR derivation_policy!='inventory-related-keyword.v2'").get().count,0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com'").get().count, 64);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com' AND resolution_state = 'resolved' AND main_keyword IS NOT NULL").get().count, 63, "every real group currently resolves to an actual main keyword");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE main_keyword IS NULL OR resolution_state = 'unresolved'").get().count, 1);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com' AND action_state = '未施策'").get().count,64,"article matching must not infer workflow state");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE site_id = 'it-shukatu.com' AND action_state = '公開中'").get().count,0,"published state requires separate WP lifecycle evidence");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_article_match_runs WHERE state = '確定'").get().count,13);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE action_state NOT IN ('未施策','予約済','下書き','公開中')").get().count, 0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM dfs_tasks WHERE group_id IN (SELECT group_id FROM keyword_groups WHERE site_id = 'it-shukatu.com')").get().count, 100);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_task_metadata").get().count,100,"every DFS task must retain execution and result metadata");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_task_metadata WHERE status_code=20000 AND status_message='Ok.' AND check_url!=''").get().count,100,"provider health and replay URLs must be queryable without reopening raw snapshots");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_task_metadata WHERE spell_json IS NOT NULL").get().count,1,"the observed spell correction must not remain raw-only");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_feature_occurrences").get().count,270,"every non-organic SERP container occurrence must retain its queryable rank and payload");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_feature_occurrences WHERE feature_type IN ('knowledge_graph','people_also_search','images','video')").get().count,4,"rare SERP features must not be dropped");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_organic_attributes").get().count,926,"every organic result must retain xpath and boolean SERP attributes");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_action_signals").get().count,8,"observed spelling, special features and commerce evidence must become proposed actions");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_action_signals WHERE evidence_json='[]' OR status!='proposed' OR length(evidence_digest)!=64").get().count,0,"every action must remain evidence-bound and unapproved by default");
assert.equal(pocDb.prepare("SELECT SUM(priced_result_count) AS count FROM serp_action_signals").get().count,6);assert.equal(pocDb.prepare("SELECT SUM(rated_result_count) AS count FROM serp_action_signals").get().count,2);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_demand_occurrences WHERE demand_type='paa'").get().count,396,"all PAA occurrences in the 100 DFS snapshots must be preserved");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_demand_occurrences WHERE demand_type='related_search'").get().count,792,"all related-search occurrences in the 100 DFS snapshots must be preserved");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_demand_occurrences WHERE normalized_value='' OR snapshot_path='' OR length(snapshot_digest)!=64").get().count,0,"every demand occurrence must retain normalized value and raw provenance");
assert.equal(pocDb.prepare("SELECT COUNT(DISTINCT task_id) AS count FROM serp_demand_occurrences WHERE demand_type='paa'").get().count,99,"the one SERP without PAA must remain an explicit absence rather than a fabricated row");
assert.equal(pocDb.prepare("SELECT COUNT(DISTINCT task_id) AS count FROM serp_demand_occurrences WHERE demand_type='related_search'").get().count,99,"the one SERP without related searches must remain an explicit absence rather than a fabricated row");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_organic_results").get().count,926,"all organic result records must be projected from raw snapshots");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_page_keyword_edges").get().count,926,"every organic observation in the top-10 corpus must become one page-keyword edge");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM simultaneous_keyword_relations").get().count,339,"observed shared URLs must form deterministic simultaneous-ranking keyword relations");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_domain_coverage").get().count,226,"domain coverage must preserve the observed SERP competitor population");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_page_coverage").get().count,565,"page coverage must preserve every canonical SERP page");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM simultaneous_keyword_relations WHERE shared_url_count<1 OR overlap_ratio<=0 OR shared_urls_json='[]'").get().count,0,"every simultaneous keyword relation must retain URL evidence");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_organic_results WHERE description IS NOT NULL AND description!=''").get().count,918,"available organic descriptions must not be discarded");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_ai_overviews").get().count,68,"all observed AIO records, including asynchronous placeholders, must be projected");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM serp_ai_overviews WHERE markdown IS NOT NULL AND markdown!=''").get().count,17,"available AIO answer text must not be discarded");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_citation_references").get().count,96,"every AIO citation occurrence must be normalized without losing its raw reference fields");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_citation_domains").get().count,38,"AIO citations must aggregate to the observed domain population");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_citation_references WHERE is_own_domain=1").get().count,0,"the actual corpus has no own-site AIO citation and must expose that gap");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_citation_references WHERE organic_url_rank IS NOT NULL").get().count,61,"AIO citation exact-URL overlap must be matched against the canonical same-query top-10 corpus");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_citation_references WHERE organic_domain_rank IS NOT NULL").get().count,71,"URL and domain overlap must remain separate AIO citation signals");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_content_elements").get().count,69,"every structured AIO answer element must be normalized without discarding text or markdown");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_content_elements WHERE coverage_status='no_title'").get().count,34,"untitled AIO prose must remain distinct from heading gaps");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_content_elements WHERE coverage_status='unassigned'").get().count,19,"titled AIO sections without confirmed WP articles must remain unassessed");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_content_elements WHERE coverage_status='missing'").get().count,16,"assigned articles must expose titled AIO sections absent from current WP headings");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM aio_content_elements WHERE coverage_status IN ('covered_title','covered_heading')").get().count,0,"the strict actual corpus currently covers no titled AIO section and must not fabricate coverage");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_topic_proposals").get().count,878,"canonical topics must aggregate repeated demand occurrences within each keyword group");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_topic_evidence").get().count,1188,"every PAA/related-search occurrence must bind to exactly one proposal in its source group");
assert.equal(pocDb.prepare("SELECT SUM(occurrence_count) AS count FROM content_topic_proposals").get().count,1188,"proposal occurrence totals must reconcile to the raw demand population");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_topic_proposals WHERE status!='proposed'").get().count,0,"deterministic analysis must not self-approve content topics");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_topic_coverage").get().count,878,"every evidence-bound topic must receive an explicit article coverage state");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_topic_coverage WHERE coverage_status='unassigned'").get().count,658,"topics without a confirmed article must remain distinct from missing article coverage");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_topic_coverage WHERE coverage_status!='unassigned'").get().count,220,"only topics belonging to the 13 confirmed article assignments may be assessed against WP headings");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_topic_coverage WHERE coverage_status IN ('covered_title','covered_heading') AND (matched_text IS NULL OR match_source IS NULL)").get().count,0,"covered topics must retain the exact title or heading evidence");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM content_structure_candidates").get().count,63,"only resolved keyword groups may receive structure candidates");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM keyword_groups WHERE main_keyword GLOB 'topic-*' OR main_keyword GLOB 'keyword-*'").get().count, 0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM articles WHERE site_id = 'it-shukatu.com' AND gsc_status = 'ok'").get().count,59);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM articles WHERE site_id='it-shukatu.com' AND modified_at IS NOT NULL AND length(headings_digest)=64").get().count,59,"WP modified time and heading evidence digest must survive projection");
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM gsc_query_results WHERE site_id = 'it-shukatu.com'").get().count,681);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM gsc_query_results WHERE source_file = '' OR window_days != 28").get().count,0);
assert.equal(pocDb.prepare("SELECT COUNT(*) AS count FROM gsc_query_results WHERE normalized_query = ''").get().count,0);
{
  const actual=projectDashboard(pocDb);
  assert.equal(actual.groups.length,64);assert.equal(actual.groups.filter((group)=>group.resolution_state==="resolved").length,63);assert.equal(actual.groups.filter((group)=>group.resolution_state==="unresolved").length,1,"tree projection must not change the SERP article boundary");
  assert.equal(actual.sites[0].lexical_index.variant_clusters.length,921);assert.equal(actual.sites[0].lexical_index.associations.length,1636);assert.ok(actual.sites[0].lexical_index.associations.every((item)=>item.evidence_source_keyword_ids.length>0&&item.evidence_digest.length===64));
  assert.ok(actual.sites[0].ai_question_candidates.length>0);assert.ok(actual.sites[0].ai_question_candidates.some((row)=>row.candidate_kind==="observed_question"&&row.generator_kind==="observed_passthrough"));assert.ok(actual.sites[0].ai_question_candidates.some((row)=>row.candidate_kind==="derived_question"&&row.generator_kind==="deterministic_rule"));assert.ok(actual.sites[0].ai_question_candidates.every((row)=>row.evidence_occurrence_ids.length>0&&row.input_digest.length===64&&row.evidence_digest.length===64));
  assert.equal(actual.sites[0].portfolio_metrics.keyword_count,10694);assert.equal(actual.sites[0].portfolio_metrics.serp_acquired_keyword_count,100);assert.equal(actual.sites[0].portfolio_metrics.serp_unacquired_keyword_count,10594);assert.equal(actual.sites[0].portfolio_metrics.task_count,100);assert.equal(actual.sites[0].portfolio_metrics.gsc_query_count,678);assert.equal(actual.sites[0].portfolio_metrics.gsc_query_row_count,681,"normalized query count and retained source rows must both remain visible");assert.equal(actual.sites[0].portfolio_metrics.question_candidate_count,actual.sites[0].ai_question_candidates.length);
  assert.equal(actual.groups.reduce((sum,group)=>sum+group.related_keyword_proposals.length,0),792);assert.ok(actual.groups.flatMap((group)=>group.related_keyword_proposals).every((item)=>item.evidence.representative_source_keyword_id&&item.evidence_digest.length===64));
  assert.equal(actual.serp_demand_occurrences.length,1188,"API projection must preserve the full PAA/related-search occurrence population");
  assert.equal(actual.serp_demands.reduce((sum,row)=>sum+row.occurrence_count,0),1188,"canonical demand aggregation must reconcile exactly to occurrences");
  assert.ok(actual.serp_demands.every((row)=>row.importance_score>=0&&row.importance_score<=100&&row.importance_policy==="observed-demand-relative.v1"));assert.ok(actual.serp_demands.every((row)=>row.first_observed_at&&row.last_observed_at&&row.max_recursion_depth>=1));
  assert.ok(actual.serp_demands.some((row)=>row.occurrence_count>1&&row.task_count>1),"repeated demands across seed keywords must expose recurrence evidence");
  assert.equal(actual.serp_organic_results.length,926);
  assert.equal(actual.raw_snapshot_inventory.length,110);assert.equal(actual.raw_snapshot_inventory.filter((row)=>row.analysis_status==="connected").length,100);assert.equal(actual.raw_snapshot_inventory.filter((row)=>row.analysis_status==="unconnected").length,10);assert.ok(actual.raw_snapshot_inventory.some((row)=>row.analysis_status==="unconnected"&&row.item_types.includes("jobs")));
  assert.equal(actual.sites[0].provider_cost_ledger.entry_count,100);assert.equal(actual.sites[0].provider_cost_ledger.total_cost_usd,actual.serp_task_metadata.reduce((sum,row)=>sum+Number(row.cost),0));assert.equal(actual.sites[0].provider_cost_ledger.api_key_stored,false);assert.equal(actual.sites[0].provider_cost_ledger.rakko_credit_equivalence,null);assert.ok(actual.sites[0].provider_cost_ledger.entries.every((entry)=>entry.source_digest.length===64));
  assert.equal(actual.dfs_enrichment_status.state,"not_acquired");assert.deepEqual(actual.keyword_market_metrics,[]);assert.deepEqual(actual.keyword_monthly_searches,[]);assert.deepEqual(actual.keyword_difficulties,[]);assert.deepEqual(actual.domain_ranked_keywords,[]);
  assert.equal(actual.serp_action_signals.length,8);assert.ok(actual.serp_action_signals.some((row)=>row.signal_types.includes("visual")&&row.recommended_formats.includes("original_images")));assert.ok(actual.serp_action_signals.some((row)=>row.signal_types.includes("commercial")&&row.rated_result_count===2));assert.ok(actual.serp_action_signals.some((row)=>row.signal_types.includes("spelling")&&row.corrected_keyword==="就活ネクタイ"));assert.ok(actual.serp_action_signals.every((row)=>row.status==="proposed"&&row.evidence.length>0));
  assert.equal(actual.serp_task_metadata.length,100);assert.equal(actual.serp_task_metadata.filter((row)=>row.spell!=null).length,1);assert.equal(actual.serp_special_features.length,4);assert.equal(actual.serp_feature_summary.reduce((sum,row)=>sum+row.occurrence_count,0),270);assert.ok(actual.serp_organic_results.every((row)=>row.attributes?.type==="organic"));
  assert.equal(actual.serp_page_keyword_edges.length,926);assert.equal(actual.simultaneous_keyword_relations.length,339);assert.equal(actual.serp_page_coverage.length,565);assert.equal(actual.serp_domain_coverage.length,226);assert.ok(actual.simultaneous_keyword_relations.every((item)=>item.shared_urls.length===item.shared_url_count));assert.ok(actual.serp_page_coverage.every((item)=>item.top_task_id&&item.top_keyword&&item.best_rank>=1));
  assert.equal(actual.serp_ai_overviews.length,68);
  assert.equal(actual.content_structure_candidates.filter((item)=>item.draft_package).length,63);assert.ok(actual.content_structure_candidates.every((item)=>item.draft_package.body_state==="not_generated"));assert.ok(actual.content_structure_candidates.every((item)=>item.draft_package.input_digest.length===64&&item.draft_package.package_digest.length===64));assert.ok(actual.content_structure_candidates.some((item)=>item.draft_package.gates.some((gate)=>gate.gate==="citation_approval"&&gate.status==="pending")));
  assert.equal(actual.serp_ai_overviews.reduce((sum,row)=>sum+row.references.length,0),96,"AIO citation references must remain available to the API consumer");
  assert.equal(actual.aio_citation_references.length,96);assert.equal(actual.aio_citation_domains.length,38);assert.equal(actual.aio_citation_references.filter((row)=>row.organic_url_rank!=null).length,61);assert.equal(actual.aio_citation_references.filter((row)=>row.organic_domain_rank!=null).length,71);assert.equal(actual.aio_citation_references.filter((row)=>row.is_own_domain).length,0);
  assert.equal(actual.aio_content_elements.length,69);assert.equal(actual.aio_content_elements.filter((row)=>row.coverage_status==="missing").length,16);assert.ok(actual.aio_content_elements.every((row)=>row.evidence_digest.length===64));
  assert.equal(actual.content_topic_proposals.length,878);
  assert.equal(actual.content_topic_coverage.length,878);assert.equal(actual.content_topic_coverage.filter((row)=>row.coverage_status!=="unassigned").length,220);assert.ok(actual.content_topic_coverage.every((row)=>row.evidence_digest.length===64));
  assert.equal(actual.content_topic_proposals.reduce((sum,row)=>sum+row.evidence_occurrence_ids.length,0),1188);
  assert.equal(actual.content_structure_candidates.length,63);
  assert.ok(actual.content_structure_candidates.every((candidate)=>candidate.status==="proposed"&&candidate.candidate_digest.length===64));
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
const mcpInitialize=await fetch(`http://127.0.0.1:${port}/mcp`,{
  method:"POST",headers:{"content-type":"application/json","accept":"application/json, text/event-stream"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"integration-test",version:"1"}}})
});assert.equal(mcpInitialize.status,200);assert.equal((await mcpInitialize.json()).result.capabilities.tools.listChanged,false);
const mcpTools=await fetch(`http://127.0.0.1:${port}/mcp`,{method:"POST",headers:{"content-type":"application/json","mcp-protocol-version":"2025-06-18"},body:JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/list"})});assert.equal(mcpTools.status,200);assert.equal((await mcpTools.json()).result.tools.length,5);
assert.equal((await fetch(`http://127.0.0.1:${port}/mcp`,{headers:{origin:"https://evil.example"}})).status,403);assert.equal((await fetch(`http://127.0.0.1:${port}/mcp`)).status,405);
assert.equal(first.sites.length, 2);
assert.equal(first.sites.find((site)=>site.site_id==="solobiz-lab.com").portfolio_metrics.group_count,1);assert.equal(first.sites.find((site)=>site.site_id==="it-shukatu.com").portfolio_metrics.group_count,1,"portfolio metrics must remain site scoped rather than use the two-site total");
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
assert.match(app,/data\.keyword_hierarchy/);assert.match(app,/mermaid\.render/);assert.match(html,/data-view="keyword-tree"/);assert.match(html,/id="tree-branch-filter"/);
assert.match(html,/data-view="demand-search"/);assert.match(app,/renderDemandSearch/);assert.match(app,/importance_score/);assert.match(app,/importance_policy/);
assert.match(html,/data-view="lexical-explorer"/);assert.match(app,/renderLexicalExplorer/);assert.match(app,/cosine_score/);assert.match(app,/lexical_index/);
assert.match(html,/data-view="keyword-utilities"/);assert.match(app,/runKeywordUtility/);assert.match(app,/executeUtility/);assert.match(html,/競合\/自サイト重複除去/);
assert.match(html,/data-view="quick-search"/);assert.match(app,/renderQuickSearch/);assert.match(app,/navigateQuickResult/);assert.match(app,/6種類の保持データ/);
assert.match(html,/demand-export-csv/);assert.match(app,/downloadDemand/);assert.match(app,/downloadRows/);assert.match(app,/history\.replaceState/);assert.match(app,/observed-demand/);
assert.match(app,/data\.simultaneous_keyword_relations/);assert.match(app,/観測内の同時ランクインKW/);
assert.match(app,/data\.serp_page_keyword_edges/);assert.match(app,/data\.serp_page_coverage/);assert.match(app,/competitorDomainsForSite/);assert.match(app,/複数記事群横断/);assert.match(app,/competitorPageRows/);assert.match(app,/renderCompetitorContent/);assert.match(app,/data\.competitor_headings/);
assert.match(app,/data\.serp_organic_results/);assert.match(app,/descriptionMatches/);assert.match(app,/SERP説明文/);assert.match(app,/keywordMatches/);
assert.match(app,/highlightMatches/);assert.match(app,/freshnessMatches/);assert.match(app,/強調語あり/);assert.match(app,/日時あり/);
assert.match(app,/data\.aio_citation_references/);assert.match(app,/data\.aio_citation_domains/);assert.match(app,/renderAioCitations/);assert.match(app,/通常SERP同一URL/);assert.match(app,/自サイト引用/);
assert.match(app,/data\.aio_content_elements/);assert.match(app,/AIO回答要素/);assert.match(app,/既存記事の論点不足/);assert.match(app,/statusLabels/);
assert.match(app,/data\.serp_task_metadata/);assert.match(app,/data\.serp_special_features/);assert.match(app,/renderAcquisitionHealth/);assert.match(app,/平均処理秒/);assert.match(app,/希少feature/);
assert.match(app,/元KW台帳/);assert.match(app,/siteInventory\.filter/);
assert.match(app,/data\.raw_snapshot_inventory/);assert.match(app,/分析未接続/);assert.match(app,/rawInventoryRows/);
assert.match(app,/data\.serp_action_signals/);assert.match(app,/SERP実測からの形式・構成施策/);assert.match(app,/推奨素材/);assert.match(app,/未承認/);
assert.match(app,/data\.dfs_enrichment_status/);assert.match(app,/data\.keyword_market_metrics/);assert.match(app,/data\.keyword_monthly_searches/);assert.match(app,/data\.domain_ranked_keywords/);assert.match(app,/追加市場データは未取得です/);assert.match(app,/renderMarketData/);
assert.match(app,/data\.content_topic_coverage/);assert.match(app,/既存WP記事の論点カバレッジ/);assert.match(app,/不足ではなく未評価/);
assert.match(app, /query-page-size/);
assert.match(app, /syncQueryCategoryFilters/);
assert.match(app, /empty\.hidden=rows\.length>0/);
assert.match(html, /id="query-detail-dialog"/);
assert.match(html, /data-view="content-plans"/);
assert.match(html, /id="content-plan-list"/);
assert.match(html, /提案のみ・未承認/);
assert.match(app, /data\.content_topic_proposals/);
assert.match(app, /data\.content_structure_candidates/);
assert.match(app,/本文生成package/);assert.match(app,/draft_package/);assert.match(app,/引用未承認のため公開不可/);
assert.match(app, /data\.content_generation_candidates/);
assert.match(app,/related_keyword_proposals/);assert.match(app,/未取得台帳からの関連KW候補/);assert.match(app,/concept dedupe済み/);
assert.match(app,/provider_cost_ledger/);assert.match(app,/provider費用/);
assert.match(app,/buildQuickSearchBookmarklet/);assert.match(app,/quick_q/);assert.match(html,/quick-search-bookmarklet/);assert.match(html,/ページ本文は送信・保存しません/);
assert.match(app,/renderSuggestExplorer/);assert.match(app,/processing_state/);assert.match(html,/suggest-explorer/);assert.match(html,/保有コーパス・サジェスト/);
assert.match(app,/renderAiQuestions/);assert.match(app,/ai_question_candidates/);assert.match(html,/ai-questions/);assert.match(html,/実測PAAはそのまま保持/);
assert.match(app,/suggestExportRows/);assert.match(app,/questionExportRows/);assert.match(app,/suggest_q/);assert.match(app,/question_kind/);assert.match(html,/suggest-export-csv/);assert.match(html,/ai-question-export-json/);
assert.match(app,/portfolio_metrics/);assert.match(app,/renderSitePortfolio/);assert.match(html,/site-portfolio/);assert.match(html,/未登録サイトは0件として作らず/);
assert.match(app,/locationData\.stations/);assert.match(app,/station_source/);assert.match(app,/生成上限20,000行/);assert.match(html,/locality-prefecture/);assert.match(html,/国交省2025年度駅dataset/);
assert.match(app, /競合根拠からの生成候補/);
assert.match(app, /data\.competitor_page_evidence/);
assert.match(app, /data\.competitor_headings/);
assert.match(app, /data\.competitor_terms/);
assert.match(app, /競合共起語/);
assert.match(app, /renderContentPlans/);
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
