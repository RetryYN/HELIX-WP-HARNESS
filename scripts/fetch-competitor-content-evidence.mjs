import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {fileURLToPath} from "node:url";
import path from "node:path";
import kuromoji from "kuromoji";
import {contentTerms,parseCompetitorHtml} from "./competitor-content-core.mjs";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const dbPath=path.resolve(repoRoot,process.env.WP_DASHBOARD_DB??".helix/keyword-dashboard.sqlite");
const output=path.resolve(repoRoot,process.argv[2]??".helix/evidence/competitor-content/manifest.json"),resume=process.env.WP_COMPETITOR_RESUME==="1";
const rawDir=path.join(path.dirname(output),"raw"),maxPages=Number(process.env.WP_COMPETITOR_PAGE_LIMIT??60),maxRank=Number(process.env.WP_COMPETITOR_MAX_RANK??3);
const userAgent="HELIX-WP-HARNESS-Research/1.0 (+public SEO evidence; contact site owner listed in project configuration)";
const sha=(value)=>createHash("sha256").update(value).digest("hex");
const tokenizer=await new Promise((resolve,reject)=>kuromoji.builder({dicPath:path.resolve(repoRoot,"node_modules/kuromoji/dict")}).build((error,value)=>error?reject(error):resolve(value)));
const tokenize=(value)=>tokenizer.tokenize(value);
const db=new DatabaseSync(dbPath,{readOnly:true});
const rows=db.prepare(`SELECT d.group_id,o.task_id,o.rank_group,o.url,o.domain,s.domain AS own_domain FROM serp_organic_results o JOIN dfs_tasks d ON d.task_id=o.task_id JOIN keyword_groups g ON g.group_id=d.group_id JOIN sites s ON s.site_id=g.site_id WHERE o.rank_group<=? ORDER BY o.rank_group,o.task_id`).all(maxRank);db.close();
const byUrl=new Map();
for(const row of rows){let host;try{host=new URL(row.url).hostname.replace(/^www\./,"")}catch{continue}if(host===row.own_domain||host.endsWith(`.${row.own_domain}`))continue;const item=byUrl.get(row.url)??{url:row.url,domain:row.domain,groups:new Map()};const evidence=item.groups.get(row.group_id)??{group_id:row.group_id,best_rank:row.rank_group,tasks:new Map()};evidence.best_rank=Math.min(evidence.best_rank,row.rank_group);evidence.tasks.set(row.task_id,Math.min(evidence.tasks.get(row.task_id)??Infinity,row.rank_group));item.groups.set(row.group_id,evidence);byUrl.set(row.url,item)}
const candidates=[...byUrl.values()].sort((a,b)=>Math.min(...[...a.groups.values()].map((x)=>x.best_rank))-Math.min(...[...b.groups.values()].map((x)=>x.best_rank))||b.groups.size-a.groups.size||a.url.localeCompare(b.url)).slice(0,maxPages);

const robotsCache=new Map();
function robotsAllows(text,url){const target=new URL(url),lines=text.split(/\r?\n/).map((line)=>line.replace(/#.*/,"").trim()).filter(Boolean);let applies=false;const rules=[];for(const line of lines){const [rawKey,...rest]=line.split(":");const key=rawKey.toLowerCase(),value=rest.join(":").trim();if(key==="user-agent"){applies=value==="*"||value.toLowerCase().includes("helix-wp-harness");continue}if(applies&&(key==="allow"||key==="disallow")&&value)rules.push({allow:key==="allow",path:value})}const matches=rules.filter((rule)=>target.pathname.startsWith(rule.path)).sort((a,b)=>b.path.length-a.path.length);return matches[0]?.allow??true}
async function allowed(url){const origin=new URL(url).origin;if(!robotsCache.has(origin))robotsCache.set(origin,(async()=>{try{const response=await fetch(`${origin}/robots.txt`,{headers:{"User-Agent":userAgent},signal:AbortSignal.timeout(10000)});return response.ok?response.text():""}catch{return ""}})());return robotsAllows(await robotsCache.get(origin),url)}
async function acquire(candidate){const fetchedAt=new Date().toISOString();if(!await allowed(candidate.url))return {...candidate,status:"robots_denied",fetched_at:fetchedAt,http_status:null,content_type:null};try{const response=await fetch(candidate.url,{headers:{"User-Agent":userAgent,"Accept":"text/html,application/xhtml+xml"},redirect:"follow",signal:AbortSignal.timeout(20000)});const contentType=response.headers.get("content-type")??"";if(!response.ok||!contentType.includes("text/html"))return {...candidate,status:response.ok?"unsupported_content_type":"http_error",fetched_at:fetchedAt,http_status:response.status,content_type:contentType,final_url:response.url};const html=await response.text(),snapshotDigest=sha(html),rawPath=path.join(rawDir,`${snapshotDigest}.html`);await writeFile(rawPath,html);const parsed=parseCompetitorHtml(html,response.url),terms=contentTerms(parsed,tokenize).slice(0,500);return {...candidate,status:"ok",fetched_at:fetchedAt,http_status:response.status,content_type:contentType,final_url:response.url,snapshot_path:rawPath,snapshot_digest:snapshotDigest,title:parsed.title,canonical_url:parsed.canonical_url,headings:parsed.headings,text_length:parsed.text_length,text_digest:parsed.text_digest,internal_link_count:parsed.internal_link_count,external_link_count:parsed.external_link_count,terms};}catch(error){return {...candidate,status:error?.name==="TimeoutError"?"timeout":"fetch_error",fetched_at:fetchedAt,http_status:null,content_type:null,error:String(error.message??error)}}}

await mkdir(rawDir,{recursive:true});
const previous=resume&&existsSync(output)?JSON.parse(await readFile(output,"utf8")):null,previousByUrl=new Map((previous?.pages??[]).map((page)=>[page.url,page]));
const pages=new Array(candidates.length),pendingByOrigin=new Map();
for(const [index,candidate] of candidates.entries()){
  const cached=previousByUrl.get(candidate.url);
  if(cached){let refreshed=cached;if(cached.status==="ok"&&cached.snapshot_path&&existsSync(cached.snapshot_path)){const html=await readFile(cached.snapshot_path,"utf8"),parsed=parseCompetitorHtml(html,cached.final_url??cached.url);refreshed={...cached,title:parsed.title,canonical_url:parsed.canonical_url,headings:parsed.headings,text_length:parsed.text_length,text_digest:parsed.text_digest,internal_link_count:parsed.internal_link_count,external_link_count:parsed.external_link_count,terms:contentTerms(parsed,tokenize).slice(0,500)}}pages[index]={...refreshed,domain:candidate.domain,groups:[...candidate.groups.values()].map((group)=>({...group,task_ids:[...group.tasks.keys()].sort(),tasks:[...group.tasks].map(([task_id,best_rank])=>({task_id,best_rank})).sort((a,b)=>a.task_id.localeCompare(b.task_id))}))};continue}
  const origin=new URL(candidate.url).origin,queue=pendingByOrigin.get(origin)??[];queue.push({index,candidate});pendingByOrigin.set(origin,queue);
}
const originQueues=[...pendingByOrigin.values()],totalPending=originQueues.reduce((sum,queue)=>sum+queue.length,0);let originCursor=0,completed=0;
const workers=Array.from({length:Math.min(6,originQueues.length)},async()=>{while(originCursor<originQueues.length){const queue=originQueues[originCursor++];for(const {index,candidate} of queue){const raw=await acquire(candidate);pages[index]={...raw,groups:[...raw.groups.values()].map((group)=>({...group,task_ids:[...group.tasks.keys()].sort(),tasks:[...group.tasks].map(([task_id,best_rank])=>({task_id,best_rank})).sort((a,b)=>a.task_id.localeCompare(b.task_id))}))};completed+=1;process.stderr.write(`[${completed}/${totalPending} new; ${pages.filter(Boolean).length}/${candidates.length} total] ${pages[index].status} ${pages[index].url}\n`)}}});
await Promise.all(workers);
const manifest={schema_version:"competitor-content-evidence.v2",parser_version:"competitor-content-core.v2",generated_at:new Date().toISOString(),source_db:dbPath,selection:{max_rank:maxRank,page_limit:maxPages,candidate_count:byUrl.size,selected_count:candidates.length,own_domains_excluded:true},counts:Object.fromEntries(["ok","robots_denied","http_error","unsupported_content_type","timeout","fetch_error"].map((status)=>[status,pages.filter((page)=>page.status===status).length])),pages};
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(manifest,null,2)}\n`);console.log(JSON.stringify({output,...manifest.selection,...manifest.counts},null,2));
