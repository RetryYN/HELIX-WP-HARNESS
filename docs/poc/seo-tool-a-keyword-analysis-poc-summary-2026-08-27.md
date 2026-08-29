---
artifact_id: WP-POC-SEO_TOOL_A-KEYWORD-ANALYSIS-20260827
status: primary-complete-unregistered
evidence_cutoff: 2026-08-27
source_branch: research/seo-tool-a-keyword-analysis
source_range: 2577737..66e106b
---

# SeoToolA キーワード分析 PoC — 一次要約（ハーネス再登録用）

## 1. 何が起きたか

- 2026-08-25〜27、`research/seo-tool-a-keyword-analysis` ブランチで **90 コミット / 110 ファイル / +23,665 行** が
  ハーネス（`.helix/` の PLAN・resume-point・harness.db）を経由せずに積まれた。
- 本書はその成果を **PoC 証跡として回収** し、`PLAN-L2-001-s1-draft-post-requirements` の入力に接続するための索引である。
  内容の正しさを検証したものではない（検証は要求化の段階で行う）。

## 2. 成果の所在

| 種別 | 場所 | 概要 |
|---|---|---|
| 調査台帳 | `docs/research/seo-tool-a-keyword-competitive-analysis.md` | SeoToolA 公開機能・API と本リポ実装の差分台帳（根拠クラス付き） |
| API 契約 | `docs/research/seo-tool-a-openapi-inventory.json` / `evidence/seo-tool-a-openapi.json` | 公開 OpenAPI の全操作を証跡へ写像 |
| 能力判定 | `docs/research/seo-tool-a-capability-decisions.json` | 各能力の実装/不足/採否 |
| 料金 | `docs/research/seo-tool-a-pricing-policy.json` | 公開料金とプロバイダ費用の照合 |
| Web 機能棚卸 | `docs/research/seo-tool-a-web-capability-inventory.json` | 公開画面機能の一覧 |
| プロトタイプ | `docs/prototypes/wp-ops-dashboard/` | SEO 研究ダッシュボード（SERP・競合・共起・AIO・内部リンク・タイトル/見出し生成） |
| 実行証跡 | `artifacts/poc/`、`.helix/evidence/` | SERP snapshot・GSC 7d/28d・keyword workbook・WP headings |
| スクリプト | `scripts/*.mjs`（test-* 対で同梱） | 上記の再現・検査 |

## 3. 一次的に判明したこと（要求化の候補）

1. SeoToolA 公開 API の全操作が、既存の SERP/GSC 証跡へ写像できる（`docs/research/seo-tool-a-openapi-inventory.json`）。
2. 有料プロバイダ（DPB）取得は料金検証つきのゲートで止められる（`gate provider plans with verified pricing`）。
3. SERP snapshot の再利用（同一 KW の履歴比較）で再取得コストを抑えられる（最終コミット 66e106b）。
4. タイトル候補・見出しアウトラインは「証跡に束縛された生成」として品質オラクルでゲートできる。
5. WordPress 公開面（sitemap・ナビ・SEO メタ）の棚卸が read-only で可能。

いずれも **単一サイト・単日観測** に基づく一次結果であり、要求（WP-*）へ昇格するには
再現性・費用上限・無人実行可否の判定が要る（決定者 = PO）。

## 4. 未了

- ハーネスへの PLAN 紐付け（本書で resume-point に接続、DB 登録は未）
- `helix doctor` 赤（doc カバレッジ雛形欠落・nfr-registry 欠落・decision-packet 不整合）の解消
- research ブランチの main への PR / レビュー（codex-sol・コメント方式）
- 統合層 `media/wp` pin の更新（PR マージ後）
