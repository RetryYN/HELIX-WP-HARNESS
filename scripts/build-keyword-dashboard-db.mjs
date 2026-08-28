import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildDashboardDb } from "./keyword-dashboard-db.mjs";
import { categoryPathForKeywords } from "./keyword-category-taxonomy.mjs";
import {serpConfidence} from "./keyword-serp-core.mjs";
import {readXlsxKeywordWorkbook} from "./read-xlsx-keywords.mjs";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const fromRepo=(value)=>path.isAbsolute(value)?value:path.resolve(repoRoot,value);
const dbPath = fromRepo(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });
const baseFixture=JSON.parse(readFileSync(fromRepo("docs/prototypes/wp-ops-dashboard/data.json"),"utf8"));
const pocPath=fromRepo(process.env.WP_KEYWORD_POC_RESULT??"artifacts/poc/keyword-workbook-100-live/result.json");
const poc=JSON.parse(readFileSync(pocPath,"utf8"));
const keywordWorkbookPath=fromRepo(process.env.WP_KEYWORD_WORKBOOK??"../poc-wp/data/IT就活大学キーワードマップ.xlsx"),workbookRows=existsSync(keywordWorkbookPath)?readXlsxKeywordWorkbook(keywordWorkbookPath):null;
const importedKeywords=(workbookRows??poc.tasks).map((row)=>({source_keyword_id:row.source_keyword_id??`it-shukatu.com:${row.source_sheet}:${row.source_row}`,site_id:"it-shukatu.com",source_sheet:row.source_sheet,source_row:row.source_row,raw_keyword:row.raw_keyword??row.keyword,search_volume:row.search_volume,cpc:row.cpc,competition:row.competition}));
const taskById=new Map(poc.tasks.map((task)=>[task.source_keyword_id,task]));
const pairByIds=new Map(poc.grouping.pairs.map((pair)=>[[pair.left,pair.right].sort().join("\0"),pair]));
const processedGroups=poc.article_keyword_groups.map((group,index)=>{
  const rows=group.source_keyword_ids.map((id)=>taskById.get(id));
  const pairs=[];
  for(let left=0;left<rows.length;left+=1)for(let right=left+1;right<rows.length;right+=1)pairs.push(pairByIds.get([rows[left].source_keyword_id,rows[right].source_keyword_id].sort().join("\0")));
  const weakest=pairs.length?pairs.reduce((current,pair)=>(pair.decision_ratio??pair.ratio)<(current.decision_ratio??current.ratio)?pair:current):null;
  const sharedUrls=rows.length>1?rows[0].organic_urls.slice(0,5).filter((url)=>rows.slice(1).every((row)=>row.organic_urls.slice(0,5).includes(url))):[];
  const resolved=group.resolution_state!=="unresolved"&&group.main_keyword!=null;
  const main=resolved?rows.find((row)=>row.keyword===group.main_keyword):null;
  if(resolved&&!main)throw new Error(`main keyword is not an actual group member: ${group.group_id}`);
  const inferredCategoryPath=categoryPathForKeywords(rows.map((row)=>row.keyword));
  const contextCategory=group.context_scope_id==="context:it"?"IT就活":"就活";
  const categoryPath=[contextCategory,...inferredCategoryPath.filter((part)=>part!==contextCategory&&!(group.context_scope_id==="context:general"&&part==="IT就活"))];
  const mainBasis="文脈・語数階層内の実在KWから検索Vol最大（修飾語はmain除外）";
  return {
    id:`it-shukatu-serp-${String(index+1).padStart(3,"0")}`,site_id:"it-shukatu.com",resolution_state:resolved?"resolved":"unresolved",main_keyword:resolved?group.main_keyword:null,derived_parent_candidate:resolved?null:group.derived_parent_candidate??null,
    main_origin:resolved?mainBasis:"derived_parent_candidate（修飾語KWのみ・実在親KWなし・main未確定）",
    source_order:{file:0,sheet:0,row:Math.min(...rows.map((row)=>row.source_row))},source_location:`DB取込 / IT就活 / ${(main??rows[0]).source_row}行`,search_volume:resolved?group.main_search_volume:null,search_volume_source:"取込DB（DataForSEO検索Vol）",
    intent_keywords:rows.filter((row)=>row.keyword!==group.main_keyword).map((row)=>row.keyword),sibling_keywords:[],comparison_keywords:rows.map((row)=>row.keyword),
    confidence:weakest?serpConfidence(weakest.decision_ratio??weakest.ratio):"single",overlap:{shared:weakest?.shared_count??0,depth:5,ratio:weakest?.decision_ratio??weakest?.ratio??0},state:"未施策",wp_article_id:null,category:categoryPath.at(-1),category_path:categoryPath,
    strategy:{decision:resolved?(rows.length>1?"1記事に統合":"単独施策候補"):"親KW未確定（PO確定またはDFS取得待ち）",article_count:1,main_basis:resolved?mainBasis:"derived_parent_candidate（未昇格）",click_opportunity:"AIO出現クエリは施策評価で別管理"},
    article_gate:{status:"未成立",conditions:[
      resolved?{label:"対象KW群の確定",status:"pass",detail:`main 1語・内包KW ${rows.length-1}語`}:{label:"対象KW群の確定",status:"blocked",detail:`main未確定・導出候補「${group.derived_parent_candidate??"—"}」・修飾語KW ${rows.length}語`},{label:"WP記事IDの割当",status:"blocked",detail:"未割当"},{label:"main KW coverage",status:"pending",detail:"記事未作成"},{label:"内包KWの検索意図coverage",status:rows.length>1?"pending":"pass",detail:rows.length>1?"記事未作成":"内包KWなし"},{label:"required_topics coverage",status:"blocked",detail:"PAA・関連検索の論点化待ち"},{label:"事実情報の出典",status:"pending",detail:"記事未作成"}
    ]},cost:rows.reduce((sum,row)=>sum+Number(row.cost??0),0),task_ids:rows.map((row)=>row.task_id),shared_urls:sharedUrls
  };
});
const fixture={...baseFixture,generated_at:poc.generated_at,sites:baseFixture.sites.filter((site)=>site.site_id==="it-shukatu.com"),groups:processedGroups};
const fixturePath=fromRepo(".helix/keyword-dashboard-runtime.json");
mkdirSync(path.dirname(fixturePath),{recursive:true});
await import("node:fs/promises").then(({writeFile})=>writeFile(fixturePath,`${JSON.stringify(fixture,null,2)}\n`));
const gscEvidencePaths=(process.env.WP_GSC_EVIDENCE_PATHS?JSON.parse(process.env.WP_GSC_EVIDENCE_PATHS):[process.env.WP_GSC_EVIDENCE??"artifacts/poc/evidence-fixtures/gsc-page-query-28d/manifest.json"]).map(fromRepo);
const missingGscEvidencePaths=gscEvidencePaths.filter((candidate)=>!existsSync(candidate));
if(missingGscEvidencePaths.length&&process.env.WP_ALLOW_EMPTY_GSC!=="1")throw new Error(`GSC evidence is required: ${missingGscEvidencePaths.join(", ")}. Set WP_ALLOW_EMPTY_GSC=1 only for an explicit empty-state test.`);
const availableGscEvidencePaths=gscEvidencePaths.filter((candidate)=>existsSync(candidate));
const headingEvidencePath=fromRepo(process.env.WP_HEADING_EVIDENCE??"artifacts/poc/evidence-fixtures/wp-headings/manifest.json");
const hasHeadingEvidence=existsSync(headingEvidencePath);
if(!hasHeadingEvidence&&process.env.WP_ALLOW_EMPTY_HEADINGS!=="1")throw new Error(`WP heading evidence is required: ${headingEvidencePath}. Set WP_ALLOW_EMPTY_HEADINGS=1 only for an explicit empty-state test.`);
const contentStructureEvidencePath=fromRepo(process.env.WP_CONTENT_STRUCTURE_EVIDENCE??"artifacts/poc/evidence-fixtures/wp-content-structure/manifest.json");
const siteSurfaceEvidencePath=fromRepo(process.env.WP_SITE_SURFACE_EVIDENCE??"artifacts/poc/evidence-fixtures/site-surface-inventory/manifest.json");
const publicPageSurfaceEvidencePath=fromRepo(process.env.WP_PUBLIC_PAGE_SURFACE_EVIDENCE??"artifacts/poc/evidence-fixtures/public-page-surface/manifest.json");
const competitorEvidencePath=fromRepo(process.env.WP_COMPETITOR_EVIDENCE??".helix/evidence/competitor-content/manifest.json");
const dfsEnrichmentEvidencePath=process.env.WP_DFS_ENRICHMENT_EVIDENCE?fromRepo(process.env.WP_DFS_ENRICHMENT_EVIDENCE):undefined;if(dfsEnrichmentEvidencePath&&!existsSync(dfsEnrichmentEvidencePath))throw new Error(`DFS enrichment evidence not found: ${dfsEnrichmentEvidencePath}`);
const db = buildDashboardDb({ dbPath, fixturePath, artifactRoot: fromRepo("artifacts/poc"), importedKeywords, serpAcquiredSourceKeywordIds:poc.tasks.map((row)=>row.source_keyword_id), gscEvidencePaths:availableGscEvidencePaths, headingEvidencePath:hasHeadingEvidence?headingEvidencePath:undefined,contentStructureEvidencePath:availableGscEvidencePaths.length&&existsSync(contentStructureEvidencePath)?contentStructureEvidencePath:undefined,siteSurfaceEvidencePath:availableGscEvidencePaths.length&&existsSync(siteSurfaceEvidencePath)?siteSurfaceEvidencePath:undefined,publicPageSurfaceEvidencePath:availableGscEvidencePaths.length&&existsSync(publicPageSurfaceEvidencePath)?publicPageSurfaceEvidencePath:undefined, competitorEvidencePath:existsSync(competitorEvidencePath)?competitorEvidencePath:undefined,dfsEnrichmentEvidencePath });
const counts = Object.fromEntries(["sites", "imported_keywords", "keyword_groups", "dfs_enrichment_runs", "keyword_market_metrics", "keyword_monthly_searches", "keyword_difficulty_enrichment", "domain_ranked_keywords", "raw_snapshot_inventory", "dfs_tasks", "serp_task_metadata", "serp_action_signals", "serp_feature_occurrences", "serp_feature_items", "serp_feature_item_links", "serp_intent_fingerprints", "serp_intent_pair_reviews", "keyword_boundary_reviews", "serp_depth_stability", "content_topology_reviews", "serp_organic_attributes", "serp_demand_occurrences", "serp_organic_results", "serp_page_keyword_edges", "simultaneous_keyword_relations", "serp_page_coverage", "serp_domain_coverage", "serp_ai_overviews", "aio_citation_references", "aio_citation_domains", "aio_content_elements", "content_topic_proposals", "content_topic_coverage", "content_structure_candidates", "content_generation_candidates", "competitor_pages", "competitor_headings", "competitor_page_terms", "competitor_terms", "competitor_task_terms", "gate_runs", "articles", "gsc_query_results", "article_links"].map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)]));
counts.content_consolidation_blueprints=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_blueprints").get().count);
counts.content_consolidation_citation_recommendations=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_citation_recommendations").get().count);
counts.content_consolidation_citation_claim_audits=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_citation_claim_audits").get().count);
counts.content_consolidation_citation_backfill_candidates=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_citation_backfill_candidates").get().count);
counts.content_consolidation_citation_backfill_eligibility=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_citation_backfill_eligibility").get().count);
counts.content_consolidation_citation_observation_lineage=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_citation_observation_lineage").get().count);
counts.content_consolidation_citation_authority_audits=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_citation_authority_audits").get().count);
counts.content_consolidation_primary_source_requirements=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_primary_source_requirements").get().count);
counts.content_consolidation_retained_primary_source_discovery=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_retained_primary_source_discovery").get().count);
counts.content_consolidation_retained_primary_source_evidence=Number(db.prepare("SELECT COUNT(*) AS count FROM content_consolidation_retained_primary_source_evidence").get().count);
db.close();
console.log(JSON.stringify({ db_path: dbPath, ...counts }, null, 2));
