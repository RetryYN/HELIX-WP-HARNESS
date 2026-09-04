import assert from "node:assert/strict";
import { matchConceptMention } from "./concept-mention.mjs";

for (const [text, term, expected] of [
  ["大学院の選び方", "大学", "substring_only"],
  ["大学の選び方", "大学", "word_boundary_mention"],
  ["cart", "art", "substring_only"],
  ["cart and art", "art", "word_boundary_mention"],
  ["ＡＩの活用", "ai", "word_boundary_mention"],
  ["銀、行", "銀行", "absent"],
  ["銀行と無関係な話", "銀行", "word_boundary_mention"],
  ["仕事をしない選択", "仕事", "word_boundary_mention"],
  ["何もない", "", "absent"],
]) assert.equal(matchConceptMention(text, term), expected, `${text} / ${term}`);
console.log("Concept mentions: word boundaries, normalization, punctuation and negated mentions verified; no sense inference");
