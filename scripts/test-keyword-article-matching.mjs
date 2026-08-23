import assert from "node:assert/strict";
import { matchKeywordGroupToArticles } from "./keyword-article-matching.mjs";

const article=(wp_article_id,title,queries=[])=>({wp_article_id,title,url:`https://example.test/${wp_article_id}`,queries:queries.map((query)=>({query}))});
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
assert.equal(conflict.state,"競合");assert.equal(conflict.wp_article_id,null);
console.log("keyword title -> acquired query article matching: OK");
