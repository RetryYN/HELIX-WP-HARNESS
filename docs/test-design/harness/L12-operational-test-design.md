---
layer: L12
sub_doc: operational-test-design
status: candidate_projection
source_authority: docs/test-design/l12-operational-value-test-design.md
pair_artifact: docs/design/harness/L1-requirements/screen-requirements.md
---

# HELIX L12 screen operational-test compatibility projection

HELIX V-model readerへL1 screen projectionのpairを接続する非正本projectionである。
業務価値oracleの正本は`docs/test-design/l12-operational-value-test-design.md`、画面操作のPO受入観点は
`docs/test-design/l11-user-acceptance-test-design.md`にあり、この文書からpass、freeze、agreementを主張しない。

| HELIX reader ID | WP surface | operational evidence boundary |
| --- | --- | --- |
| PM-01 | WP-UI-01 | 判断時間、誤write、reconciliation結果をWP-OT-01/04へ接続する |
| PM-02 | WP-UI-02 | KW母集団差分とDataForSEO provenanceをWP-OT-04へ接続する |
| PM-03 | WP-UI-03 | 判定根拠からoperationまでのtrace orphan 0をWP-OT-04で測る |
| PM-04 | WP-UI-04 | AIO/LLMO測定値の取得条件と欠測を成果oracleへ接続する |
| PM-05 | WP-UI-05 | 内部link・売り場判断の証跡をWP-OT-04へ接続する |
| PM-06 | WP-UI-06 | rewrite前後の版・成果差分をWP-OT-04/05へ接続する |
| PM-07 | WP-UI-07 | 売上÷費用の未確定規則ではpassを出さずWP-OT-05へ接続する |
| PM-08 | WP-UI-08 | 予定と実績の差分、例外停止をWP-OT-01へ接続する |

