import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const inventoryPath = "docs/research/seo-tool-a-web-capability-inventory.json",
  outputPath =
    "docs/prototypes/wp-ops-dashboard/seo-tool-a-capability-completion-audit.json",
  attestationPath =
    "docs/prototypes/wp-ops-dashboard/capability-proof-attestation.json",
  inventory = JSON.parse(readFileSync(inventoryPath, "utf8")),
  contractDrift = JSON.parse(
    readFileSync("docs/research/seo-tool-a-public-contract-drift.json", "utf8"),
  ),
  packageJson = JSON.parse(readFileSync("package.json", "utf8")),
  attestation = existsSync(attestationPath)
    ? JSON.parse(readFileSync(attestationPath, "utf8"))
    : null,
  attestationByCapability = new Map(
    (attestation?.capabilities ?? []).map((row) => [row.capability_id, row]),
  );
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fileDigest = (path) =>
  existsSync(path)
    ? createHash("sha256").update(readFileSync(path)).digest("hex")
    : null;
const commandResolution = (command) => {
  const node = command.match(/^node\s+([^\s]+)/u),
    npm = command.match(/^npm run\s+([^\s]+)/u);
  if (node) {
    const target = node[1],
      resolved = existsSync(target);
    return {
      command,
      resolution_kind: "node_script",
      target,
      resolved,
      target_sha256: resolved ? fileDigest(target) : null,
    };
  }
  if (npm) {
    const target = npm[1],
      definition = packageJson.scripts?.[target],
      resolved = typeof definition === "string";
    return {
      command,
      resolution_kind: "package_script",
      target,
      resolved,
      definition_sha256: resolved ? digest(definition) : null,
    };
  }
  return {
    command,
    resolution_kind: "unsupported_command",
    target: null,
    resolved: false,
  };
};
export function assessEvidenceIntegrity(artifacts, commands) {
  const artifactIntegrity = artifacts.map((path) => ({
      path,
      exists: existsSync(path),
      sha256: fileDigest(path),
    })),
    commandIntegrity = commands.map(commandResolution),
    missingArtifactCount = artifactIntegrity.filter(
      (item) => !item.exists,
    ).length,
    unresolvedCommandCount = commandIntegrity.filter(
      (item) => !item.resolved,
    ).length;
  return {
    state:
      missingArtifactCount === 0 && unresolvedCommandCount === 0
        ? "integrity_verified_execution_not_attested"
        : "integrity_failed",
    artifact_count: artifactIntegrity.length,
    missing_artifact_count: missingArtifactCount,
    verification_command_count: commandIntegrity.length,
    unresolved_command_count: unresolvedCommandCount,
    execution_attested: false,
    artifact_integrity: artifactIntegrity,
    command_integrity: commandIntegrity,
  };
}
export function matchesCapabilityAttestation({
  attestation,
  inventoryDigest,
  receipt,
  artifactSetDigest,
  commandSetDigest,
  commandCount,
}) {
  return Boolean(
    attestation?.schema_version === "capability-proof-attestation.v1" &&
    attestation.source_inventory_digest === inventoryDigest &&
    attestation.all_unique_commands_passed &&
    receipt?.all_commands_passed &&
    receipt.artifact_set_digest === artifactSetDigest &&
    receipt.command_set_digest === commandSetDigest &&
    receipt.executed_command_count === commandCount &&
    receipt.passed_command_count === commandCount,
  );
}
const groups = {
  serp: new Set([
    "question_search",
    "lsi_paa",
    "simultaneous_ranking",
    "bulk_keyword_research",
    "seo_difficulty",
    "influx_keywords",
    "influx_pages",
    "competitive_domains",
    "content_search",
    "search_rank",
    "headline",
    "cooccurrence",
  ]),
  corpus: new Set(["suggest", "related_keywords", "synonyms", "associations"]),
  ai: new Set([
    "ai_keyword_proposal",
    "ai_title",
    "ai_heading",
    "ai_body",
    "ai_questions",
    "ai_related_keywords",
  ]),
  site: new Set(["bulk_site_research", "site_search"]),
  qa: new Set(["qa_sites"]),
  provider: new Set(["hashtags", "google_trends", "news", "credit_history"]),
  ui: new Set([
    "quick_search",
    "auxiliary_tools",
    "data_output",
    "bookmarklet",
  ]),
  contract: new Set(["public_api", "mcp"]),
};
const proof = {
  serp: {
    artifacts: [
      "scripts/search-contract-code-mapping-oracle.mjs",
      "scripts/keyword-dashboard-db.mjs",
      "scripts/question-lineage-oracle.mjs",
      "scripts/paa-question-expansion-graph.mjs",
      "scripts/paa-answer-completion-portfolio.mjs",
      "scripts/aio-completion-portfolio.mjs",
      "scripts/acquisition-contract-fulfillment.mjs",
      "scripts/acquisition-remediation-portfolio.mjs",
      "scripts/acquisition-execution-readiness.mjs",
      "scripts/acquisition-approval-manifest.mjs",
      "scripts/acquisition-remediation-evidence.mjs",
      "scripts/acquisition-lifetime-budget.mjs",
      "scripts/acquisition-lifetime-allocation.mjs",
      "scripts/acquisition-lifetime-approval-manifest.mjs",
      "scripts/execute-acquisition-remediation.mjs",
      "scripts/collect-acquisition-remediation.mjs",
      "scripts/demand-occurrence-integrity.mjs",
      "scripts/demand-appearance-history.mjs",
      "scripts/competitive-appearance-history.mjs",
      "scripts/simultaneous-rank-integrity.mjs",
      "scripts/rank-monitor-plan.mjs",
      "scripts/keyword-acquisition-portfolio.mjs",
      "scripts/test-keyword-dashboard-integration.mjs",
      "scripts/audit-serp-data-coverage.mjs",
    ],
    verification: [
      "node scripts/test-search-contract-code-mapping-oracle.mjs",
      "node scripts/test-search-contract-code-mapping-api.mjs",
      "node scripts/test-question-lineage-oracle.mjs",
      "node scripts/test-paa-question-expansion-graph.mjs",
      "node scripts/test-paa-question-expansion-api.mjs",
      "node scripts/test-paa-answer-completion-portfolio.mjs",
      "node scripts/test-paa-answer-completion-api.mjs",
      "node scripts/test-aio-completion-portfolio.mjs",
      "node scripts/test-aio-completion-api.mjs",
      "node scripts/test-acquisition-contract-fulfillment.mjs",
      "node scripts/test-acquisition-contract-api.mjs",
      "node scripts/test-acquisition-remediation-portfolio.mjs",
      "node scripts/test-acquisition-remediation-api.mjs",
      "node scripts/test-acquisition-remediation-evidence.mjs",
      "node scripts/test-acquisition-approval-manifest.mjs",
      "node scripts/test-acquisition-approval-manifest-api.mjs",
      "node scripts/test-acquisition-execution-readiness.mjs",
      "node scripts/test-acquisition-execution-readiness-api.mjs",
      "node scripts/test-demand-occurrence-integrity.mjs",
      "node scripts/test-demand-appearance-history.mjs",
      "node scripts/test-demand-appearance-history-api.mjs",
      "node scripts/test-competitive-appearance-history.mjs",
      "node scripts/test-competitive-appearance-history-api.mjs",
      "node scripts/test-acquisition-lifetime-budget.mjs",
      "node scripts/test-acquisition-lifetime-allocation.mjs",
      "node scripts/test-acquisition-lifetime-allocation-api.mjs",
      "node scripts/test-acquisition-lifetime-approval-manifest.mjs",
      "node scripts/test-acquisition-lifetime-approval-manifest-api.mjs",
      "node scripts/test-simultaneous-rank-integrity.mjs",
      "node scripts/test-rank-monitor-plan.mjs",
      "node scripts/test-rank-monitor-plan-api.mjs",
      "node scripts/test-keyword-acquisition-portfolio.mjs",
      "node scripts/test-keyword-acquisition-portfolio-api.mjs",
      "npm run prototype:keyword-dashboard:test",
      "node scripts/test-serp-data-coverage.mjs",
    ],
  },
  corpus: {
    artifacts: [
      "scripts/content-semantic-coverage-review.mjs",
      "scripts/graph-related-keyword-query.mjs",
      "scripts/public-semantic-graph.mjs",
      "scripts/public-semantic-graph-query.mjs",
      "docs/research/public-lexical-corpus/semantic-source-manifest.json",
      "scripts/public-synonym-evidence.mjs",
      "docs/research/public-lexical-corpus/source-manifest.json",
      "docs/research/public-lexical-corpus/LICENSE-JAPANESE-WORDNET",
      "scripts/keyword-dashboard-db.mjs",
      "scripts/keyword-dashboard-api.mjs",
      "scripts/keyword-dashboard-mcp.mjs",
      "scripts/keyword-lineage-ledger.mjs",
      "scripts/related-keyword-boundary-oracle.mjs",
      "scripts/suggest-evidence-oracle.mjs",
      "scripts/variant-evidence-oracle.mjs",
      "scripts/semantic-candidate-review.mjs",
      "scripts/association-evidence-oracle.mjs",
      "docs/prototypes/wp-ops-dashboard/app.js",
      "scripts/test-keyword-dashboard-integration.mjs",
    ],
    verification: [
      "node scripts/test-content-semantic-coverage-review.mjs",
      "node scripts/test-content-semantic-coverage-api.mjs",
      "node scripts/test-graph-related-keyword-query.mjs",
      "node scripts/test-graph-related-keyword-api.mjs",
      "node scripts/test-public-semantic-graph.mjs",
      "node scripts/test-public-semantic-graph-api.mjs",
      "node scripts/test-public-synonym-evidence.mjs",
      "node scripts/test-public-synonym-evidence-api.mjs",
      "node scripts/test-keyword-lineage-ledger.mjs",
      "node scripts/test-related-keyword-boundary-oracle.mjs",
      "node scripts/test-suggest-evidence-oracle.mjs",
      "node scripts/test-variant-evidence-oracle.mjs",
      "node scripts/test-semantic-candidate-review.mjs",
      "node scripts/test-association-evidence-oracle.mjs",
      "npm run prototype:keyword-dashboard:test",
    ],
  },
  ai: {
    artifacts: [
      "docs/prototypes/wp-ops-dashboard/public-source-review-export.mjs",
      "scripts/public-source-review-ledger.mjs",
      "scripts/import-public-source-review-decisions.mjs",
      "docs/prototypes/wp-ops-dashboard/evidence-safe-revision-export.mjs",
      "scripts/evidence-safe-manual-revision-packets.mjs",
      "scripts/evidence-safe-draft-revisions.mjs",
      "scripts/import-evidence-safe-draft-revision-decisions.mjs",
      "scripts/content-semantic-coverage-review.mjs",
      "scripts/generation-challenger-manifest.mjs",
      "scripts/generation-challenger-result-contract.mjs",
      "scripts/content-rich-block-plan.mjs",
      "scripts/paid-test-budget-scenarios.mjs",
      "scripts/generation-execution-manifest.mjs",
      "scripts/generation-provenance-ledger.mjs",
      "scripts/content-topic-proposals.mjs",
      "scripts/content-generation-review.mjs",
      "scripts/content-task-holdout-oracle.mjs",
      "scripts/content-editorial-review-packet.mjs",
      "scripts/title-serp-pattern-oracle.mjs",
      "scripts/title-repair-oracle.mjs",
      "scripts/heading-serp-pattern-oracle.mjs",
      "scripts/heading-repair-oracle.mjs",
      "scripts/content-demand-stability.mjs",
      "scripts/content-competitive-stability.mjs",
      "scripts/content-evidence-ensemble-selection.mjs",
      "scripts/content-selection-delta-explanations.mjs",
      "scripts/content-readiness-oracle.mjs",
      "scripts/claim-verification-queue.mjs",
      "scripts/claim-discovery-portfolio.mjs",
      "scripts/content-draft-package.mjs",
      "scripts/ai-question-candidates.mjs",
      "scripts/test-keyword-dashboard-integration.mjs",
    ],
    verification: [
      "node scripts/test-public-source-review-ledger.mjs",
      "node scripts/test-public-source-review-ui-export.mjs",
      "node scripts/test-public-source-review-import.mjs",
      "node scripts/test-public-source-review-api.mjs",
      "node scripts/test-public-source-citation-application-packets.mjs",
      "node scripts/test-public-source-citation-application-api.mjs",
      "node scripts/test-dashboard-split-sidebar.mjs",
      "node scripts/test-evidence-safe-revision-ui-export.mjs",
      "node scripts/test-evidence-safe-manual-revision-packets.mjs",
      "node scripts/test-evidence-safe-manual-revision-packets-api.mjs",
      "node scripts/test-evidence-safe-draft-revisions.mjs",
      "node scripts/test-evidence-safe-draft-revisions-api.mjs",
      "node scripts/test-evidence-safe-draft-revision-import.mjs",
      "node scripts/test-content-semantic-coverage-review.mjs",
      "node scripts/test-content-semantic-coverage-api.mjs",
      "npm run prototype:generation-challenger-manifest:test",
      "npm run prototype:generation-challenger-manifest:api:test",
      "npm run prototype:generation-challenger-result:test",
      "npm run prototype:content-rich-block-plan:test",
      "npm run prototype:content-rich-block-plan:api:test",
      "npm run prototype:paid-test-budget-scenarios:test",
      "npm run prototype:paid-test-budget-scenarios:api:test",
      "npm run prototype:generation-execution-manifest:test",
      "npm run prototype:generation-execution-manifest:api:test",
      "npm run prototype:generation-provenance:test",
      "npm run prototype:generation-provenance:api:test",
      "npm run prototype:content-task-holdout:test",
      "npm run prototype:content-editorial-review:test",
      "node scripts/test-title-serp-pattern-oracle.mjs",
      "node scripts/test-title-repair-oracle.mjs",
      "node scripts/test-title-repair-api.mjs",
      "node scripts/test-heading-serp-pattern-oracle.mjs",
      "node scripts/test-heading-repair-oracle.mjs",
      "node scripts/test-heading-repair-api.mjs",
      "node scripts/test-content-demand-stability.mjs",
      "node scripts/test-content-demand-stability-api.mjs",
      "node scripts/test-content-competitive-stability.mjs",
      "node scripts/test-content-competitive-stability-api.mjs",
      "node scripts/test-content-evidence-ensemble-selection.mjs",
      "node scripts/test-content-evidence-ensemble-selection-api.mjs",
      "node scripts/test-content-selection-delta-explanations.mjs",
      "node scripts/test-content-selection-delta-explanations-api.mjs",
      "node scripts/test-content-readiness-oracle.mjs",
      "node scripts/test-content-readiness-api.mjs",
      "node scripts/test-claim-verification-queue.mjs",
      "node scripts/test-claim-verification-api.mjs",
      "node scripts/test-claim-discovery-portfolio.mjs",
      "node scripts/test-claim-discovery-api.mjs",
      "npm run prototype:ai-questions:test",
      "npm run prototype:keyword-dashboard:test",
    ],
  },
  site: {
    artifacts: [
      "scripts/keyword-dashboard-db.mjs",
      "scripts/keyword-dashboard-api.mjs",
      "docs/prototypes/wp-ops-dashboard/app.js",
    ],
    verification: [
      "npm run prototype:research-api:test",
      "npm run prototype:keyword-dashboard:test",
    ],
  },
  qa: {
    artifacts: [
      "scripts/retained-qa-site-evidence.mjs",
      "scripts/qa-appearance-history.mjs",
      "scripts/qa-copy-export.mjs",
      "scripts/keyword-dashboard-db.mjs",
      "scripts/keyword-dashboard-api.mjs",
      "scripts/keyword-dashboard-mcp.mjs",
      "docs/prototypes/wp-ops-dashboard/index.html",
      "docs/prototypes/wp-ops-dashboard/app.js",
    ],
    verification: [
      "node scripts/test-retained-qa-site-evidence.mjs",
      "node scripts/test-qa-appearance-history.mjs",
      "node scripts/test-qa-copy-export.mjs",
      "node scripts/test-retained-qa-site-evidence-api.mjs",
      "npm run prototype:keyword-dashboard:test",
    ],
  },
  provider: {
    artifacts: [
      "scripts/provider-acquisition-plan.mjs",
      "scripts/acquisition-lifetime-allocation.mjs",
      "scripts/acquisition-lifetime-approval-manifest.mjs",
      "docs/prototypes/wp-ops-dashboard/provider-acquisition-plan.json",
      "scripts/test-provider-acquisition-plan.mjs",
    ],
    verification: [
      "npm run provider:acquisition-plan:test",
      "node scripts/test-acquisition-lifetime-allocation.mjs",
      "node scripts/test-acquisition-lifetime-allocation-api.mjs",
      "node scripts/test-acquisition-lifetime-approval-manifest.mjs",
      "node scripts/test-acquisition-lifetime-approval-manifest-api.mjs",
    ],
  },
  ui: {
    artifacts: [
      "docs/prototypes/wp-ops-dashboard/app.js",
      "docs/prototypes/wp-ops-dashboard/index.html",
      "docs/prototypes/wp-ops-dashboard/dashboard-table-state.mjs",
      "scripts/test-dashboard-table-state.mjs",
      "scripts/test-keyword-dashboard-integration.mjs",
    ],
    verification: [
      "npm run prototype:table-state:test",
      "npm run prototype:keyword-dashboard:test",
    ],
  },
  contract: {
    artifacts: [
      "scripts/public-search-metadata.mjs",
      "docs/research/evidence/public-search-metadata.json",
      "docs/research/evidence/public-search-country-metadata.json",
      "scripts/public-api-credit-estimator.mjs",
      "scripts/public-api-operation-graph.mjs",
      "docs/research/public-api-operation-graph.json",
      "scripts/public-api-retention-matrix.mjs",
      "docs/research/public-api-retention-matrix.json",
      "scripts/provider-provenance-hypothesis.mjs",
      "docs/research/provider-provenance-hypothesis.json",
      "scripts/keyword-dashboard-api.mjs",
      "scripts/keyword-dashboard-mcp.mjs",
      "scripts/seo-action-queue.mjs",
      "scripts/test-keyword-dashboard-api.mjs",
      "scripts/test-keyword-dashboard-mcp.mjs",
    ],
    verification: [
      "node scripts/test-public-search-metadata.mjs",
      "node scripts/test-public-search-metadata-api.mjs",
      "node scripts/test-public-api-credit-estimator.mjs",
      "node scripts/test-public-api-credit-estimator-api.mjs",
      "npm run research:public-operation-graph:test",
      "npm run research:public-retention:test",
      "npm run research:provider-provenance:test",
      "node scripts/test-seo-action-queue-api.mjs",
      "npm run prototype:research-api:test",
      "npm run prototype:mcp:test",
    ],
  },
};
const blockerClasses = (row) => {
  if (row.helix_status === "implemented") return [];
  const ids = new Set();
  if (
    [
      "hashtags",
      "qa_sites",
      "google_trends",
      "news",
      "credit_history",
    ].includes(row.id)
  )
    ids.add("external_provider_or_account_data");
  if (
    groups.serp.has(row.id) ||
    [
      "suggest",
      "related_keywords",
      "synonyms",
      "associations",
      "bulk_site_research",
      "site_search",
    ].includes(row.id)
  )
    ids.add("corpus_or_acquisition_depth");
  if (groups.ai.has(row.id)) ids.add("generation_runtime_or_quality_oracle");
  if (["public_api", "mcp"].includes(row.id))
    ids.add("contract_or_auth_parity");
  if (row.id === "data_output") ids.add("export_and_state_coverage");
  return [...ids];
};
const capabilities = inventory.capabilities.map((row) => {
  const group = Object.entries(groups).find(([, ids]) => ids.has(row.id))?.[0];
  if (!group) throw new Error(`missing audit group: ${row.id}`);
  const blockers = blockerClasses(row),
    artifacts = [...proof[group].artifacts],
    commands = [...proof[group].verification];
  if (row.id === "seo_difficulty") {
    artifacts.unshift(
      "scripts/seo-difficulty-contract.mjs",
      "docs/research/seo-tool-a-public-contract-drift.json",
    );
    commands.unshift(
      "node scripts/test-seo-difficulty-contract.mjs",
      "node scripts/test-public-contract-drift.mjs",
    );
  }
  const assessed = assessEvidenceIntegrity(artifacts, commands),
    artifactSetDigest = digest(assessed.artifact_integrity),
    commandSetDigest = digest(assessed.command_integrity),
    receipt = attestationByCapability.get(row.id),
    executionAttested = matchesCapabilityAttestation({
      attestation,
      inventoryDigest: digest(inventory),
      receipt,
      artifactSetDigest,
      commandSetDigest,
      commandCount: commands.length,
    }),
    evidenceIntegrity = {
      state: assessed.state,
      artifact_count: assessed.artifact_count,
      missing_artifact_count: assessed.missing_artifact_count,
      verification_command_count: assessed.verification_command_count,
      unresolved_command_count: assessed.unresolved_command_count,
      execution_attested: executionAttested,
      artifact_set_digest: artifactSetDigest,
      command_set_digest: commandSetDigest,
      attestation_digest: executionAttested ? receipt.attestation_digest : null,
    },
    integrityProven = evidenceIntegrity.state !== "integrity_failed",
    parityStatus =
      row.helix_status === "implemented" && integrityProven && executionAttested
        ? "proven_complete"
        : "incomplete",
    record = {
      capability_id: row.id,
      name: row.name,
      parity_status: parityStatus,
      helix_status: row.helix_status,
      completion_evidence_state:
        row.helix_status !== "implemented"
          ? "contradicted_by_retained_gap"
          : !integrityProven
            ? "evidence_integrity_failed"
            : executionAttested
              ? "artifact_integrity_and_execution_attested"
              : "execution_attestation_missing_or_stale",
      blocker_classes: !integrityProven
        ? [...new Set([...blockers, "evidence_integrity_failure"])]
        : row.helix_status === "implemented" && !executionAttested
          ? [
              ...new Set([
                ...blockers,
                "execution_attestation_missing_or_stale",
              ]),
            ]
          : blockers,
      remaining_gap: row.gap,
      authoritative_evidence: artifacts,
      verification_commands: commands,
      evidence_integrity: evidenceIntegrity,
    };
  return { ...record, evidence_digest: digest(record) };
});
const summary = {
  capability_count: capabilities.length,
  proven_complete_count: capabilities.filter(
    (row) => row.parity_status === "proven_complete",
  ).length,
  incomplete_count: capabilities.filter(
    (row) => row.parity_status === "incomplete",
  ).length,
  evidence_integrity_pass_count: capabilities.filter(
    (row) => row.evidence_integrity.state !== "integrity_failed",
  ).length,
  evidence_integrity_failure_count: capabilities.filter(
    (row) => row.evidence_integrity.state === "integrity_failed",
  ).length,
  missing_artifact_count: capabilities.reduce(
    (sum, row) => sum + row.evidence_integrity.missing_artifact_count,
    0,
  ),
  unresolved_verification_command_count: capabilities.reduce(
    (sum, row) => sum + row.evidence_integrity.unresolved_command_count,
    0,
  ),
  execution_attested_capability_count: capabilities.filter(
    (row) => row.evidence_integrity.execution_attested,
  ).length,
  blocker_counts: Object.fromEntries(
    [...new Set(capabilities.flatMap((row) => row.blocker_classes))]
      .sort()
      .map((blocker) => [
        blocker,
        capabilities.filter((row) => row.blocker_classes.includes(blocker))
          .length,
      ]),
  ),
};
const artifactCatalog = [
    ...new Set(capabilities.flatMap((row) => row.authoritative_evidence)),
  ]
    .sort()
    .map((path) => ({
      path,
      exists: existsSync(path),
      sha256: fileDigest(path),
    })),
  commandCatalog = [
    ...new Set(capabilities.flatMap((row) => row.verification_commands)),
  ]
    .sort()
    .map(commandResolution),
  evidenceIntegrityCatalog = {
    artifact_count: artifactCatalog.length,
    verification_command_count: commandCatalog.length,
    artifacts: artifactCatalog,
    commands: commandCatalog,
    catalog_digest: digest({
      artifacts: artifactCatalog,
      commands: commandCatalog,
    }),
  };
const publicContractCredits = {
  operation_count: contractDrift.operation_count,
  credit_contract_count: contractDrift.api_credit_contracts.length,
  dynamic_credit_contract_count:
    contractDrift.dynamic_api_credit_contracts.length,
  zero_credit_operation_count: contractDrift.zero_credit_operations.length,
  unclassified_operation_count:
    contractDrift.operation_classification.unclassified_count,
  operation_classification: contractDrift.operation_classification,
  accounting_unit: "provider_credit_not_usd",
  usd_conversion_supported: false,
  web_and_api_separated: true,
  paid_request_executed: contractDrift.paid_request_executed,
  rows: contractDrift.api_credit_contracts.map((row) => ({
    ...row,
    contract_kind: "fixed",
    inventory_credits:
      inventory.capabilities.find((item) => item.id === row.capability_id)
        ?.credits ?? null,
  })),
  dynamic_rows: contractDrift.dynamic_api_credit_contracts.map((row) => ({
    ...row,
    contract_kind: "dynamic",
    inventory_credits:
      inventory.capabilities.find((item) => item.id === row.capability_id)
        ?.credits ?? null,
  })),
};
const proofAttestation = {
  receipt_present: Boolean(attestation),
  schema_valid:
    attestation?.schema_version === "capability-proof-attestation.v1",
  inventory_digest_matches:
    attestation?.source_inventory_digest === digest(inventory),
  all_unique_commands_passed: Boolean(attestation?.all_unique_commands_passed),
  target_capability_count: attestation?.target_capability_count ?? 0,
  unique_command_count: attestation?.unique_command_count ?? 0,
  receipt_digest: attestation?.receipt_digest ?? null,
  external_acquisition_triggered: Boolean(
    attestation?.external_acquisition_triggered,
  ),
  model_execution_triggered: Boolean(attestation?.model_execution_triggered),
  paid_execution_triggered: Boolean(attestation?.paid_execution_triggered),
};
const base = {
    schema_version: "seo-tool-a-capability-completion-audit.v1",
    evidence_cutoff: inventory.evidence_cutoff,
    inventory_digest: digest(inventory),
    completion_claim: "not_proven",
    summary,
    evidence_integrity_catalog: evidenceIntegrityCatalog,
    proof_attestation: proofAttestation,
    public_contract_credits: publicContractCredits,
    capabilities,
  },
  audit = { ...base, audit_digest: digest(base) };
writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(
  `SeoToolA capability audit: ${summary.proven_complete_count}/${summary.capability_count} proven complete, ${summary.incomplete_count} incomplete -> ${outputPath}`,
);
