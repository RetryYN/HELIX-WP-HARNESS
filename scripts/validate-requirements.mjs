import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const fail = (message) => { throw new Error(`requirements validation: ${message}`); };
const unique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return seen;
};
const exactKeys = (value, allowed, label) => {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`unknown ${label} property ${key}`);
  for (const key of allowed) if (!(key in value)) fail(`missing ${label} property ${key}`);
};
const requiredFiles = [
  "docs/requirements/authority.md", "docs/requirements/l1/business.md", "docs/requirements/l1/functional.md",
  "docs/requirements/l1/screen.md", "docs/requirements/l1/technical.md", "docs/requirements/l1/nfr.md",
  "docs/requirements/l2/screen-list.md", "docs/requirements/l2/screen-flow.md", "docs/requirements/l2/ui-element.md",
  "docs/requirements/l2/wireframe.md", "docs/test-design/l10-system-acceptance-test-design.md",
  "docs/test-design/l11-user-acceptance-test-design.md", "docs/test-design/l12-operational-value-test-design.md"
];
for (const path of requiredFiles) if (!existsSync(resolve(root, path))) fail(`missing artifact ${path}`);
const projection = readJson("docs/requirements/discovery/candidate-projection.json");
if (projection.canonical !== false) fail("L2 projection must remain non-canonical");
if (projection.compile_status === "completed" && !projection.agreement) fail("compile completed without human agreement");
const events = readFileSync(resolve(root, "docs/requirements/discovery/events.jsonl"), "utf8").trim().split("\n").map((line, index) => {
  try { return JSON.parse(line); } catch { fail(`invalid JSON event line ${index + 1}`); }
});
const eventIds = unique(events.map((event) => event.event_id), "event id");
events.forEach((event, index) => {
  if (event.sequence !== index + 1) fail(`non-contiguous sequence at ${event.event_id}`);
  if (event.initiative_id !== projection.initiative_id) fail(`initiative mismatch at ${event.event_id}`);
});
if (events.length !== projection.event_count || events.at(-1)?.event_id !== projection.event_head) fail("projection event head/count mismatch");
for (const candidate of projection.candidates) {
  for (const source of candidate.source_event_ids) if (!eventIds.has(source)) fail(`unknown event ${source}`);
  if (candidate.state === "frozen") fail(`L2 candidate cannot be frozen: ${candidate.candidate_id}`);
}
const ir = readJson("docs/requirements/l3/requirements-ir.json");
exactKeys(ir, ["schema_version", "initiative_id", "authority", "source_authority", "compile_result", "freeze", "actors", "requirements"], "IR");
if (ir.authority === "canonical" && ir.compile_result !== "completed") fail("canonical IR without completed compile");
if (ir.freeze.g3 === "frozen" && (!projection.agreement || projection.compile_status !== "completed")) fail("G3 freeze without agreement");
const requirementIds = unique(ir.requirements.map((requirement) => requirement.id), "requirement id");
const testIds = new Set();
const acceptanceIds = [];
for (const requirement of ir.requirements) {
  const commonKeys = ["id", "kind", "status", "source_ids", "statement", "priority", "actor_ids", "surface_ids", "acceptance_ids", "test_ids"];
  const conditionalKeys = requirement.surface_ids?.length ? [] : ["non_ui_na"];
  const decisionKeys = requirement.status === "human_decision_required" ? ["pending_resolution"] : [];
  exactKeys(requirement, [...commonKeys, ...conditionalKeys, ...decisionKeys], `requirement ${requirement.id}`);
  if (!requirement.source_ids?.length || !requirement.acceptance_ids?.length || !requirement.test_ids?.length) fail(`incomplete trace fields ${requirement.id}`);
  acceptanceIds.push(...requirement.acceptance_ids); requirement.test_ids.forEach((id) => testIds.add(id));
  if (!requirement.surface_ids?.length && !requirement.non_ui_na) fail(`${requirement.id} has neither surface nor N/A receipt`);
  if (requirement.status === "human_decision_required" && !requirement.pending_resolution?.length) fail(`${requirement.id} lacks pending decisions`);
}
unique(acceptanceIds, "acceptance id");
const acceptance = readJson("docs/requirements/l3/acceptance-cases.json");
const definedAcceptance = unique(acceptance.cases.map((item) => item.id), "defined acceptance id");
for (const id of acceptanceIds) if (!definedAcceptance.has(id)) fail(`undefined acceptance ${id}`);
for (const item of acceptance.cases) {
  exactKeys(item, ["id", "requirement_id", "polarity", "oracle"], `acceptance ${item.id}`);
  if (!requirementIds.has(item.requirement_id)) fail(`acceptance ${item.id} references unknown requirement`);
  const owner = ir.requirements.find((requirement) => requirement.id === item.requirement_id);
  if (!owner.acceptance_ids.includes(item.id)) fail(`acceptance ${item.id} missing from owner`);
  if (!["positive", "negative", "boundary"].includes(item.polarity) || !item.oracle) fail(`invalid acceptance ${item.id}`);
}
const trace = readJson("docs/requirements/l3/traceability.json");
const tracedRequirements = new Set(trace.relations.flatMap((relation) => relation.l3));
const tracedTests = new Set(trace.relations.flatMap((relation) => relation.tests));
for (const id of requirementIds) if (!tracedRequirements.has(id)) fail(`orphan requirement ${id}`);
for (const id of testIds) if (!tracedTests.has(id)) fail(`orphan test ${id}`);
for (const relation of trace.relations) for (const id of relation.l3) if (!requirementIds.has(id)) fail(`unknown requirement ${id}`);
const inventory = readJson("docs/poc/wp-poc-inventory.json");
unique(inventory.evidence.map((item) => item.evidence_id), "PoC evidence id");
for (const item of inventory.evidence) {
  if (!/^[0-9a-f]{64}$/.test(item.sha256)) fail(`invalid PoC digest ${item.evidence_id}`);
  if (!item.finding || !item.adopt?.length || !item.limits?.length) fail(`incomplete PoC disposition ${item.evidence_id}`);
}
console.log(`requirements validation: OK (${events.length} events, ${ir.requirements.length} requirements, ${acceptanceIds.length} acceptance cases, ${testIds.size} tests)`);
