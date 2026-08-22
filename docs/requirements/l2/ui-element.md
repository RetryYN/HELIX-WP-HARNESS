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
| KeywordMap | KW母集団を記事割当・未割当・足切り・取込失敗へexactly-oneで会計し、clusterごとにmain/sub KW、検索意図、件数、gate、WP状態、監査導線を表示する |
| DataForSEOEvidenceDetail | provider、snapshot ID、endpoint/type、location/language/device、取得時刻・期間・鮮度、volume、CPC、competition、SERP、PAA、関連KW、cost、cache TTL、evidence ID、実測/推定を表示する。欠損値は0でなく未取得とする |

表示fieldは`docs/requirements/l3/traceability.json`のsurface relationへexactly one以上で接続する。
