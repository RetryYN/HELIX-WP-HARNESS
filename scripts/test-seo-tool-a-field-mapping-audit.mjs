import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const audit=JSON.parse(readFileSync("docs/prototypes/wp-ops-dashboard/seo-tool-a-field-mapping-audit.json","utf8"));
const inventory=JSON.parse(readFileSync("docs/research/seo-tool-a-openapi-inventory.json","utf8"));
const app=readFileSync("docs/prototypes/wp-ops-dashboard/app.js","utf8"),html=readFileSync("docs/prototypes/wp-ops-dashboard/index.html","utf8");
assert.equal(audit.schema_version,"seo-tool-a-field-mapping-audit.v2");
assert.equal(audit.field_occurrence_count,inventory.field_count);assert.equal(audit.rows.length,952);
assert.equal(audit.unique_schema_field_path_count,849);assert.equal(audit.duplicate_flattened_occurrence_count,103);
assert.equal(audit.unclassified_count,0);assert.equal(audit.contract_compatible,false);assert.match(audit.audit_digest,/^[a-f0-9]{64}$/);
assert.deepEqual(audit.disposition_counts,{contract_shape_only:448,provider_dataset_not_acquired:168,provider_execution_metadata_not_acquired:31,provider_history_not_acquired:1,provider_metric_not_acquired:21,request_control_not_1to1_supported:171,retained_semantic_mapping:112});
assert.ok(audit.rows.every((row)=>row.field_id.length===64&&row.disposition&&row.reason&&row.roles.length&&row.operations.length));
assert.ok(audit.disposition_counts.retained_semantic_mapping>0);assert.ok(audit.disposition_counts.provider_dataset_not_acquired>0);assert.equal(audit.disposition_counts.response_field_not_1to1_mapped??0,0);
assert.ok(audit.rows.some((row)=>row.field_path.endsWith("searchVolume")&&row.helix_targets.includes("keyword_market_metrics.search_volume")));
assert.ok(audit.rows.some((row)=>row.schema==="MetadataLocationsResponseDto"&&row.field_path==="data.locations[].name"&&row.disposition==="retained_semantic_mapping"&&row.helix_targets.includes("retained_public_search_locations.name")));assert.ok(audit.rows.some((row)=>row.schema==="MetadataLanguagesResponseDto"&&row.field_path==="data.languages[].name"&&row.disposition==="retained_semantic_mapping"));
assert.ok(audit.rows.some((row)=>row.field_path.endsWith("consumedCredit")&&row.disposition==="provider_execution_metadata_not_acquired"));assert.ok(audit.rows.some((row)=>row.field_path.endsWith("estimatedTraffic")&&row.type==="number"&&row.disposition==="provider_metric_not_acquired"));assert.ok(audit.rows.some((row)=>row.field_path.endsWith("firstSeenRange")&&row.disposition==="provider_history_not_acquired"));
assert.match(app,/seo-tool-a-field-mapping-audit\.json/);assert.match(app,/seo-tool-a-field-audit-summary/);assert.match(html,/外部SEOデータfield対応監査/);assert.match(html,/seo-tool-a-field-audit-rows/);
console.log(`SeoToolA field mapping audit: OK (${audit.field_occurrence_count} occurrences, ${audit.unique_schema_field_path_count} unique, zero unclassified, contract parity not claimed)`);
