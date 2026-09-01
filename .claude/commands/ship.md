---
description: release evidence、rollback note、最終検証を準備する。
argument-hint: "<target>"
---

Command: ship

対象: $ARGUMENTS

note: PLAN-M-02 承認前は `helix` alias ではなく、現行 `helix` CLI だけで repository-local の HELIX lifecycle を扱う。最初に `helix status --json`、`helix completion decision-packet --json`、`helix completion review-bundle --json`、`helix version-up dry-run --current v0.1.0 --target v0.1.4 --release-remote https://github.com/RetryYN/HELIX-HARNESS-DevOS.git --json` を実行し、completion review-bundle の exact digest と semantic digest を確認する。対象に必要な narrow verification を走らせ、workflow または gate behavior に影響する場合は `helix doctor --profile consumer` で閉じる。
