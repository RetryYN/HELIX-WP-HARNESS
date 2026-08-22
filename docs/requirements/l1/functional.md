---
layer: L1
sub_doc: functional
status: confirmed_input
pair_artifact: docs/test-design/l12-operational-value-test-design.md
authority: docs/requirements/authority.md
---

# L1 Functional Requirements

| ID | ユーザー視点の要求 | 下流family |
| --- | --- | --- |
| WP-FRL1-01 | POはサイト設計Excelから施策対象を取り込める | KW |
| WP-FRL1-02 | POはKWの足切り・統合・戦場選定の根拠を確認し訂正できる | KW/AUDIT |
| WP-FRL1-03 | POは根拠と品質gateを満たす記事を下書きまたは承認後に公開できる | POST |
| WP-FRL1-04 | POは投稿・固定ページ・LPを共通の意図語彙で扱える | DOC |
| WP-FRL1-05 | POは要承認、異常、成果、次回予定を画面で確認できる | UI/AUDIT |
| WP-FRL1-06 | POは外部writeを承認、差し戻しでき、その判断履歴を確認できる | APPROVAL |
| WP-FRL1-07 | POはGSC、GA4、ASP、費用データの鮮度と取得失敗を確認できる | INGEST |

L1のIDはユーザー要求であり、L3のsystem requirement IDとは区別する。
