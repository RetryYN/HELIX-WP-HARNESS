import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath || beforePath === afterPath) throw new Error("Supply distinct before and after database paths");
const before = new DatabaseSync(beforePath, { readOnly: true });
const after = new DatabaseSync(afterPath, { readOnly: true });
try {
  assert.equal(after.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.deepEqual(after.prepare("PRAGMA foreign_key_check").all(), []);
  const tables = ["sites", "imported_keywords", "keyword_groups", "raw_snapshot_inventory", "raw_snapshot_payloads", "content_generation_candidates"];
  const counts = {};
  for (const table of tables) {
    const count = (db) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
    counts[table] = count(after);
    assert.equal(counts[table], count(before), `${table} count changed`);
  }
  const canonicalRows = (db, table) => db.prepare(`SELECT * FROM ${table}`).all().map((row) => JSON.stringify(row)).sort();
  for (const { name } of before.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%decisions' OR name LIKE '%decision_sets')").all()) {
    assert(/^[a-z_]+$/u.test(name));
    assert.deepEqual(canonicalRows(after, name), canonicalRows(before, name), `${name} changed`);
  }
  const raw = (db) => db.prepare("SELECT task_id,payload_digest,payload_bytes FROM raw_snapshot_payloads ORDER BY task_id").all();
  assert.deepEqual(raw(after), raw(before), "Raw snapshot metadata changed");
  const reviews = after.prepare("SELECT group_id,coverage_rows_json FROM content_semantic_reviews ORDER BY group_id").all();
  assert(reviews.length > 0, "No semantic reviews");
  const oldGroups = before.prepare("SELECT group_id FROM content_semantic_reviews ORDER BY group_id").all().map((row) => row.group_id);
  assert.deepEqual(reviews.map((row) => row.group_id), oldGroups);
  let candidateCount = 0, substringOnlyCount = 0;
  for (const review of reviews) {
    for (const row of JSON.parse(review.coverage_rows_json)) {
      assert.equal(row.mention_matching, "intl_word_boundaries_v1");
      assert.equal(row.semantic_coverage_verified, false);
      assert(Array.isArray(row.substring_only_concepts));
      candidateCount += 1;
      substringOnlyCount += row.substring_only_concepts.length;
    }
  }
  assert(candidateCount > 0, "No semantic candidates verified");
  console.log(JSON.stringify({ counts, semantic_groups: reviews.length, semantic_candidates: candidateCount, substring_only_observations: substringOnlyCount, integrity: "ok", decisions_preserved: true }));
} finally {
  before.close();
  after.close();
}
