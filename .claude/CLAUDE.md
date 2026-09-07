<!-- HELIX:managed:start -->
# Claude runtime アダプター

Claude Code session の HELIX lifecycle work は、現行 `helix` CLI 経由で扱う。
consumer 側所有の Claude instruction は、この managed block の外側へ追加できる。
PLAN-M-02 で atomic identifier migration が行われるまでは、CLI 名は `helix`、state dir は `.helix` のまま扱う。

PO への進捗報告・調査結論・確認依頼など chat 出力は日本語を既定とする。docs / handover / adapter prose も日本語を基本とし、CLI 名・識別子・技術用語は原語のまま扱ってよい。

- セッション証跡: `helix status`、`harness.db` continuation projection、`helix completion decision-packet --json`、`helix completion review-bundle --json` (exact digest と semantic digest を確認)、`helix version-up dry-run --current v0.1.0 --target v0.1.4 --release-remote https://github.com/RetryYN/HELIX-HARNESS-DevOS.git --json`、`helix rename plan --json`
- 診断: `helix doctor --profile consumer`
- レビュー分離: 可能な場合は別 runtime / model family を使う

<!-- HELIX:managed:end -->
