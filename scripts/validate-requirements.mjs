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
  "docs/requirements/l3/coverage-gaps.json",
  "docs/requirements/discovery/deferred-requirements.json", "docs/requirements/discovery/s1-acceptance-mapping.json",
  "docs/test-design/l11-user-acceptance-test-design.md", "docs/test-design/l12-operational-value-test-design.md",
  "docs/prototypes/wp-ops-dashboard/index.html", "docs/prototypes/wp-ops-dashboard/styles.css",
  "docs/prototypes/wp-ops-dashboard/app.js", "docs/prototypes/wp-ops-dashboard/prototype-home.png",
  "docs/prototypes/wp-ops-dashboard/prototype-mobile.png"
];
for (const path of requiredFiles) if (!existsSync(resolve(root, path))) fail(`missing artifact ${path}`);
const projection = readJson("docs/requirements/discovery/candidate-projection.json");
if (projection.canonical !== false) fail("L2 projection must remain non-canonical");
if (projection.compile_status === "completed" && !projection.agreement) fail("compile completed without human agreement");
if (!projection.prototype_revision_ids.includes("WP-PROT-UI-02-r3")) fail("current HTML prototype missing from projection");
const events = readFileSync(resolve(root, "docs/requirements/discovery/events.jsonl"), "utf8").trim().split("\n").map((line, index) => {
  try { return JSON.parse(line); } catch { fail(`invalid JSON event line ${index + 1}`); }
});
const eventIds = unique(events.map((event) => event.event_id), "event id");
events.forEach((event, index) => {
  if (event.sequence !== index + 1) fail(`non-contiguous sequence at ${event.event_id}`);
  if (event.initiative_id !== projection.initiative_id) fail(`initiative mismatch at ${event.event_id}`);
});
if (events.length !== projection.event_count || events.at(-1)?.event_id !== projection.event_head) fail("projection event head/count mismatch");
const generatedPrototypeIds = new Set(events.filter((event) => event.event_type === "prototype_generated").map((event) => event.payload?.prototype_id));
const recordedReactionIds = new Set(events.filter((event) => event.event_type === "prototype_reaction_recorded").map((event) => event.payload?.reaction_id));
for (const id of projection.prototype_revision_ids) if (!generatedPrototypeIds.has(id)) fail(`prototype revision lacks generation event ${id}`);
for (const id of projection.reaction_ids) if (!recordedReactionIds.has(id)) fail(`reaction lacks event ${id}`);
for (const id of recordedReactionIds) if (!projection.reaction_ids.includes(id)) fail(`reaction event missing from projection ${id}`);
for (const candidate of projection.candidates) {
  for (const source of candidate.source_event_ids) if (!eventIds.has(source)) fail(`unknown event ${source}`);
  if (candidate.state === "frozen") fail(`L2 candidate cannot be frozen: ${candidate.candidate_id}`);
}
const deferred = readJson("docs/requirements/discovery/deferred-requirements.json");
exactKeys(deferred, ["schema_version", "initiative_id", "authority", "reentry_condition", "requirements"], "deferred requirements");
if (deferred.initiative_id !== projection.initiative_id || deferred.authority !== "l2_backflow_inventory") fail("invalid deferred requirement authority");
const deferredIds = unique(deferred.requirements.map((item) => item.id), "deferred requirement id");
for (const item of deferred.requirements) {
  exactKeys(item, ["id", "candidate_id", "source", "statement", "disposition"], `deferred requirement ${item.id}`);
  if (!projection.candidates.some((candidate) => candidate.candidate_id === item.candidate_id && candidate.requirement_ids.includes(item.id))) fail(`deferred requirement missing from projection ${item.id}`);
  if (item.disposition !== "deferred_until_l3_compile" || !item.source || !item.statement) fail(`invalid deferred requirement ${item.id}`);
}
for (const candidate of projection.candidates) for (const id of candidate.requirement_ids) {
  if (id.startsWith("WP-DEFER-") && !deferredIds.has(id)) fail(`projection references unknown deferred requirement ${id}`);
}
const ir = readJson("docs/requirements/l3/requirements-ir.json");
exactKeys(ir, ["schema_version", "initiative_id", "authority", "source_authority", "compile_result", "freeze", "actors", "requirements"], "IR");
if (ir.authority === "canonical" && ir.compile_result !== "completed") fail("canonical IR without completed compile");
if (ir.freeze.g3 === "frozen" && (!projection.agreement || projection.compile_status !== "completed")) fail("G3 freeze without agreement");
if (ir.compile_result === "not_requested" && ir.requirements.some((requirement) => ["specified", "frozen"].includes(requirement.status))) fail("specified requirement before L3 compile request");
const requirementIds = unique(ir.requirements.map((requirement) => requirement.id), "requirement id");
for (const candidate of projection.candidates) for (const id of candidate.requirement_ids) {
  if (!id.startsWith("WP-DEFER-") && !requirementIds.has(id)) fail(`projection references unknown requirement ${id}`);
}
const l1SourceFiles = [
  "docs/requirements/l1/business.md",
  "docs/requirements/l1/functional.md",
  "docs/requirements/l1/nfr.md",
  "docs/requirements/l1/screen.md",
  "docs/requirements/l1/technical.md",
];
const l1IdPattern = /\bWP-(?:BR|FRL1|NFRL1|TRL1|SCR)-\d{2}\b/g;
const l1Ids = unique(
  l1SourceFiles.flatMap((path) => [...readFileSync(resolve(root, path), "utf8").matchAll(/^\|\s*(WP-(?:BR|FRL1|NFRL1|TRL1|SCR)-\d{2})\s*\|/gm)].map((match) => match[1])),
  "L1 id",
);
const referencedL1Ids = new Set(ir.requirements.flatMap((requirement) => requirement.source_ids).filter((id) => l1Ids.has(id)));
const uncoveredL1Ids = [...l1Ids].filter((id) => !referencedL1Ids.has(id));
const coverageGaps = readJson("docs/requirements/l3/coverage-gaps.json");
exactKeys(coverageGaps, ["schema_version", "initiative_id", "authority", "promotion_policy", "gaps"], "coverage gaps");
if (coverageGaps.initiative_id !== ir.initiative_id || coverageGaps.authority !== "non_canonical_precompile_inventory") fail("invalid coverage gap authority");
const recordedGapIds = unique(coverageGaps.gaps.map((gap) => gap.source_id), "coverage gap source id");
for (const gap of coverageGaps.gaps) {
  exactKeys(gap, ["source_id", "reason", "next_action"], `coverage gap ${gap.source_id}`);
  if (!l1Ids.has(gap.source_id) || !gap.reason || !gap.next_action) fail(`invalid coverage gap ${gap.source_id}`);
}
for (const id of uncoveredL1Ids) if (!recordedGapIds.has(id)) fail(`unrecorded pre-L3 coverage gap ${id}`);
for (const id of recordedGapIds) if (!uncoveredL1Ids.includes(id)) fail(`stale pre-L3 coverage gap ${id}`);
if ((ir.compile_result === "completed" || ir.freeze.g3 === "frozen") && uncoveredL1Ids.length) {
  fail(`L3 promotion has orphan L1 ids: ${uncoveredL1Ids.join(", ")}`);
}
for (const id of ["WP-NFR-SEC-01", "WP-NFR-PRIV-01", "WP-NFR-PERM-01", "WP-NFR-COST-01", "WP-NFR-LEGAL-01", "WP-NFR-OBS-01", "WP-NFR-A11Y-01", "WP-NFR-REC-01", "WP-NFR-CRED-01"]) {
  if (!requirementIds.has(id)) fail(`implicit matrix requirement missing: ${id}`);
}
const testIds = new Set();
const acceptanceIds = [];
for (const requirement of ir.requirements) {
  const commonKeys = ["id", "kind", "status", "source_ids", "statement", "priority", "actor_ids", "surface_ids", "acceptance_ids", "test_ids"];
  const conditionalKeys = requirement.surface_ids?.length ? [] : ["non_ui_na"];
  const decisionKeys = requirement.pending_resolution ? ["pending_resolution"] : [];
  exactKeys(requirement, [...commonKeys, ...conditionalKeys, ...decisionKeys], `requirement ${requirement.id}`);
  if (!requirement.source_ids?.length || !requirement.acceptance_ids?.length || !requirement.test_ids?.length) fail(`incomplete trace fields ${requirement.id}`);
  acceptanceIds.push(...requirement.acceptance_ids); requirement.test_ids.forEach((id) => testIds.add(id));
  if (!requirement.surface_ids?.length && !requirement.non_ui_na) fail(`${requirement.id} has neither surface nor N/A receipt`);
  if (requirement.status === "human_decision_required" && !requirement.pending_resolution?.length) fail(`${requirement.id} lacks pending decisions`);
}
unique(acceptanceIds, "acceptance id");
const acceptance = readJson("docs/requirements/l3/acceptance-cases.json");
exactKeys(acceptance, ["schema_version", "cases"], "acceptance registry");
const definedAcceptance = unique(acceptance.cases.map((item) => item.id), "defined acceptance id");
for (const id of acceptanceIds) if (!definedAcceptance.has(id)) fail(`undefined acceptance ${id}`);
for (const item of acceptance.cases) {
  exactKeys(item, ["id", "requirement_id", "polarity", "oracle"], `acceptance ${item.id}`);
  if (!requirementIds.has(item.requirement_id)) fail(`acceptance ${item.id} references unknown requirement`);
  const owner = ir.requirements.find((requirement) => requirement.id === item.requirement_id);
  if (!owner.acceptance_ids.includes(item.id)) fail(`acceptance ${item.id} missing from owner`);
  if (!["positive", "negative", "boundary"].includes(item.polarity) || !item.oracle) fail(`invalid acceptance ${item.id}`);
}
const s1Mapping = readJson("docs/requirements/discovery/s1-acceptance-mapping.json");
exactKeys(s1Mapping, ["schema_version", "source", "authority", "mappings"], "S1 acceptance mapping");
const s1SourceText = readFileSync(resolve(root, s1Mapping.source), "utf8");
const s1SourceIds = unique(s1SourceText.match(/\bAC-S1-\d{3}\b/g) ?? [], "S1 source acceptance id");
const mappedS1Ids = unique(s1Mapping.mappings.map((item) => item.source_acceptance_id), "mapped S1 acceptance id");
for (const id of s1SourceIds) if (!mappedS1Ids.has(id)) fail(`unmapped S1 acceptance ${id}`);
for (const mapping of s1Mapping.mappings) {
  exactKeys(mapping, ["source_acceptance_id", "candidate_acceptance_ids"], `S1 mapping ${mapping.source_acceptance_id}`);
  if (!s1SourceIds.has(mapping.source_acceptance_id) || !mapping.candidate_acceptance_ids.length) fail(`invalid S1 mapping ${mapping.source_acceptance_id}`);
  for (const id of mapping.candidate_acceptance_ids) if (!definedAcceptance.has(id)) fail(`S1 mapping references unknown acceptance ${id}`);
}
const trace = readJson("docs/requirements/l3/traceability.json");
exactKeys(trace, ["schema_version", "initiative_id", "relations"], "trace registry");
unique(trace.relations.map((relation) => `${relation.l1}\0${relation.l2}`), "trace relation");
const tracedRequirements = new Set(trace.relations.flatMap((relation) => relation.l3));
const tracedTests = new Set(trace.relations.flatMap((relation) => relation.tests));
for (const id of requirementIds) if (!tracedRequirements.has(id)) fail(`orphan requirement ${id}`);
for (const id of testIds) if (!tracedTests.has(id)) fail(`orphan test ${id}`);
for (const relation of trace.relations) {
  exactKeys(relation, ["l1", "l2", "l3", "tests"], `trace ${relation.l1} + ${relation.l2}`);
  if (!l1Ids.has(relation.l1)) fail(`trace references unknown L1 id ${relation.l1}`);
  const expectedRelationTests = new Set(relation.l3.flatMap((id) => ir.requirements.find((requirement) => requirement.id === id)?.test_ids ?? []));
  if (relation.tests.length !== expectedRelationTests.size || relation.tests.some((id) => !expectedRelationTests.has(id))) {
    fail(`trace test mismatch ${relation.l1} + ${relation.l2}`);
  }
  for (const id of relation.l3) {
    if (!requirementIds.has(id)) fail(`unknown requirement ${id}`);
    const owner = ir.requirements.find((requirement) => requirement.id === id);
    if (!owner.source_ids.includes(relation.l1) || !owner.source_ids.includes(relation.l2)) {
      fail(`trace/IR source mismatch ${relation.l1} + ${relation.l2} -> ${id}`);
    }
  }
}
for (const requirement of ir.requirements) {
  const requirementL1Ids = requirement.source_ids.filter((id) => l1Ids.has(id));
  const requirementL2Ids = requirement.source_ids.filter((id) => id.startsWith("WP-CAND-"));
  for (const l1 of requirementL1Ids) {
    const relation = trace.relations.find((item) => item.l1 === l1 && requirementL2Ids.includes(item.l2) && item.l3.includes(requirement.id));
    if (!relation) fail(`IR L1 source missing from trace ${l1} -> ${requirement.id}`);
  }
  for (const l2 of requirementL2Ids) {
    const relation = trace.relations.find((item) => item.l2 === l2 && requirementL1Ids.includes(item.l1) && item.l3.includes(requirement.id));
    if (!relation) fail(`IR L2 source missing from trace ${l2} -> ${requirement.id}`);
  }
}
const inventory = readJson("docs/poc/wp-poc-inventory.json");
unique(inventory.evidence.map((item) => item.evidence_id), "PoC evidence id");
for (const item of inventory.evidence) {
  if (!/^[0-9a-f]{64}$/.test(item.sha256)) fail(`invalid PoC digest ${item.evidence_id}`);
  if (!item.finding || !item.adopt?.length || !item.limits?.length) fail(`incomplete PoC disposition ${item.evidence_id}`);
}
console.log(`requirements validation: OK (${events.length} events, ${ir.requirements.length} requirements, ${acceptanceIds.length} acceptance cases, ${testIds.size} tests, ${uncoveredL1Ids.length} pre-L3 coverage gaps)`);
