# 撤回済みprecompile gap inventory

`requirements-ir.json`はL2での漏れ検査用inventoryであり、L3成果物ではない。
画面prototypeのPO reaction／agreement前に作られたため、2026-08-23のPO判断によりprecompileとして撤回した。
現時点ではcanonical、specified、frozenのいずれでもない。
`acceptance-cases.json`と`traceability.json`を分離し、`npm run requirements:validate`が次をfail-closeする。

- 未知・欠落property
- 重複requirement/acceptance/event ID
- L1→L2→L3→testの孤児
- surfaceもnon-UI N/A receiptもない要求
- decision IDを持たない`human_decision_required`
- human agreementなしのcompile完了・G3 freeze

現在のbackflowは`WP-Q-UI-01`。実HTML prototypeへのPO reactionをappend-only eventへ追加し、
画面構成のagreement後にだけ新しいL3 IRをcompileする。
