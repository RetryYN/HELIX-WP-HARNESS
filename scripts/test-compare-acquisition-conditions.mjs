import assert from "node:assert/strict";
import { acquisitionFields, compareAcquisitionConditions as compare } from "./compare-acquisition-conditions.mjs";
const base = Object.fromEntries(acquisitionFields.map((key) => [key, key]));
assert.equal(compare(base, base).listed_fields_match, true);
for (const field of acquisitionFields) {
  assert.deepEqual(compare(base, { ...base, [field]: "changed" }).differing_fields, [field]);
  for (const value of [null, undefined, ""]) {
    const result = compare(base, { ...base, [field]: value });
    assert.equal(result.listed_fields_match, false);
    assert.deepEqual(result.unknown_fields, [field]);
  }
}
assert.equal(compare({}, {}).listed_fields_match, false);
assert.equal(compare(null, null).listed_fields_match, false);
assert.deepEqual(compare({ ...base, depth: 10 }, { ...base, depth: "10" }).differing_fields, ["depth"]);
assert.equal(compare(base, base).semantic_equivalence_proven, false);
console.log("Acquisition conditions: mismatch, missing, empty and type differences verified");
