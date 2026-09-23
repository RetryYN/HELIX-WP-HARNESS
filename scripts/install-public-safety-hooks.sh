#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hooks_path="$repo_root/.githooks"

if [[ ! -x "$hooks_path/pre-commit" || ! -x "$hooks_path/pre-push" ]]; then
  echo "FAIL: tracked public-safety hooks are missing or not executable." >&2
  exit 1
fi

# core.hooksPath lives in the shared (common-dir) config, so a relative value is
# required: it resolves against each linked worktree instead of pinning one path.
existing="$(git config --local --get core.hooksPath || true)"
if [[ -n "$existing" && "$existing" != ".githooks" ]]; then
  echo "FAIL: refusing to replace existing core.hooksPath: $existing" >&2
  echo "  Unset it first (git config --local --unset core.hooksPath) if it points at the retired integration layer." >&2
  exit 1
fi
git config --local core.hooksPath .githooks
echo "installed public-safety hooks: core.hooksPath=.githooks ($repo_root)"
