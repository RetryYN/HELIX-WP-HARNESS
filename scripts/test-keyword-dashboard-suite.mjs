import {existsSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";

const workbookPath=path.resolve(process.env.WP_KEYWORD_WORKBOOK??"../poc-wp/data/IT就活大学キーワードマップ.xlsx");
const portableTests=["scripts/test-dashboard-bind-policy.mjs","scripts/test-keyword-dashboard-empty-state.mjs"];
const fullTests=[
  "scripts/test-dashboard-bind-policy.mjs","scripts/test-keyword-dashboard-integration.mjs","scripts/test-cooccurrence-full-api.mjs","scripts/test-domain-competition-api.mjs","scripts/test-headline-analysis-api.mjs","scripts/test-title-analysis-api.mjs","scripts/test-outline-analysis-api.mjs","scripts/test-content-plan-composition-api.mjs","scripts/test-content-evidence-draft-api.mjs","scripts/test-keyword-decision-audit-api.mjs","scripts/test-serp-intent-fingerprint-api.mjs","scripts/test-keyword-boundary-api.mjs","scripts/test-serp-depth-stability-api.mjs","scripts/test-content-topology-api.mjs","scripts/test-content-consolidation-blueprint-api.mjs","scripts/test-serp-brand-analysis-api.mjs","scripts/test-aio-response-state-api.mjs","scripts/test-serp-snapshot-history.mjs","scripts/test-serp-snapshot-history-api.mjs","scripts/test-serp-freshness-api.mjs","scripts/test-serp-presentation-api.mjs","scripts/test-wp-paragraph-structure-api.mjs"
];
const selected=existsSync(workbookPath)?fullTests:portableTests;
if(!existsSync(workbookPath))console.log(`dashboard suite: portable evidence mode (${workbookPath} is intentionally not stored in the public repository; full 10,694-row gate remains local)`);
for(const test of selected){
  const run=spawnSync(process.execPath,[test],{stdio:"inherit",env:process.env});
  if(run.status!==0)process.exit(run.status??1);
}
