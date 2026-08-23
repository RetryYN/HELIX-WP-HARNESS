import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const guardModule=process.env.WP_GSC_GUARD_MODULE;
if(!guardModule)throw new Error("WP_GSC_GUARD_MODULE is required");
const require=createRequire(import.meta.url);
const {connectGuarded}=require(guardModule);
const siteUrl=process.env.WP_GSC_SITE_URL??"https://it-shukatu-college.com/";
const siteId=process.env.WP_GSC_SITE_ID??"it-shukatu.com";
const days=Number(process.env.WP_GSC_DAYS??7);
const concurrency=Number(process.env.WP_GSC_CONCURRENCY??3);
const outputDir=path.resolve(process.argv[2]??".helix/evidence/gsc-page-query-7d");

async function wpPosts(){
  const rows=[];
  for(let page=1;;page+=1){
    const response=await fetch(`${siteUrl}wp-json/wp/v2/posts?per_page=100&page=${page}&orderby=id&order=asc&_fields=id,link,slug,status,date,modified,title,categories`);
    if(response.status===400&&page>1)break;
    if(!response.ok)throw new Error(`WP posts: HTTP ${response.status}`);
    rows.push(...await response.json());
    if(page>=Number(response.headers.get("x-wp-totalpages")??1))break;
  }
  return rows;
}

await mkdir(outputDir,{recursive:true});
const posts=await wpPosts();
const {browser,newPage}=await connectGuarded();
const results=new Array(posts.length);
let cursor=0;
async function worker(){
  while(cursor<posts.length){
    const index=cursor++;
    const post=posts[index];
    const page=await newPage();
    const reportUrl=`https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(siteUrl)}&num_of_days=${days}&breakdown=query&page=!${encodeURIComponent(post.link)}`;
    const zipPath=path.join(outputDir,`${post.id}.zip`);
    const extractDir=path.join(outputDir,String(post.id));
    try{
      await page.goto(reportUrl,{waitUntil:"domcontentloaded"});
      await page.waitForTimeout(6500);
      if(page.url().includes("accounts.google.com"))throw new Error("SESSION_EXPIRED");
      const downloadPromise=page.waitForEvent("download",{timeout:30000});
      await page.getByRole("button",{name:"エクスポート"}).click();
      await page.waitForTimeout(600);
      await page.getByRole("menu").getByText("CSV をダウンロード",{exact:true}).click();
      const download=await downloadPromise;
      await download.saveAs(zipPath);
      await mkdir(extractDir,{recursive:true});
      execFileSync("unzip",["-o",zipPath,"クエリ.csv","フィルタ.csv","-d",extractDir],{stdio:"ignore"});
      const queryCsv=await readFile(path.join(extractDir,"クエリ.csv"),"utf8");
      results[index]={site_id:siteId,wp_article_id:post.id,url:post.link,title:post.title.rendered,categories:post.categories,days,report_url:reportUrl,query_file:path.relative(outputDir,path.join(extractDir,"クエリ.csv")),filter_file:path.relative(outputDir,path.join(extractDir,"フィルタ.csv")),query_rows:Math.max(0,queryCsv.trim().split(/\r?\n/).length-1),status:"ok"};
    }catch(error){
      results[index]={site_id:siteId,wp_article_id:post.id,url:post.link,title:post.title.rendered,categories:post.categories,days,report_url:reportUrl,status:"error",error:String(error.message??error)};
    }finally{
      await page.close();
      await rm(zipPath,{force:true});
    }
  }
}
try{await Promise.all(Array.from({length:Math.min(concurrency,posts.length)},()=>worker()));}finally{await browser.close()}
const evidence={schema_version:"wp-gsc-page-query-poc.v1",generated_at:new Date().toISOString(),site_id:siteId,site_url:siteUrl,days,articles:results};
await writeFile(path.join(outputDir,"manifest.json"),`${JSON.stringify(evidence,null,2)}\n`);
const ok=results.filter((row)=>row.status==="ok");
console.log(JSON.stringify({output:path.join(outputDir,"manifest.json"),articles:results.length,ok:ok.length,failed:results.length-ok.length,query_rows:ok.reduce((sum,row)=>sum+row.query_rows,0)},null,2));
if(ok.length!==results.length)process.exitCode=1;
