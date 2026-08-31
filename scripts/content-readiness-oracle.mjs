import { createHash } from "node:crypto";
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildContentReadinessOracle(
  groups,
  structures,
  titleOracle,
  headingOracle,
  topologyOracle,
  demandStabilityOracle = { rows: [] },
  competitiveStabilityOracle = { rows: [] },
  ensembleSelectionOracle = { group_rows: [] },
  semanticDecisionPacket = { items: [], summary: {} },
  safeRevisionOracle = { rows: [] },
  manualRevisionPackets = { packets: [] },
  publicSourceReviewPacket = { items: [], summary: {} },
  publicSourceCitationApplicationPackets = { packets: [], summary: {} },
) {
  const structureByGroup = new Map(
      structures.map((row) => [row.group_id, row]),
    ),
    titleByGroup = new Map(titleOracle.rows.map((row) => [row.group_id, row])),
    headingByCandidate = new Map(
      headingOracle.rows.map((row) => [row.candidate_id, row]),
    ),
    stabilityByCandidate = new Map(
      (demandStabilityOracle.rows ?? []).map((row) => [row.candidate_id, row]),
    ),
    competitiveStabilityByCandidate = new Map(
      (competitiveStabilityOracle.rows ?? []).map((row) => [
        row.candidate_id,
        row,
      ]),
    ),
    ensembleByGroup = new Map(
      (ensembleSelectionOracle.group_rows ?? []).map((row) => [
        row.group_id,
        row,
      ]),
    ),
    topologyByGroup = Map.groupBy(
      (topologyOracle.rows ?? []).flatMap((row) =>
        row.groups.map((group) => ({ ...row, group_id: group.group_id })),
      ),
      (row) => row.group_id,
    ),
    semanticByGroup = Map.groupBy(
      semanticDecisionPacket.items ?? [],
      (row) => row.group_id,
    ),
    safeRevisionsByGroup = Map.groupBy(
      safeRevisionOracle.rows ?? [],
      (row) => row.group_id,
    ),
    manualPacketByGroup = new Map(
      (manualRevisionPackets.packets ?? []).map((row) => [row.group_id, row]),
    ),
    publicSourceReviewsByGroup = Map.groupBy(
      publicSourceReviewPacket.items ?? [],
      (row) => row.group_id,
    ),
    publicSourceCitationPacketByGroup = new Map(
      (publicSourceCitationApplicationPackets.packets ?? []).map((row) => [
        row.group_id,
        row,
      ]),
    ),
    rows = [];
  for (const group of groups.filter((row) => row.main_keyword)) {
    const structure = structureByGroup.get(group.id),
      composition = structure?.composition,
      draft = structure?.draft_package?.draft_revision,
      title = titleByGroup.get(group.id),
      selectedHeadingIds = composition?.selected_heading_ids ?? [],
      selectedRepairs = selectedHeadingIds
        .map((id) => headingByCandidate.get(id))
        .filter(Boolean),
      selectedStability = [
        composition?.title_candidate_id,
        ...selectedHeadingIds,
      ]
        .map((id) => stabilityByCandidate.get(id))
        .filter(
          (row) => row && row.demand_stability_state !== "not_applicable",
        ),
      selectedCompetitiveStability = [
        composition?.title_candidate_id,
        ...selectedHeadingIds,
      ]
        .map((id) => competitiveStabilityByCandidate.get(id))
        .filter(
          (row) => row && row.competitive_stability_state !== "not_applicable",
        ),
      ensemble = ensembleByGroup.get(group.id),
      topology = topologyByGroup.get(group.id) ?? [],
      semanticTasks = semanticByGroup.get(group.id) ?? [],
      safeRevisions = safeRevisionsByGroup.get(group.id) ?? [],
      manualPacket = manualPacketByGroup.get(group.id),
      publicSourceReviews = publicSourceReviewsByGroup.get(group.id) ?? [],
      publicSourceCitationPacket = publicSourceCitationPacketByGroup.get(
        group.id,
      );
    const semanticCounts = Object.fromEntries(
        [
          "unreviewed",
          "resolved_editor_approved_for_consideration",
          "resolved_editor_rejected",
          "unresolved_deferred",
          "reviewer_disagreement",
        ].map((state) => [
          state,
          semanticTasks.filter((row) => row.resolution_progress_state === state)
            .length,
        ]),
      ),
      semanticPendingCount =
        semanticCounts.unreviewed +
        semanticCounts.unresolved_deferred +
        semanticCounts.reviewer_disagreement,
      semanticLineage = {
        task_count: semanticTasks.length,
        pending_count: semanticPendingCount,
        progress_counts: semanticCounts,
        sense_readiness_counts: Object.fromEntries(
          [
            "unique_path_supported_sense",
            "multiple_path_supported_senses",
            "dictionary_senses_without_reconstructed_direct_path",
            "no_dictionary_sense",
          ].map((state) => [
            state,
            semanticTasks.filter(
              (row) => row.sense_evidence_readiness_state === state,
            ).length,
          ]),
        ),
        pending_task_ids: semanticTasks
          .filter((row) =>
            [
              "unreviewed",
              "unresolved_deferred",
              "reviewer_disagreement",
            ].includes(row.resolution_progress_state),
          )
          .map((row) => row.task_id),
        decision_packet_digest: semanticDecisionPacket.packet_digest ?? null,
        context_relevance_inferred: false,
        auto_approval: false,
      };
    const safeRevisionApprovedCount = safeRevisions.filter(
        (row) =>
          row.editorial_progress_state === "approved_for_manual_revision",
      ).length,
      safeRevisionLineage = {
        proposal_count: safeRevisions.length,
        approved_for_manual_revision_count: safeRevisionApprovedCount,
        pending_or_not_approved_count:
          safeRevisions.length - safeRevisionApprovedCount,
        progress_counts: Object.fromEntries(
          [
            "unreviewed",
            "approved_for_manual_revision",
            "changes_requested",
            "rejected",
            "deferred",
            "reviewer_disagreement",
          ].map((state) => [
            state,
            safeRevisions.filter(
              (row) => row.editorial_progress_state === state,
            ).length,
          ]),
        ),
        proposal_ids: safeRevisions.map((row) => row.revision_proposal_id),
        proposal_set_digest: safeRevisionOracle.proposal_set_digest ?? null,
        manual_packet_id: manualPacket?.packet_id ?? null,
        manual_packet_digest: manualPacket?.packet_digest ?? null,
        artifact_applied: false,
        auto_publication: false,
      };
    const publicSourceApprovedCount = publicSourceReviews.filter(
        (row) => row.claim_use_approved,
      ).length,
      publicSourceReviewLineage = {
        eligible_review_count: publicSourceReviews.length,
        approved_for_claim_use_count: publicSourceApprovedCount,
        pending_or_not_approved_count:
          publicSourceReviews.length - publicSourceApprovedCount,
        review_ids: publicSourceReviews.map((row) => row.review_id),
        review_digests: publicSourceReviews.map((row) => row.review_digest),
        packet_digest: publicSourceReviewPacket.packet_digest ?? null,
        draft_application_required: publicSourceApprovedCount > 0,
        auto_approval: false,
        auto_apply: false,
        auto_publication: false,
      },
      publicSourceCitationApplicationLineage = {
        packet_id: publicSourceCitationPacket?.packet_id ?? null,
        packet_digest: publicSourceCitationPacket?.packet_digest ?? null,
        placement_count: publicSourceCitationPacket?.placements?.length ?? 0,
        body_text_unchanged:
          publicSourceCitationPacket?.body_text_unchanged ?? true,
        review_state: publicSourceCitationPacket?.review_state ?? null,
        editorial_progress_state:
          publicSourceCitationPacket?.editorial_progress_state ?? null,
        reviewer_count: publicSourceCitationPacket?.reviewer_count ?? 0,
        manual_application_approved:
          publicSourceCitationPacket?.manual_application_approved ?? false,
        artifact_applied: false,
        auto_apply: false,
        auto_publication: false,
      };
    const gates = [
        {
          gate: "public_source_review_decision",
          state: !publicSourceReviews.length
            ? "pass"
            : publicSourceApprovedCount === publicSourceReviews.length
              ? "review_required"
              : "blocked",
          detail:
            publicSourceApprovedCount === publicSourceReviews.length
              ? `approved ${publicSourceApprovedCount} / eligible ${publicSourceReviews.length}; draft application required`
              : `approved ${publicSourceApprovedCount} / eligible ${publicSourceReviews.length}`,
        },
        {
          gate: "public_source_citation_application",
          state: !publicSourceReviews.length
            ? "pass"
            : publicSourceCitationPacket?.manual_application_approved
              ? "review_required"
              : "blocked",
          detail: publicSourceCitationPacket?.manual_application_approved
            ? `packet ${publicSourceCitationPacket.packet_id} approved for manual application but unapplied; body unchanged ${publicSourceCitationPacket.body_text_unchanged}`
            : publicSourceCitationPacket
              ? `packet ${publicSourceCitationPacket.packet_id} ${publicSourceCitationPacket.editorial_progress_state ?? "unreviewed"}; manual application approval required`
            : "approved-only citation application packet unavailable",
        },
        {
          gate: "composition",
          state: composition?.review_state === "ready" ? "pass" : "blocked",
          detail: composition?.review_state ?? "missing",
        },
        {
          gate: "title_editor_review",
          state:
            title?.review_state === "ready_for_editor_review"
              ? "review_required"
              : "blocked",
          detail: title?.review_state ?? "missing",
        },
        {
          gate: "heading_semantic_review",
          state: selectedRepairs.length ? "review_required" : "pass",
          detail: `selected repair ${selectedRepairs.length} / semantic verified 0`,
        },
        {
          gate: "semantic_sense_resolution",
          state:
            semanticTasks.length && semanticPendingCount
              ? "review_required"
              : "pass",
          detail: `pending ${semanticPendingCount} / task ${semanticTasks.length}`,
        },
        {
          gate: "evidence_safe_revision_decision",
          state: !safeRevisions.length
            ? "pass"
            : safeRevisionApprovedCount === safeRevisions.length
              ? "pass"
              : "blocked",
          detail: `approved ${safeRevisionApprovedCount} / proposal ${safeRevisions.length}`,
        },
        {
          gate: "evidence_safe_manual_revision",
          state: !safeRevisions.length
            ? "pass"
            : manualPacket
              ? "review_required"
              : "blocked",
          detail: manualPacket
            ? `packet ${manualPacket.packet_id} unapplied`
            : "approved-only packet unavailable",
        },
        {
          gate: "demand_stability",
          state:
            !selectedStability.length ||
            selectedStability.every(
              (row) => row.demand_stability_state === "stable_observed",
            )
              ? "pass"
              : "review_required",
          detail:
            selectedStability
              .map((row) => `${row.candidate_id}:${row.demand_stability_state}`)
              .join(" ") || "no demand-backed selected candidate",
        },
        {
          gate: "competitive_stability",
          state:
            !selectedCompetitiveStability.length ||
            selectedCompetitiveStability.every(
              (row) =>
                row.competitive_stability_state === "stable_page_observed",
            )
              ? "pass"
              : "review_required",
          detail:
            selectedCompetitiveStability
              .map(
                (row) =>
                  `${row.candidate_id}:${row.competitive_stability_state}`,
              )
              .join(" ") || "no competitor-backed selected candidate",
        },
        {
          gate: "evidence_ensemble_selection",
          state: ensemble?.selection_review_required
            ? "review_required"
            : "pass",
          detail: ensemble
            ? `title_change ${ensemble.title_selection_changed} heading_add ${ensemble.heading_add_ids.length} heading_remove ${ensemble.heading_remove_ids.length}`
            : "selection oracle unavailable",
        },
        {
          gate: "topology",
          state: topology.some((row) => row.review_required)
            ? "review_required"
            : "pass",
          detail:
            topology.map((row) => row.topology_decision).join(" / ") ||
            "no topology conflict",
        },
        {
          gate: "claim_verification",
          state:
            (draft?.review?.verified_claim_count ?? 0) ===
              (draft?.review?.claim_count ?? -1) &&
            draft?.review?.claim_count > 0
              ? "pass"
              : "blocked",
          detail: `verified ${draft?.review?.verified_claim_count ?? 0}/${draft?.review?.claim_count ?? 0}`,
        },
        {
          gate: "citation_approval",
          state:
            (draft?.review?.approved_citation_count ?? 0) > 0
              ? "pass"
              : "blocked",
          detail: `approved ${draft?.review?.approved_citation_count ?? 0} / candidate ${draft?.review?.citation_candidate_count ?? 0}`,
        },
      ],
      blockers = gates
        .filter((row) => row.state === "blocked")
        .map((row) => row.gate),
      reviews = gates
        .filter((row) => row.state === "review_required")
        .map((row) => row.gate),
      base = {
        readiness_id: `content-readiness:${group.id}`,
        group_id: group.id,
        main_keyword: group.main_keyword,
        wp_article_id: group.wp_article_id ?? null,
        publication_state: blockers.length
          ? "blocked"
          : reviews.length
            ? "editor_review_required"
            : "ready_for_publication_review",
        blocker_codes: blockers,
        review_codes: reviews,
        gates,
        semantic_resolution: semanticLineage,
        evidence_safe_revision: safeRevisionLineage,
        public_source_review: publicSourceReviewLineage,
        public_source_citation_application:
          publicSourceCitationApplicationLineage,
        selected_title_repair_id: title?.repair_id ?? null,
        selected_heading_repair_ids: selectedRepairs.map(
          (row) => row.repair_id,
        ),
        composition_digest: composition?.composition_digest ?? null,
        draft_revision_digest: draft?.revision_digest ?? null,
        topology_digests: topology.map((row) => row.topology_digest),
        auto_approval: false,
        auto_publication: false,
        ranking_effect_inferred: false,
        policy: "content-readiness-oracle.v6",
      };
    rows.push({ ...base, readiness_digest: digest(base) });
  }
  return {
    rows,
    summary: {
      group_count: rows.length,
      blocked_count: rows.filter((row) => row.publication_state === "blocked")
        .length,
      editor_review_required_count: rows.filter(
        (row) => row.publication_state === "editor_review_required",
      ).length,
      ready_for_publication_review_count: rows.filter(
        (row) => row.publication_state === "ready_for_publication_review",
      ).length,
      title_review_required_count: rows.filter((row) =>
        row.review_codes.includes("title_editor_review"),
      ).length,
      heading_semantic_review_required_count: rows.filter((row) =>
        row.review_codes.includes("heading_semantic_review"),
      ).length,
      semantic_sense_review_required_count: rows.filter((row) =>
        row.review_codes.includes("semantic_sense_resolution"),
      ).length,
      semantic_task_count: rows.reduce(
        (sum, row) => sum + row.semantic_resolution.task_count,
        0,
      ),
      semantic_pending_task_count: rows.reduce(
        (sum, row) => sum + row.semantic_resolution.pending_count,
        0,
      ),
      evidence_safe_revision_group_count: rows.filter(
        (row) => row.evidence_safe_revision.proposal_count,
      ).length,
      public_source_review_group_count: rows.filter(
        (row) => row.public_source_review.eligible_review_count,
      ).length,
      public_source_review_item_count: rows.reduce(
        (sum, row) => sum + row.public_source_review.eligible_review_count,
        0,
      ),
      public_source_review_decision_blocked_count: rows.filter((row) =>
        row.blocker_codes.includes("public_source_review_decision"),
      ).length,
      public_source_review_draft_application_review_count: rows.filter((row) =>
        row.review_codes.includes("public_source_review_decision"),
      ).length,
      evidence_safe_revision_proposal_count: rows.reduce(
        (sum, row) => sum + row.evidence_safe_revision.proposal_count,
        0,
      ),
      evidence_safe_revision_decision_blocked_count: rows.filter((row) =>
        row.blocker_codes.includes("evidence_safe_revision_decision"),
      ).length,
      evidence_safe_manual_revision_blocked_count: rows.filter((row) =>
        row.blocker_codes.includes("evidence_safe_manual_revision"),
      ).length,
      evidence_safe_manual_revision_review_required_count: rows.filter((row) =>
        row.review_codes.includes("evidence_safe_manual_revision"),
      ).length,
      demand_stability_review_required_count: rows.filter((row) =>
        row.review_codes.includes("demand_stability"),
      ).length,
      competitive_stability_review_required_count: rows.filter((row) =>
        row.review_codes.includes("competitive_stability"),
      ).length,
      evidence_ensemble_selection_review_required_count: rows.filter((row) =>
        row.review_codes.includes("evidence_ensemble_selection"),
      ).length,
      topology_review_required_count: rows.filter((row) =>
        row.review_codes.includes("topology"),
      ).length,
      claim_verification_blocked_count: rows.filter((row) =>
        row.blocker_codes.includes("claim_verification"),
      ).length,
      citation_approval_blocked_count: rows.filter((row) =>
        row.blocker_codes.includes("citation_approval"),
      ).length,
      auto_approved_count: 0,
      auto_published_count: 0,
    },
    policy: "content-readiness-oracle.v4",
  };
}
