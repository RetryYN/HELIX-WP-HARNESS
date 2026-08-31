import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";

const source = ".helix/keyword-dashboard.sqlite",
  sourceDb = openDashboardDb(source),
  oracle =
    projectDashboard(sourceDb).sites[0]
      .public_source_citation_application_packets;
sourceDb.close();

const root = mkdtempSync(path.join(tmpdir(), "citation-application-review-")),
  dbPath = path.join(root, "dashboard.sqlite"),
  inputPath = path.join(root, "decisions.json"),
  reviewerDigest = createHash("sha256").update("test-editor").digest("hex"),
  payload = {
    schema_version: "citation-application-review-decisions.v1",
    packet_set_digest: oracle.packet_set_digest,
    reviewer_digest: reviewerDigest,
    decisions: [],
  },
  run = (...extra) =>
    spawnSync(
      process.execPath,
      [
        "scripts/import-citation-application-review-decisions.mjs",
        "--file",
        inputPath,
        "--db",
        dbPath,
        ...extra,
      ],
      { encoding: "utf8" },
    );
try {
  copyFileSync(source, dbPath);
  writeFileSync(inputPath, JSON.stringify(payload));
  const dryRun = run();
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(JSON.parse(dryRun.stdout).state, "validated_not_imported");
  let db = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM citation_application_review_decision_sets",
      )
      .get().n,
    0,
  );
  db.close();
  const committed = run("--commit");
  assert.equal(committed.status, 0, committed.stderr);
  assert.equal(JSON.parse(committed.stdout).state, "imported");
  db = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM citation_application_review_decision_sets",
      )
      .get().n,
    1,
  );
  db.close();
  const duplicate = run("--commit");
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /already imported/u);
  console.log(
    "citation application review import: OK (dry-run, explicit commit, duplicate reviewer rejection)",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
