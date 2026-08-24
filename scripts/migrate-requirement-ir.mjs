import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;
const digest = (value) => `sha256:${createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex")}`;
const keyed = (rows, key) => Object.fromEntries(rows.map((row) => [row[key], row]));

const legacyIr = readJson("docs/requirements/l3/requirements-ir.json");
const legacyAcceptance = readJson("docs/requirements/l3/acceptance-cases.json");
const legacyTrace = readJson("docs/requirements/l3/traceability.json");

const requirements = keyed(legacyIr.requirements.map((source) => {
  const record = {
    schema_version: "wp-requirement.v2",
    requirement_id: source.id,
    revision: 1,
    kind: source.kind,
    lifecycle_status: source.status,
    statement: source.statement,
    priority: source.priority,
    source_ids: source.source_ids,
    actor_ids: source.actor_ids,
    surface_ids: source.surface_ids,
    primary_system_contract_id: `WP-SC-${source.id.slice(3)}`,
    acceptance_ids: source.acceptance_ids,
    system_test_ids: source.test_ids,
    pending_resolution: source.pending_resolution ?? [],
  };
  return { ...record, semantic_digest: digest(record) };
}), "requirement_id");

const systemContracts = keyed(Object.values(requirements).map((requirement) => {
  const record = {
    schema_version: "wp-system-contract.v1",
    system_contract_id: requirement.primary_system_contract_id,
    revision: 1,
    lifecycle_status: requirement.lifecycle_status,
    requirement_ids: [requirement.requirement_id],
    behavior: requirement.statement,
    acceptance_ids: requirement.acceptance_ids,
    system_test_ids: requirement.system_test_ids,
  };
  return { ...record, semantic_digest: digest(record) };
}), "system_contract_id");

const acceptanceCases = keyed(legacyAcceptance.cases.map((source) => {
  const requirement = requirements[source.requirement_id];
  const record = {
    schema_version: "wp-acceptance-case.v2",
    acceptance_id: source.id,
    revision: 1,
    lifecycle_status: requirement.lifecycle_status,
    system_contract_id: requirement.primary_system_contract_id,
    requirement_id: source.requirement_id,
    polarity: source.polarity,
    oracle: source.oracle,
    system_test_ids: requirement.system_test_ids,
  };
  return { ...record, semantic_digest: digest(record) };
}), "acceptance_id");

const testOwners = new Map();
for (const requirement of Object.values(requirements)) {
  for (const testId of requirement.system_test_ids) {
    const prior = testOwners.get(testId) ?? [];
    prior.push(requirement);
    testOwners.set(testId, prior);
  }
}
const systemTests = keyed([...testOwners].map(([testId, owners]) => {
  const acceptanceIds = [...new Set(owners.flatMap((item) => item.acceptance_ids))];
  const record = {
    schema_version: "wp-system-test.v1",
    system_test_id: testId,
    revision: 1,
    status: "designed_not_implemented",
    system_contract_ids: owners.map((item) => item.primary_system_contract_id),
    acceptance_ids: acceptanceIds,
    scenario: owners.map((item) => item.statement).join(" / "),
    required_evidence: acceptanceIds.map((id) => acceptanceCases[id].oracle),
  };
  return { ...record, semantic_digest: digest(record) };
}), "system_test_id");

const refinementRecords = legacyTrace.relations.map((source, index) => {
  const record = {
    schema_version: "wp-requirement-refinement.v1",
    refinement_contract_id: `WP-RC-${String(index + 1).padStart(3, "0")}`,
    revision: 1,
    lifecycle_status: "draft",
    source_ids: [source.l1, source.l2],
    requirement_ids: source.l3,
    system_test_ids: source.tests,
  };
  return { ...record, semantic_digest: digest(record) };
});
const keywordPolicy = {
  schema_version: "wp-requirement-refinement.v1",
  refinement_contract_id: "WP-RC-PR5-KW-001",
  revision: 1,
  lifecycle_status: "specified",
  source_ids: ["WP-FR-KW-02", "WP-FR-UI-01"],
  requirement_ids: ["WP-FR-KW-02", "WP-FR-UI-01"],
  system_test_ids: ["WP-AT-KW-02", "WP-AT-UI-01"],
  behavior: [
    "raw keywordは監査用に保持し、一覧のmain keywordは正規化済みtokenを語境界付きで表示する",
    "表示treeのroot_source_keyword_idとSERP比較境界context_scope_idを分離する",
    "IT就活文脈と一般就活文脈を別scopeとし、main keyword選定とSERP群数を混線させない",
    "実DFS 100 keywordを処理し64 SERP群、確定63、未確定1、記事ID確定13の再現性をrequired CIで拘束する"
  ],
  acceptance_oracles: [
    "raw 就活ねくたいは一覧で就活 ネクタイ、raw 就活つらいは一覧で就活 つらいと表示される",
    "context:it 84 keywordとcontext:general 16 keywordが別SERP scopeとして処理される",
    "表示treeを単一就活rootへ変更しても64群・確定63・未確定1・記事ID確定13が不変である",
    "topic-0 keyword-4等の架空keywordを実データ検証へ混入させない"
  ]
};
refinementRecords.push({ ...keywordPolicy, semantic_digest: digest(keywordPolicy) });
const refinementContracts = keyed(refinementRecords, "refinement_contract_id");

const shards = [
  ["requirements", requirements],
  ["system_contracts", systemContracts],
  ["acceptance_cases", acceptanceCases],
  ["system_tests", systemTests],
  ["refinement_contracts", refinementContracts],
];
mkdirSync(resolve(root, "requirements-ir"), { recursive: true });
const receipts = [];
for (const [kind, body] of shards) {
  const path = `requirements-ir/${kind}.json`;
  const text = stable(body);
  writeFileSync(resolve(root, path), text);
  receipts.push({ kind, path, count: Object.keys(body).length, digest: digest(text) });
}
const baseline = digest({ initiative_id: legacyIr.initiative_id, source: "pre-canonical-l3-compatibility-snapshot" });
const rootDigest = digest(receipts.map(({ kind, count, digest: shardDigest }) => ({ kind, count, digest: shardDigest })));
writeFileSync(resolve(root, "requirements-ir/manifest.json"), stable({
  schema_version: "helix-requirement-ir.v2",
  authority: "canonical",
  source_authority: "json_stable_id_shards",
  partition: "stable_id_keyed_shards",
  lifecycle: "elicited_not_frozen",
  initiative_id: legacyIr.initiative_id,
  shards: receipts,
  baseline_root_digest: baseline,
  root_digest: rootDigest,
}));
console.log(`migrated requirement IR: ${Object.keys(requirements).length} requirements / ${Object.keys(acceptanceCases).length} acceptance cases / ${Object.keys(systemTests).length} tests`);
