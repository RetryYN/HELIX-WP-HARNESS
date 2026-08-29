import {readFileSync,writeFileSync} from "node:fs";
import {buildAcquisitionRetentionBlueprint} from "./acquisition-retention-blueprint.mjs";
const source="docs/prototypes/wp-ops-dashboard/seo-tool-a-field-mapping-audit.json",output="docs/research/acquisition-retention-blueprint.json";
const blueprint=buildAcquisitionRetentionBlueprint(JSON.parse(readFileSync(source,"utf8")));
writeFileSync(output,`${JSON.stringify(blueprint,null,2)}\n`);
console.log(`Acquisition retention blueprint: ${blueprint.future_covered_count}/${blueprint.field_occurrence_count} future-covered -> ${output}`);

