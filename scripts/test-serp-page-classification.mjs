import assert from "node:assert/strict";
import {classifySerpPage,recommendPageType} from "./serp-page-classification.mjs";
const cases=[
  [{url:"https://example.com/report.pdf",title:"調査報告"},"pdf"],
  [{url:"https://www.youtube.com/watch?v=x",title:"解説"},"video"],
  [{url:"https://x.com/example/status/1",title:"投稿"},"social"],
  [{url:"https://example.com/",title:"就活サービス"},"service_top"],
  [{url:"https://example.com/jobs/engineer",title:"求人一覧"},"database"],
  [{url:"https://example.com/column/howto",title:"就活方法を解説"},"article"],
  [{url:"https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q1",title:"質問"},"qa_forum"],
];
for(const [item,expected] of cases)assert.equal(classifySerpPage(item).page_type,expected);
assert.equal(recommendPageType([{rank:1,page_type:"article"},{rank:2,page_type:"article"},{rank:3,page_type:"database"}]),"article");
console.log("SERP page classification: OK");
