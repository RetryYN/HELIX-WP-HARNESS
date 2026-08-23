import { normalizeKeyword } from "./keyword-serp-core.mjs";

const genericTerms=["就活","新卒","向け","とは","方法"];
const aliases=[[/x(?:twitter)?|twitter|ツイッター/g,"twitter"],[/ｉｔ/g,"it"]];

export function canonicalMatchText(value){
  let text=normalizeKeyword(value).replace(/[\s\p{P}\p{S}]+/gu,"");
  for(const [pattern,replacement] of aliases)text=text.replace(pattern,replacement);
  return text;
}

export function distinctiveKeywordCores(keywords){
  const cores=new Set();
  for(const keyword of keywords){
    const canonical=canonicalMatchText(keyword);
    if(canonical.length>=4)cores.add(canonical);
    let distinctive=canonical.replace(/^it|it$/g,"");
    for(const term of genericTerms)distinctive=distinctive.replaceAll(term,"");
    if(distinctive.length>=2)cores.add(distinctive);
  }
  return [...cores];
}

export function matchKeywordGroupToArticles(group,articles){
  const keywords=[group.main_keyword,...group.intent_keywords];
  const cores=distinctiveKeywordCores(keywords);
  const candidates=articles.map((article)=>{
    const title=canonicalMatchText(article.title);
    const titleMatches=cores.filter((core)=>title.includes(core));
    const queryMatches=article.queries.filter((query)=>keywords.some((keyword)=>canonicalMatchText(keyword)===canonicalMatchText(query.query)));
    return {wp_article_id:article.wp_article_id,title:article.title,url:article.url,title_matches:titleMatches,query_matches:queryMatches.map((query)=>query.query),title_score:titleMatches.reduce((score,core)=>Math.max(score,core.length),0)};
  }).filter((candidate)=>candidate.title_score>0);
  const bestScore=Math.max(0,...candidates.map((candidate)=>candidate.title_score));
  const titleCandidates=candidates.filter((candidate)=>candidate.title_score===bestScore);
  const confirmed=titleCandidates.filter((candidate)=>candidate.query_matches.length>0);
  const state=titleCandidates.length===0?"新規記事候補":confirmed.length===1?"確定":titleCandidates.length===1?"タイトル一致のみ":"複数候補";
  return {group_id:group.id,main_keyword:group.main_keyword,state,wp_article_id:state==="確定"?confirmed[0].wp_article_id:null,candidates:titleCandidates};
}
