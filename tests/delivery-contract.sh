#!/usr/bin/env bash
# Focused check: the delivery skill states the automation-first thin-protocol
# contract — the approval invariant, Spike/Bounded/Architectural routing,
# mandatory Orca with no headless fallback, task-sized freshness with
# adaptive review, original-party bounded remediation, native (non-journal)
# evidence, and exact-HEAD no-worker release — and the proven
# input_accepted/90-second/TUI-read/one-Enter recovery. Fixture copies run
# through the same checks; a negative fixture that passes is a test failure.
# Does not require claude, codex, grok or orca.
set -u

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
skill="$root/skills/delivery/SKILL.md"

failures=0
fail() {
  printf '%s\n' "FAIL: $*" >&2
  failures=$((failures + 1))
}

diag() {
  printf '%s\n' "FAIL: $*" >&2
}

# --- approval invariant ------------------------------------------------------

check_approval_invariant() {
  local file=$1
  local tmp=0
  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi
  if ! grep -Ei 'approval invariant|explicit human approval' "$file" >/dev/null; then
    diag "no explicit approval invariant before candidate mutation"
    tmp=1
  fi
  if ! grep -Ei 'Plan Mode' "$file" >/dev/null; then
    diag "does not name Plan Mode as unable to bypass approval"
    tmp=1
  fi
  if ! grep -Ei 'bypass' "$file" | grep -Eiv 'cannot|does not' >/dev/null 2>&1; then
    : # no permissive bypass language found is fine; nothing to flag
  fi
  if grep -Ei 'Plan Mode' "$file" | grep -Ei 'can bypass|may bypass|bypasses approval' >/dev/null; then
    diag "grants Plan Mode a bypass of the approval invariant"
    tmp=1
  fi
  return $tmp
}

# --- shape routing ------------------------------------------------------------

check_shapes() {
  local file=$1
  local tmp=0
  if ! grep -Fq 'Spike' "$file"; then diag "no Spike shape"; tmp=1; fi
  if ! grep -Fq 'Bounded' "$file"; then diag "no Bounded shape"; tmp=1; fi
  if ! grep -Fq 'Architectural' "$file"; then diag "no Architectural shape"; tmp=1; fi
  if ! grep -Ei 'no delivery run|no candidate is delivered' "$file" >/dev/null; then
    diag "Spike does not say it starts no delivery run"
    tmp=1
  fi
  if ! grep -Ei 'one whole-change review' "$file" >/dev/null; then
    diag "Bounded does not get one whole-change review"
    tmp=1
  fi
  if ! grep -Ei 'integration review' "$file" >/dev/null; then
    diag "Architectural has no integration review"
    tmp=1
  fi
  return $tmp
}

# --- frontmatter discovery routing --------------------------------------------

# Prints the YAML frontmatter's description value (single logical line; the
# repository's frontmatter is not multi-line folded).
frontmatter_description() {
  awk '
    NR == 1 && $0 == "---" { infm = 1; next }
    infm && $0 == "---" { exit }
    infm && /^description:[[:space:]]*/ {
      sub(/^description:[[:space:]]*/, "")
      print
    }
  ' "$1"
}

check_frontmatter_routing() {
  local file=$1
  local desc
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi

  desc=$(frontmatter_description "$file")
  if [ -z "$desc" ]; then
    diag "no frontmatter description found"
    return 1
  fi

  if printf '%s\n' "$desc" | grep -Ei 'only for architectural|architectural.only|never use for bounded|not for bounded|forbid(s)? bounded' >/dev/null; then
    diag "frontmatter restricts discovery to Architectural work or forbids Bounded work"
    tmp=1
  fi
  if printf '%s\n' "$desc" | grep -Ei 'not for a one-line fix|excludes? .*one-line' >/dev/null; then
    diag "frontmatter excludes small one-line Bounded fixes from discovery"
    tmp=1
  fi

  return $tmp
}

# --- Orca mandatory, no headless fallback -------------------------------------

check_orca_mandatory() {
  local file=$1
  local tmp=0
  if ! grep -Ei 'Orca is (the )?(required|mandatory)' "$file" >/dev/null; then
    diag "does not state Orca is mandatory"
    tmp=1
  fi
  if ! grep -Ei 'no headless fallback|no direct dispatch and no headless' "$file" >/dev/null; then
    diag "does not state there is no headless fallback"
    tmp=1
  fi
  if grep -Ei 'fallback (is )?only when no coordinator|headless fallback is a fallback only' "$file" >/dev/null; then
    diag "still permits a headless fallback"
    tmp=1
  fi
  return $tmp
}

# --- task-sized freshness and adaptive review ---------------------------------

check_freshness_review() {
  local file=$1
  local tmp=0
  if ! grep -Ei 'fresh implementer' "$file" >/dev/null; then
    diag "does not say independently reviewable tasks get a fresh implementer"
    tmp=1
  fi
  if ! grep -Ei 'batched' "$file" >/dev/null; then
    diag "does not say same-shaped mechanical work is batched"
    tmp=1
  fi
  if ! grep -Ei 'adaptive' "$file" >/dev/null; then
    diag "review depth is not stated as adaptive"
    tmp=1
  fi
  return $tmp
}

# --- original-party bounded remediation ---------------------------------------

check_remediation() {
  local file=$1
  local tmp=0
  if ! grep -Ei 'original implementer' "$file" >/dev/null; then
    diag "remediation does not name the original implementer"
    tmp=1
  fi
  if ! grep -Ei 'original reviewer|reviewer that raised' "$file" >/dev/null; then
    diag "remediation does not name the original reviewer"
    tmp=1
  fi
  if ! grep -F 'REPLAN_OR_SPLIT' "$file" >/dev/null; then
    diag "no REPLAN_OR_SPLIT disposition"
    tmp=1
  fi
  if grep -Ei 'fresh implementation session' "$file" >/dev/null; then
    diag "remediation still routes to a fresh implementation session instead of the original implementer"
    tmp=1
  fi
  return $tmp
}

# --- native (non-journal) evidence --------------------------------------------

check_native_evidence() {
  local file=$1
  local tmp=0
  if ! grep -Ei 'asks? Orca for the dispatch-bound command|dispatch-bound command' "$file" >/dev/null; then
    diag "does not say evidence is read from Orca's dispatch record"
    tmp=1
  fi
  if grep -Eiq 'journaled wherever the hooks are wired|delivery-doctor|bin/delivery-evidence|hooks/hooks\.json' "$file"; then
    diag "still relies on the removed journal/doctor/hook rails for evidence"
    tmp=1
  fi
  return $tmp
}

# --- exact-HEAD, no-worker release --------------------------------------------

check_release() {
  local file=$1
  local tmp=0
  if ! grep -Ei 'no LLM (release )?worker' "$file" >/dev/null; then
    diag "does not say release has no LLM worker"
    tmp=1
  fi
  if ! grep -Ei 'exact HEAD|exact-HEAD' "$file" >/dev/null; then
    diag "release is not bound to exact HEAD"
    tmp=1
  fi
  if ! grep -Ei 'draft pull request' "$file" >/dev/null; then
    diag "release does not prepare a draft pull request"
    tmp=1
  fi
  return $tmp
}

# --- launch/wait recovery (preserved from the prior contract) ----------------

launch_wait_section() {
  awk '
    /^### Launching a worker[[:space:]]*$/ { p = 1 }
    p && /^###/ && !/^### Launching a worker[[:space:]]*$/ { exit }
    p { print }
  ' "$1"
}

check_launch_wait() {
  local file=$1
  local section
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi

  section=$(launch_wait_section "$file")
  if [ -z "$section" ]; then
    diag "$file has no Launching a worker section"
    return 1
  fi

  if ! printf '%s\n' "$section" | grep -F 'input_accepted' >/dev/null; then
    diag "launch/wait does not name input_accepted"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'transport receipt|not proof|not submission' >/dev/null; then
    diag "launch/wait does not say input_accepted is a receipt rather than submission proof"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -E '90' >/dev/null; then
    diag "launch/wait does not allow 90 seconds"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'heartbeat' >/dev/null; then
    diag "launch/wait does not wait for a heartbeat"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'progress' >/dev/null; then
    diag "launch/wait does not wait for visible progress"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'reads? the (worker )?TUI' >/dev/null; then
    diag "launch/wait does not read the TUI on the no-signal path"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'pending' >/dev/null; then
    diag "launch/wait does not require the task still pending"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'input box' >/dev/null; then
    diag "launch/wait does not confirm the prompt remains in the input box"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'exactly once' >/dev/null; then
    diag "launch/wait does not limit Enter to exactly once"
    tmp=1
  fi
  if printf '%s\n' "$section" | grep -Ei 'Enter immediately|immediately after every' >/dev/null; then
    diag "launch/wait sends Enter immediately"
    tmp=1
  fi
  if printf '%s\n' "$section" | grep -Ei 'Enter again|another Enter|second Enter' >/dev/null; then
    diag "launch/wait permits repeated Enter presses"
    tmp=1
  fi

  return $tmp
}

run_all_checks() {
  local file=$1
  local tmp=0
  check_approval_invariant "$file" || tmp=1
  check_shapes "$file" || tmp=1
  check_frontmatter_routing "$file" || tmp=1
  check_orca_mandatory "$file" || tmp=1
  check_freshness_review "$file" || tmp=1
  check_remediation "$file" || tmp=1
  check_native_evidence "$file" || tmp=1
  check_release "$file" || tmp=1
  check_launch_wait "$file" || tmp=1
  return $tmp
}

if [ ! -f "$skill" ]; then
  fail "skills/delivery/SKILL.md is absent"
else
  shipped_out=$(mktemp "${TMPDIR:-/tmp}/delivery-contract-shipped.XXXXXX")
  if ! run_all_checks "$skill" >"$shipped_out" 2>&1; then
    fail "shipped delivery skill failed the contract check"
    cat "$shipped_out" >&2
  fi
  rm -f "$shipped_out"
fi

scratch=$(mktemp -d "${TMPDIR:-/tmp}/delivery-contract.XXXXXX")
cleanup() { rm -rf "$scratch"; }
trap cleanup EXIT

expect_check_fail() {
  local checker=$1
  local file=$2
  local why=$3
  local out=$4
  if "$checker" "$file" >"$out" 2>&1; then
    fail "negative fixture passed ${checker}: ${why}"
    cat "$out" >&2
    return 1
  fi
  if [ ! -s "$out" ]; then
    fail "negative fixture ${why} was rejected with no FAIL line"
    return 1
  fi
}

# Fixture 1: a complete-looking flow where Plan Mode approval bypasses Dely's
# invariant — present but wrong for the approval-invariant row.
cat >"$scratch/bypass.md" <<'EOF'
## Control

Control owns the approval invariant. Once native Plan Mode's plan is
approved by the human in that UI, Plan Mode can bypass Dely's own contract
approval step and mutation may begin immediately.
EOF
expect_check_fail check_approval_invariant "$scratch/bypass.md" \
  "Plan Mode approval bypasses Dely's contract approval" \
  "$scratch/out-bypass"

# Fixture 2: a renamed four-phase workflow with no shape routing at all —
# same decision, plan, task review, and integration review for everything.
cat >"$scratch/no-shapes.md" <<'EOF'
## Phases

design -> implement -> review -> release. Every request gets one decision
record, one plan, one task review, and one integration review.
EOF
expect_check_fail check_shapes "$scratch/no-shapes.md" \
  "renamed workflow with no Spike/Bounded/Architectural routing" \
  "$scratch/out-no-shapes"

# Fixture 2b: a complete-looking skill — full Spike/Bounded/Architectural body
# intact — whose frontmatter description alone forbids discovery on Bounded
# work. The body-only checks above cannot see this; only a frontmatter check
# can.
if [ -f "$skill" ]; then
  sed 's/^description:.*/description: Deliver a change through design, implementation and review. Only for Architectural changes; never use for Bounded changes, even a one-line fix./' \
    "$skill" >"$scratch/contradictory-frontmatter.md"
  expect_check_fail check_frontmatter_routing "$scratch/contradictory-frontmatter.md" \
    "complete-looking skill whose frontmatter forbids Bounded work" \
    "$scratch/out-contradictory-frontmatter"
fi

# Fixture 3: says Orca is preferred but keeps a headless fallback.
cat >"$scratch/headless.md" <<'EOF'
## Dispatch

Orca is the preferred execution plane.

A direct headless harness call is a fallback only when no coordinator is
selected, or when the selected coordinator is unavailable.
EOF
expect_check_fail check_orca_mandatory "$scratch/headless.md" \
  "Orca preferred rather than mandatory, with a retained headless fallback" \
  "$scratch/out-headless"

# Fixture 4: every task gets a fresh implementer regardless of shape, and
# review depth is fixed rather than adaptive.
cat >"$scratch/fixed-depth.md" <<'EOF'
## Implementation

Every changed file gets its own fresh implementer TUI. Review is always one
task review followed by one integration review, for Bounded and
Architectural work alike.
EOF
expect_check_fail check_freshness_review "$scratch/fixed-depth.md" \
  "no batching and non-adaptive fixed review depth" \
  "$scratch/out-fixed-depth"

# Fixture 5: remediation starts a fresh implementer and loops until green.
cat >"$scratch/loop.md" <<'EOF'
## Remediation

A finding sends the work to a fresh implementation session. If the reviewer
still does not accept, dispatch another fresh implementation session and
repeat until ACCEPT.
EOF
expect_check_fail check_remediation "$scratch/loop.md" \
  "remediation loops through fresh implementers instead of stopping at REPLAN_OR_SPLIT" \
  "$scratch/out-loop"

# Fixture 6: evidence still comes from the removed journal and doctor.
cat >"$scratch/journal.md" <<'EOF'
## Evidence

Gate evidence is journaled wherever the hooks are wired. Run delivery-doctor
before trusting any of this; bin/delivery-evidence reads the journal back.
EOF
expect_check_fail check_native_evidence "$scratch/journal.md" \
  "evidence still sourced from the removed journal/doctor rails" \
  "$scratch/out-journal"

# Fixture 7: release dispatches an LLM worker instead of exact-HEAD Control.
cat >"$scratch/release-worker.md" <<'EOF'
## Release

Dispatch a fresh release worker to append the delivery-log row, run the
gates, and open the pull request whenever the branch is ready.
EOF
expect_check_fail check_release "$scratch/release-worker.md" \
  "release dispatches an LLM worker with no exact-HEAD or draft-PR binding" \
  "$scratch/out-release-worker"

# Fixture 8: TUI read exists but a second missing signal authorizes another
# Enter — the historical dispatch-submission counterexample.
cat >"$scratch/repeat-enter.md" <<'EOF'
### Launching a worker

After a coordinator-selected dispatch, `input_accepted` is a transport
receipt, not proof that the harness submitted the prompt. Control allows 90
seconds for a dispatch heartbeat or visible agent progress. If neither
appears, Control reads the worker TUI. When that read shows the task still
pending in the input box, send Enter exactly once. If a second missing
signal arrives, send Enter again.
EOF
expect_check_fail check_launch_wait "$scratch/repeat-enter.md" \
  "contract that permits repeated Enter presses" \
  "$scratch/out-repeat-enter"

if [ "$failures" -ne 0 ]; then
  printf '%s\n' "delivery-contract: ${failures} failure(s)" >&2
  exit 1
fi
printf '%s\n' "delivery-contract: ok"
