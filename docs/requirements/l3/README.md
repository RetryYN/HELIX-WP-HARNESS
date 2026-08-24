# 撤回済みprecompile gap inventory

このディレクトリのJSONは移行照合用のread-only compatibility inputであり、L3正本ではない。
L3正本はリポジトリ直下の`requirements-ir/manifest.json`と5 shardである。
画面prototypeのPO reaction／agreement前に作られたため、2026-08-23のPO判断によりprecompileとして撤回した。
現時点ではcanonical、specified、frozenのいずれでもない。
`acceptance-cases.json`と`traceability.json`を分離し、`npm run requirements:validate`が次をfail-closeする。

- 未知・欠落property
- 重複requirement/acceptance/event ID
- 現在inventoryへ収載したL1/L2→requirement→testの双方向不一致
- 未収載L1 IDと`coverage-gaps.json`の差分（未記録gap／解消済みの古いgap）
- surfaceもnon-UI N/A receiptもない要求
- decision IDを持たない`human_decision_required`
- `candidate_inventory` / `human_decision_required` / `specified` / `frozen`以外の要求status
- human agreementなしのcompile完了・G3 freeze

要求statusの定義域は上記4値に閉じる。precompileでは`candidate_inventory`を使い、未決事項を
分離する場合だけ`human_decision_required`へ移す。L3 compileと必要な人間承認後だけ`specified`、
対応gateのfreeze receipt後だけ`frozen`へ進める。新しいstatusを導入する場合は、文書、validator、
遷移oracleを同じ変更で更新し、未知値による既存guardの迂回を許可しない。

L3未開始の現在は、全L1 IDがrequirementへ降下済みとは主張しない。未降下IDは
`coverage-gaps.json`へ理由と再入場action付きで全件列挙する。validatorはこの集合のexact一致を検査し、
L3 compile完了またはG3 freezeを主張する時点ではgapが1件でもあれば拒否する。したがって現在の
`OK (... pre-L3 coverage gaps)`は「gapがない」ではなく「gapが黙って消失・増加していない」を意味する。

現在のbackflowは`WP-Q-UI-01`。実HTML prototypeへのPO reactionをappend-only eventへ追加し、
画面構成のagreement後にだけ新しいL3 IRをcompileする。
