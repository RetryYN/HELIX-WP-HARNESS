import { createHash } from "node:crypto";

export function sampleSemanticEvaluationPairs(pairs, { size, seed }) {
  if (!Number.isSafeInteger(size) || size < 1 || size > pairs.length) {
    throw new Error("Sample size must be an integer between 1 and the pair population size");
  }
  if (typeof seed !== "string" || !seed.trim()) throw new Error("A nonempty sampling seed is required");
  const seen = new Set();
  const ranked = pairs.map((row) => {
    if (!row.left_task_id || !row.right_task_id || row.left_task_id === row.right_task_id) {
      throw new Error("Two distinct task IDs are required");
    }
    const key = JSON.stringify([row.left_task_id, row.right_task_id].sort());
    if (seen.has(key)) throw new Error("Duplicate task pair in sample population");
    seen.add(key);
    // Do not rank by pair_digest: it can encode classifier-dependent evidence.
    const rank = createHash("sha256").update(JSON.stringify([seed, key])).digest("hex");
    return { row, key, rank };
  });
  ranked.sort((a, b) => a.rank.localeCompare(b.rank) || a.key.localeCompare(b.key));
  return ranked.slice(0, size).map(({ row }) => row);
}
