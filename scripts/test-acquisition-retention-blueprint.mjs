import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const blueprint=JSON.parse(readFileSync("docs/research/acquisition-retention-blueprint.json","utf8"));
assert.equal(blueprint.schema_version,"acquisition-retention-blueprint.v1");assert.equal(blueprint.field_occurrence_count,952);assert.equal(blueprint.future_covered_count,952);assert.equal(blueprint.future_uncovered_count,0);assert.equal(blueprint.not_acquired_field_count,221);assert.equal(blueprint.credentials_retained,false);assert.equal(blueprint.external_request_executed,false);assert(blueprint.rows.every((row)=>row.row_digest.length===64&&row.future_lossless_targets.length));
console.log("acquisition retention blueprint: OK (952/952 future-covered, 221 not acquired)");
