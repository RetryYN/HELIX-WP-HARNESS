import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildDashboardDb } from "./keyword-dashboard-db.mjs";
import { categoryPathForKeywords } from "./keyword-category-taxonomy.mjs";

const dbPath = path.resolve(process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });
const baseFixture=JSON.parse(readFileSync(path.resolve("docs/prototypes/wp-ops-dashboard/data.json"),"utf8"));
const pocPath=path.resolve(process.env.WP_KEYWORD_POC_RESULT??"artifacts/poc/keyword-workbook-100-live/result.json");
const poc=JSON.parse(readFileSync(pocPath,"utf8"));
const importedKeywords=poc.tasks.map((row)=>({source_keyword_id:row.source_keyword_id,site_id:"it-shukatu.com",source_sheet:row.source_sheet,source_row:row.source_row,raw_keyword:row.keyword,search_volume:row.search_volume,cpc:row.cpc,competition:row.competition}));
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
  const categoryPath=categoryPathForKeywords(rows.map((row)=>row.keyword));
  const mainBasis="文脈・語数階層内の実在KWから検索Vol最大（修飾語はmain除外）";
  return {
    id:`it-shukatu-serp-${String(index+1).padStart(3,"0")}`,site_id:"it-shukatu.com",resolution_state:resolved?"resolved":"unresolved",main_keyword:resolved?group.main_keyword:null,derived_parent_candidate:resolved?null:group.derived_parent_candidate??null,
    main_origin:resolved?mainBasis:"derived_parent_candidate（修飾語KWのみ・実在親KWなし・main未確定）",
    source_order:{file:0,sheet:0,row:Math.min(...rows.map((row)=>row.source_row))},source_location:`DB取込 / IT就活 / ${(main??rows[0]).source_row}行`,search_volume:resolved?group.main_search_volume:null,search_volume_source:"取込DB（DataForSEO検索Vol）",
    intent_keywords:rows.filter((row)=>row.keyword!==group.main_keyword).map((row)=>row.keyword),sibling_keywords:[],comparison_keywords:rows.map((row)=>row.keyword),
    confidence:weakest?((weakest.decision_ratio??weakest.ratio)>=0.8?"high":"possible"):"single",overlap:{shared:weakest?.shared_count??0,depth:5,ratio:weakest?.decision_ratio??weakest?.ratio??0},state:"未施策",wp_article_id:null,category:categoryPath.at(-1),category_path:categoryPath,
    strategy:{decision:resolved?(rows.length>1?"1記事に統合":"単独施策候補"):"親KW未確定（PO確定またはDFS取得待ち）",article_count:1,main_basis:resolved?mainBasis:"derived_parent_candidate（未昇格）",click_opportunity:"AIO出現クエリは施策評価で別管理"},
    article_gate:{status:"未成立",conditions:[
      resolved?{label:"対象KW群の確定",status:"pass",detail:`main 1語・内包KW ${rows.length-1}語`}:{label:"対象KW群の確定",status:"blocked",detail:`main未確定・導出候補「${group.derived_parent_candidate??"—"}」・修飾語KW ${rows.length}語`},{label:"WP記事IDの割当",status:"blocked",detail:"未割当"},{label:"main KW coverage",status:"pending",detail:"記事未作成"},{label:"内包KWの検索意図coverage",status:rows.length>1?"pending":"pass",detail:rows.length>1?"記事未作成":"内包KWなし"},{label:"required_topics coverage",status:"blocked",detail:"PAA・関連検索の論点化待ち"},{label:"事実情報の出典",status:"pending",detail:"記事未作成"}
    ]},cost:rows.reduce((sum,row)=>sum+Number(row.cost??0),0),task_ids:rows.map((row)=>row.task_id),shared_urls:sharedUrls
  };
});
const fixture={...baseFixture,generated_at:poc.generated_at,groups:[...baseFixture.groups.filter((group)=>group.site_id!=="it-shukatu.com"),...processedGroups]};
const fixturePath=path.resolve(".helix/keyword-dashboard-runtime.json");
mkdirSync(path.dirname(fixturePath),{recursive:true});
await import("node:fs/promises").then(({writeFile})=>writeFile(fixturePath,`${JSON.stringify(fixture,null,2)}\n`));
const gscEvidencePath=path.resolve(process.env.WP_GSC_EVIDENCE??".helix/evidence/gsc-page-query-28d/manifest.json");
const hasGscEvidence=existsSync(gscEvidencePath);
if(!hasGscEvidence&&process.env.WP_ALLOW_EMPTY_GSC!=="1")throw new Error(`GSC evidence is required: ${gscEvidencePath}. Set WP_ALLOW_EMPTY_GSC=1 only for an explicit empty-state test.`);
const headingEvidencePath=path.resolve(process.env.WP_HEADING_EVIDENCE??".helix/evidence/wp-headings/manifest.json");
const db = buildDashboardDb({ dbPath, fixturePath, artifactRoot: path.resolve("artifacts/poc"), importedKeywords, gscEvidencePath:hasGscEvidence?gscEvidencePath:undefined, headingEvidencePath:existsSync(headingEvidencePath)?headingEvidencePath:undefined });
const counts = Object.fromEntries(["sites", "imported_keywords", "keyword_groups", "dfs_tasks", "gate_runs", "articles", "gsc_query_results", "article_links"].map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)]));
db.close();
console.log(JSON.stringify({ db_path: dbPath, ...counts }, null, 2));
