import assert from "node:assert/strict";
import { buildGenerationExecutionManifest } from "./generation-execution-manifest.mjs";
const input = {
  main_keyword: "検証", title: "検証の手順", title_candidate_id: "t",
  instruction: "観測根拠だけを使用する",
  headings: [{ candidate_id: "h", text: "準備する項目", level: 2, evidence_ids: ["e"], parent_candidate_id: null }],
  topic_proposal_ids: ["p"],
  citation_candidates: [{ citation_id: "c", title: "一次資料の候補", url: "https://example.test/source", approval_state: "unreviewed" }],
  serp_action_signals: [{ task_id: "task", evidence: [{ text: "保持した観測" }] }],
};
const build = (draftInput) => buildGenerationExecutionManifest({ siteId: "s", structures: [{ group_id: "g", draft_package: { package_version: "fixture", input_digest: "i", package_digest: "p", input: draftInput } }] }).requests[0];
const request = build(input);
assert.deepEqual(request.input.draft_input, input);
assert.equal(request.input.draft_input.citation_candidates[0].approval_state, "unreviewed");
assert.equal(request.execution_authorized, false);
const longer = build({ ...input, title: input.title.repeat(1000) });
assert(longer.token_ceiling.maximum_input_tokens > request.token_ceiling.maximum_input_tokens);
assert.notEqual(longer.request_digest, request.request_digest);
request.input.draft_input.headings[0].text = "変更";
assert.equal(input.headings[0].text, "準備する項目");
console.log("Generation manifest: full retained briefing preserved, included in estimate/digest, isolated from source; citations remain unapproved");
