export function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * ratio) - 1];
}

export function primaryQueryStats(rows) {
  const impressions = rows.map((row) => Number(row.impressions));
  return {
    impression_p95: percentile(impressions, 0.95),
    total_clicks: rows.reduce((sum, row) => sum + Number(row.clicks), 0),
    total_impressions: impressions.reduce((sum, value) => sum + value, 0),
  };
}

export function primaryQueryScore(row, impressionP95) {
  // A click is worth the observed p95 impression level. Log scaling prevents
  // either a tiny-sample CTR or a single high-impression query from dominating.
  return Math.log1p(Number(row.impressions))
    + Math.log1p(Number(row.clicks)) * Math.log1p(Math.max(1, impressionP95));
}

export function rankPrimaryQueries(rows, impressionP95) {
  return rows.map((row) => ({ ...row, primary_score: primaryQueryScore(row, impressionP95) }))
    .sort((left, right) => right.primary_score - left.primary_score
      || right.clicks - left.clicks
      || right.impressions - left.impressions
      || left.position - right.position
      || left.normalized_query.localeCompare(right.normalized_query, "ja"));
}
