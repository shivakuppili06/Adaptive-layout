#!/usr/bin/env bash
#
# verify.sh — Run this before submitting. Designed for a coding agent
# (or you) to execute unattended and get a pass/fail verdict plus a
# written report, covering exactly the things the assignment's rubric
# and "what we don't want to see" section call out.
#
# Usage:
#   chmod +x verify.sh
#   ./verify.sh              # install, typecheck, test, anti-pattern scan, build
#   ./verify.sh --deploy     # also deploy to Vercel and print the URL
#
# Exit code is non-zero if any gap check fails — an agent can chain this
# with `&& git push` / `&& email submission` safely.

set -uo pipefail
REPORT="gap-check-report.md"
FAIL=0

log()  { echo -e "$1"; }
pass() { log "✅ $1"; echo "- ✅ $1" >> "$REPORT"; }
fail() { log "❌ $1"; echo "- ❌ $1" >> "$REPORT"; FAIL=1; }
warn() { log "⚠️  $1"; echo "- ⚠️  $1" >> "$REPORT"; }

echo "# Gap-check report — $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$REPORT"
echo "" >> "$REPORT"

# ---------------------------------------------------------------------
log "\n== 1) Install =="
if npm install --silent 2>&1 | tee /tmp/install.log | tail -5; then
  pass "npm install succeeded"
else
  fail "npm install failed — see /tmp/install.log"
fi

# ---------------------------------------------------------------------
log "\n== 2) Type check (tsc -b) =="
npx tsc -b > /tmp/tsc.log 2>&1
TSC_EXIT=$?
cat /tmp/tsc.log
if [ $TSC_EXIT -eq 0 ] && ! grep -qE 'error TS' /tmp/tsc.log; then
  pass "TypeScript compiles with zero errors"
else
  fail "tsc -b reported errors — see /tmp/tsc.log"
fi

# ---------------------------------------------------------------------
log "\n== 3) Unit / gap-check tests (vitest) =="
if npx vitest run 2>&1 | tee /tmp/vitest.log | tail -20; then
  if grep -q "failed" /tmp/vitest.log && ! grep -q "0 failed" /tmp/vitest.log; then
    fail "vitest reported failing tests — see /tmp/vitest.log"
  else
    pass "All resolver gap-check tests pass (no overlap / no clipping / degradation order / hard constraints)"
  fi
else
  fail "vitest run failed to execute — see /tmp/vitest.log"
fi

# ---------------------------------------------------------------------
log "\n== 4) Anti-pattern scan (the assignment's explicit 'don't want to see' list) =="

# 4a. Per-surface hardcoded branches disguised as the resolver.
if grep -RniE 'surface(\.id)?\s*===?\s*["'"'"'](mobile|kiosk|broadcast|retail)' src/resolver.ts 2>/dev/null; then
  fail "Found a surface-name conditional inside resolver.ts — looks like a hardcoded per-surface branch"
else
  pass "resolver.ts contains no surface-name conditionals"
fi

# 4b. CSS media queries standing in for the resolution logic.
if grep -RniE '@media' src/*.tsx src/*.ts 2>/dev/null; then
  fail "Found @media queries — resolution logic must live in TypeScript, not CSS breakpoints"
else
  pass "No CSS media queries found (resolution logic is not delegated to CSS)"
fi

# 4c. Uniform-scaling-as-adaptation check: confirm 3+ distinct composition modes exist.
MODE_COUNT=$(grep -o '"row"\|"stack"\|"hybrid"' src/resolver.ts | sort -u | wc -l | tr -d ' ')
if [ "$MODE_COUNT" -ge 3 ]; then
  pass "resolver.ts defines $MODE_COUNT distinct composition modes (not just uniform scaling)"
else
  fail "resolver.ts defines fewer than 3 composition modes — check for uniform-scaling-only logic"
fi

# 4d. Any TODO/FIXME left in shipped source (agent should flag before submission).
TODO_HITS=$(grep -RniE 'TODO|FIXME|XXX' src --include="*.ts" --include="*.tsx" | grep -v resolver.test.ts || true)
if [ -n "$TODO_HITS" ]; then
  warn "Found TODO/FIXME markers in src/ — review before submitting:\n$TODO_HITS"
else
  pass "No leftover TODO/FIXME markers in src/"
fi

# ---------------------------------------------------------------------
log "\n== 5) Production build =="
if npm run build 2>&1 | tee /tmp/build.log | tail -15; then
  if [ -f dist/index.html ]; then
    pass "Production build succeeded (dist/index.html present)"
  else
    fail "Build ran but dist/index.html is missing"
  fi
else
  fail "npm run build failed — see /tmp/build.log"
fi

# ---------------------------------------------------------------------
log "\n== 6) Required files present (submission structure) =="
for f in src/spec.ts src/surfaces.ts src/resolver.ts src/render-dom.tsx src/App.tsx package.json README.md ARCHITECTURE.md; do
  if [ -f "$f" ]; then
    pass "$f present"
  else
    fail "$f MISSING — required by submission structure"
  fi
done

# ---------------------------------------------------------------------
log "\n== 7) README/ARCHITECTURE content checks =="
for section in "Setup" "Known limitations" "Time spent"; do
  if grep -qi "$section" README.md; then
    pass "README.md mentions '$section'"
  else
    fail "README.md is missing a '$section' section"
  fi
done
if grep -qi "priority" ARCHITECTURE.md && grep -qi "extend" ARCHITECTURE.md; then
  pass "ARCHITECTURE.md covers priority/degradation and extensibility"
else
  warn "ARCHITECTURE.md may be missing priority/degradation or extensibility discussion — review manually"
fi

# ---------------------------------------------------------------------
if [[ "${1:-}" == "--deploy" ]]; then
  log "\n== 8) Deploy to Vercel =="
  if ! command -v vercel &> /dev/null; then
    log "Installing Vercel CLI..."
    npm install -g vercel --silent
  fi
  if npx vercel --prod --yes 2>&1 | tee /tmp/deploy.log | tail -20; then
    URL=$(grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' /tmp/deploy.log | tail -1)
    if [ -n "$URL" ]; then
      pass "Deployed: $URL"
      echo "" >> "$REPORT"
      echo "**Live demo:** $URL" >> "$REPORT"
    else
      warn "Deploy ran but no URL was captured — check /tmp/deploy.log manually"
    fi
  else
    fail "Vercel deploy failed — see /tmp/deploy.log (you may need 'vercel login' first)"
  fi
fi

# ---------------------------------------------------------------------
echo "" >> "$REPORT"
if [ "$FAIL" -eq 0 ]; then
  echo "## Verdict: READY TO SUBMIT" >> "$REPORT"
  log "\n==================================="
  log "✅ ALL GAP CHECKS PASSED — ready to submit."
  log "Report written to $REPORT"
  log "==================================="
else
  echo "## Verdict: NOT READY — fix the ❌ items above" >> "$REPORT"
  log "\n==================================="
  log "❌ One or more gap checks FAILED — see $REPORT before submitting."
  log "==================================="
fi

exit $FAIL
