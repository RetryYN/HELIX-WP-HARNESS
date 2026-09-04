import assert from "node:assert/strict";
import vm from "node:vm";
import { renderBlindSemanticReview } from "./render-blind-semantic-review.mjs";
const packet = {
  schema_version: "blind-semantic-evaluation.v1", review_mode: "predictions_withheld", dataset_digest: "p", source_dataset_digest: "s",
  cases: [{ case_id: "case-1", left: { keyword: "<script>alert(1)</script>", results: [{ title: "危険", url: "javascript:alert(1)" }] }, right: { keyword: "比較", results: [] }, annotation: { label: null } }],
};
const html = renderBlindSemanticReview(packet);
assert(!html.includes('<script>alert(1)</script>'));
assert(!html.includes('href="javascript:'));
assert(html.includes("connect-src 'none'"));
assert.throws(() => renderBlindSemanticReview({ ...packet, review_mode: "predictions_visible" }));
assert.throws(() => renderBlindSemanticReview({ ...packet, cases: [{ ...packet.cases[0], classifier_prediction: {} }] }));
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const values = { '[data-label]': { value: "" }, '[data-rationale]': { value: "" }, '[data-evidence]': { value: "" } };
const reviewer = { value: "" }, status = { textContent: "" };
let onSave, downloaded, clicks = 0;
class LocalURL extends URL { static createObjectURL(blob) { downloaded = blob; return "blob:test"; } static revokeObjectURL() {} }
const context = vm.createContext({
  URL: LocalURL, Blob, setTimeout: (fn) => fn(),
  document: {
    querySelector: (selector) => ({ '#save': { addEventListener: (_, fn) => { onSave = fn; } }, '#reviewer': reviewer, '#status': status })[selector],
    querySelectorAll: () => [{ dataset: { case: "0" }, querySelector: (selector) => values[selector] }],
    createElement: () => ({ click() { clicks += 1; } }),
  },
});
vm.runInContext(script, context);
onSave(); assert.equal(clicks, 0); assert(status.textContent.includes("識別子"));
reviewer.value = "reviewer-1";
onSave(); assert.equal(clicks, 0);
values['[data-label]'].value = "same_article";
onSave(); assert(status.textContent.includes("理由"));
values['[data-rationale]'].value = "対象と目的が一致するため";
onSave(); assert(status.textContent.includes("根拠URL"));
values['[data-evidence]'].value = "javascript:alert(1)";
onSave(); assert.equal(clicks, 0);
values['[data-evidence]'].value = "https://example.test/evidence";
onSave(); assert.equal(clicks, 1);
const result = JSON.parse(await downloaded.text());
assert.equal(result.gold_labels, false);
assert.equal(result.accuracy_claim, "not_evaluated");
assert.equal(result.source_packet_digest, "p");
assert.equal(result.annotations[0].case_id, "case-1");
assert.equal(result.annotations[0].reviewer, "reviewer-1");
values['[data-label]'].value = "insufficient_evidence";
values['[data-evidence]'].value = "";
onSave(); assert.equal(clicks, 2);
console.log("Blind semantic form: escaped evidence, prediction rejection, required rationale/URLs, local annotation export; DOM harness only");
