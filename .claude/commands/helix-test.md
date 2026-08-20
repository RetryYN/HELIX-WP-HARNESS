---
description: 現在の変更に対して HELIX verification を実行する。
argument-hint: "<changed area or PLAN id>"
---

対象: $ARGUMENTS

最初に `helix status --json`、`helix completion decision-packet --json`、`helix completion review-bundle --json`、`helix version-up dry-run --current v0.1.0 --target v0.1.4 --release-remote https://github.com/RetryYN/HELIX-HARNESS-OS.git --json` を確認し、completion review-bundle の exact digest / semantic digest を照合する。narrow Vitest target、`npm run typecheck`、`npm run lint` を実行する。変更が HELIX workflow または gate に影響する場合は `helix doctor --profile consumer` で閉じる。
