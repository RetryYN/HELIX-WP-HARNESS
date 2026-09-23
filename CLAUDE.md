<!-- HELIX:managed:start -->
# HELIX 共有コンテキスト

harness state と delegation には repository-local の現行 `helix` command を使う。PLAN-M-02 までは command 名を `helix` とする。

PO への進捗報告・調査結論・確認依頼など chat 出力は日本語を既定とする。docs / handover / adapter prose も日本語を基本とし、CLI 名・識別子・技術用語は原語のまま扱ってよい。

- `helix status` は local runtime mode を報告する。
- `helix completion decision-packet --json` は completionClaimAllowed=false と未完了 blocker queue を確認する。
- `helix completion review-bundle --json` は S4 / version-up / rename / action-binding の scoped review packet、exact digest、semantic digest を確認する。
- `helix version-up dry-run --current v0.1.0 --target v0.1.4 --release-remote https://github.com/RetryYN/HELIX-HARNESS-DevOS.git --json` は distribution tag 更新を plan-only / no-write 証跡として確認する。
- `helix doctor --profile consumer` は consumer repo 向け health check を実行する。
- `helix rename plan --json` は PLAN-M-02 承認前の blocked packet を確認する。
- `helix status` は DB-backed cross-runtime continuation state を報告する。
- `helix codex --role <role> --task "..."` は Codex へ委譲する。
- `helix claude --role <role> --task "..."` は Claude へ委譲する。

adapter doc に secret、token、machine-local absolute path を書かない。
<!-- HELIX:managed:end -->

<!-- project-owned:start -->
## 共通規律（採用版 2026-09-23、project-owned）

旧統合層 HELIX-MARKETING-HARNESS（2026-09-23 に PO 判断で廃止）の「傘下リポ共通規律」を本リポの正本として採用する。
本節と矛盾する記述がある場合は本節が優先。

1. PO 承認前に外部（本番 WP・公開先・第三者サービス）への write をしない。
2. credential を repository・DB・ログへ書かない。
3. 進行順序は PoC（実機証跡）→ 要求 → 設計 → 実装。証跡なしに実装へ進まない。
4. cross-repo 編集禁止。他リポへの書き込みは指示に含まれていても着手前に PO へ確認する。
   `RetryYN/HELIX-HARNESS` と `RetryYN/TAKUMI_CMO-Claude_Cowark` は read-only 参照。
5. 破壊的・不可逆な操作（削除・rename・force-push・履歴改変）は PO の明示判断を得てから行う。
6. 公開リポジトリへ、credential に限らず、実運用サイトを特定する情報、個人環境の絶対パス、
   広告・affiliate の追跡識別子、転載許諾を確認していない記事本文、非公開調査対象の固有名を
   記録しない。read-only 証跡も公開可能な最小表現へ変換し、原文・対応表はリポジトリ外で扱う。
7. commit / push / Issue・PR 起票前に `bash scripts/public-safety-guard.sh --staged` を通す。
   調査・証跡・PoC artifact を変更する場合は、非公開の固有名対応表を
   `PUBLIC_REDACTION_GUARD_RE` または `.public-safety.local.regex` から注入する。
   clone / worktree 作成後は `bash scripts/install-public-safety-hooks.sh` で tracked hook を有効にする。

公開情報の分類、例外、事故対応の正本は `docs/governance/public-repository-safety.md`。
検査を通すために実値を allowlist へ追加してはならず、例外は理由・owner・期限を持つ PO 判断として扱う。

メモリ（Claude の auto-memory・共有ハーネスメモリとも）へは、PO の明示指示があるときだけ書く。
指摘を受けたら、その場限りの指摘か永続的な指摘かを先に区別する。

HELIX-WP-THEME は別リポとして独立運用する。その旧 L0〜L8 状態を本リポの現在進捗として扱わない。

- HELIX-HARNESS は npm 依存 `helix: github:RetryYN/HELIX-HARNESS#dcfbb845` の**固定 commit 参照**
  （node_modules 内は編集しない）。pin 更新は `helix version-up dry-run` で計画を確認してから行う。
- HELIX Lite として導入するのはコア（規律・CI・doctor・review・completion evidence）まで。
  resident lanes / routing / allocation / 配布系は本家で育て、本リポへ複製しない。
- このリポジトリでは裸の `helix` を使わず、必ず `npm run helix -- <command>` を使う。
  global wrapper は別 checkout を参照し得るため、進捗・doctor・PLAN・handover の証跡には採用しない。
<!-- project-owned:end -->
