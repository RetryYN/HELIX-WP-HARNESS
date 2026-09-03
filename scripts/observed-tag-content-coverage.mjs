import { createHash } from "node:crypto";

const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const includes = (text, value) => normalize(text).includes(normalize(value));

export function buildObservedTagContentCoverage(hashtagRows, groups, articles, { siteId } = {}) {
  const groupById = new Map(groups.filter((row) => !siteId || row.site_id === siteId).map((row) => [row.id ?? row.group_id, row]));
  const articleById = new Map(articles.filter((row) => !siteId || row.site_id === siteId).map((row) => [row.wp_article_id, row]));
  const rows = [];
  for (const tag of hashtagRows.filter((row) => !siteId || row.site_id === siteId)) {
    for (const groupId of tag.group_ids) {
      const group = groupById.get(groupId);
      if (!group) continue;
      const article = articleById.get(group.wp_article_id), headings = article?.headings ?? [];
      const bareTag = tag.hashtag.replace(/^#/u, ""), title = article?.title ?? "";
      const markerInTitle = includes(title, tag.hashtag), markerHeadingPositions = headings.filter((heading) => includes(heading.text, tag.hashtag)).map((heading) => heading.position);
      const termInTitle = includes(title, bareTag), termHeadingPositions = headings.filter((heading) => includes(heading.text, bareTag)).map((heading) => heading.position);
      const exactMarkerCovered = markerInTitle || markerHeadingPositions.length > 0, lexicalTermCovered = termInTitle || termHeadingPositions.length > 0;
      const reviewAction = exactMarkerCovered
        ? "monitor_existing_marker"
        : tag.classification === "job_attribute_marker_observed"
          ? "verify_claim_before_consideration"
          : tag.classification === "ambiguous_marker_review"
            ? "classify_before_consideration"
            : article
              ? "review_topic_fit"
              : "review_unassigned_group_context";
      const base = {
        site_id: tag.site_id,
        group_id: groupId,
        normalized_tag: tag.normalized_tag,
        hashtag: tag.hashtag,
        classification: tag.classification,
        observed_occurrence_count: tag.occurrence_count,
        source_evidence_digest: tag.evidence_digest,
        wp_article_id: article?.wp_article_id ?? null,
        article_url: article?.url ?? null,
        marker_in_title: markerInTitle,
        marker_heading_positions: markerHeadingPositions,
        term_in_title: termInTitle,
        term_heading_positions: termHeadingPositions,
        exact_marker_covered: exactMarkerCovered,
        lexical_term_covered: lexicalTermCovered,
        review_action: reviewAction,
        claim_verification_required: tag.classification === "job_attribute_marker_observed",
        classification_review_required: tag.classification === "ambiguous_marker_review",
        popularity_inferred: false,
        ranking_effect_inferred: false,
        auto_content_use: false,
      };
      rows.push({ coverage_id: digest({ site_id: tag.site_id, group_id: groupId, normalized_tag: tag.normalized_tag }), ...base, coverage_digest: digest(base) });
    }
  }
  rows.sort((a, b) => a.review_action.localeCompare(b.review_action) || b.observed_occurrence_count - a.observed_occurrence_count || a.normalized_tag.localeCompare(b.normalized_tag) || a.group_id.localeCompare(b.group_id));
  return {
    policy: "observed-tag-content-coverage.v1",
    rows,
    summary: {
      decision_count: rows.length,
      assigned_article_count: rows.filter((row) => row.wp_article_id != null).length,
      exact_marker_covered_count: rows.filter((row) => row.exact_marker_covered).length,
      lexical_term_covered_count: rows.filter((row) => row.lexical_term_covered).length,
      claim_verification_required_count: rows.filter((row) => row.claim_verification_required).length,
      classification_review_required_count: rows.filter((row) => row.classification_review_required).length,
      auto_content_use_count: 0,
    },
  };
}
