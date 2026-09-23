#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

usage() {
  echo "usage: $0 --staged | --base-ref <git-ref> [<head-ref>]" >&2
  exit 2
}

mode=""
base_ref=""
head_ref="HEAD"
case "${1:-}" in
  --staged)
    mode="staged"
    [[ $# -eq 1 ]] || usage
    ;;
  --base-ref)
    mode="range"
    base_ref="${2:-}"
    head_ref="${3:-HEAD}"
    [[ ( $# -eq 2 || $# -eq 3 ) && -n "$base_ref" ]] || usage
    git rev-parse --verify "${base_ref}^{commit}" >/dev/null
    git rev-parse --verify "${head_ref}^{commit}" >/dev/null
    ;;
  *) usage ;;
esac

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
records="$tmp_dir/added-lines.tsv"
: >"$records"

append_diff() {
  local repo="$1"
  local prefix="$2"
  shift 2

  git -C "$repo" diff --no-ext-diff --unified=0 "$@" -- |
    awk -v prefix="$prefix" '
      /^diff --git / { file = ""; in_hunk = 0; next }
      /^\+\+\+ b\// && !in_hunk { file = substr($0, 7); next }
      /^\+\+\+ \/dev\/null/ && !in_hunk { file = ""; next }
      /^@@ / { match($0, /\+[0-9]+/); line_number = substr($0, RSTART + 1, RLENGTH - 1) + 0; in_hunk = 1; next }
      /^\+/ && in_hunk && file != "" {
        line = substr($0, 2)
        gsub(/\t/, "    ", line)
        print prefix file "\t" line_number "\t" line
        line_number++
        next
      }
      in_hunk && !/^-/ { line_number++ }
    ' >>"$records"
}

scan_gitlinks() {
  local repo="$1" prefix="$2"
  shift 2
  while IFS=$'\t' read -r path old_sha new_sha; do
    [[ -n "$path" && ( -d "$repo/$path/.git" || -f "$repo/$path/.git" ) ]] || {
      echo "FAIL: changed submodule is not initialized" >&2
      exit 1
    }
    for sha in "$old_sha" "$new_sha"; do
      git -C "$repo/$path" cat-file -e "${sha}^{commit}" 2>/dev/null || {
        echo "FAIL: submodule commit unavailable for inspection" >&2
        exit 1
      }
    done
    scan_range "$repo/$path" "$prefix$path/" "$old_sha" "$new_sha"
  done < <(git -C "$repo" diff --raw --no-abbrev "$@" | awk '
    $1 ~ /^:160000/ || $2 == "160000" {
      old = $3; new = $4; path = $6
      if (path != "") print path "\t" old "\t" new
    }
  ')
}

scan_range() {
  local repo="$1" prefix="$2" start="$3" finish="$4" commit parent
  git -C "$repo" merge-base --is-ancestor "$start" "$finish" || {
    echo "FAIL: scan base is not an ancestor of head" >&2
    exit 1
  }
  while read -r commit; do
    parent="$(git -C "$repo" rev-list --parents -n 1 "$commit" | awk '{print $2}')"
    [[ -n "$parent" ]] || parent="$(git -C "$repo" hash-object -t tree /dev/null)"
    append_diff "$repo" "$prefix" "$parent" "$commit"
    scan_gitlinks "$repo" "$prefix" "$parent" "$commit"
  done < <(git -C "$repo" rev-list --reverse "$start..$finish")
}

if [[ "$mode" == "staged" ]]; then
  append_diff . "" --cached
  scan_gitlinks . "" --cached
else
  scan_range . "" "$base_ref" "$head_ref"
fi

failures=0
check_pattern() {
  local description="$1"
  local pattern="$2"
  local found="$tmp_dir/found"
  local result=0
  grep -Ei -- "$pattern" "$records" >"$found" 2>/dev/null || result=$?
  if [[ "$result" -eq 0 ]]; then
    echo "FAIL: $description" >&2
    awk -F '\t' '{ print "  " $1 ":" $2 }' "$found" | sort -u >&2
    failures=$((failures + 1))
  elif [[ "$result" -ne 1 ]]; then
    echo "FAIL: invalid $description pattern" >&2
    failures=$((failures + 1))
  fi
}

# Split well-known token prefixes so this guard does not flag its own source.
check_pattern "private key material" 'BEGIN [A-Z0-9 ]*PRIVATE KEY'
check_pattern "well-known access token format" '(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})'
credential_assignment_pattern="(password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret)[\"'[:space:]]*[:=][[:space:]]*[\"'[:space:]]*[A-Za-z0-9+/=_-]{12,}"
check_pattern "credential-like assignment" "$credential_assignment_pattern"
personal_path_pattern='(/ho''me/[^/<[:space:]]+/|/Us''ers/[^/<[:space:]]+/|[A-Za-z]:[/\\]Us''ers[/\\][^/\\<[:space:]]+[/\\])'
check_pattern "personal absolute filesystem path" "$personal_path_pattern"
check_pattern "affiliate or click-tracking URL" 'https?://[^[:space:]]*(a8mat=|/svt/|/0\.gif\?)'

custom_regex="${PUBLIC_REDACTION_GUARD_RE:-}"
local_regex_file="${PUBLIC_SAFETY_REGEX_FILE:-.public-safety.local.regex}"
if [[ -f "$local_regex_file" ]]; then
  file_regex="$(grep -Ev '^[[:space:]]*(#|$)' "$local_regex_file" | paste -sd '|' - || true)"
  if [[ -n "$file_regex" ]]; then
    custom_regex="${custom_regex:+${custom_regex}|}${file_regex}"
  fi
fi
if [[ -n "$custom_regex" ]]; then
  check_pattern "private name/domain mapping" "$custom_regex"
fi

if awk -F '\t' '$1 ~ /(^|\/)(research|evidence|poc|raw|captures?)(\/|$)/ || $1 ~ /^docs\/.*poc/ { found=1 } END { exit !found }' "$records" &&
   [[ -z "$custom_regex" ]]; then
  echo "FAIL: research/evidence/PoC content changed without a private redaction mapping." >&2
  echo "  Set PUBLIC_REDACTION_GUARD_RE or create .public-safety.local.regex." >&2
  failures=$((failures + 1))
fi

if (( failures > 0 )); then
  echo "public safety check: $failures failure(s)" >&2
  exit 1
fi

echo "public safety check: OK ($(wc -l <"$records" | tr -d ' ') added line(s) inspected)"
