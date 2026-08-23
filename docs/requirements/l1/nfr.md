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
| WP-NFRL1-04 | 画面状態を色以外のtext/iconでも識別でき、主要操作をkeyboardで到達・実行できる | baseline accessibility oracle |
| WP-NFRL1-05 | 外部dataは技術的lineageとして取得日時・期間窓・source refを持ち、stale/欠測を判定できる | schema/freshness trace test |
| WP-NFRL1-06 | 本番write actionは実行前backup、rollback手順、対象へ束縛した承認、実行監査を持つ | action-binding test |
| WP-NFRL1-07 | API費用上限超過時は取得を停止しPOへ通知する | cost boundary test |
| WP-NFRL1-08 | UI frontは未認証拒否、HTTPS、非index、CSRF、rate limitを満たす | security test |
| WP-NFRL1-09 | 収集dataを目的最小限とし、datasetごとに保持・削除・法的/契約上の根拠を持つ | privacy/retention test |
| WP-NFRL1-10 | actorとservice accountのpermissionを操作単位で限定し、権限逸脱を拒否する | permission test |
| WP-NFRL1-11 | 外部content/APIの利用規約、license、転載禁止、取得条件をprovenanceへ束縛する | legal compliance test |
| WP-NFRL1-12 | operation、gate、外部call、失敗、recoveryを相関ID付きで観測できる | observability test |
| WP-NFRL1-13 | UIの主要判断・操作はWCAG 2.1 AA相当のkeyboard、focus、name、contrastを満たす | accessibility test |
| WP-NFRL1-14 | backupの存在だけでなくrestore rehearsalと復旧時間を証跡化する | recovery test |

## 意味境界

- `WP-NFRL1-04`は全画面の最低操作可能性、`WP-NFRL1-13`はaccessible name、visible focus、
  contrastを含むWCAG 2.1 AA相当の適合境界であり、前者だけでは後者を満たしたとみなさない。
- `WP-NFRL1-05`はdataの技術的lineage・鮮度、`WP-NFRL1-11`はそのsourceを利用・引用・cache
  してよい法的／契約上の条件であり、lineageが存在しても利用許諾を推定しない。
- `WP-NFRL1-06`は個々のwrite actionを安全に開始・取消できる条件、`WP-NFRL1-14`はbackupから
  実際に復元できることとRTOを検証する運用回復性であり、backup作成だけではrestore可能とみなさない。
