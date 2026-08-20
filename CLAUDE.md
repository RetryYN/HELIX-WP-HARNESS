<!-- HELIX:managed:start -->
# HELIX 共有コンテキスト

harness state と delegation には repository-local の現行 `helix` command を使う。PLAN-M-02 までは command 名を `helix` とする。

PO への進捗報告・調査結論・確認依頼など chat 出力は日本語を既定とする。docs / handover / adapter prose も日本語を基本とし、CLI 名・識別子・技術用語は原語のまま扱ってよい。

- `helix status` は local runtime mode を報告する。
- `helix completion decision-packet --json` は completionClaimAllowed=false と未完了 blocker queue を確認する。
- `helix completion review-bundle --json` は S4 / version-up / rename / action-binding の scoped review packet、exact digest、semantic digest を確認する。
- `helix version-up dry-run --current v0.1.0 --target v0.1.4 --release-remote https://github.com/RetryYN/HELIX-HARNESS-OS.git --json` は distribution tag 更新を plan-only / no-write 証跡として確認する。
- `helix doctor --profile consumer` は consumer repo 向け health check を実行する。
- `helix rename plan --json` は PLAN-M-02 承認前の blocked packet を確認する。
- `helix status` は DB-backed cross-runtime continuation state を報告する。
- `helix codex --role <role> --task "..."` は Codex へ委譲する。
- `helix claude --role <role> --task "..."` は Claude へ委譲する。

adapter doc に secret、token、machine-local absolute path を書かない。
<!-- HELIX:managed:end -->

<!-- project-owned:start -->
## 統合層規律の継承（project-owned）

本リポは HELIX-MARKETING-HARNESS（統合層）の `media/wp/` submodule として結合されており、
統合層 CLAUDE.md の「傘下リポ共通規律」を継承する（PO 承認前の外部 write 禁止／
credential 非格納／PoC→要求→設計→実装の順／cross-repo 編集禁止／破壊的操作は PO 明示判断）。

- `vendor/helix-harness/` は RetryYN/HELIX-HARNESS の**固定 commit read-only 参照**。
  中のファイルを編集しない。pin 更新は `helix version-up dry-run` で計画を確認してから行う。
- HELIX Lite として導入するのはコア（規律・CI・doctor・review・completion evidence）まで。
  resident lanes / routing / allocation / 配布系は本家で育て、本リポへ複製しない。
<!-- project-owned:end -->
