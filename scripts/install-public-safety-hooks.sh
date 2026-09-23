#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hooks_path="$repo_root/.githooks"

if [[ ! -x "$hooks_path/pre-commit" || ! -x "$hooks_path/pre-push" ]]; then
  echo "FAIL: tracked public-safety hooks are missing or not executable." >&2
  exit 1
fi

existing="$(git config --local --get core.hooksPath || true)"
if [[ -n "$existing" && "$existing" != "$hooks_path" ]]; then
  echo "FAIL: refusing to replace existing core.hooksPath: $existing" >&2
  echo "  Remove it first if it points at the retired integration layer." >&2
  exit 1
fi
git config --local core.hooksPath "$hooks_path"
echo "installed public-safety hooks: $repo_root"
