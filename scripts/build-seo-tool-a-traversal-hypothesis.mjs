import { readFileSync, writeFileSync } from "node:fs";
import { buildTraversalHypothesis } from "./seo-tool-a-traversal-hypothesis.mjs";

const spec = JSON.parse(
  readFileSync("docs/research/evidence/seo-tool-a-openapi.json", "utf8"),
);
const audit = buildTraversalHypothesis(spec);
const output = "docs/research/seo-tool-a-traversal-hypothesis.json";
writeFileSync(output, `${JSON.stringify(audit, null, 2)}\n`);
console.log(
  `Traversal hypothesis: ${audit.algorithm_hypotheses.length} alternatives, internal algorithm proven=${audit.evidence_boundary.internal_algorithm_proven} -> ${output}`,
);
