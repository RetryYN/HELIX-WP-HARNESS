import {createHash} from "node:crypto";

const decodeEntities=(value)=>String(value??"").replace(/&#(x?[0-9a-f]+);|&([a-z]+);/gi,(_,numeric,named)=>{
  if(numeric)return String.fromCodePoint(Number.parseInt(numeric.replace(/^x/i,""),numeric[0].toLowerCase()==="x"?16:10));
  return {amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "}[named.toLowerCase()]??`&${named};`;
});
const clean=(value)=>decodeEntities(String(value??"").replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ").replace(/<noscript\b[\s\S]*?<\/noscript>/gi," ").replace(/<!--[\s\S]*?-->/g," ").replace(/<[^>]+>/g," ")).replace(/[\s\u3000]+/g," ").trim();
const digest=(value)=>createHash("sha256").update(value).digest("hex");

export function parseCompetitorHtml(html,url){
  const source=String(html),headings=[...source.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match,index)=>({position:index,level:Number(match[1]),text:clean(match[2])})).filter((item)=>item.text);
  const title=clean(source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const canonical=source.match(/<link\b(?=[^>]*\brel=["'][^"']*canonical[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1]??null;
  const body=source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]??source;
  const text=clean(body),origin=new URL(url).origin;
  const links=[...body.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["'][^>]*>/gi)].map((match)=>{try{return new URL(decodeEntities(match[1]),url).href}catch{return null}}).filter(Boolean);
  return {url,title,canonical_url:canonical?new URL(canonical,url).href:null,headings,text,text_length:text.length,text_digest:digest(text),internal_link_count:links.filter((link)=>new URL(link).origin===origin).length,external_link_count:links.filter((link)=>new URL(link).origin!==origin).length};
}

const allowedPos=new Set(["名詞","動詞","形容詞"]),ignoredPosDetail=new Set(["数","非自立","代名詞","接尾"]);
export function contentTerms(parsed,tokenize){
  const headingText=parsed.headings.map((item)=>item.text).join(" "),headingTerms=new Set(tokenize(headingText).filter((token)=>allowedPos.has(token.pos)&&!ignoredPosDetail.has(token.pos_detail_1)).map((token)=>token.basic_form==="*"?token.surface_form:token.basic_form).filter((term)=>term.length>1));
  const counts=new Map();
  for(const token of tokenize(parsed.text)){if(!allowedPos.has(token.pos)||ignoredPosDetail.has(token.pos_detail_1))continue;const term=token.basic_form==="*"?token.surface_form:token.basic_form;if(term.length<=1||/^\d+$/.test(term))continue;counts.set(term,(counts.get(term)??0)+1)}
  return [...counts].map(([term,count])=>({term,count,in_heading:headingTerms.has(term)})).sort((a,b)=>b.count-a.count||a.term.localeCompare(b.term,"ja"));
}

export function aggregateCompetitorTerms(pageEvidence){
  const aggregate=new Map();
  for(const page of pageEvidence)for(const term of page.terms){const row=aggregate.get(term.term)??{term:term.term,page_count:0,total_count:0,heading_page_count:0,weighted_score:0,evidence_urls:[]};row.page_count+=1;row.total_count+=term.count;row.heading_page_count+=Number(term.in_heading);row.weighted_score+=1+Math.log1p(term.count)+(term.in_heading?2:0)+Math.max(0,4-page.best_rank)*.25;row.evidence_urls.push(page.url);aggregate.set(term.term,row)}
  return [...aggregate.values()].sort((a,b)=>b.page_count-a.page_count||b.heading_page_count-a.heading_page_count||b.weighted_score-a.weighted_score||a.term.localeCompare(b.term,"ja"));
}
