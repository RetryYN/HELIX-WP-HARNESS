const allowedStates = new Set(['observed', 'query_observed_rank1_identity_redacted', 'query_observed_rank1_missing', 'not_observed']);
const isRedactedUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname === 'example' || url.hostname.endsWith('.example') || /<(?:redacted|removed)[^>]*>/iu.test(decodeURIComponent(url.href));
  } catch {
    return true;
  }
};

export function validateCanonicalKeywordTargets(source, assignments, { rank1IdentityEvidence = [] } = {}) {
  const packets = new Map(source.packets.map((packet) => [packet.task_id, packet]));
  const candidates = new Set(source.plans.plans.map((plan) => plan.article_candidate_id));
  const byCandidate = new Map();
  const observedTaskOwners = new Map();
  const recoveredByTask = new Map(rank1IdentityEvidence.map((row) => [row.task_id, row]));

  for (const row of assignments) {
    if (!candidates.has(row.article_candidate_id)) throw new Error(`unknown article candidate: ${row.article_candidate_id}`);
    if (byCandidate.has(row.article_candidate_id)) throw new Error(`duplicate canonical target: ${row.article_candidate_id}`);
    if (!allowedStates.has(row.state)) throw new Error(`invalid canonical target state: ${row.state}`);
    if (!row.reason?.trim()) throw new Error(`canonical target requires reason: ${row.article_candidate_id}`);

    if (row.state !== 'not_observed') {
      const packet = packets.get(row.task_id);
      if (!packet) throw new Error(`unknown canonical task: ${row.task_id}`);
      if (row.keyword !== packet.keyword) throw new Error(`canonical keyword does not match task: ${row.article_candidate_id}`);
      const rank1 = packet.serp?.pages?.find((page) => page.rank === 1);
      if (row.state === 'observed') {
        const storedUrl = rank1?.url && !isRedactedUrl(rank1.url) ? rank1.url : null;
        const recovered = recoveredByTask.get(row.task_id);
        const recoveredUrl = recovered?.recovery_state === 'recovered' && recovered.keyword === packet.keyword && recovered.raw_digest?.trim() ? recovered.rank1_url : null;
        const expectedUrl = storedUrl ?? recoveredUrl;
        if (!expectedUrl) throw new Error(`canonical task has no externally usable organic rank-1 URL evidence: ${row.task_id}`);
        if (isRedactedUrl(expectedUrl)) throw new Error(`canonical rank-1 URL identity is redacted: ${row.article_candidate_id}`);
        if (row.rank1_url !== expectedUrl) throw new Error(`rank-1 URL does not belong to canonical task: ${row.article_candidate_id}`);
      } else if (row.state === 'query_observed_rank1_identity_redacted') {
        if (!rank1?.url || !isRedactedUrl(rank1.url)) throw new Error(`canonical rank-1 URL is not redacted: ${row.article_candidate_id}`);
        if (row.rank1_url != null) throw new Error(`redacted rank-1 target cannot claim an externally queryable URL: ${row.article_candidate_id}`);
      } else {
        if (rank1?.url) throw new Error(`rank-1 URL is present; target cannot be marked missing: ${row.article_candidate_id}`);
        if (row.rank1_url != null) throw new Error(`missing rank-1 target cannot claim a URL: ${row.article_candidate_id}`);
      }
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
