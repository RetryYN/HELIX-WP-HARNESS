const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
const normalize = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/gu, " ").trim();

// Word boundaries establish a mention, not the intended sense or topic coverage.
export function matchConceptMention(text, term) {
  const source = normalize(text), target = normalize(term);
  if (!target) return "absent";
  const boundaries = new Set([0, source.length]);
  for (const item of segmenter.segment(source)) {
    boundaries.add(item.index);
    boundaries.add(item.index + item.segment.length);
  }
  let partial = false;
  for (let start = source.indexOf(target); start !== -1; start = source.indexOf(target, start + 1)) {
    if (boundaries.has(start) && boundaries.has(start + target.length)) return "word_boundary_mention";
    partial = true;
  }
  return partial ? "substring_only" : "absent";
}
