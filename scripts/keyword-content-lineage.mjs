import { createHash } from "node:crypto";

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ja-JP");

const asArray = (value) => (Array.isArray(value) ? value : []);

const includesGroup = (row, groupId) =>
  row?.group_id === groupId || asArray(row?.group_ids).includes(groupId);

const sourceRowsForGroup = (rows, group) => {
  const exact = rows.filter((row) =>
    asArray(row.exact_group_ids).includes(group.id),
  );
  if (exact.length) return exact;
  const groupTerms = new Set(
    [
      group.main_keyword,
      group.display_keyword,
      ...asArray(group.intent_keywords),
      ...asArray(group.sibling_keywords),
      ...asArray(group.comparison_keywords),
    ]
      .filter(Boolean)
      .map(normalize),
  );
  return rows.filter(
    (row) => row.site_id === group.site_id && groupTerms.has(row.normalized_keyword),
  );
};

const proposalRowsForGroup = (rows, group) =>
  rows.filter((row) => asArray(row.proposal_group_ids).includes(group.id));

const compactSource = (row) => ({
  source_keyword_id: row.source_keyword_id,
  raw_keyword: row.raw_keyword,
  normalized_keyword: row.normalized_keyword,
  processing_state: row.processing_state,
  lineage_state: row.lineage_state,
  source_sheet: row.source_sheet,
  source_row: row.source_row,
  evidence_digest: row.evidence_digest,
});

const compactDemand = (row, occurrenceRows = []) => {
  const value = normalize(row.normalized_value ?? row.representative_value ?? row.value);
  const occurrenceIds = [
    ...new Set([
      ...asArray(row.evidence_occurrence_ids),
      ...occurrenceRows
        .filter(
          (occurrence) =>
            occurrence.demand_type === row.demand_type &&
            normalize(occurrence.normalized_value ?? occurrence.value) === value,
        )
        .map((occurrence) => occurrence.occurrence_id)
        .filter(Boolean),
    ]),
  ];
  return {
    demand_type: row.demand_type,
    value: row.representative_value ?? row.value ?? null,
    normalized_value: row.normalized_value ?? (value || null),
    occurrence_count: row.occurrence_count ?? 0,
    importance_score: row.importance_score ?? null,
    max_recursion_depth: row.max_recursion_depth ?? null,
    source_keywords: asArray(row.source_keywords),
    task_count: row.task_count ?? null,
    first_observed_at: row.first_observed_at ?? null,
    last_observed_at: row.last_observed_at ?? null,
    evidence_ids: occurrenceIds,
    evidence_occurrence_ids: occurrenceIds,
  };
};

const compactTopic = (row) => ({
  proposal_id: row.proposal_id,
  topic_kind: row.topic_kind,
  display_topic: row.display_topic,
  relation: row.relation,
  occurrence_count: row.occurrence_count,
  task_count: row.task_count,
  priority_score: row.priority_score,
  status: row.status,
  evidence_digest: row.evidence_digest,
  evidence_occurrence_ids: asArray(row.evidence_occurrence_ids),
});

const compactCandidate = (row) => ({
  candidate_id: row.candidate_id,
  content_type: row.content_type,
  heading_level: row.heading_level ?? null,
  text: row.text,
  evidence_type: row.evidence_type,
  evidence_ids: asArray(row.evidence_ids),
  status: row.status,
  review_state: row.review?.review_state ?? null,
  review_digest: row.review?.review_digest ?? null,
  candidate_digest: row.candidate_digest,
});

const compactOutlineCandidate = (row) => ({
  ...compactCandidate(row),
  outline_position: row.outline_position ?? null,
  parent_relation: row.parent_relation
    ? {
        parent_candidate_id: row.parent_relation.parent_candidate_id ?? null,
        policy: row.parent_relation.policy ?? null,
        score: row.parent_relation.score ?? null,
        shared_evidence_count: row.parent_relation.shared_evidence_count ?? 0,
        lexical_jaccard: row.parent_relation.lexical_jaccard ?? null,
        substring_match: row.parent_relation.substring_match ?? false,
      }
    : null,
});

const compactStructure = (row) => ({
  group_id: row.group_id,
  title_candidate: row.title_candidate,
  status: row.status,
  candidate_digest: row.candidate_digest,
  source_topic_ids: asArray(row.source_topic_ids),
  heading_candidates: asArray(row.heading_candidates).map((item) => ({
    level: item.level,
    text: item.text,
    topic_proposal_id: item.topic_proposal_id ?? null,
    evidence_digest: item.evidence_digest ?? null,
  })),
});

const compactOutline = (row) => {
  const sections = asArray(row.sections).map((section) => ({
    ...compactOutlineCandidate(section),
    children: asArray(section.children).map(compactOutlineCandidate),
  }));
  return {
    status: row.status,
    selected_count: row.selected_count ?? 0,
    h2_count: row.h2_count ?? 0,
    h3_count: row.h3_count ?? 0,
    candidate_count: row.candidate_count ?? 0,
    omitted_candidate_count: row.omitted_candidate_count ?? 0,
    evidence_id_count: row.evidence_id_count ?? 0,
    selected_candidate_ids: sections.flatMap((section) => [
      section.candidate_id,
      ...section.children.map((child) => child.candidate_id),
    ]),
    selected_sections: sections,
    unassigned_candidate_ids: asArray(row.unassigned_candidates),
    policy: row.policy ?? null,
  };
};

const compactReadiness = (row) =>
  row
    ? {
        publication_state: row.publication_state,
        blocker_codes: asArray(row.blocker_codes),
        review_codes: asArray(row.review_codes),
        auto_approval: row.auto_approval ?? false,
        auto_publication: row.auto_publication ?? false,
        readiness_digest: row.readiness_digest ?? null,
      }
    : null;

const stage = (state, count, details = {}) => ({ state, count, ...details });

/**
 * Build a bounded, site-scoped projection from retained keyword evidence to
 * editorial candidates. This is intentionally a projection, not a new
 * grouping or generation algorithm: every stage keeps its source IDs and
 * review/publication state, and no stage mutates content or performs IO.
 */
export function buildKeywordContentLineage({
  siteId,
  groups = [],
  keywordInventory = [],
  keywordLineageRows = [],
  demands = [],
  occurrences = [],
  topics = [],
  questions = [],
  structures = [],
  candidates = [],
  outlines = [],
  readinessRows = [],
  query = "",
  groupId = "",
} = {}) {
  if (!siteId) throw new TypeError("siteId is required");
  const normalizedQuery = normalize(query);
  const siteGroups = groups.filter((group) => group.site_id === siteId);
  const inventory = keywordInventory.filter((row) => row.site_id === siteId);
  const lineage = keywordLineageRows.filter((row) => row.site_id === siteId);
  const sourceRows = lineage.length ? lineage : inventory;
  const rows = siteGroups
    .filter((group) => !groupId || group.id === groupId)
    .map((group) => {
      const exactSources = sourceRowsForGroup(sourceRows, group);
      const proposedSources = proposalRowsForGroup(sourceRows, group);
      const groupDemands = demands.filter((row) => includesGroup(row, group.id));
      const groupOccurrences = occurrences.filter(
        (row) => row.group_id === group.id,
      );
      const groupTopics = topics.filter((row) => row.group_id === group.id);
      const groupQuestions = questions.filter((row) => row.group_id === group.id);
      const structure = structures.find((row) => row.group_id === group.id) ?? null;
      const groupCandidates = candidates
        .filter((row) => row.group_id === group.id)
        .map(compactCandidate);
      const outline = outlines.find((row) => row.group_id === group.id) ?? null;
      const readiness = readinessRows.find((row) => row.group_id === group.id) ?? null;
      const allText = normalize(
        JSON.stringify({
          group,
          exactSources,
          proposedSources,
          groupDemands,
          groupTopics,
          groupQuestions,
          structure,
          groupCandidates,
          outline,
          readiness,
        }),
      );
      if (normalizedQuery && !allText.includes(normalizedQuery)) return null;

      const sourceStage = exactSources.length
        ? stage("retained", exactSources.length, {
            acquired_count: exactSources.filter(
              (row) => row.processing_state !== "SERP未取得",
            ).length,
            unacquired_count: exactSources.filter(
              (row) => row.processing_state === "SERP未取得",
            ).length,
          })
        : proposedSources.length
          ? stage("proposal_only", 0, { proposal_count: proposedSources.length })
          : stage("missing", 0);
      const demandStage = groupDemands.length || groupTopics.length
        ? stage("observed", groupDemands.length + groupTopics.length, {
          demand_count: groupDemands.length,
          topic_count: groupTopics.length,
          question_count: groupQuestions.length,
          demand_occurrence_count: groupDemands.reduce(
            (sum, row) => sum + Number(row.occurrence_count ?? 0),
            0,
          ),
          })
        : stage("not_observed", 0, { question_count: groupQuestions.length });
      const structureStage = structure
        ? stage("candidate", 1, { status: structure.status })
        : stage("missing", 0);
      const titleCandidates = groupCandidates.filter(
        (row) => row.content_type === "title",
      );
      const headingCandidates = groupCandidates.filter(
        (row) => row.content_type === "heading",
      );
      const generationStage = titleCandidates.length || headingCandidates.length
        ? stage("candidate", titleCandidates.length + headingCandidates.length, {
            title_count: titleCandidates.length,
            heading_count: headingCandidates.length,
            ready_count: groupCandidates.filter((row) => row.review_state === "ready")
              .length,
            needs_review_count: groupCandidates.filter(
              (row) => row.review_state === "needs_review",
            ).length,
          })
        : stage("missing", 0, { title_count: 0, heading_count: 0 });
      const publicationStage = readiness
        ? stage(readiness.publication_state === "blocked" ? "blocked" : "review", 1, {
            blocker_codes: asArray(readiness.blocker_codes),
          })
        : stage("unknown", 0);
      const base = {
        site_id: siteId,
        group_id: group.id,
        main_keyword: group.main_keyword ?? null,
        display_keyword: group.display_keyword ?? null,
        group_state: group.resolution_state ?? group.state ?? null,
        source_keywords: exactSources.map(compactSource),
        proposed_keywords: proposedSources.map(compactSource),
        demand_observations: groupDemands.map((row) =>
          compactDemand(row, groupOccurrences),
        ),
        topic_proposals: groupTopics.map(compactTopic),
        question_candidates: groupQuestions.map((row) => ({
          question_id: row.question_id,
          question_text: row.question_text,
          candidate_kind: row.candidate_kind,
          source_topic_id: row.source_topic_id,
          source_kind: row.source_kind,
          generator_kind: row.generator_kind,
          generator_version: row.generator_version,
          input_digest: row.input_digest,
          status: row.status,
          review_state: row.review_state,
          evidence_digest: row.evidence_digest,
          evidence_occurrence_ids: asArray(row.evidence_occurrence_ids),
        })),
        structure_candidate: structure ? compactStructure(structure) : null,
        generation_candidates: groupCandidates,
        outline: outline ? compactOutline(outline) : null,
        readiness: compactReadiness(readiness),
        stages: {
          source_keywords: sourceStage,
          demand: demandStage,
          structure: structureStage,
          title_and_headings: generationStage,
          publication: publicationStage,
        },
        policy: "keyword-content-lineage.v1",
        source_policy: "retained_evidence_only",
        automatic_group_assignment: false,
        automatic_generation: false,
        automatic_content_mutation: false,
        automatic_publication: false,
        external_acquisition_triggered: false,
      };
      return { ...base, lineage_digest: digest(base) };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        String(a.group_id).localeCompare(String(b.group_id)) ||
        String(a.main_keyword ?? "").localeCompare(String(b.main_keyword ?? ""), "ja"),
    );

  const summary = {
    site_id: siteId,
    group_count: rows.length,
    source_retained_group_count: rows.filter(
      (row) => row.stages.source_keywords.state === "retained",
    ).length,
    proposal_only_group_count: rows.filter(
      (row) => row.stages.source_keywords.state === "proposal_only",
    ).length,
    demand_observed_group_count: rows.filter(
      (row) => row.stages.demand.state === "observed",
    ).length,
    structure_candidate_group_count: rows.filter(
      (row) => row.stages.structure.state === "candidate",
    ).length,
    generation_candidate_group_count: rows.filter(
      (row) => row.stages.title_and_headings.state === "candidate",
    ).length,
    publication_blocked_group_count: rows.filter(
      (row) => row.stages.publication.state === "blocked",
    ).length,
    source_inventory_count: inventory.length,
    source_lineage_count: lineage.length,
    automatic_group_assignment: false,
    automatic_generation: false,
    automatic_content_mutation: false,
    automatic_publication: false,
    external_acquisition_triggered: false,
  };
  return {
    rows,
    summary,
    filters: { site_id: siteId, q: query, group_id: groupId || "all" },
    policy: "keyword-content-lineage.v1",
    source_policy: "retained_evidence_only",
    lineage_digest: digest({ summary, rows: rows.map((row) => row.lineage_digest) }),
  };
}
