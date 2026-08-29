import {createHash} from "node:crypto";

const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonical=(raw)=>{const url=new URL(raw),host=url.hostname.toLocaleLowerCase("en-US").replace(/^www\./u,"");return{host,page:`${url.protocol}//${host}${url.pathname.replace(/\/$/u,"")||"/"}`,directory:`${url.protocol}//${host}/${url.pathname.split("/").filter(Boolean)[0]??""}`}};

export function buildObservedRankedKeywordIndex(edges,{siteId}={}){
  const observations=[];
  for(const edge of edges){
    const target=canonical(edge.canonical_url??edge.url),scopes=[{scope_type:"host",scope_value:target.host},{scope_type:"directory",scope_value:target.directory},{scope_type:"page",scope_value:target.page}];
    for(const scope of scopes)observations.push({...scope,site_id:siteId,task_id:edge.task_id,group_id:edge.group_id,keyword:edge.keyword,rank:edge.rank,observed_url:target.page});
  }
  const groups=new Map();for(const row of observations){const key=`${row.scope_type}\0${row.scope_value}`;const values=groups.get(key)??[];values.push(row);groups.set(key,values)}
  const rows=[...groups.values()].map((values)=>{const keywords=[...new Map(values.sort((a,b)=>a.rank-b.rank||a.keyword.localeCompare(b.keyword,"ja")).map((row)=>[row.keyword,{keyword:row.keyword,best_rank:row.rank,task_ids:[...new Set(values.filter((item)=>item.keyword===row.keyword).map((item)=>item.task_id))].sort(),group_ids:[...new Set(values.filter((item)=>item.keyword===row.keyword).map((item)=>item.group_id))].sort(),observed_urls:[...new Set(values.filter((item)=>item.keyword===row.keyword).map((item)=>item.observed_url))].sort()}])).values()],base={site_id:siteId,scope_type:values[0].scope_type,scope_value:values[0].scope_value,keyword_count:keywords.length,observation_count:values.length,best_rank:Math.min(...values.map((row)=>row.rank)),keywords,corpus_boundary:"retained_top10_observations_only",estimated_traffic:null,estimated_value:null,unranked_inference:false,external_acquisition_triggered:false,policy:"observed-ranked-keyword-index.v1"};return{...base,evidence_digest:digest(base)}}).sort((a,b)=>a.scope_type.localeCompare(b.scope_type)||b.keyword_count-a.keyword_count||a.scope_value.localeCompare(b.scope_value));
  const summary={site_id:siteId,row_count:rows.length,host_count:rows.filter((row)=>row.scope_type==="host").length,directory_count:rows.filter((row)=>row.scope_type==="directory").length,page_count:rows.filter((row)=>row.scope_type==="page").length,keyword_scope_membership_count:rows.reduce((sum,row)=>sum+row.keyword_count,0),external_acquisition_triggered_count:0,corpus_boundary:"retained_top10_observations_only",full_rank_database_claimed:false,traffic_inferred:false};return{rows,summary,index_digest:digest({rows,summary})};
}
