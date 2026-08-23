import { normalizeKeyword } from "./keyword-serp-core.mjs";
import kuromoji from "kuromoji";
import { fileURLToPath } from "node:url";

const genericTokens=new Set(["it","就活","新卒","方法"]);
const tokenAlias=(token)=>["x","twitter","ツイッター"].includes(token)?"twitter":token;
const tokenizer=await new Promise((resolve,reject)=>kuromoji.builder({dicPath:fileURLToPath(new URL("../node_modules/kuromoji/dict",import.meta.url))}).build((error,value)=>error?reject(error):resolve(value)));
const grammarParts=new Set(["助詞","助動詞"]);
const ignoredParts=new Set(["記号","フィラー"]);
const analysisCache=new Map();
const matchTokenCache=new Map();

export function analyzeJapaneseText(value){
  const normalized=normalizeKeyword(value);
  if(analysisCache.has(normalized))return analysisCache.get(normalized);
  const analyzed=tokenizer.tokenize(normalized).filter((token)=>!ignoredParts.has(token.pos)).map((token,index)=>{
    const surface=tokenAlias(token.surface_form.toLowerCase());
    const lemma=tokenAlias((token.basic_form==="*"?surface:token.basic_form).toLowerCase());
    return{surface,lemma,pos:token.pos,pos_detail:token.pos_detail_1,index,grammar:grammarParts.has(token.pos)};
  });
  analysisCache.set(normalized,analyzed);
  return analyzed;
}

export function tokenizeMatchText(value){
  const normalized=normalizeKeyword(value);
  if(matchTokenCache.has(normalized))return matchTokenCache.get(normalized);
  const content=analyzeJapaneseText(normalized).filter((token)=>!token.grammar).map((token)=>token.lemma);
  const merged=[];
  for(let index=0;index<content.length;index+=1){
    if(content[index]==="就"&&content[index+1]==="活"){merged.push("就活");index+=1}
    else merged.push(content[index]);
  }
  matchTokenCache.set(normalized,merged);
  return merged;
}

export function canonicalMatchText(value){
  return tokenizeMatchText(value).join("");
}

const tokenSet=(value)=>new Set(tokenizeMatchText(value));
const sameTokenSet=(left,right)=>left.size===right.size&&[...left].every((token)=>right.has(token));
const containsTokenSet=(left,right)=>[...right].every((token)=>left.has(token));
const queryKeywordKind=(keyword,query)=>{const expected=tokenSet(keyword),observed=tokenSet(query);if(sameTokenSet(expected,observed))return"期待一致";return Math.min(expected.size,observed.size)>=2&&containsTokenSet(observed,expected)?"内包一致":null};

export function assessKeywordAcquisition(group,queries){
  if(!group)return{state:"施策KW未連携",coverage_rate:null,acquired_keywords:0,planned_keywords:0,matched_query_count:0,unexpected_query_count:queries.length,rewrite_guidance:"先に施策KW群と記事IDを確定",targets:[],queries:queries.map((query)=>({...query,keyword_match:"想定外",matched_keywords:[]}))};
  const planned=[...new Set([group.main_keyword,...group.intent_keywords])];
  const targetRows=planned.map((keyword)=>{
    const matches=queries.map((query)=>{
      // A broader acquired query may contain the planned KW. The reverse does
      // not prove that a modifier such as `比較` or `おすすめ` was acquired.
      const kind=queryKeywordKind(keyword,query.query);
      return kind?{query:query.query,kind,clicks:query.clicks,impressions:query.impressions}:null;
    }).filter(Boolean);
    const exact=matches.filter((match)=>match.kind==="期待一致");
    return{keyword,role:keyword===group.main_keyword?"メインKW":"内包KW",status:exact.length?"期待一致":matches.length?"内包一致":"未獲得",matches};
  });
  const queryRows=queries.map((query)=>{
    const matched=targetRows.map((target)=>({target,match:target.matches.find((match)=>match.query===query.query)})).filter((item)=>item.match);
    const exact=matched.filter((item)=>item.match.kind==="期待一致");
    return{...query,keyword_match:exact.length?"期待一致":matched.length?"内包一致":"想定外",matched_keywords:(exact.length?exact:matched).map((item)=>item.target.keyword)};
  });
  const acquired=targetRows.filter((target)=>target.status!=="未獲得").length;
  const main=targetRows[0];
  const coverage=queries.length&&planned.length?acquired/planned.length:null;
  const state=queries.length===0?"未観測":acquired===planned.length?"全KW獲得":acquired>0?"一部獲得":"未獲得";
  const rewriteGuidance=queries.length===0?"観測待ち":main.status==="未獲得"?"タイトル・主要見出しでメインKWを補強":coverage<0.5?"未獲得KWを見出し・FAQへ補強":acquired===planned.length?"獲得KWを維持し順位・CTRを改善":queryRows.filter((query)=>query.keyword_match==="想定外").reduce((sum,query)=>sum+query.impressions,0)>queryRows.filter((query)=>query.keyword_match!=="想定外").reduce((sum,query)=>sum+query.impressions,0)?"想定外クエリの意図ずれを確認":"未獲得KWを見出し・FAQへ補強";
  return{state,coverage_rate:coverage,acquired_keywords:acquired,planned_keywords:planned.length,matched_query_count:queryRows.filter((query)=>query.keyword_match!=="想定外").length,unexpected_query_count:queryRows.filter((query)=>query.keyword_match==="想定外").length,rewrite_guidance:rewriteGuidance,group_id:group.id,main_keyword:group.main_keyword,targets:targetRows,queries:queryRows};
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
    const queryEvidence=keywords.map((keyword,index)=>{const matches=article.queries.map((query)=>({query:query.query,kind:queryKeywordKind(keyword,query.query)})).filter((item)=>item.kind);return{keyword,main:index===0,matches}}).filter((item)=>item.matches.length);
    const queryMatches=[...new Set(queryEvidence.flatMap((item)=>item.matches.map((match)=>match.query)))];
    const mainQueryExact=queryEvidence.some((item)=>item.main&&item.matches.some((match)=>match.kind==="期待一致"));
    const queryScore=queryEvidence.reduce((score,item)=>score+(item.main?100:0)+(item.matches.some((match)=>match.kind==="期待一致")?20:10),0);
    const titleScore=Math.max(0,...evidence.map((item)=>item.weight))+Math.max(0,evidence.length-1)*20;
    const headingEvidence=(article.headings??[]).map((heading)=>{const tokens=tokenizeMatchText(heading.text);const main=titleEvidence(group.main_keyword,tokens,{main:true});const intents=group.intent_keywords.filter((keyword)=>titleEvidence(keyword,tokens).matches);return{...heading,level:heading.level??2,main:main.matches,intents}});
    const plannedCoverage=keywords.map((keyword)=>{const full=(value)=>titleEvidence(keyword,tokenizeMatchText(value),{main:true}).matches;const layer=full(article.title)?"title":(article.headings??[]).some((heading)=>heading.level===2&&full(heading.text))?"h2":(article.headings??[]).some((heading)=>heading.level===3&&full(heading.text))?"h3":null;return{keyword,role:keyword===group.main_keyword?"main":"intent",layer}});
    const coveredKeywords=plannedCoverage.filter((item)=>item.layer).length;
    const headingLayer=(level,mainBase,intentBase)=>{const rows=headingEvidence.filter((heading)=>heading.level===level),main=rows.filter((heading)=>heading.main),intents=[...new Set(rows.flatMap((heading)=>heading.intents))],eligible=main.length>0||intents.length>=2;return{eligible,score:eligible?(main.length?mainBase:intentBase)+intents.length*30:0}};
    const h2=headingLayer(2,500,200),h3=headingLayer(3,300,100);
    const headingEligible=h2.eligible||h3.eligible;
    const headingScore=h2.score||h3.score;
    const headingMatches=headingEvidence.filter((heading)=>heading.main||heading.intents.length).map(({position,level,text,main,intents})=>({position,level,text,main,intent_keywords:intents}));
    return {wp_article_id:article.wp_article_id,title:article.title,url:article.url,title_matches:titleMatches,query_matches:queryMatches,query_support_keywords:queryEvidence.map((item)=>item.keyword),query_score:queryScore,query_eligible:mainQueryExact||queryEvidence.length>=2,heading_score:headingScore,heading_eligible:headingEligible,h2_score:h2.score,h2_eligible:h2.eligible,h3_score:h3.score,h3_eligible:h3.eligible,heading_matches:headingMatches,planned_keyword_coverage:plannedCoverage,coverage_rate:keywords.length?coveredKeywords/keywords.length:0,covered_keywords:coveredKeywords,planned_keywords:keywords.length,main_keyword_layer:plannedCoverage[0]?.layer??null,main_title_position:mainEvidence.start,main_title_span:mainEvidence.span,main_title_leading:mainEvidence.leading,title_score:titleScore};
  }).filter((candidate)=>candidate.title_score>0||candidate.query_matches.length>0||candidate.heading_eligible);
  const queryCandidates=candidates.filter((candidate)=>candidate.query_eligible);
  const bestQueryScore=Math.max(0,...queryCandidates.map((candidate)=>candidate.query_score));
  const strongestQueryCandidates=queryCandidates.filter((candidate)=>candidate.query_score===bestQueryScore);
  const bestScore=Math.max(0,...candidates.map((candidate)=>candidate.title_score));
  const titleCandidates=candidates.filter((candidate)=>candidate.title_score===bestScore);
  const leadingCandidates=candidates.filter((candidate)=>candidate.main_title_leading);
  const bestLeadingScore=Math.max(0,...leadingCandidates.map((candidate)=>candidate.title_score));
  const leading=leadingCandidates.filter((candidate)=>candidate.title_score===bestLeadingScore);
  const h2Candidates=candidates.filter((candidate)=>candidate.h2_eligible),bestH2Score=Math.max(0,...h2Candidates.map((candidate)=>candidate.h2_score)),strongestH2Candidates=h2Candidates.filter((candidate)=>candidate.h2_score===bestH2Score);
  const h3Candidates=candidates.filter((candidate)=>candidate.h3_eligible),bestH3DisplayScore=Math.max(0,...h3Candidates.map((candidate)=>candidate.h3_score)),strongestH3Display=h3Candidates.filter((candidate)=>candidate.h3_score===bestH3DisplayScore),h3SelectionCandidates=h3Candidates.filter((candidate)=>candidate.title_score>0||candidate.query_eligible||candidate.h2_eligible),bestH3Score=Math.max(0,...h3SelectionCandidates.map((candidate)=>candidate.h3_score)),strongestH3Candidates=h3SelectionCandidates.filter((candidate)=>candidate.h3_score===bestH3Score);
  // PO-defined order: main-keyword title match first, acquired-query support
  // second. Included keywords strengthen/disambiguate but do not override a
  // unique compact main keyword at the title front.
  const selected=leading.length===1?leading[0]:strongestQueryCandidates.length===1?strongestQueryCandidates[0]:strongestH2Candidates.length===1?strongestH2Candidates[0]:strongestH3Candidates.length===1?strongestH3Candidates[0]:null;
  const displayed=selected?[selected]:queryCandidates.length>1?strongestQueryCandidates:h2Candidates.length?strongestH2Candidates:h3Candidates.length?strongestH3Display:titleCandidates;
  const state=candidates.length===0?"新規記事候補":selected?"確定":displayed.length===1&&displayed[0].title_score===0?"見出し一致のみ":displayed.length===1?"タイトル一致のみ":"複数候補";
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
      return Number(r.query_matches.length>0)-Number(l.query_matches.length>0)||r.title_score-l.title_score||r.heading_score-l.heading_score||(l.main_title_position??Infinity)-(r.main_title_position??Infinity)||left.group_id.localeCompare(right.group_id);
    });
    for(const duplicate of competing.slice(1)){duplicate.state="同一記事候補";duplicate.wp_article_id=null}
  }
  return reconciled;
}
