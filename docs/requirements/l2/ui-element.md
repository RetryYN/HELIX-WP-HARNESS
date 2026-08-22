# L2 UI Elements

| element | contract |
| --- | --- |
| ApprovalQueue | 対象、理由、gate、risk、期限、source evidenceを表示する |
| DecisionDialog | 実行差分、外部影響、rollback、理由入力、取消を表示する |
| EvidenceLink | immutable evidence ID、時刻、digestを表示する。secret値は表示しない |
| FreshnessBadge | 取得日時、期間窓、expected interval、stale理由を表示する |
| StateBadge | labelとiconを必須とし色だけに依存しない |
| DerivedStatus | source eventと導出規則versionを表示し手入力を許可しない |
| ReconciliationPanel | timeout、不明応答、重複候補を比較し自動再送を禁止する |
| EmptyState | 証跡がない理由、次回取得予定、必要actionを表示する |
| ErrorState | failure step、evidence、retry/re-entry ownerを表示する |

表示fieldは`docs/requirements/l3/traceability.json`のsurface relationへexactly one以上で接続する。
