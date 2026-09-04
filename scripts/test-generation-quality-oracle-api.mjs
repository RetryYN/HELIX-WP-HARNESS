import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import { routeResearchApi } from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";
import { buildGenerationQualityOracle } from "./generation-quality-oracle.mjs";

const dbPath = process.env.WP_DASHBOARD_DB ?? ".helix/keyword-dashboard.sqlite",
  db = existsSync(dbPath) ? openDashboardDb(dbPath) : null,
  fallbackOracle = buildGenerationQualityOracle({
    candidates: [
      {
        candidate_id: "portable-ready",
        group_id: "portable-group",
        content_type: "title",
        text: "ポータブル検証タイトル",
        evidence_ids: ["portable-evidence"],
        review: {
          review_state: "ready",
          quality_score: 100,
          evidence_count: 1,
          review_digest: "r".repeat(64),
          oracle: { evidence_reference_resolved: true },
          issues: [],
        },
      },
      {
        candidate_id: "portable-blocked",
        group_id: "portable-group",
        content_type: "heading",
        heading_level: 2,
        text: "ポータブル検証見出し",
        review: {
          review_state: "blocked",
          quality_score: 0,
          evidence_count: 0,
          review_digest: "b".repeat(64),
          oracle: { evidence_reference_resolved: false },
          issues: ["evidence_missing"],
        },
      },
    ],
  }),
  data = db
    ? projectDashboard(db)
    : {
        sites: [
          {
            site_id: "portable-site",
            label: "Portable test site",
            domain: "portable.example",
            generation_quality_oracle: fallbackOracle,
          },
        ],
      };
try {
  const site = data.sites[0],
    oracle = site.generation_quality_oracle,
    url = new URL(
      `/api/v1/generation-quality-oracle?site_id=${encodeURIComponent(site.site_id)}&limit=100`,
      "http://localhost",
    ),
    api = routeResearchApi(url.pathname, url, data, db);

  assert.equal(api.status, 200);
  assert(oracle.rows.length > 0);
  assert(oracle.rows.every((row) =>
    row.semantic_coverage.semantic_coverage_verified === false &&
    row.semantic_coverage.measurement === "lexical_mention_coverage" &&
    Array.isArray(row.semantic_coverage.substring_only_concepts),
  ));
  assert.equal(api.body.policy, "generation-quality-oracle.v1");
  assert.equal(api.body.meta.total, oracle.rows.length);
  assert.equal(api.body.summary.candidate_count, oracle.summary.candidate_count);
  assert.equal(
    api.body.summary.blocked_deterministic_gate_count,
    oracle.summary.blocked_deterministic_gate_count,
  );
  assert.equal(api.body.oracle_digest, oracle.oracle_digest);
  assert(api.body.data.length <= 100);
  assert(
    api.body.data.every(
      (row) =>
        /^[a-f0-9]{64}$/u.test(row.quality_digest) &&
        row.human_quality_proven === false &&
        row.semantic_coverage.semantic_coverage_verified === false &&
        row.semantic_coverage.measurement === "lexical_mention_coverage" &&
        Array.isArray(row.semantic_coverage.substring_only_concepts) &&
        row.ranking_effect_inferred === false &&
        row.auto_selection === false &&
        row.auto_content_mutation === false,
    ),
  );
  assert.equal(api.body.provenance.external_acquisition_triggered, false);

  const listed = handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      data,
    ),
    tool = listed.result.tools.find(
      (entry) => entry.name === "audit_generation_quality",
    );
  assert(tool);
  assert.deepEqual(tool.inputSchema.required, ["site_id"]);

  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "audit_generation_quality",
        arguments: {
          site_id: site.site_id,
          state: "blocked_deterministic_gate",
          limit: 10,
        },
      },
    },
    data,
  );
  assert.equal(mcp.result.isError, false);
  assert.equal(
    mcp.result.structuredContent.meta.total,
    oracle.rows.filter(
      (row) => row.review_state === "blocked_deterministic_gate",
    ).length,
  );
  assert.equal(mcp.result.structuredContent.human_quality_proven, false);
  assert(mcp.result.structuredContent.data.every((row) =>
    row.semantic_coverage.semantic_coverage_verified === false &&
    row.semantic_coverage.measurement === "lexical_mention_coverage",
  ));
  assert.equal(
    mcp.result.structuredContent.provenance.external_acquisition_triggered,
    false,
  );
  console.log(
    `generation quality oracle API/MCP: OK (${oracle.rows.length} candidates, ${oracle.summary.blocked_deterministic_gate_count} deterministic blocks, ${db ? "live DB" : "portable fixture"}, human/ranking claims remain false)`,
  );
} finally {
  db?.close();
}
