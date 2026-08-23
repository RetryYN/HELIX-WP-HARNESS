import {mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";

const siteUrl=process.env.WP_SITE_URL??"https://it-shukatu-college.com/";
const siteId=process.env.WP_SITE_ID??"it-shukatu.com";
const output=path.resolve(process.argv[2]??".helix/evidence/wp-headings/manifest.json");
const summaryOutput=path.resolve(process.env.WP_HEADING_SUMMARY??"artifacts/poc/wp-heading-summary.json");
const decode=(value)=>value.replace(/<[^>]+>/g," ").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&#x([\da-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16))).replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#(?:0*39|x0*27);/gi,"'").replace(/\s+/g," ").trim();
const articles=[];
for(let page=1;;page+=1){
  const url=new URL("wp-json/wp/v2/posts",siteUrl);url.search=new URLSearchParams({per_page:"100",page:String(page),orderby:"id",order:"asc",_fields:"id,link,modified,title,content"});
  const response=await fetch(url);
  if(response.status===400&&page>1)break;
  if(!response.ok)throw new Error(`WP posts: HTTP ${response.status}`);
  for(const post of await response.json()){
    const headings=[...post.content.rendered.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match,index)=>({position:index,text:decode(match[1])})).filter((heading)=>heading.text);
    articles.push({site_id:siteId,wp_article_id:post.id,url:post.link,title:decode(post.title.rendered),modified:post.modified,headings});
  }
  if(page>=Number(response.headers.get("x-wp-totalpages")??1))break;
}
await mkdir(path.dirname(output),{recursive:true});
const generatedAt=new Date().toISOString();
await writeFile(output,`${JSON.stringify({schema_version:"wp-heading-evidence.v1",generated_at:generatedAt,site_id:siteId,site_url:siteUrl,articles},null,2)}\n`);
const h2=articles.reduce((sum,article)=>sum+article.headings.length,0);
const digest=createHash("sha256").update(JSON.stringify(articles.map((article)=>[article.wp_article_id,article.modified,article.headings.map((heading)=>heading.text)]))).digest("hex");
await mkdir(path.dirname(summaryOutput),{recursive:true});await writeFile(summaryOutput,`${JSON.stringify({schema_version:"wp-heading-attestation.v1",generated_at:generatedAt,site_id:siteId,articles:articles.length,h2,tree_sha256:digest},null,2)}\n`);
console.log(JSON.stringify({output,summary:summaryOutput,articles:articles.length,h2},null,2));
