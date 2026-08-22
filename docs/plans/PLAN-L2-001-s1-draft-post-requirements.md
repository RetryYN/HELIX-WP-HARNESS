---
plan_id: PLAN-L2-001-s1-draft-post-requirements
title: "S1 最小運用タスク（WordPress安全公開）のL2要求・画面prototype"
kind: add-design
layer: L2
drive: agent
status: in_progress
completion_claim_allowed: false
created: 2026-08-22
updated: 2026-08-23
owner: Codex / PO
behavior_contract_id: WP-REQUIREMENT-AUTHORITY-001
responsibility_owner: wp-requirement-authority
agent_slots:
  - role: se
    slot_label: "Codex — PoC証跡から要求・受入条件を起草する"
  - role: tl
    slot_label: "Claude — 要求、境界、検証可能性を独立レビューする"
generates:
  - artifact_path: docs/requirements/s1-draft-post-requirements.md
    artifact_type: design_doc
  - artifact_path: docs/requirements/discovery/candidate-projection.json
    artifact_type: requirement_candidate_projection
  - artifact_path: docs/requirements/l3/requirements-ir.json
    artifact_type: withdrawn_precompile_gap_inventory
  - artifact_path: docs/prototypes/wp-ops-dashboard/index.html
    artifact_type: l2_screen_prototype
pair_artifact: docs/test-design/l11-user-acceptance-test-design.md
related_l0: docs/planning/l1-plan-autonomous-wp-harness.md
related_br: docs/planning/l1-plan-autonomous-wp-harness.md
next_pair_freeze: L3
github_issue_id: null
dependencies:
  parent: docs/planning/l1-plan-autonomous-wp-harness.md
  requires: []
review_evidence: []
inventory_evidence:
  - target: poc-wp local read-only checkout
    inspected_at: 2026-08-23
    scope: PoC-1〜4、renderer/reverse、PO入力資料の存在とdigest
    disposition: adopt_with_limits
    evidence: docs/poc/wp-poc-inventory.json
    rejection_reason: raw運用data、secret混入可能log、PoC実装codeはWP要求正本へ複製しない
  - target: https://github.com/RetryYN/HELIX-HARNESS
    inspected_at: 2026-08-23
    scope: Requirement Discovery、L1-L12、trace、review evidence契約
    disposition: read_only_reference
    evidence: docs/requirements/authority.md
    rejection_reason: HELIX本体は変更せず、consumer固有要求だけを本リポジトリで管理する
---

# S1 最小運用タスク（WordPress安全公開）のL2要求・画面prototype

## §0 位置づけ

confirmed inputのL1企画を入力として、S1の最小運用タスク1本を検証可能なL2要求へ落とす。
対象は「POが指定した記事をdraftから開始し、公開可能条件と承認を閉じて同一post IDを安全に公開する」。
本PLANは要求authority再編、PoC束縛、Claude/Codex連携証跡だけを扱い、本番WordPressへのwriteや実装は行わない。

## §3 工程表

### Step 1: [直列] PoC・L1から要求境界を抽出

- 直列理由 = **downstream_dependency**。上流証跡を確定してから要求と受入条件を起草する。

### Step 2: [直列] L2要求と受入条件を起草

- 直列理由 = **downstream_dependency**。Step 1の境界を入力に、正常系・拒否系・証跡を定義する。

### Step 3: [直列] Claude独立レビュー

- 直列理由 = **downstream_dependency**。Codexの起草後、Claudeがread-onlyでレビューし、
  `review_kind=cross_agent`、`worker_model`、`reviewer_model`をhandover証跡へ残す。

## §3.1 実装計画

- `docs/requirements/s1-draft-post-requirements.md` に目的、対象、非対象、入力、出力、
  承認境界、失敗時挙動、受入条件を記載する。
- 本PLAN中は本番WordPressへ接続・writeしない。
- 要求確定後の設計・実装・実機検証は後続PLANへ分離する。

## §4 DoD（Definition of Done）

- [x] L1およびPoC証跡への参照がdigest付きinventoryとして記録されている。
- [x] credential非記録、冪等性、失敗時fail-closeがL3要求・受入oracleに含まれる。
- [ ] Codex起草とClaude独立レビューのprovider evidenceが保存されている。
- [x] PO未決事項を推測で確定せず、discovery eventとcandidate projectionへ列挙している。
- [x] post IDを状態identityとし、WPから取得できる本文・全応答を重複保存しない。
- [x] 判断flowを確認できるHTML prototypeとdesktop/mobile render evidenceが存在する。
- [ ] HTML prototypeへのPO reactionとagreementがappend-only eventへ記録されている。
- [x] prototype agreement前のL3 precompileは撤回され、要件定義未開始として表示される。
