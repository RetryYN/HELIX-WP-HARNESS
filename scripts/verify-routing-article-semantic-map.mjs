import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (file) => { const bytes = fs.readFileSync(file); return { value: JSON.parse(bytes), digest: sha(bytes) }; };
const index = (rows, key, label) => {
  const result = new Map();
  for (const row of rows ?? []) {
    assert(row?.[key] != null, `${label} requires ${key}`);
    assert(!result.has(row[key]), `duplicate ${label}: ${row[key]}`);
    result.set(row[key], row);
  }
  return result;
};
const nonempty = (value, label) => assert(typeof value === 'string' && value.trim(), `${label} required`);

export function verifyRoutingArticleSemanticMap(packet, review, brief, audit, map) {
  assert.equal(map.schema_version, 'routing-article-semantic-map.v1');
  for (const [name, source] of Object.entries({ packet, review, brief, audit })) {
    assert.equal(map.source_digests?.[name], source.digest, `${name} source digest mismatch`);
  }
  const jobId = map.job_id;
  nonempty(jobId, 'job_id');
  const page = index(packet.value.pages, 'job_id', 'packet page').get(jobId);
  const reviewPage = index(review.value.pages, 'job_id', 'review page').get(jobId);
  const design = index(brief.value.briefs, 'job_id', 'editorial brief').get(jobId);
  const audited = index(audit.value.jobs, 'job_id', 'independent audit').get(jobId);
  assert(page && reviewPage && design && audited, `${jobId}: source page missing`);
  const keywords = index(page.acquired_keywords, 'keyword_digest', 'acquired keyword');
  const classifications = index(reviewPage.keyword_reviews, 'keyword_digest', 'keyword review');
  const auditKeywords = index(audited.keyword_audit, 'keyword_digest', 'audited keyword');
  assert.deepEqual(new Set(classifications.keys()), new Set(keywords.keys()), 'keyword review coverage mismatch');
  assert.deepEqual(new Set(auditKeywords.keys()), new Set(keywords.keys()), 'audited keyword coverage mismatch');
  const sections = index(design.sections, 'unit_id', 'brief section');
  const links = index(design.internal_links, 'candidate_id', 'internal-link candidate');
  const groups = index(map.groups, 'group_id', 'meaning group');
  assert(groups.size > 0, 'meaning groups required');
  const routed = new Set();
  let onPage = 0; let internal = 0;
  for (const group of groups.values()) {
    nonempty(group.reader_question, `${group.group_id}: reader question`);
    nonempty(group.meaning_boundary, `${group.group_id}: meaning boundary`);
    assert(['on_page', 'internal_candidate'].includes(group.destination), `${group.group_id}: invalid destination`);
    assert(Array.isArray(group.keyword_digests) && group.keyword_digests.length, `${group.group_id}: keyword digests required`);
    if (group.destination === 'on_page') assert(sections.has(group.unit_id), `${group.group_id}: unknown brief unit`);
    else assert(links.has(group.candidate_id), `${group.group_id}: unknown internal-link candidate`);
    for (const digest of group.keyword_digests) {
      assert(keywords.has(digest), `${group.group_id}: keyword absent from exact page`);
      assert(!routed.has(digest), `duplicate mapped keyword: ${digest}`);
      routed.add(digest);
      assert.equal(classifications.get(digest).class, group.review_class, `${group.group_id}: review class mismatch`);
      const route = auditKeywords.get(digest).route;
      if (group.destination === 'on_page') {
        assert.equal(route.route, 'meaning_unit', `${group.group_id}: audit route mismatch`);
        assert.equal(route.unit_id, group.unit_id, `${group.group_id}: audited unit mismatch`);
        assert(sections.get(group.unit_id).keyword_digests.includes(digest), `${group.group_id}: keyword absent from brief section`);
        onPage++;
      } else {
        assert.equal(route.route, 'internal_link_candidate', `${group.group_id}: audit route mismatch`);
        assert.equal(route.candidate_id, group.candidate_id, `${group.group_id}: audited link mismatch`);
        internal++;
      }
    }
  }
  assert.deepEqual(routed, new Set(keywords.keys()), 'acquired keyword coverage mismatch');
  const originalHeadings = index(page.heading_evidence.headings, 'position', 'exact-page heading');
  const auditedHeadings = index(audited.heading_reviews, 'position', 'audited heading');
  assert.deepEqual(new Set(auditedHeadings.keys()), new Set(originalHeadings.keys()), 'heading audit coverage mismatch');
  const headingRoutes = index(map.heading_routes, 'position', 'mapped heading');
  const substantive = [...auditedHeadings.values()].filter((row) => row.classification !== 'excluded');
  assert.deepEqual(new Set(headingRoutes.keys()), new Set(substantive.map((row) => row.position)), 'substantive heading coverage mismatch');
  for (const route of headingRoutes.values()) {
    const original = originalHeadings.get(route.position);
    const independent = auditedHeadings.get(route.position);
    assert(original && independent?.classification !== 'excluded', `excluded or unknown heading mapped: ${route.position}`);
    assert.equal(route.heading_digest, sha(original.text), `heading ${route.position}: source text mismatch`);
    assert.equal(independent.heading_digest, route.heading_digest, `heading ${route.position}: audit digest mismatch`);
    assert(sections.has(route.unit_id), `heading ${route.position}: unknown brief unit`);
    assert(independent.matched_unit_ids.includes(route.unit_id), `heading ${route.position}: unit not independently supported`);
  }
  const briefEdges = new Set(design.story_transitions.map((edge) => {
    assert.equal(edge.hypothesis_only, true, 'brief transition claims observed behavior');
    return `${edge.source_unit_id}->${edge.target_unit_id}`;
  }));
  const mappedEdges = new Set();
  for (const edge of map.transition_hypotheses ?? []) {
    assert.equal(edge.hypothesis_only, true, 'mapped transition claims observed behavior');
    nonempty(edge.condition, 'transition condition');
    assert(sections.has(edge.from) && sections.has(edge.to), 'transition endpoint absent from brief');
    const key = `${edge.from}->${edge.to}`;
    assert(briefEdges.has(key), `transition absent from brief: ${key}`);
    assert(!mappedEdges.has(key), `duplicate transition: ${key}`);
    mappedEdges.add(key);
  }
  assert.deepEqual(mappedEdges, briefEdges, 'brief transition coverage mismatch');
  return {
    schema_version: 'routing-article-semantic-map-verification.v1', job_id: jobId,
    summary: { acquired_keywords: keywords.size, mapped_keywords: routed.size, on_page_keywords: onPage,
      internal_candidate_keywords: internal, meaning_groups: groups.size,
      substantive_headings: substantive.length, mapped_headings: headingRoutes.size,
      transition_hypotheses: mappedEdges.size, observed_user_transitions: 0 },
    limits: ['This verifies source-bound routing, not semantic correctness of the article body.',
      'An internal candidate is not an installed link or an answered on-page question.',
      'Hypothetical transitions are not observed user behavior or ranking evidence.']
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const files = process.argv.slice(2);
  if (files.length !== 5) throw new Error('usage: node scripts/verify-routing-article-semantic-map.mjs PACKET REVIEW BRIEF AUDIT MAP');
  const [packet, review, brief, audit, map] = files.map(read);
  console.log(JSON.stringify(verifyRoutingArticleSemanticMap(packet, review, brief, audit, map.value), null, 2));
}
