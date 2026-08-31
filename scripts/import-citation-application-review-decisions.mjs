import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { projectDashboard } from "./keyword-dashboard-db.mjs";
import { validateCitationApplicationReviewDecisions } from "./public-source-citation-application-review-ledger.mjs";

const args = process.argv.slice(2),
  value = (flag) => {
    const index = args.indexOf(flag);
    return index < 0 ? null : args[index + 1];
  },
  file = value("--file"),
  dbPath = resolve(value("--db") ?? ".helix/keyword-dashboard.sqlite"),
  commit = args.includes("--commit");
if (!file)
  throw new Error(
    "usage: node scripts/import-citation-application-review-decisions.mjs --file decisions.json [--db dashboard.sqlite] [--commit]",
  );
const input = JSON.parse(readFileSync(resolve(file), "utf8")),
  db = new DatabaseSync(dbPath, { readOnly: !commit });
try {
  const data = projectDashboard(db),
    site = data.sites.find(
      (row) =>
        row.public_source_citation_application_packets?.packet_set_digest ===
        input.packet_set_digest,
    );
  if (!site)
    throw new Error(
      "citation application packet set does not match any site in this dashboard",
    );
  const validated = validateCitationApplicationReviewDecisions(
    site.public_source_citation_application_packets,
    input,
  );
  if (!commit)
    console.log(
      JSON.stringify(
        {
          state: "validated_not_imported",
          db_path: dbPath,
          site_id: site.site_id,
          packet_set_digest: validated.packet_set_digest,
          reviewer_digest: validated.reviewer_digest,
          decision_count: validated.decision_count,
          complete: validated.complete,
          decision_set_digest: validated.decision_set_digest,
          artifact_applied: false,
          auto_apply: false,
          auto_publication: false,
        },
        null,
        2,
      ),
    );
  else {
    if (
      db
        .prepare(
          "SELECT 1 FROM citation_application_review_decision_sets WHERE packet_set_digest=? AND reviewer_digest=?",
        )
        .get(validated.packet_set_digest, validated.reviewer_digest)
    )
      throw new Error(
        "reviewer citation-application decision set already imported for this packet set",
      );
    const insertSet = db.prepare(
        "INSERT INTO citation_application_review_decision_sets VALUES (?, ?, ?, ?, ?, ?)",
      ),
      insertDecision = db.prepare(
        "INSERT INTO citation_application_review_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
    db.exec("BEGIN");
    try {
      insertSet.run(
        validated.packet_set_digest,
        validated.reviewer_digest,
        validated.decision_set_digest,
        new Date().toISOString(),
        validated.decision_count,
        Number(validated.complete),
      );
      for (const row of validated.decisions)
        insertDecision.run(
          validated.packet_set_digest,
          row.packet_id,
          row.packet_digest,
          row.group_id,
          row.source_revision_digest,
          row.reviewer_digest,
          row.editorial_state,
          Number(row.placement_lineage_reviewed),
          Number(row.source_decisions_reviewed),
          Number(row.body_unchanged_verified),
          Number(row.no_unsupported_claim_introduced),
          row.reviewed_at,
          row.notes,
          row.decision_digest,
          0,
          0,
          0,
        );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    console.log(
      JSON.stringify(
        {
          state: "imported",
          db_path: dbPath,
          site_id: site.site_id,
          packet_set_digest: validated.packet_set_digest,
          reviewer_digest: validated.reviewer_digest,
          decision_count: validated.decision_count,
          complete: validated.complete,
          artifact_applied: false,
          auto_apply: false,
          auto_publication: false,
        },
        null,
        2,
      ),
    );
  }
} finally {
  db.close();
}
