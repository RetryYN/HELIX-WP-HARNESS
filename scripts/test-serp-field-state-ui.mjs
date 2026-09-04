import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../docs/prototypes/wp-ops-dashboard/",import.meta.url),html=readFileSync(new URL("index.html",root),"utf8"),js=readFileSync(new URL("serp-field-state-audit.js",root),"utf8");
assert.match(html,/serp-field-state-audit-summary/u);
assert.match(html,/serp-field-state-audit-rows/u);
assert.match(html,/serp-field-state-audit\.js/u);
assert.match(html,/payloadに存在しないfieldは未取得かどうかをこの監査だけでは判定しません/u);
assert.match(js,/api\/v1\/serp-field-lineage/u);
assert.match(js,/value_state/u);
assert.match(js,/null_observation_count/u);
assert.match(js,/false_observation_count/u);
assert.match(js,/next_cursor/u);
console.log("SERP field state UI: OK (all observed value states, pagination, and absent-field boundary are visible)");
