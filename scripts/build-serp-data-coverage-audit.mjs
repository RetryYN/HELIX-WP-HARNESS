import {writeFileSync} from "node:fs";
import path from "node:path";
import {auditSerpDataCoverage} from "./audit-serp-data-coverage.mjs";

const output=path.resolve(process.env.SERP_DATA_AUDIT_OUTPUT??"docs/prototypes/wp-ops-dashboard/serp-data-coverage-audit.json"),audit=auditSerpDataCoverage(process.env.SERP_RAW_ROOT?path.resolve(process.env.SERP_RAW_ROOT):undefined);
writeFileSync(output,`${JSON.stringify(audit)}\n`);
console.log(`SERP data coverage audit: ${audit.decision_connected.length} decision / ${audit.evidence_only_projected.length} evidence-only / ${audit.projected_but_unclassified.length} unclassified -> ${output}`);
