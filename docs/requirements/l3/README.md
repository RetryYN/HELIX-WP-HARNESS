# 撤回済みprecompile gap inventory

`requirements-ir.json`はL2での漏れ検査用inventoryであり、L3成果物ではない。
画面prototypeのPO reaction／agreement前に作られたため、2026-08-23のPO判断によりprecompileとして撤回した。
現時点ではcanonical、specified、frozenのいずれでもない。
`acceptance-cases.json`と`traceability.json`を分離し、`npm run requirements:validate`が次をfail-closeする。

- 未知・欠落property
- 重複requirement/acceptance/event ID
- 現在inventoryへ収載したL1/L2→requirement→testの双方向不一致
- 未収載L1 IDと`coverage-gaps.json`の差分（未記録gap／解消済みの古いgap）
- surfaceもnon-UI N/A receiptもない要求
- decision IDを持たない`human_decision_required`
- human agreementなしのcompile完了・G3 freeze

L3未開始の現在は、全L1 IDがrequirementへ降下済みとは主張しない。未降下IDは
`coverage-gaps.json`へ理由と再入場action付きで全件列挙する。validatorはこの集合のexact一致を検査し、
L3 compile完了またはG3 freezeを主張する時点ではgapが1件でもあれば拒否する。したがって現在の
`OK (... pre-L3 coverage gaps)`は「gapがない」ではなく「gapが黙って消失・増加していない」を意味する。

現在のbackflowは`WP-Q-UI-01`。実HTML prototypeへのPO reactionをappend-only eventへ追加し、
画面構成のagreement後にだけ新しいL3 IRをcompileする。
