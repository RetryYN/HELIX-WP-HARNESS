import assert from "node:assert/strict";
import { openDashboardDb, projectDashboard } from "./keyword-dashboard-db.mjs";
import {
  routeResearchApi,
  researchOpenApi,
  setResearchDb,
} from "./keyword-dashboard-api.mjs";
import { handleMcpMessage } from "./keyword-dashboard-mcp.mjs";

const db = openDashboardDb(".helix/keyword-dashboard.sqlite");
try {
  assert.equal(
    Number(
      db.prepare("SELECT COUNT(*) count FROM public_semantic_sources").get()
        .count,
    ),
    1,
  );
  assert.equal(
    Number(
      db.prepare("SELECT COUNT(*) count FROM public_semantic_senses").get()
        .count,
    ),
    158058,
  );
  assert.equal(
    Number(
      db.prepare("SELECT COUNT(*) count FROM public_semantic_definitions").get()
        .count,
    ),
    57238,
  );
  assert.equal(
    Number(
      db.prepare("SELECT COUNT(*) count FROM public_semantic_relations").get()
        .count,
    ),
    115295,
  );
  const data = projectDashboard(db),
    site = data.sites.find(
      (row) => row.public_semantic_graph?.summary.relation_count === 115295,
    );
  assert(site);
  assert.equal(
    site.public_semantic_graph.summary.site_corpus_matched_term_count,
    425,
  );
  const url = new URL(
      `/api/v1/public-semantic-graph?site_id=${site.site_id}&q=${encodeURIComponent("トラブル")}&depth=2&limit=100`,
      "http://localhost",
    ),
    response = routeResearchApi(url.pathname, url, data, db);
  assert.equal(researchOpenApi.info.version, "2.115.0");
  assert.equal(response.status, 200);
  assert.equal(response.body.summary.query_match_state, "exact");
  assert.equal(response.body.summary.seed_sense_count, 4);
  assert(response.body.meta.total > 100);
  assert.equal(response.body.data.length, 100);
  assert(response.body.data.some((row) => row.depth === 2));
  assert(
    response.body.data.every(
      (row) =>
        row.path_synsets.length === row.depth + 1 &&
        row.path_relation_ids.length === row.depth &&
        row.semantic_relation_only &&
        !row.synonymy_inferred &&
        !row.search_demand_inferred &&
        !row.ranking_effect_inferred &&
        !row.auto_mutation,
    ),
  );
  assert(
    response.body.data.some(
      (row) =>
        row.traversal_direction === "incoming" &&
        row.traversal_relation_type !== row.canonical_relation_type,
    ),
  );
  assert.equal(
    response.body.source.relation_file_sha256,
    "7643604773d71af613e0f45e994d6c2a7cd9c493ede21b857409e342ee259f93",
  );
  assert.equal(response.body.provenance.external_acquisition_triggered, false);
  setResearchDb(db);
  const mcp = handleMcpMessage(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "traverse_public_semantic_graph",
        arguments: {
          site_id: site.site_id,
          query: "トラブル",
          depth: 2,
          limit: 100,
        },
      },
    },
    data,
  ).result;
  assert.equal(mcp.isError, false);
  assert.equal(mcp.structuredContent.meta.total, response.body.meta.total);
  assert.equal(mcp.structuredContent.synonymy_inferred, false);
  assert.equal(mcp.structuredContent.auto_mutation, false);
  console.log(
    "public semantic graph API/MCP: OK (bounded depth 2, canonical/inverse relation semantics, 0 automatic mutation)",
  );
} finally {
  setResearchDb(null);
  db.close();
}
