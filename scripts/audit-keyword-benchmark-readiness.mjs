import {DatabaseSync} from "node:sqlite";
import {pathToFileURL} from "node:url";
import {canonicalSerpUrl} from "./serp-page-keyword-graph.mjs";
import {hasRedactedUrlIdentity} from "./retained-url-identity.mjs";

const identity=value=>{try{return value&&!hasRedactedUrlIdentity(value)?canonicalSerpUrl(value):null;}catch{return null;}};

// Retained SERP appearance is a bounded sample, not the full set of a page's ranking keywords.
export function auditKeywordBenchmarkReadiness(db){
  const rows=db.prepare("SELECT t.task_id,p.page_id,p.url,p.status,p.fetched_at,p.snapshot_digest FROM data_provider_b_tasks t LEFT JOIN competitor_page_task_evidence e ON e.task_id=t.task_id AND e.best_rank=1 LEFT JOIN competitor_pages p USING(page_id) ORDER BY t.task_id,p.page_id").all();
  const headings=db.prepare("SELECT page_id,position,level,text FROM competitor_headings WHERE level IN (2,3)").all();
  const ranked=db.prepare("SELECT url,keyword,location_code,language_code,source_digest FROM domain_ranked_keywords").all();
  const appearances=db.prepare("SELECT canonical_url,keyword FROM serp_page_keyword_edges").all();
  const byPage=Map.groupBy(headings,h=>h.page_id);
  const observedByUrl=Map.groupBy(appearances,r=>identity(r.canonical_url));
  const rankedByUrl=Map.groupBy(ranked,r=>identity(r.url));
  const results=rows.map(row=>{
    const url=identity(row.url),hs=byPage.get(row.page_id)??[],kw=url?(rankedByUrl.get(url)??[]):[];
    return {task_id:row.task_id,page_id:row.page_id,
      top_page_state:!row.page_id?"not_retained":!url?"unidentifiable_url":row.status!=="ok"?"fetch_not_ok":"retained",
      heading_count:hs.length,
      long_heading_count:hs.filter(h=>h.text.length>300).length,
      possible_navigation_heading_count:hs.filter(h=>/カテゴリ一覧|あわせて知りたい|人気記事ランキング|総合Q&Aランキング|まずは読みたい記事/.test(h.text)).length,
      heading_comparison_state:hs.length?"requires_content_region_and_meaning_review":"not_observed",
      snapshot_digest:row.snapshot_digest,fetched_at:row.fetched_at,
      bounded_serp_keyword_count:url?new Set((observedByUrl.get(url)??[]).map(r=>r.keyword)).size:0,
      page_ranked_keyword_count:new Set(kw.map(r=>r.keyword)).size,
      page_ranked_keyword_state:kw.length?"observed_subset_scope_alignment_required":"not_observed",
      semantic_agreement:null,ranking_success_proven:false};
  });
  return {schema_version:"keyword-benchmark-readiness.v1",rows:results,summary:{task_count:new Set(results.map(r=>r.task_id)).size,
    top_page_rows:results.filter(r=>r.page_id).length,
    rows_with_headings:results.filter(r=>r.heading_count).length,
    rows_with_long_heading_flags:results.filter(r=>r.long_heading_count).length,
    rows_with_navigation_flags:results.filter(r=>r.possible_navigation_heading_count).length,
    rows_with_page_ranked_keywords:results.filter(r=>r.page_ranked_keyword_count).length,
    semantic_agreement:null,ranking_success_proven:false,db_modified:false}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const db=new DatabaseSync(process.argv[2]??".helix/keyword-dashboard.sqlite",{readOnly:true});
  try{console.log(JSON.stringify(auditKeywordBenchmarkReadiness(db).summary,null,2));}finally{db.close();}
}
