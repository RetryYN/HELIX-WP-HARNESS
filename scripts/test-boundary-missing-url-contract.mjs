import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";
import {buildKeywordBoundaryOracle} from "./keyword-boundary-oracle.mjs";

const intent={left_task_id:"a",right_task_id:"b",left_group_id:"g",right_group_id:"g",left_keyword:"例A",right_keyword:"例B",current_same_group:true,intent_similarity_score:.1,review_required:true,pair_digest:"a".repeat(64)};
const row=buildKeywordBoundaryOracle([],[intent]).rows[0];
const source=readFileSync(new URL("./keyword-dashboard-db.mjs",import.meta.url),"utf8");
const schema=source.match(/CREATE TABLE keyword_boundary_reviews \([^\n]+\);/)[0];
const db=new DatabaseSync(":memory:");
try{
  // Isolate the production table's null/check contract from unrelated foreign-key tables.
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec(schema);
  const fields=["left_task_id","right_task_id","left_group_id","right_group_id","left_keyword","right_keyword","current_same_group","url_overlap_ratio","shared_url_count","intent_similarity_score","decision","recommended_action","reason_codes_json","policy","review_required","auto_mutation","boundary_digest"];
  const values={...row,current_same_group:1,review_required:1,auto_mutation:0,reason_codes_json:JSON.stringify(row.reason_codes)};
  db.prepare(`INSERT INTO keyword_boundary_reviews (${fields.join(",")}) VALUES (${fields.map(()=>"?").join(",")})`).run(...fields.map(field=>values[field]));
  const stored=db.prepare("SELECT url_overlap_ratio,shared_url_count,decision FROM keyword_boundary_reviews").get();
  assert.equal(stored.url_overlap_ratio,null);
  assert.equal(stored.shared_url_count,null);
  assert.equal(stored.decision,"insufficient_url_evidence_review");
}finally{db.close();}

const bundle=readFileSync(new URL("../docs/prototypes/wp-ops-dashboard/app.js",import.meta.url),"utf8");
const start=bundle.indexOf("strength=isBoundary?"),end=bundle.indexOf(";return`<tr>",start);
assert(start>=0&&end>start);
const expression=bundle.slice(start+"strength=".length,end);
const render=(input)=>vm.runInNewContext(expression,{row:input,isBoundary:true});
assert(render(row).includes("URL 未確認"));
assert(!render(row).includes("URL 0%"));
assert(render({...row,url_overlap_ratio:0,intent_similarity_score:1}).includes("URL 0%"));
assert(render({...row,intent_similarity_score:1}).includes("検索結果傾向スコア 1.000（意味一致率ではありません）"));
console.log("missing URL evidence contract: OK (production SQLite schema and UI strength expression; not full browser integration)");
