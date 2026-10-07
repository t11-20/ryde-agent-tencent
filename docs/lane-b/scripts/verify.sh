#!/usr/bin/env bash
# Installs, typechecks, tests and builds every Lane B package in dependency order.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
restore_root_lock() {
  if git ls-files --error-unmatch package-lock.json >/dev/null 2>&1; then
    git checkout -- package-lock.json
  fi
}
trap restore_root_lock EXIT
run_pkg() {
  local dir="$1"; shift
  [ -f "$dir/package.json" ] || { echo "skip $dir (not created yet)"; return 0; }
  echo "=== $dir ==="
  (cd "$dir" && npm ci --no-audit --no-fund && for s in "$@"; do npm run "$s"; done)
}
run_pkg packages/evidence typecheck test build fixtures:check
run_pkg apps/web typecheck test build
run_pkg packages/eval typecheck test
echo "verify.sh: all Lane B packages passed."
