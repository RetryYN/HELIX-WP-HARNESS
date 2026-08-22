---
layer: L2
sub_doc: screen-list
status: candidate
pair_artifact: docs/test-design/l11-user-acceptance-test-design.md
---

# L2 Screen List

| surface ID | route | source | priority | normal/cancel/failure/timeout |
| --- | --- | --- | --- | --- |
| WP-UI-01 | `/` | WP-SCR-01 | P0 | defined/defined/defined/defined |
| WP-UI-02 | `/articles` | WP-SCR-02 | P0 | defined/N/A/defined/defined |
| WP-UI-03 | `/audit/clusters` | WP-SCR-03 | P0 | defined/defined/defined/defined |
| WP-UI-04 | `/aio` | WP-SCR-04 | P1 | defined/N/A/defined/defined |
| WP-UI-05 | `/links` | WP-SCR-05 | P1 | defined/defined/defined/defined |
| WP-UI-06 | `/rewrites` | WP-SCR-06 | P1 | defined/defined/defined/defined |
| WP-UI-07 | `/outcomes` | WP-SCR-07 | P0 | defined/N/A/defined/defined |
| WP-UI-08 | `/calendar` | WP-SCR-08 | P1 | defined/N/A/defined/defined |

`N/A`はread-only surfaceに取消操作が存在しないため。read-only要件が変わった場合に再評価する。

`WP-UI-02`はcluster grouped keyword mapとDataForSEO evidence detailを持つ。外部APIの値は取得条件・snapshot・鮮度・費用・cache制約と一緒に表示し、未取得を0または推定値で補完しない。
