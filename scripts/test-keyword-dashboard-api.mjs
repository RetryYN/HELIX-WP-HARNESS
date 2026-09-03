import assert from "node:assert/strict";
import {
  operationCoverage,
  researchOpenApi,
  routeResearchApi,
} from "./keyword-dashboard-api.mjs";
const data = {
  sites: [
    {
      site_id: "s",
      label: "S",
      domain: "s.test",
      portfolio_metrics: {},
      provider_cost_ledger: {},
      ai_question_candidates: [
        { question_id: "q1", candidate_kind: "derived_question" },
      ],
      lexical_index: {},
      wp_page_seo_metadata: [
        {
          wp_article_id: 1,
          title: "IT",
          description: "説明",
          canonical_url: "https://s.test/it",
        },
      ],
      wp_page_seo_audits: [
        {
          wp_article_id: 1,
          state: "warning",
          findings: [{ code: "title_length", detail: "2文字" }],
        },
      ],
      public_surface_inventory: [
        {
          surface_type: "page",
          analysis_state: "surface_only_unconnected",
          canonical_url: "https://s.test/about",
        },
      ],
    },
  ],
  keyword_inventory: [
    { site_id: "s", raw_keyword: "IT 就活", processing_state: "SERP未取得" },
    { site_id: "s", raw_keyword: "IT 転職", processing_state: "取得済" },
  ],
  groups: [{ id: "g", site_id: "s", task_ids: ["t"] }],
  serp_demands: [
    {
      group_ids: ["g"],
      demand_type: "paa",
      representative_value: "質問",
      source_keywords: ["IT"],
    },
  ],
  serp_organic_results: [
    {
      task_id: "t",
      title: "比較記事",
      url: "https://example.test",
      description: "選び方",
      pre_snippet: "2026/08/26",
      breadcrumb: "example › guide",
      highlighted: ["比較"],
      links: [{ title: "料金表", url: "https://example.test/price" }],
      rating: { value: 4.5, rating_max: 5, votes_count: 10 },
      price: { displayed_price: "￥1,000" },
      attributes: { is_video: false },
    },
    {
      task_id: "t",
      title: "動画",
      url: "https://video.test",
      description: null,
      pre_snippet: null,
      breadcrumb: "video",
      highlighted: [],
      links: [],
      rating: null,
      price: null,
      attributes: { is_video: true },
    },
  ],
  competitor_page_evidence: [],
  content_structure_candidates: [{ group_id: "g" }],
  content_generation_candidates: [],
};
const route = (path) => {
  const url = new URL(path, "http://localhost");
  return routeResearchApi(url.pathname, url, data);
};
assert.equal(researchOpenApi.openapi, "3.1.0");
const openApiPaths = Object.keys(researchOpenApi.paths),
  mappedOperationIds = new Set(
    operationCoverage.map((row) => row.operation_id),
  );
assert.equal(openApiPaths.length, 123);
assert.ok(openApiPaths.every((path) => researchOpenApi.paths[path].get));
assert.equal(operationCoverage.length, 27);
assert.equal(mappedOperationIds.size, 24);
assert.equal(
  operationCoverage.filter(
    (row) => row.mapping_state === "plan_only_no_mutation",
  ).length,
  2,
);
const keywords = route("/api/v1/keywords?site_id=s&q=IT&limit=1");
assert.equal(keywords.status, 200);
assert.equal(keywords.body.data.length, 1);
assert.equal(keywords.body.meta.total, 2);
assert.equal(keywords.body.meta.next_cursor, "1");
assert.equal(keywords.body.provenance.external_acquisition_triggered, false);
assert.equal(
  route("/api/v1/questions?site_id=s&kind=derived_question").body.data.length,
  1,
);
assert.equal(
  route("/api/v1/serp-results?site_id=s&target=pre-snippet&q=2026").body.meta
    .total,
  1,
);
assert.equal(
  route("/api/v1/serp-results?site_id=s&target=sitelink&q=料金").body.meta
    .total,
  1,
);
assert.equal(
  route("/api/v1/serp-results?site_id=s&target=commerce&q=displayed_price").body
    .meta.total,
  1,
);
assert.equal(
  route("/api/v1/serp-results?site_id=s&feature=video").body.meta.total,
  1,
);
assert.equal(route("/api/v1/serp-feature-items?site_id=s").body.meta.total, 0);
assert.equal(
  route("/api/v1/operation-coverage").body.meta.mapped_operation_count,
  operationCoverage.length,
);
assert.equal(
  route("/api/v1/rank/status?site_id=s").body.data.state,
  "not_acquired",
);
assert.equal(
  route("/api/v1/market/status?site_id=s").body.mutation_supported,
  false,
);
assert.equal(route("/api/v1/wordpress/links?site_id=s").status, 200);
assert.equal(
  route("/api/v1/wordpress/seo-metadata?site_id=s").body.meta.total,
  1,
);
assert.equal(
  route("/api/v1/wordpress/seo-audits?site_id=s&state=warning").body.meta.total,
  1,
);
assert.equal(
  route("/api/v1/wordpress/surface?site_id=s&type=page").body.meta.total,
  1,
);
assert.equal(route("/api/v1/acquisition?site_id=missing").status, 404);
assert.equal(route("/api/v1/keywords").status, 400);
const retention = route(
  "/api/v1/acquisition-retention?disposition=provider_metric_not_acquired&limit=100",
);
assert.equal(retention.status, 200);
assert.equal(retention.body.meta.total, 21);
assert.equal(retention.body.summary.future_covered_count, 952);
assert.equal(retention.body.summary.not_acquired_field_count, 221);
assert.equal(retention.body.credentials_retained, false);
console.log(
  `keyword dashboard API: OK (OpenAPI 3.1, ${openApiPaths.length} read-only routes, all ${mappedOperationIds.size} SeoToolA operation IDs mapped, pagination, site gate)`,
);
