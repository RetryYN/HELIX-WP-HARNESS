import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const keywordPath="artifacts/poc/keyword-workbook-100-live/result.json";
const gscSummaryPath="artifacts/poc/gsc-page-query-7d-summary.json";
assert.ok(existsSync(keywordPath),"100-keyword real DFS result is required");
assert.ok(existsSync(gscSummaryPath),"GSC real-data attestation is required");
const keyword=JSON.parse(readFileSync(keywordPath,"utf8"));
const gsc=JSON.parse(readFileSync(gscSummaryPath,"utf8"));
assert.equal(keyword.tasks.length,100,"real DFS task count");
assert.equal(keyword.article_keyword_groups.length,67,"real SERP group count");
assert.ok(keyword.tasks.every((row)=>row.task_id&&row.response_digest&&row.raw_file),"DFS provenance must be complete");
assert.equal(new Set(keyword.tasks.map((row)=>row.source_keyword_id)).size,100,"source keyword IDs must be unique");
assert.equal(gsc.schema_version,"wp-gsc-page-query-poc-summary.v1");
assert.equal(gsc.articles,59);
assert.equal(gsc.articles_ok+gsc.articles_error,gsc.articles);
assert.equal(gsc.query_rows,318);
assert.match(gsc.local_evidence_tree_sha256,/^[a-f0-9]{64}$/);
console.log("required PoC evidence: OK (DFS 100 real KW / 67 groups, GSC 59 articles / 318 queries)");
