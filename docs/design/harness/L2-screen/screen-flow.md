---
layer: L2
sub_doc: screen-flow
status: candidate_projection
source_authority: docs/requirements/l2/screen-flow.md
source_sha256: 61a6476c0777b898b432aa7fc1bd8a2d1d142d44d695472dafce420aea332b0a
pair_artifact: docs/design/harness/L2-screen/wireframe.md
---

# HELIX L2 screen-flow compatibility projection

正本flowは`docs/requirements/l2/screen-flow.md`。次の対応だけをHELIX readerへ投影する。

`PM-01 → PM-02 → PM-03 → PM-01`は判断、KW詳細、監査、再入場の循環を表す。
`PM-01 → PM-07`は成果確認、`PM-02 → PM-04 / PM-05 / PM-06 / PM-08`は各P1 surfaceへの導線を表す。
failure、timeout、cancel、reconciliationの状態契約はWP正本から変更しない。
