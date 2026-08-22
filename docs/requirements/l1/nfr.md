---
layer: L1
sub_doc: nfr
status: confirmed_input
pair_artifact: docs/test-design/l12-operational-value-test-design.md
authority: docs/requirements/authority.md
---

# L1 Non-functional Requirements

| ID | 品質要求 | 測定方向 |
| --- | --- | --- |
| WP-NFRL1-01 | 分類外・不明・外部writeはfail-closeする | negative/boundary test |
| WP-NFRL1-02 | timeout後の再実行で重複投稿を作らない | idempotency test |
| WP-NFRL1-03 | 一覧cold p95 1秒以内、操作応答p95 300ms以内を目標とする | 基準data setで測定 |
| WP-NFRL1-04 | 状態を色だけで表現せず、主要操作をkeyboardで実行できる | accessibility oracle |
| WP-NFRL1-05 | 外部dataは取得日時・期間窓・provenanceを持つ | schema/trace test |
| WP-NFRL1-06 | 本番writeはbackup、rollback、承認、監査を持つ | action-binding test |
| WP-NFRL1-07 | API費用上限超過時は取得を停止しPOへ通知する | cost boundary test |
| WP-NFRL1-08 | UI frontは未認証拒否、HTTPS、非index、CSRF、rate limitを満たす | security test |
