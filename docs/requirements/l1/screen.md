---
layer: L1
sub_doc: screen
status: confirmed_input
pair_artifact: docs/requirements/l2/screen-list.md
authority: docs/requirements/authority.md
---

# L1 Screen Requirements

| ID | 画面 | POの問い | 主操作 |
| --- | --- | --- | --- |
| WP-SCR-01 | ホーム | 今、判断が必要か。運転は正常か | 承認、差し戻し |
| WP-SCR-02 | KW・記事一覧 | 全KWがどの記事・除外理由へ帰属したか | 詳細表示 |
| WP-SCR-03 | 処理監査 | なぜこのcluster・gate判定になったか | 分割、統合、除外 |
| WP-SCR-04 | AIO/LLMO | AIに読まれ、露出しているか | 提案確認 |
| WP-SCR-05 | 内部link・売り場 | 孤立、提携切れ、差替対象は何か | 差替承認 |
| WP-SCR-06 | rewrite | どの記事をなぜ直し、結果がどう変化したか | rewrite承認 |
| WP-SCR-07 | 成果 | 収益と費用、L1成功基準の現在値は何か | read-only |
| WP-SCR-08 | calendar | 何が起き、次に何が起きるか | read-only |

全画面はempty/loading/error/stale/normalを定義し、表示値を証跡または導出規則へtraceする。
