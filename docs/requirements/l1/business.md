---
layer: L1
sub_doc: business
status: confirmed_input
pair_artifact: docs/test-design/l12-operational-value-test-design.md
authority: docs/requirements/authority.md
---

# L1 Business Requirements

| ID | 要求 | 成功判定 |
| --- | --- | --- |
| WP-BR-01 | POの日常作業を方針・承認・例外判断へ限定し、WP投稿・計測・改善ループを自走可能にする | S3運転で通常タスクにPO手作業がなく、分類外と高リスクだけ停止する |
| WP-BR-02 | 既存サイトを引き継ぎ、実態から運用ルールを構成できる | 引継ぎinventoryと差分判断が再現可能 |
| WP-BR-03 | 新規サイトを立ち上げ、HELIX-WP-THEMEへ接続できる | S4別sliceの受入で検証する |
| WP-BR-04 | 投稿・計測・改善の判断を証跡由来にする | UI表示から入力、判定、承認、外部結果まで追跡できる |
| WP-BR-05 | 総売上が総運用コストの2倍以上となる状態を連続3か月維持する | 推計を除外した月次実測で判定する |

## Actorとscope

- actor: PO 1名、WP運用agent、決定論analyzer、外部service
- production boundary: 初期対象`solobiz-lab.com`
- release boundary: S3。S4は別sliceとして再承認する。
- non-goal: WP theme自体の開発、WP以外の媒体、第三者配布、決済の自動実行

## 未決事項

売上算定、共通AI費用配賦、GSC filter、標準plugin、主サイト影響条件は後続L2 candidateとしてownerと
再入場条件を保持し、スライス1のfreezeへ混入させない。
