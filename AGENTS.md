<!-- HELIX:managed:start -->
# HELIX アダプター

この project は HELIX lifecycle を現行 `helix` command で扱う。PLAN-M-02 で atomic identifier migration が行われるまでは、CLI 名は `helix` のまま扱う。

PO への進捗報告・調査結論・確認依頼など chat 出力は日本語を既定とする。docs / handover / adapter prose も日本語を基本とし、CLI 名・識別子・技術用語は原語のまま扱ってよい。

- 状態確認: `helix status`
- 完了判定 packet 確認: `helix completion decision-packet --json`
- 完了 review bundle 確認: `helix completion review-bundle --json` (exact digest と semantic digest を確認)
- Version-up dry-run: `helix version-up dry-run --current v0.1.0 --target v0.1.4 --release-remote https://github.com/RetryYN/HELIX-HARNESS-OS.git --json`
- 診断: `helix doctor --profile consumer`
- rename packet 確認: `helix rename plan --json`
- 継続状態: `helix status`（`harness.db` continuation projection）
- Codex 委譲: `helix codex --role <role> --task "..."`
- Claude 委譲: `helix claude --role <role> --task "..."`
- チーム dry-run: `helix team run --definition .helix/teams/default-hybrid.yaml --mode hybrid --json`

この managed block の外側にある project-owned instruction は consumer 側の所有物として扱い、勝手に上書きしない。
<!-- HELIX:managed:end -->
