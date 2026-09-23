#!/usr/bin/env bash
set -euo pipefail

guard="$(cd "$(dirname "$0")" && pwd)/public-safety-guard.sh"
scratch_dir="$(mktemp -d)"
trap 'rm -rf "$scratch_dir"' EXIT
repo="$scratch_dir/repo"
git init -q -b main "$repo"
git -C "$repo" config user.name 'Guard Test'
git -C "$repo" config user.email 'guard@example.test'
git -C "$repo" commit -q --allow-empty -m baseline
base="$(git -C "$repo" rev-parse HEAD)"
dummy="$(printf 'Abc123%.0s' {1..4})"

expect_fail() {
  local label="$1"
  shift
  if (cd "$repo" && "$@") >"$scratch_dir/output" 2>&1; then
    echo "FAIL: $label unexpectedly passed" >&2
    exit 1
  fi
  if grep -Fq "$dummy" "$scratch_dir/output"; then
    echo "FAIL: $label printed the detected value" >&2
    exit 1
  fi
}

printf 'password = %s\n' "$dummy" >"$repo/sample.txt"
git -C "$repo" add sample.txt
expect_fail assignment bash "$guard" --staged
grep -Fq 'sample.txt:1' "$scratch_dir/output"
git -C "$repo" restore --staged sample.txt

printf '{"password": "%s"}\n' "$dummy" >"$repo/sample.txt"
git -C "$repo" add sample.txt
expect_fail json_assignment bash "$guard" --staged
git -C "$repo" restore --staged sample.txt

mkdir -p "$repo/docs/poc"
printf 'synthetic example\n' >"$repo/docs/poc/check.md"
git -C "$repo" add docs/poc/check.md
expect_fail poc_mapping bash "$guard" --staged
git -C "$repo" restore --staged docs/poc/check.md

expect_fail invalid_regex env PUBLIC_REDACTION_GUARD_RE='(' bash "$guard" --staged

printf 'password = %s\n' "$dummy" >"$repo/sample.txt"
git -C "$repo" add sample.txt
git -C "$repo" commit -q -m 'add synthetic secret'
printf 'safe content\n' >"$repo/sample.txt"
git -C "$repo" add sample.txt
git -C "$repo" commit -q -m 'remove synthetic secret'
expect_fail intermediate_commit bash "$guard" --base-ref "$base" HEAD

echo 'public safety guard tests passed'
