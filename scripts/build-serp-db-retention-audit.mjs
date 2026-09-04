import { writeFileSync } from "node:fs";
import path from "node:path";
import { auditSerpDbRetention } from "./audit-serp-db-retention.mjs";

const output = path.resolve(
  process.env.SERP_DB_RETENTION_AUDIT_OUTPUT ??
    "docs/prototypes/wp-ops-dashboard/serp-db-retention-audit.json",
);
const audit = auditSerpDbRetention({
  dbPath: path.resolve(
    process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite",
  ),
  rawRoots: process.env.SERP_RAW_ROOT
    ? [path.resolve(process.env.SERP_RAW_ROOT)]
    : undefined,
});
writeFileSync(output, `${JSON.stringify(audit)}\n`);
const all = audit.scope_summary.find((row) => row.scope === "all");
console.log(
  `SERP DB retention audit: ${all.not_retained_nonempty_observation_count} non-empty observations not retained / ${all.raw_nonempty_observation_count} observed -> ${output}`,
);
