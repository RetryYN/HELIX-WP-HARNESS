import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTraversalHypothesis } from "./seo-tool-a-traversal-hypothesis.mjs";

const spec = JSON.parse(
    readFileSync("docs/research/evidence/seo-tool-a-openapi.json", "utf8"),
  ),
  audit = buildTraversalHypothesis(spec),
  stored = JSON.parse(
    readFileSync("docs/research/seo-tool-a-traversal-hypothesis.json", "utf8"),
  );
assert.equal(audit.schema_version, "seo-tool-a-traversal-hypothesis.v1");
assert.equal(audit.source.operation_id, "OtherKeywordsController_search");
assert.equal(audit.source.document_version, "1.16.0");
assert.equal(audit.contract_signals.length, 6);
assert(
  audit.contract_signals
    .filter((row) => row.id !== "stack_or_queue_order")
    .every((row) => row.observed === true),
);
assert.equal(
  audit.contract_signals.find((row) => row.id === "stack_or_queue_order").observed,
  false,
);
assert.deepEqual(
  audit.algorithm_hypotheses.map((row) => row.id),
  ["depth_first", "breadth_first", "bounded_occurrence_aggregation"],
);
assert.equal(audit.algorithm_hypotheses[0].confidence, "possible_not_proven");
assert.equal(audit.algorithm_hypotheses[1].confidence, "possible_not_proven");
assert.equal(
  audit.algorithm_hypotheses[2].confidence,
  "contract_level_only",
);
assert.equal(audit.evidence_boundary.internal_algorithm_proven, false);
assert.equal(audit.evidence_boundary.external_request_executed, false);
assert.equal(audit.evidence_boundary.paid_request_executed, false);
assert.equal(audit.evidence_boundary.automatic_group_assignment, false);
assert.equal(audit.evidence_boundary.automatic_content_mutation, false);
assert.equal(audit.downstream_mappings.length, 3);
assert(audit.downstream_mappings.every((row) => row.automatic_mutation === false));
assert.equal(
  audit.identifiability_proof.identifiability_state,
  "not_identifiable_from_public_projection",
);
assert.equal(audit.identifiability_proof.trace_order_differs, true);
assert.equal(audit.identifiability_proof.public_projection.equal, true);
assert.notDeepEqual(
  audit.identifiability_proof.traces.depth_first,
  audit.identifiability_proof.traces.breadth_first,
);
assert.equal(audit.identifiability_proof.external_request_executed, false);
assert.equal(audit.identifiability_proof.paid_request_executed, false);
assert.equal(audit.identifiability_proof.automatic_mutation, false);
assert.equal(stored.audit_digest, audit.audit_digest);
console.log(
  "SeoToolA traversal hypothesis: OK (bounded recursion explicit, DFS/BFS unresolved, occurrence aggregation mapped, no internal/provider claim)",
);
