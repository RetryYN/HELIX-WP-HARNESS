# HELIX-WP-HARNESS

WordPress 専用のマーケティングハーネス。`RetryYN/HELIX-MARKETING-HARNESS` からの
**媒体別リポジトリ分割**（1 媒体 = 1 ハーネス = 1 リポジトリ）の 1 号として、
PO 判断（2026-08-21）により白紙から出発する。

## 出自と持ち込み範囲

- 持ち込みは **WordPress PoC 証跡のみ**（`docs/poc/`）。
- 旧リポジトリの要求正本（L0〜L6・契約 JSON・ゲート群・discovery ledger）は
  **持ち込まない**。参照が必要な場合は旧リポジトリを read-only で参照する。
- 要求は本リポジトリで新規に起こす（`docs/requirements/` 参照）。

## 原則（旧リポジトリから引き継ぐ規律の最小集合）

- PO 承認前の外部 write（WordPress への投稿・設定変更）は行わない。
- credential をリポジトリ・ログへ書かない。
- PoC → 要求 → 設計 → 実装の順を守り、PoC 証跡なしで実装を始めない。

## ローカル設定で注入する値（公開リポに書かない）

| 環境変数 | 用途 |
|---|---|
| `DATA_PROVIDER_B_LOGIN` / `DATA_PROVIDER_B_PASSWORD` | データ提供ベンダー B の API 認証（Basic） |
| `DATA_PROVIDER_B_LABS_PATH` | 同ベンダーの Labs 系エンドポイントのパス接頭辞（ベンダー名を含むため伏せ字。既定値はダミー） |
| `WP_DATA_PROVIDER_B_ENRICHMENT_LIVE=1` / `WP_DATA_PROVIDER_B_ENRICHMENT_MAX_USD` | 課金取得の明示許可と上限 |

実値の対応表は `.public-safety.local.regex` / `PUBLIC_REDACTION_GUARD_RE` と同様にリポジトリ外で管理する。
