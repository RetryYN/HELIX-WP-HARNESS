import assert from "node:assert/strict";
import { analyzeJapaneseText, assessKeywordAcquisition, matchKeywordGroupToArticles, reconcileArticleAssignments } from "./keyword-article-matching.mjs";

const article=(wp_article_id,title,queries=[])=>({wp_article_id,title,url:`https://example.test/${wp_article_id}`,queries:queries.map((query)=>({query}))});
const grammar=analyzeJapaneseText("IT業界でやりたいこと");
assert.deepEqual(grammar.filter((token)=>token.grammar).map((token)=>token.surface),["で","たい"]);
assert.equal(grammar.find((token)=>token.surface==="やり").lemma,"やる");
const axis=matchKeywordGroupToArticles({id:"axis",main_keyword:"就活の軸it",intent_keywords:["就活の軸 例文 it"]},[
  article(130,"IT業界で成功するための就活の軸とは？ポイントや例文を紹介",["就活の軸 it"]),
  article(195,"文系のIT就活完全ガイド",["it 就活"]),
]);
assert.equal(axis.state,"確定");assert.equal(axis.wp_article_id,130);
const twitter=matchKeywordGroupToArticles({id:"twitter",main_keyword:"就活ツイッター",intent_keywords:[]},[
  article(132,"X（Twitter）を活用した就活成功術",["就活 ツイッター"]),
]);
assert.equal(twitter.state,"確定");assert.equal(twitter.wp_article_id,132);
const conflict=matchKeywordGroupToArticles({id:"jobs",main_keyword:"it 就活 職種",intent_keywords:[]},[
  article(195,"IT就活の企業と職種ガイド"),article(499,"IT業界の就活向け職種一覧"),
]);
assert.equal(conflict.state,"確定");assert.equal(conflict.wp_article_id,195,"the compact main keyword at the title front resolves weaker scattered candidates");
const titleOnly=matchKeywordGroupToArticles({id:"passport",main_keyword:"it パスポート 就活",intent_keywords:[]},[
  article(1112,"ITパスポートは就活に有利？意味ない？就職を有利にする方法"),
]);
assert.equal(titleOnly.state,"確定");assert.equal(titleOnly.wp_article_id,1112,"a unique main keyword near the title start confirms the WP article without a GSC query");
const agent=matchKeywordGroupToArticles({id:"agent",main_keyword:"it 就活エージェント",intent_keywords:[]},[
  article(17,"【2027年最新版】新卒向けIT就活エージェントおすすめ比較ランキング完全ガイド"),
  article(902,"就活エージェントで施工管理は絶対にやめとけ！IT就活の闇を解説"),
]);
assert.equal(agent.state,"確定");assert.equal(agent.wp_article_id,17,"compact main-keyword tokens beat scattered title tokens");
const noSubstring=matchKeywordGroupToArticles({id:"net",main_keyword:"就活ネット",intent_keywords:[]},[
  article(1,"就活でインターネットを活用する方法"),
]);
assert.equal(noSubstring.state,"新規記事候補","token matching must not treat ネット as a substring of インターネット");
const acquisition=assessKeywordAcquisition({id:"g",main_keyword:"it 就活サイト",intent_keywords:["it 就活サイト おすすめ","it 就活サイト 比較"]},[
  {query:"就活サイト it",clicks:2,impressions:20},{query:"IT 就活サイト おすすめ",clicks:1,impressions:10},{query:"IT業界 面接",clicks:0,impressions:4},
]);
assert.equal(acquisition.coverage_rate,2/3);assert.equal(acquisition.targets[0].status,"期待一致","keyword order variants are the same normalized token set");assert.equal(acquisition.unexpected_query_count,1);
assert.equal(assessKeywordAcquisition({id:"x",main_keyword:"就活ツイッター",intent_keywords:[]},[{query:"twitter 就活",clicks:0,impressions:1},{query:"x 就活 アカウント",clicks:1,impressions:10}]).queries[1].keyword_match,"内包一致","broader GSC queries remain visible when an exact query also exists");
const intentSupport=matchKeywordGroupToArticles({id:"sites",main_keyword:"it 就活サイト",intent_keywords:["it 就活サイト おすすめ","it 就活サイト 比較"]},[
  article(10,"IT就活サイトの選び方",["it 就活サイト"]),article(20,"IT就活サイト比較",["it 就活サイト","it 就活サイト 比較"]),
]);
assert.equal(intentSupport.state,"確定");assert.equal(intentSupport.wp_article_id,20,"included keywords disambiguate articles that both acquire the main keyword");
const reconciled=reconcileArticleAssignments([
  {group_id:"with-query",main_keyword:"it 就活",state:"確定",wp_article_id:195,candidates:[{wp_article_id:195,title_score:4,main_title_position:5,query_matches:["it 就活"]}]},
  {group_id:"title-only",main_keyword:"就活 it 企業",state:"確定",wp_article_id:195,candidates:[{wp_article_id:195,title_score:6,main_title_position:3,query_matches:[]}]},
]);
assert.equal(reconciled.find((match)=>match.group_id==="with-query").state,"確定");
assert.equal(reconciled.find((match)=>match.group_id==="title-only").state,"同一記事候補");
console.log("keyword title -> acquired query article matching: OK");
