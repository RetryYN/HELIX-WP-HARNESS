import { normalizeKeyword } from "./keyword-serp-core.mjs";
import kuromoji from "kuromoji";
import { fileURLToPath } from "node:url";

const genericTokens=new Set(["it","就活","新卒","方法"]);
const tokenAlias=(token)=>["x","twitter","ツイッター"].includes(token)?"twitter":token;
const tokenizer=await new Promise((resolve,reject)=>kuromoji.builder({dicPath:fileURLToPath(new URL("../node_modules/kuromoji/dict",import.meta.url))}).build((error,value)=>error?reject(error):resolve(value)));
const grammarParts=new Set(["助詞","助動詞"]);
const ignoredParts=new Set(["記号","フィラー"]);

export function analyzeJapaneseText(value){
  return tokenizer.tokenize(normalizeKeyword(value)).filter((token)=>!ignoredParts.has(token.pos)).map((token,index)=>{
    const surface=tokenAlias(token.surface_form.toLowerCase());
    const lemma=tokenAlias((token.basic_form==="*"?surface:token.basic_form).toLowerCase());
    return{surface,lemma,pos:token.pos,pos_detail:token.pos_detail_1,index,grammar:grammarParts.has(token.pos)};
  });
}

export function tokenizeMatchText(value){
  const content=analyzeJapaneseText(value).filter((token)=>!token.grammar).map((token)=>token.lemma);
  const merged=[];
  for(let index=0;index<content.length;index+=1){
    if(content[index]==="就"&&content[index+1]==="活"){merged.push("就活");index+=1}
    else merged.push(content[index]);
  }
  return merged;
}

export function canonicalMatchText(value){
  return tokenizeMatchText(value).join("");
}

export function distinctiveKeywordCores(keywords){
  return [...new Set(keywords.flatMap((keyword)=>tokenizeMatchText(keyword).filter((token)=>!genericTokens.has(token))))];
}

const titleEvidence=(keyword,titleTokens,{main=false}={})=>{
  const tokens=[...new Set(tokenizeMatchText(keyword))];
  // A main keyword identifies the article only when every meaningful token is
  // present. Dropping generic tokens here made e.g. `IT 就活 エージェント`
  // equivalent to every title containing only `エージェント`.
  const distinctive=tokens.filter((token)=>!genericTokens.has(token));
  const required=main?tokens:(distinctive.length?distinctive:tokens);
  const positions=required.map((token)=>titleTokens.indexOf(token));
  const matches=required.length>0&&positions.every((position)=>position>=0);
  const start=matches?Math.min(...positions):null;
  const end=matches?Math.max(...positions):null;
  const span=matches?end-start+1:null;
  const compact=matches&&span<=required.length+4;
  const leading=main&&compact&&start<=6&&end<=10;
  const chars=required.reduce((sum,token)=>sum+token.length,0);
  // Full main-token matches dominate intent hints. Earlier and more compact
  // occurrences rank higher while still allowing keyword order variants.
  const weight=matches?(main?1000:100)+chars*10-start*3-span*2:0;
  return{keyword,tokens,required,matches,start,end,span,compact,leading,weight};
};

export function matchKeywordGroupToArticles(group,articles){
  const keywords=[group.main_keyword,...group.intent_keywords];
  const candidates=articles.map((article)=>{
    const titleTokens=tokenizeMatchText(article.title);
    const mainEvidence=titleEvidence(group.main_keyword,titleTokens,{main:true});
    const evidence=[mainEvidence,...group.intent_keywords.map((keyword)=>titleEvidence(keyword,titleTokens))].filter((item)=>item.matches);
    const titleMatches=[...new Set(evidence.flatMap((item)=>item.required))];
    const queryMatches=article.queries.filter((query)=>keywords.some((keyword)=>canonicalMatchText(keyword)===canonicalMatchText(query.query)));
    const titleScore=Math.max(0,...evidence.map((item)=>item.weight));
    return {wp_article_id:article.wp_article_id,title:article.title,url:article.url,title_matches:titleMatches,query_matches:queryMatches.map((query)=>query.query),main_title_position:mainEvidence.start,main_title_span:mainEvidence.span,main_title_leading:mainEvidence.leading,title_score:titleScore};
  }).filter((candidate)=>candidate.title_score>0||candidate.query_matches.length>0);
  const queryCandidates=candidates.filter((candidate)=>candidate.query_matches.length>0);
  const bestScore=Math.max(0,...candidates.map((candidate)=>candidate.title_score));
  const titleCandidates=candidates.filter((candidate)=>candidate.title_score===bestScore);
  const leadingCandidates=candidates.filter((candidate)=>candidate.main_title_leading);
  const bestLeadingScore=Math.max(0,...leadingCandidates.map((candidate)=>candidate.title_score));
  const leading=leadingCandidates.filter((candidate)=>candidate.title_score===bestLeadingScore);
  const selected=queryCandidates.length===1?queryCandidates[0]:queryCandidates.length===0&&leading.length===1?leading[0]:null;
  const displayed=selected?[selected]:queryCandidates.length>1?queryCandidates:titleCandidates;
  const state=candidates.length===0?"新規記事候補":selected?"確定":displayed.length===1?"タイトル一致のみ":"複数候補";
  return {group_id:group.id,main_keyword:group.main_keyword,state,wp_article_id:selected?.wp_article_id??null,candidates:displayed};
}

export function reconcileArticleAssignments(matches){
  const reconciled=matches.map((match)=>({...match,candidates:match.candidates.map((candidate)=>({...candidate}))}));
  const byArticle=new Map();
  for(const match of reconciled.filter((item)=>item.state==="確定")){
    if(!byArticle.has(match.wp_article_id))byArticle.set(match.wp_article_id,[]);
    byArticle.get(match.wp_article_id).push(match);
  }
  for(const competing of byArticle.values()){
    if(competing.length<2)continue;
    competing.sort((left,right)=>{
      const candidate=(match)=>match.candidates.find((item)=>item.wp_article_id===match.wp_article_id);
      const l=candidate(left),r=candidate(right);
      return Number(r.query_matches.length>0)-Number(l.query_matches.length>0)||r.title_score-l.title_score||(l.main_title_position??Infinity)-(r.main_title_position??Infinity)||left.group_id.localeCompare(right.group_id);
    });
    for(const duplicate of competing.slice(1)){duplicate.state="同一記事候補";duplicate.wp_article_id=null}
  }
  return reconciled;
}
