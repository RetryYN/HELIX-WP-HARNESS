import assert from "node:assert/strict";
import {buildAcquisitionLifetimeAllocation} from "./acquisition-lifetime-allocation.mjs";

const keyword=(id,tier,volume,sheet="sheet")=>({candidate_digest:id,decision_tier:tier,maximum_retained_search_volume:volume,source_keyword_ids:[id],source_sheets:[sheet],representative_keyword:id,normalized_keyword:id});
const output=buildAcquisitionLifetimeAllocation({keywordPortfolio:{summary:{estimated_unit_cost_usd:.2},candidates:[keyword("boundary","boundary_review_blocker",10),keyword("proposal","group_proposal_evidence",100),keyword("inventory","inventory_discovery",1000)]},remediationPortfolio:{candidates:[{candidate_id:"r",source_task_id:"task",keyword:"seed",remediation_types:["aio","paa"],unit_cost_usd:.1}]},groups:[{id:"g1",main_keyword:"seed"}],lifetimeState:{lifetime_cap_usd:1,committed_cost_usd:.4},previouslyAttemptedTaskIds:["task"]});
assert.equal(output.summary.remaining_before_allocation_usd,.6);
assert.equal(output.summary.selected_plan_cost_usd,.4033);
assert.equal(output.summary.remaining_after_selected_plan_usd,.1967);
assert.equal(output.summary.previous_attempt_review_count,1);
assert.deepEqual(output.rows.filter((row)=>row.allocation_state==="selected_plan_only").map((row)=>row.capability),["keyword_serp_evidence","trend_history","keyword_serp_evidence","news_freshness_context"]);
assert.equal(output.rows.find((row)=>row.capability==="acquisition_remediation").allocation_reason,"previous_attempt_requires_review");
assert.equal(output.rows.find((row)=>row.keywords?.includes("inventory")).allocation_reason,"lifetime_budget_exhausted");
assert(output.rows.every((row)=>row.allocation_digest.length===64&&!row.auto_submission&&!row.external_acquisition_triggered));
assert.equal(output.allocation_plan_digest.length,64);
const stratified=buildAcquisitionLifetimeAllocation({keywordPortfolio:{summary:{estimated_unit_cost_usd:.1},candidates:[keyword("a-high","inventory_discovery",10000,"A"),keyword("a-next","inventory_discovery",9000,"A"),keyword("b-high","inventory_discovery",10,"B"),keyword("b-next","inventory_discovery",1,"B")]},lifetimeState:{lifetime_cap_usd:.3,committed_cost_usd:0},includeProviderResearch:false}),stratifiedSelected=stratified.rows.filter((row)=>row.allocation_state==="selected_plan_only");assert.equal(stratifiedSelected.length,3);assert.equal(stratifiedSelected.filter((row)=>row.coverage_primary_stratum==="B").length,1,"equal-cost P2 allocation must cover each source stratum before taking a second stratum tranche");assert.equal(stratified.policy,"acquisition-lifetime-allocation.v2");assert.equal(stratified.summary.keyword_source_sheet_coverage.length,2);
console.log("acquisition lifetime allocation: OK (global cumulative cap, decision priority, selected/deferred, no submission)");
