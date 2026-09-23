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

進捗確認では `helix status` と `helix completion decision-packet --json` を正本とし、
README やコミットメッセージだけから完了状態を推定しない。

このリポジトリでは裸の `helix` を使わず、必ず `npm run helix -- <command>` を使う。
ユーザー環境の global wrapper は別 checkout を参照し得るため、進捗・doctor・PLAN・handover の
証跡には採用しない。
<!-- project-owned:end -->
