#!/bin/bash
# Release gate, parallel lanes. Copy into a scratch dir and fill in the COMMANDS block from the repo's CLAUDE.md.
#   usage: gate.sh OUTDIR [--force-rehearsal]
# Writes OUTDIR/<step>.log and OUTDIR/summary.txt (one line per step: "<name> rc=<n> <s>s" or "<name> skipped
# (...)", then "wall <s>s" and "GATE_DONE rc=0|1"). An empty command means the repo has no such step: skipped.
set -u
G=${1:?usage: gate.sh OUTDIR [--force-rehearsal]}
FORCE=${2:-}
mkdir -p "$G"

# ── COMMANDS (fill in; leave empty to skip) ──────────────────────────────────
REPO=/path/to/repo
export AGENT_MARKER=1                       # the repo's agent-safety env var, if any
LINT="make lint"
TYPECHECK="make typecheck"
SCHEMA_DRIFT="make openapi && git diff --exit-code -- <generated client files>"
CANONICAL=""                                # canonical-data --check commands; empty = none
# tests-first markers left behind: passes only when grep finds nothing (rc 1); a match (0) or an error (2) fails.
# The ACCEPT: tag keeps the repo's older, legitimate expected failures out of this check.
MARKERS="grep -rnE 'ACCEPT:[A-Z]' <test dirs, e.g. backend/tests frontend/src e2e>; [ \$? -eq 1 ]"
BACKEND="cd backend && <full test suite in CI mode, e.g. CI=true pytest -n 8 -q>"
FRONTEND="<frontend unit suite>"
BUILD="<frontend production build>"
AUDITOR_LOG_CHECK=""                        # check that the tenancy/SQL auditor log is empty; empty = none
E2E=""                                      # full E2E command; empty = the repo has no E2E suite
REHEARSAL=""                                # deploy rehearsal command; empty = no rehearsal
DEPLOY_PATHS="deploy/ Dockerfile docker-compose*.yml .dockerignore <dependency lock files>"
PROD_REF="origin/release"                   # what production runs; empty or missing = rehearse only when forced
# ─────────────────────────────────────────────────────────────────────────────

cd "$REPO" || exit 1
: > "$G/summary.txt"

step() {
  local name=$1; shift
  if [ -z "$*" ]; then echo "$name skipped (not configured)" >> "$G/summary.txt"; return 0; fi
  local t0=$(date +%s)
  bash -c "$*" > "$G/$name.log" 2>&1
  local rc=$?
  echo "$name rc=$rc $(( $(date +%s) - t0 ))s" >> "$G/summary.txt"
  return $rc
}

T0=$(date +%s)
# Phase 1: fast and sequential (schema regeneration rewrites files later builds read)
step lint "$LINT"
step typecheck "$TYPECHECK"
step schema "$SCHEMA_DRIFT"
step canonical "$CANONICAL"
step markers "$MARKERS"

# Phase 2: parallel lanes
laneA() {
  step backend "$BACKEND"
  step frontend "$FRONTEND"
  step build "$BUILD"
  step auditor "$AUDITOR_LOG_CHECK"
}
laneB() { step e2e "$E2E"; }
laneC() {
  if [ -z "$REHEARSAL" ]; then echo "rehearsal skipped (none configured)" >> "$G/summary.txt"; return; fi
  [ -n "$PROD_REF" ] && git fetch -q origin 2>/dev/null
  # shellcheck disable=SC2086
  if [ "$FORCE" = "--force-rehearsal" ] || { [ -n "$PROD_REF" ] && git rev-parse -q --verify "$PROD_REF" >/dev/null \
       && ! git diff --quiet "$PROD_REF" -- $DEPLOY_PATHS; }; then
    step rehearsal "$REHEARSAL"
  else
    echo "rehearsal skipped (no image/deploy change against ${PROD_REF:-<no production ref>})" >> "$G/summary.txt"
  fi
}
laneA & A=$!
laneB & B=$!
laneC & C=$!
wait $A $B $C

echo "wall $(( $(date +%s) - T0 ))s" >> "$G/summary.txt"
if grep -q "rc=[1-9]" "$G/summary.txt"; then echo "GATE_DONE rc=1" >> "$G/summary.txt"; exit 1; fi
echo "GATE_DONE rc=0" >> "$G/summary.txt"
