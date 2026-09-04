import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { auditSerpDbRetention } from "./audit-serp-db-retention.mjs";

const dbPath = process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite";
const artifactPath =
  process.env.SERP_DB_RETENTION_AUDIT_OUTPUT ??
  "docs/prototypes/wp-ops-dashboard/serp-db-retention-audit.json";
assert(existsSync(artifactPath), "DB retention audit artifact must be committed");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
assert.equal(artifact.schema_version, "serp-db-retention-audit.v1");
if (!existsSync(dbPath)) {
  console.log(
    `SERP DB retention audit: portable mode (dashboard DB is not present at ${dbPath}; committed artifact schema verified)`,
  );
  process.exit(0);
}
const audit = auditSerpDbRetention({ dbPath });
assert.equal(audit.raw_files, 110);
assert.equal(audit.raw_tasks, 110);
assert.deepEqual(audit.duplicate_task_ids, []);
assert.equal(audit.database_counts.raw_snapshot_inventory, 110);
assert.equal(audit.database_counts.raw_snapshot_feature_evidence, 300);
assert.equal(audit.database_counts.raw_snapshot_payloads, 110);
assert.equal(audit.database_counts.serp_organic_results, 926);
assert.equal(audit.integrity.task_identity_match, true);
assert.equal(audit.integrity.connected_metadata_match, true);
assert.equal(audit.integrity.organic_row_match, true);
assert.equal(audit.integrity.feature_payload_match, true);
assert.equal(audit.integrity.raw_payload_match, true);
assert.equal(audit.integrity.organic_row_gap_count, 0);
assert.equal(audit.integrity.feature_payload_row_gap_count, 0);
assert.equal(audit.integrity.expected_raw_payload_rows, 110);
assert.equal(audit.integrity.retained_raw_payload_rows, 110);
assert.equal(audit.integrity.raw_payload_row_gap_count, 0);
assert.equal(audit.integrity.raw_payload_digest_mismatch_count, 0);
assert.equal(audit.integrity.raw_payload_orphan_count, 0);
assert.equal(audit.integrity.raw_payload_bytes_mismatch_count, 0);
assert.equal(audit.integrity.feature_payload_value_match, true);
assert.equal(audit.integrity.connected_organic_value_match, true);
assert.equal(audit.integrity.unconnected_organic_value_match, true);
const summary = new Map(audit.scope_summary.map((row) => [row.scope, row]));
assert.equal(summary.get("connected").task_count, 100);
assert.equal(summary.get("unconnected").task_count, 10);
assert.equal(summary.get("connected").not_retained_nonempty_observation_count, 0);
assert.equal(summary.get("unconnected").not_retained_nonempty_observation_count, 0);
const row = (scope, field) =>
  audit.field_rows.find((item) => item.scope === scope && item.field === field);
assert.equal(row("connected", "organic.description").severity, "retained");
assert.equal(row("connected", "organic.cache_url").retention_state, "exact_raw_snapshot_payload");
assert.equal(row("connected", "organic.cache_url").severity, "retained");
assert.equal(row("connected", "organic.cache_url").not_retained_nonempty_observation_count, 0);
assert.equal(row("unconnected", "organic.rank_absolute").retention_state, "exact_inventory_projection");
assert.equal(row("unconnected", "organic.description").retention_state, "exact_raw_snapshot_payload");
assert.equal(row("unconnected", "organic.description").severity, "retained");
assert.equal(row("unconnected", "organic.description").not_retained_nonempty_observation_count, 0);
assert.equal(row("unconnected", "organic.type").retention_state, "exact_raw_snapshot_payload");
assert.equal(row("unconnected", "result.check_url").retention_state, "exact_raw_snapshot_payload");
assert.equal(row("unconnected", "result.check_url").not_retained_nonempty_observation_count, 0);
assert(audit.field_rows.some((item) => item.retention_state === "exact_feature_payload"));
assert(audit.field_rows.some((item) => item.retention_state === "exact_raw_snapshot_payload"));
assert.equal(audit.dropped_field_rows.length, 0);
assert.equal(
  audit.retention_policy.absent_field_semantics,
  "A field absent from a payload is not counted; this audit only classifies observed primitive states.",
);
console.log(
  `SERP DB retention audit: OK (${audit.integrity.retained_raw_payload_rows} verbatim raw payloads; ${summary.get("all").raw_nonempty_observation_count.toLocaleString()} non-empty observations represented)`,
);
