import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import {fileURLToPath} from "node:url";
import path from "node:path";
import kuromoji from "kuromoji";
import {contentTerms,parseCompetitorHtml} from "./competitor-content-core.mjs";

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const dbPath=path.resolve(repoRoot,process.env.WP_DASHBOARD_DB??".helix/keyword-dashboard.sqlite");
const output=path.resolve(repoRoot,process.argv[2]??".helix/evidence/competitor-content/manifest.json");
const rawDir=path.join(path.dirname(output),"raw"),maxPages=Number(process.env.WP_COMPETITOR_PAGE_LIMIT??60),maxRank=Number(process.env.WP_COMPETITOR_MAX_RANK??3);
const userAgent="HELIX-WP-HARNESS-Research/1.0 (+public SEO evidence; contact site owner listed in project configuration)";
const sha=(value)=>createHash("sha256").update(value).digest("hex");
const tokenizer=await new Promise((resolve,reject)=>kuromoji.builder({dicPath:path.resolve(repoRoot,"node_modules/kuromoji/dict")}).build((error,value)=>error?reject(error):resolve(value)));
const tokenize=(value)=>tokenizer.tokenize(value);
const db=new DatabaseSync(dbPath,{readOnly:true});
const rows=db.prepare(`SELECT d.group_id,o.task_id,o.rank_group,o.url,o.domain,s.domain AS own_domain FROM serp_organic_results o JOIN dfs_tasks d ON d.task_id=o.task_id JOIN keyword_groups g ON g.group_id=d.group_id JOIN sites s ON s.site_id=g.site_id WHERE o.rank_group<=? ORDER BY o.rank_group,o.task_id`).all(maxRank);db.close();
const byUrl=new Map();
for(const row of rows){let host;try{host=new URL(row.url).hostname.replace(/^www\./,"")}catch{continue}if(host===row.own_domain||host.endsWith(`.${row.own_domain}`))continue;const item=byUrl.get(row.url)??{url:row.url,domain:row.domain,groups:new Map()};const evidence=item.groups.get(row.group_id)??{group_id:row.group_id,best_rank:row.rank_group,task_ids:new Set()};evidence.best_rank=Math.min(evidence.best_rank,row.rank_group);evidence.task_ids.add(row.task_id);item.groups.set(row.group_id,evidence);byUrl.set(row.url,item)}
const candidates=[...byUrl.values()].sort((a,b)=>Math.min(...[...a.groups.values()].map((x)=>x.best_rank))-Math.min(...[...b.groups.values()].map((x)=>x.best_rank))||b.groups.size-a.groups.size||a.url.localeCompare(b.url)).slice(0,maxPages);

const robotsCache=new Map();
function robotsAllows(text,url){const target=new URL(url),lines=text.split(/\r?\n/).map((line)=>line.replace(/#.*/,"").trim()).filter(Boolean);let applies=false;const rules=[];for(const line of lines){const [rawKey,...rest]=line.split(":");const key=rawKey.toLowerCase(),value=rest.join(":").trim();if(key==="user-agent"){applies=value==="*"||value.toLowerCase().includes("helix-wp-harness");continue}if(applies&&(key==="allow"||key==="disallow")&&value)rules.push({allow:key==="allow",path:value})}const matches=rules.filter((rule)=>target.pathname.startsWith(rule.path)).sort((a,b)=>b.path.length-a.path.length);return matches[0]?.allow??true}
async function allowed(url){const origin=new URL(url).origin;if(!robotsCache.has(origin))robotsCache.set(origin,(async()=>{try{const response=await fetch(`${origin}/robots.txt`,{headers:{"User-Agent":userAgent},signal:AbortSignal.timeout(10000)});return response.ok?response.text():""}catch{return ""}})());return robotsAllows(await robotsCache.get(origin),url)}
async function acquire(candidate){const fetchedAt=new Date().toISOString();if(!await allowed(candidate.url))return {...candidate,status:"robots_denied",fetched_at:fetchedAt,http_status:null,content_type:null};try{const response=await fetch(candidate.url,{headers:{"User-Agent":userAgent,"Accept":"text/html,application/xhtml+xml"},redirect:"follow",signal:AbortSignal.timeout(20000)});const contentType=response.headers.get("content-type")??"";if(!response.ok||!contentType.includes("text/html"))return {...candidate,status:response.ok?"unsupported_content_type":"http_error",fetched_at:fetchedAt,http_status:response.status,content_type:contentType,final_url:response.url};const html=await response.text(),snapshotDigest=sha(html),rawPath=path.join(rawDir,`${snapshotDigest}.html`);await writeFile(rawPath,html);const parsed=parseCompetitorHtml(html,response.url),terms=contentTerms(parsed,tokenize).slice(0,500);return {...candidate,status:"ok",fetched_at:fetchedAt,http_status:response.status,content_type:contentType,final_url:response.url,snapshot_path:rawPath,snapshot_digest:snapshotDigest,title:parsed.title,canonical_url:parsed.canonical_url,headings:parsed.headings,text_length:parsed.text_length,text_digest:parsed.text_digest,internal_link_count:parsed.internal_link_count,external_link_count:parsed.external_link_count,terms};}catch(error){return {...candidate,status:error?.name==="TimeoutError"?"timeout":"fetch_error",fetched_at:fetchedAt,http_status:null,content_type:null,error:String(error.message??error)}}}

await mkdir(rawDir,{recursive:true});
const pages=[];let cursor=0;
const workers=Array.from({length:Math.min(6,candidates.length)},async()=>{while(cursor<candidates.length){const index=cursor++;const raw=await acquire(candidates[index]);pages[index]={...raw,groups:[...raw.groups.values()].map((group)=>({...group,task_ids:[...group.task_ids].sort()}))};process.stderr.write(`[${index+1}/${candidates.length}] ${pages[index].status} ${pages[index].url}\n`)}});
await Promise.all(workers);
const manifest={schema_version:"competitor-content-evidence.v1",generated_at:new Date().toISOString(),source_db:dbPath,selection:{max_rank:maxRank,page_limit:maxPages,candidate_count:byUrl.size,selected_count:candidates.length,own_domains_excluded:true},counts:Object.fromEntries(["ok","robots_denied","http_error","unsupported_content_type","timeout","fetch_error"].map((status)=>[status,pages.filter((page)=>page.status===status).length])),pages};
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(manifest,null,2)}\n`);console.log(JSON.stringify({output,...manifest.selection,...manifest.counts},null,2));
