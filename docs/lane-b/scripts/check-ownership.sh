#!/usr/bin/env bash
# Fails if any changed (vs merge-base with <base>) or untracked/modified file lies outside Lane B owned paths.
set -euo pipefail
base="${1:-origin/main}"
cd "$(git rev-parse --show-toplevel)"
pattern='^(packages/evidence|packages/eval|apps/web|docs/lane-b|submission)/'
mb="$(git merge-base "$base" HEAD)"
paths="$( { git diff --name-only "$mb"..HEAD; git status --porcelain --untracked-files=all | sed -E 's/^...//; s/.* -> //'; } | sed '/^$/d' | sort -u)"
bad="$(printf '%s\n' "$paths" | grep -Ev "$pattern" | sed '/^$/d' || true)"
if [ -n "$bad" ]; then
  echo "OWNERSHIP CHECK FAILED — paths outside Lane B ownership:" >&2
  printf '  %s\n' $bad >&2
  exit 1
fi
echo "Ownership check passed ($(printf '%s\n' "$paths" | sed '/^$/d' | wc -l | tr -d ' ') paths vs $base)."
