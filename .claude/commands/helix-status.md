---
description: HELIX status / completion packet / doctor 出力を確認する。
---

`helix status --json`、`helix completion decision-packet --json`、`helix completion review-bundle --json`、`helix version-up dry-run --current v0.1.0 --target v0.1.4 --release-remote https://github.com/RetryYN/HELIX-HARNESS-OS.git --json`、`helix doctor --profile consumer` を実行し、HELIX mode、completionClaimAllowed、completion review bundle の exact digest / semantic digest、version-up plan-only 境界、未完了 blocker、hard-gate failure を要約する。
