---
plan_id: PLAN-L2-001-s1-draft-post-requirements
title: "S1 最小運用タスク（WordPress下書き投稿）の要求化"
kind: add-design
layer: L2
drive: agent
status: in_progress
completion_claim_allowed: false
created: 2026-08-22
updated: 2026-08-22
owner: Codex / PO
agent_slots:
  - role: se
    slot_label: "Codex — PoC証跡から要求・受入条件を起草する"
  - role: tl
    slot_label: "Claude — 要求、境界、検証可能性を独立レビューする"
generates:
  - artifact_path: docs/requirements/s1-draft-post-requirements.md
    artifact_type: design_doc
pair_artifact: docs/requirements/s1-draft-post-requirements.md
related_l0: docs/planning/l1-plan-autonomous-wp-harness.md
related_br: docs/planning/l1-plan-autonomous-wp-harness.md
next_pair_freeze: L3
github_issue_id: null
dependencies:
  parent: docs/planning/l1-plan-autonomous-wp-harness.md
  requires: []
review_evidence: []
---

# S1 最小運用タスク（WordPress下書き投稿）の要求化

## §0 位置づけ

confirmed済みL1企画を入力として、S1の最小運用タスク1本を検証可能なL2要求へ落とす。
対象は「POが指定した内容でWordPress記事を1本、公開せず下書きとして作成し、機械証跡を残す」。
本PLANは要求化とClaude/Codex連携証跡だけを扱い、本番WordPressへのwriteや実装は行わない。

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

- [ ] L1およびPoC証跡への参照が要求文書に記録されている。
- [ ] 下書き限定、公開禁止、credential非記録、冪等性、失敗時fail-closeが受入条件に含まれる。
- [ ] Codex起草とClaude独立レビューのprovider evidenceが保存されている。
- [ ] PO未決事項を推測で確定せず、後続判断として列挙している。
