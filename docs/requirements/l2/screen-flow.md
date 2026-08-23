# L2 Screen Flow

## 通常

`WP-UI-01 要承認 → 対象詳細 → 根拠確認 → 確認step → 承認/差し戻し → operation ID表示 → WP-UI-01`

## 取消

確認stepで取消した場合は外部writeもoperation追記も行わず、対象詳細へ戻る。

## failure

取得、導出、承認記録、外部writeのいずれが失敗したかを表示し、evidence IDと再入場条件を示す。
状態不明の外部writeは成功・失敗を推測せず`reconciliation_required`へ遷移する。

## timeout/recovery

timeout時は同一要求を再送せず、idempotency keyとWP側結果を照合する。結果が一意に確認できない場合は
PO判断queueへ送る。再試行は同一operation chainへ追記する。

## navigation

ホームから各主要な「POの問い」へ2 click以内で到達する。deep linkは認証後も対象とfilterを保持する。
