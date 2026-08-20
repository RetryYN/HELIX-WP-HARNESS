#!/usr/bin/env bash
# main branch protection 適用 (一回限り ops)。
# 品質ゲートは harness-check CI に集約し、人間 approve は既定で要求しない
# (PO 決定 2026-07-11: AI 自走のため merge 可否 = CI green のみ。approve を
#  必須化したい team 運用では第2引数に 1 以上を渡す)。
set -euo pipefail
REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
REVIEWS="${2:-0}"
gh auth status >/dev/null
ADMIN="$(gh api "repos/${REPO}" -q '.permissions.admin')"
if [[ "${ADMIN}" != "true" ]]; then
  echo "repository admin permission is required before branch protection apply" >&2
  exit 2
fi
if [[ "${REVIEWS}" == "0" ]]; then REVIEWS_JSON="null"; else
  REVIEWS_JSON="{\"required_approving_review_count\": ${REVIEWS}}"; fi
gh api -X PUT "repos/${REPO}/branches/main/protection" --input - <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["harness-check"] },
  "enforce_admins": true,
  "required_pull_request_reviews": ${REVIEWS_JSON},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
echo "main の branch protection を適用しました: ${REPO} (approve 必須=${REVIEWS})"
