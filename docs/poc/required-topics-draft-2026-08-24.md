# 共通見出し抽出・required_topics 確定・記事下書き生成 PoC

- 実施日: 2026-08-24
- 判定: **PASS（限定スコープ）**
- 対象: solobiz 記事KW群 main「ライター 副業」+ 内包「記事作成 副業」
- 入力: `artifacts/poc/keyword-serp/raw/` の既存 SERP snapshot（DFS 追加取得なし）
- 実行証跡: `artifacts/poc/required-topics/`（required-topics.json / draft-article.md /
  draft-article.json / gate-result.json）

## 成立したこと

1. 2 KW の raw snapshot から organic 上位5 URL（重複統合で 7 URL）を集め、各 URL へ
   単発 HTTP fetch（UA 明示、リトライ最小）した。raw HTML は保存せず、HTML の sha256
   digest と h1-h3 抽出見出しリストのみを証跡として保存した。
2. 見出しの NFKC 正規化 → 助詞・記号分割トークン集合から、取得成功ページの過半数に
   出現するトークンを共通テーマとして決定論で抽出できた。
3. required_topics = 共通テーマ + 両KW の PAA 質問とし、各 topic に出典
   （snapshot digest / fetch digest / URL）を付けた。逆引き不能な topic は出力していない。
4. required_topics と PAA からテンプレート組み立てで記事下書き（markdown、h2/h3 構成、
   main KW をタイトル・主要見出し・本文に含む）を決定論生成した。LLM 呼び出しなし。
   本文は構成骨子と PAA 回答枠のみで、事実数値は「推定」「要出典」プレースホルダ。
5. 既存 `checkKeywordCoverage` による main/sub KW coverage と、compact 正規化 includes
   による required_topics coverage を `gate-result.json` に pass/fail で記録した。

## 判定規則

- 共通テーマ: 取得成功ページ数を n として、`出現ページ数 > n/2` のトークンを採用。
- 取得成功が 3 ページ未満の場合は `verdict: "insufficient"` を判定 JSON に記録して
  fail-close（下流の gate は pass にならない）。プロセスは exit 1 しない。
- coverage gate: main/sub KW は既存の空白除去比較形、required_topics は compact 正規化
  includes。いずれか欠落で fail。
- 決定論テスト（`scripts/test-required-topics.mjs`）: 同一入力→同一出力、過半数判定、
  3 ページ未満 fail-close、coverage 判定をネットワークなしで検証。

## 実測結果

- fetch: 7 URL 中 6 成功、1 失敗（`jp.indeed.com` HTTP 403 → 記録して continue）
- heading_analysis verdict: `determined`（成功 6 ページ ≥ 最低 3 ページ）
- 共通テーマ: 1 件（`副業`、6 ページ中 4 ページに出現）
- PAA 質問: 8 件抽出（重複統合後 required_topics へ 7 件）
- required_topics: 8 件（common_theme 1 + paa 7）。全件に snapshot/fetch digest と URL の出典付き
- 下書き生成入力 digest: `07882b9c701efe2cc8869e9ebb6214f304020f1376e1babcde7a719d0a6ebd84`
- gate-result: keyword_coverage **pass**、required_topics_coverage **pass**、総合 **pass**
- 決定論テスト: `npm run poc:required-topics:test` → OK

## 限界と次工程

- 共通テーマ抽出は単純トークン過半数であり、意味的な同義集約はしていない。今回は
  「副業」1 トークンのみが閾値を超えた。粒度改善は次工程。
- エビデンスゲート（出典の実在検証・引用強制）の実装は②以降のスコープ。本 PoC は
  出典 digest の付与と逆引き可能性の担保まで。
- 下書きはテンプレート骨子であり、LLM による本文執筆は本 PoC 非スコープ。
- WP への投稿は PO 承認事項であり非スコープ。本 PoC は外部 write を行っていない
  （競合ページへの read-only GET のみ）。
