# 再開点（2026-08-27 整備）

## 現在地

- L1 企画書 `docs/planning/l1-plan-autonomous-wp-harness.md` = **confirmed**（2026-08-21、変更なし）。
- 現行 PLAN = `PLAN-L2-001-s1-draft-post-requirements`（`.helix/state/current-plan`、未完）。
- **2026-08-25〜27、`research/seo-tool-a-keyword-analysis` で SeoToolA キーワード分析 PoC が
  ハーネス未経由で 90 コミット進行**。成果は
  `docs/poc/seo-tool-a-keyword-analysis-poc-summary-2026-08-27.md` に索引化した（一次完了・未検証・未要求化）。
- `helix doctor` は赤（doc 雛形欠落・nfr-registry 欠落・decision-packet 不整合）。8/21 時点の green から後退。
- codex は `codex/wp-poc5-required-topics`（worktree）で作業中。research ブランチへ直接 push しない。

## 次にやること

1. SeoToolA PoC 要約を **PLAN-L2-001 の入力**として扱い、L2 スライス1 の R6 詳細要求（confirmed 待ち）に
   費用上限・SERP 再利用条件・無人実行可否を反映して PO に confirmed を求める（G1 報告は WP-* ID で）。
2. `helix doctor` を緑へ戻す（欠落 doc は最小雛形、decision-packet は現在地更新で追従）。
3. research ブランチを PR 化（レビュー codex-sol・コメント方式）→ マージ後に統合層 pin 更新。
4. <poc-parent-domain> 引継ぎ・L1 未決 9 項目は前回のまま未着手。

## 制約の要点（変更なし）

- 無人実行はリスク分類の許可範囲のみ／対外契約操作は有人ブラウザのみ。
- 費用: 無料車線優先・DataProviderB は AI 計測例外（standard キュー・キャッシュ必須）。
- 成功基準: 売上 ≧ コスト × 2（目安 月商 15 万円）を連続 3 か月・決定論実測で判定。
