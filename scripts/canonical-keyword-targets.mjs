const allowedStates = new Set(['observed', 'not_observed']);

export function validateCanonicalKeywordTargets(source, assignments) {
  const packets = new Map(source.packets.map((packet) => [packet.task_id, packet]));
  const candidates = new Set(source.plans.plans.map((plan) => plan.article_candidate_id));
  const byCandidate = new Map();
  const observedTaskOwners = new Map();

  for (const row of assignments) {
    if (!candidates.has(row.article_candidate_id)) throw new Error(`unknown article candidate: ${row.article_candidate_id}`);
    if (byCandidate.has(row.article_candidate_id)) throw new Error(`duplicate canonical target: ${row.article_candidate_id}`);
    if (!allowedStates.has(row.state)) throw new Error(`invalid canonical target state: ${row.state}`);
    if (!row.reason?.trim()) throw new Error(`canonical target requires reason: ${row.article_candidate_id}`);

    if (row.state === 'observed') {
      const packet = packets.get(row.task_id);
      if (!packet) throw new Error(`unknown canonical task: ${row.task_id}`);
      if (row.keyword !== packet.keyword) throw new Error(`canonical keyword does not match task: ${row.article_candidate_id}`);
      const rank1 = packet.serp?.pages?.find((page) => page.rank === 1);
      if (!rank1?.url) throw new Error(`canonical task has no observed organic rank-1 URL: ${row.task_id}`);
      if (row.rank1_url !== rank1.url) throw new Error(`rank-1 URL does not belong to canonical task: ${row.article_candidate_id}`);
      if (observedTaskOwners.has(row.task_id)) throw new Error(`canonical task assigned to multiple articles: ${row.task_id}`);
      observedTaskOwners.set(row.task_id, row.article_candidate_id);
    } else if (row.task_id != null || row.keyword != null || row.rank1_url != null) {
      throw new Error(`not_observed target cannot claim keyword, task, or rank-1 URL: ${row.article_candidate_id}`);
    }
    byCandidate.set(row.article_candidate_id, { ...row });
  }

  const missing = [...candidates].filter((candidateId) => !byCandidate.has(candidateId));
  if (missing.length) throw new Error(`canonical target missing for article candidates: ${missing.join(', ')}`);
  return source.plans.plans.map((plan) => byCandidate.get(plan.article_candidate_id));
}
