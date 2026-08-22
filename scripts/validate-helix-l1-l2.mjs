import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const cli = resolve(root, "node_modules/.bin/tsx");
const result = spawnSync(cli, ["node_modules/helix/src/cli.ts", "l1-l2", "gap-check", "--json"], {
  cwd: root,
  encoding: "utf8",
});
if (result.status !== 0) {
  throw new Error(`HELIX L1/L2 gap-check failed (${result.status}): ${result.stderr || result.stdout}`);
}
const packet = JSON.parse(result.stdout);
if (packet.schemaVersion !== "l1-l2-gap-check.v1") throw new Error("unexpected HELIX L1/L2 gap-check schema");
if (packet.consistency?.ok !== true || packet.consistency?.checked !== 8) {
  throw new Error(`HELIX L1/L2 projection is not connected to all 8 WP screens: ${JSON.stringify(packet.consistency)}`);
}
if (packet.consistency.violations.length !== 0 || packet.consistency.messages.some((line) => !line.includes("mock pair=declared"))) {
  throw new Error(`HELIX L1/L2 structural coverage is not green: ${JSON.stringify(packet.consistency)}`);
}
if (packet.contentReviewRequired !== true || packet.completionClaimAllowed !== false) {
  throw new Error("HELIX L1/L2 human review boundary changed unexpectedly");
}
console.log("HELIX L1/L2 validation: OK (8 WP screens, bidirectional coverage, mock pair declared)");

