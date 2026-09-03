import { createHash } from "node:crypto";

const normalize = (value) => String(value ?? "").normalize("NFKC");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const jobAttributePatterns = [
  /^(?:年休|年間休日|休日|土日|完全週休|週休|残業|賞与|昇給|給与|月給|年収|時給|福利厚生|研修|未経験|経験者|第二新卒|学歴不問|転勤なし|在宅|リモート|フレックス|正社員|契約社員|派遣|勤務地|交通費|資格|社保)/u,
  /(?:日以上|年\d+回|月\d+時間|万円|円以上)$/u,
];

export function extractObservedHashtags(value) {
  const text = normalize(value);
  const rows = [];
  for (const match of text.matchAll(/#([\p{L}\p{N}_][\p{L}\p{N}_ー・]*)/gu)) {
    const hashtag = `#${match[1]}`;
    rows.push({ hashtag, normalized_tag: hashtag.toLocaleLowerCase("ja-JP"), offset: match.index });
  }
  return rows;
}

export function classifyObservedHashtag(hashtag) {
  const tag = normalize(hashtag).replace(/^#/u, "");
  if (jobAttributePatterns.some((pattern) => pattern.test(tag))) return "job_attribute_marker_observed";
  if (/^(?:shorts?|shortvideo|twitter|x|instagram|tiktok|youtube)$/iu.test(tag) || /(?:就活|転職|採用|エンジニア|プログラミング|deepdive|フロントエンド)/iu.test(tag)) return "social_or_topic_observed";
  return "ambiguous_marker_review";
}

export function buildObservedHashtagEvidence(sourceRows) {
  const occurrences = [];
  for (const source of sourceRows) {
    for (const tag of extractObservedHashtags(source.observed_text)) {
      const identity = {
        site_id: source.site_id,
        source_kind: source.source_kind,
        source_id: source.source_id,
        field_name: source.field_name,
        offset: tag.offset,
        normalized_tag: tag.normalized_tag,
      };
      occurrences.push({
        occurrence_id: digest(identity),
        ...identity,
        hashtag: tag.hashtag,
        classification: classifyObservedHashtag(tag.hashtag),
        task_id: source.task_id ?? null,
        group_id: source.group_id ?? null,
        page_id: source.page_id ?? null,
        url: source.url ?? null,
        rank_absolute: source.rank_absolute ?? null,
        heading_position: source.heading_position ?? null,
        heading_level: source.heading_level ?? null,
        observed_text: normalize(source.observed_text),
        source_digest: source.source_digest,
        evidence_digest: digest({ ...identity, hashtag: tag.hashtag, source_digest: source.source_digest }),
        review_required: true,
        auto_content_use: false,
      });
    }
  }
  occurrences.sort((a, b) => a.site_id.localeCompare(b.site_id) || a.normalized_tag.localeCompare(b.normalized_tag) || a.occurrence_id.localeCompare(b.occurrence_id));
  const grouped = new Map();
  for (const row of occurrences) {
    const key = `${row.site_id}\0${row.normalized_tag}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  const rows = [...grouped.values()].map((items) => {
    const classifications = [...new Set(items.map((row) => row.classification))];
    const sourceKinds = [...new Set(items.map((row) => row.source_kind))].sort();
    const classification = classifications.length === 1 ? classifications[0] : "ambiguous_marker_review";
    const evidence = {
      site_id: items[0].site_id,
      hashtag: items[0].hashtag,
      normalized_tag: items[0].normalized_tag,
      classification,
      occurrence_count: items.length,
      source_kinds: sourceKinds,
      task_ids: [...new Set(items.map((row) => row.task_id).filter(Boolean))].sort(),
      group_ids: [...new Set(items.map((row) => row.group_id).filter(Boolean))].sort(),
      page_ids: [...new Set(items.map((row) => row.page_id).filter(Boolean))].sort(),
      urls: [...new Set(items.map((row) => row.url).filter(Boolean))].sort(),
      occurrence_ids: items.map((row) => row.occurrence_id),
      review_required: true,
      popularity_inferred: false,
      trend_inferred: false,
      search_volume_inferred: false,
      auto_content_use: false,
    };
    return { ...evidence, evidence_digest: digest(evidence) };
  }).sort((a, b) => b.occurrence_count - a.occurrence_count || a.normalized_tag.localeCompare(b.normalized_tag));
  return {
    policy: "observed-hashtag-evidence.v1",
    source_policy: "retained_serp_and_fetched_heading_text_only",
    rows,
    occurrences,
  };
}
