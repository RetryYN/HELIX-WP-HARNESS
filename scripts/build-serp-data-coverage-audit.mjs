import {writeFileSync} from "node:fs";
import path from "node:path";
import {auditSerpDataCoverage} from "./audit-serp-data-coverage.mjs";

const output=path.resolve(process.env.SERP_DATA_AUDIT_OUTPUT??"docs/prototypes/wp-ops-dashboard/serp-data-coverage-audit.json"),audit=auditSerpDataCoverage(process.env.SERP_RAW_ROOT?path.resolve(process.env.SERP_RAW_ROOT):undefined);
writeFileSync(output,`${JSON.stringify(audit)}\n`);
console.log(`SERP data coverage audit: ${audit.raw_leaf_field_summary.decision_connected_field_count} decision / ${audit.raw_leaf_field_summary.evidence_only_field_count} evidence-only / ${audit.raw_leaf_field_summary.raw_only_field_count} raw-only leaf fields -> ${output}`);
