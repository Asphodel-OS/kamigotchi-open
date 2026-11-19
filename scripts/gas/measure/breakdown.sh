#!/usr/bin/env bash
# Where does the gas go inside a system call? See ../README.md.
#
#   breakdown.sh [--solar] [--detail] [--match <forge test regex>] [System ...]
#
# Runs the matching Foundry tests under the default profile (the one deploys use),
# captures the call trace, and buckets the last execute() call of each system.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS="$HERE/../../../packages/contracts"

COMPILER=solc
DETAIL=()
MATCH='testTrackHarvestTime|testMurderBasic'
SYSTEMS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --solar) COMPILER=solar ;;
    --detail) DETAIL=(--detail) ;;
    --match) MATCH="$2"; shift ;;
    -h | --help) sed -n '2,7p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) SYSTEMS+=("$1") ;;
  esac
  shift
done

if [[ ${#SYSTEMS[@]} -eq 0 ]]; then
  SYSTEMS=(HarvestStartSystem HarvestCollectSystem HarvestStopSystem HarvestLiquidateSystem KamiUseItemSystem)
fi

# own out/cache dirs: the default-profile build would otherwise evict the
# build-profile artifacts that `pnpm test` keeps in out/
CACHE="$HERE/cache/$COMPILER"
REPORTS="$HERE/reports/breakdown"
mkdir -p "$CACHE" "$REPORTS"
TRACE="$CACHE/trace.txt"

USE=()
[[ "$COMPILER" == solar ]] && USE=(--use solar)

cd "$CONTRACTS"
echo "compiler: $COMPILER   tests: $MATCH" >&2
# regenerate the gitignored imports the tests compile against (as `pnpm test` does)
pnpm -s build:codegen >"$CACHE/codegen.log" 2>&1
if ! FOUNDRY_PROFILE=default forge test ${USE[@]+"${USE[@]}"} --contracts test \
  --gas-limit=10000000000000 --out "$CACHE/out" --cache-path "$CACHE/cache" \
  --match-test "$MATCH" -vvvv >"$TRACE" 2>&1; then
  echo "forge test failed, see $TRACE" >&2
  tail -20 "$TRACE" >&2
  exit 1
fi

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
for system in "${SYSTEMS[@]}"; do
  node "$HERE/breakdown.cjs" "$TRACE" "$system" ${DETAIL[@]+"${DETAIL[@]}"} \
    --json "$REPORTS/$STAMP-$COMPILER-$system.json"
  echo
done
