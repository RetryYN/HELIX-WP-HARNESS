import assert from "node:assert/strict";
import {buildSerpPresentationIntegrity} from "./serp-presentation-integrity.mjs";

const tasks=[{site_id:"site",group_id:"group",task_id:"task",keyword:"kw",observed_at:"2026-08-28T00:00:00Z"}],base={task_id:"task",rank_absolute:1,page:1,position:"left",attributes:{type:"organic",xpath:"/html/body",is_image:false,is_video:true,is_featured_snippet:false,is_malicious:false,is_web_story:false,amp_version:false,checks:["is_video"]}};
const [verified]=buildSerpPresentationIntegrity(tasks,[base]);assert.equal(verified.integrity_state,"verified");assert.equal(verified.is_video_count,1);assert.equal(verified.is_image_count,0);assert.equal(verified.interpretation_policy,"true_is_observed_format_false_is_not_proof_of_absence");assert.equal(verified.evidence_digest.length,64);
const [broken]=buildSerpPresentationIntegrity(tasks,[{...base,page:2,attributes:{...base.attributes,checks:[]}}]);assert.equal(broken.integrity_state,"review_required");assert.deepEqual(broken.anomalies.map((row)=>row.code),["unexpected_page","check_flag_mismatch"]);assert.equal(broken.auto_mutation,false);
console.log("SERP presentation integrity: OK (positive format evidence, negative non-inference, contract anomaly gate)");
