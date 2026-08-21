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
## 統合層規律の継承（project-owned）

本リポは HELIX-MARKETING-HARNESS（統合層）の `media/wp/` submodule として結合されている。
統合層ルートの `CLAUDE.md` にある「傘下リポ共通規律」を Codex でも継承する。

- PO 承認前の外部 write を行わない。
- credential を repository・DB・ログへ書かない。
- PoC → 要求 → 設計 → 実装の順を守る。
- cross-repo 編集を行わない。
- 破壊的・不可逆な操作は PO の明示判断後に行う。
- `base/wp-theme/` の旧 L0〜L8 状態を、本リポの現在進捗として扱わない。

進捗確認では `helix status` と `helix completion decision-packet --json` を正本とし、
README やコミットメッセージだけから完了状態を推定しない。

このリポジトリでは裸の `helix` を使わず、必ず `npm run helix -- <command>` を使う。
ユーザー環境の global wrapper は別 checkout を参照し得るため、進捗・doctor・PLAN・handover の
証跡には採用しない。
<!-- project-owned:end -->
