#!/usr/bin/env bash
# Focused check: the delivery skill states the automation-first thin-protocol
# contract — the approval invariant, Spike/Bounded/Architectural routing,
# mandatory Orca with no headless fallback, task-sized freshness with
# adaptive review, original-party bounded remediation, native (non-journal)
# evidence, and exact-HEAD no-worker release — and the proven
# input_accepted/90-second/TUI-read/one-Enter recovery. The design-skill /
# Plan Mode capability boundary is checked on the active owning section of
# each of its three owners — the skill, the approved design, and the durable
# decision — not the whole file, so a regression cannot hide behind matching
# tokens elsewhere. Fixture copies run through the same checks; a negative
# fixture that passes is a test failure. Does not require claude, codex, grok
# or orca.
set -u

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
skill="$root/skills/delivery/SKILL.md"
agents="$root/AGENTS.md"
decisions="$root/docs/decisions.md"
design="$root/docs/_plans/2026-08-24-automation-first-dely-design.md"

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

# --- reviewer role disposition, separate from Control routing -----------------

# Extracts the active `## Review` section (through the `### Remediation`
# subsection) and stops at the next `## ` heading. Scoped so this checker
# cannot be satisfied by implementation stop statuses or Control routing text
# that legitimately lives elsewhere (e.g. the Remediation/Failure tables).
review_section() {
  awk '/^## Review$/ { p = 1 } p && /^## / && !/^## Review$/ { exit } p { print }' "$1"
}

check_reviewer_disposition() {
  local file=$1
  local section
  local flat
  local return_line
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi

  section=$(review_section "$file")
  if [ -z "$section" ]; then
    diag "$file has no active Review section"
    return 1
  fi
  flat=$(printf '%s\n' "$section" | tr '\n' ' ')

  return_line=$(printf '%s' "$flat" | grep -Eio 'Return exactly one( role)? disposition:[^.]*\.')
  if [ -z "$return_line" ]; then
    diag "active Review section has no reviewer disposition return sentence"
    return 1
  fi

  if ! printf '%s\n' "$return_line" | grep -F 'ACCEPT' >/dev/null; then
    diag "reviewer disposition sentence omits ACCEPT"
    tmp=1
  fi
  if ! printf '%s\n' "$return_line" | grep -F 'CHANGES_REQUESTED' >/dev/null; then
    diag "reviewer disposition sentence omits CHANGES_REQUESTED"
    tmp=1
  fi
  if ! printf '%s\n' "$return_line" | grep -F 'BLOCKED' >/dev/null; then
    diag "reviewer disposition sentence omits BLOCKED"
    tmp=1
  fi
  if printf '%s\n' "$return_line" | grep -F 'REMEDIATE_ONCE' >/dev/null; then
    diag "reviewer disposition sentence tells the reviewer to return REMEDIATE_ONCE, a Control routing decision"
    tmp=1
  fi
  if printf '%s\n' "$return_line" | grep -F 'REPLAN_OR_SPLIT' >/dev/null; then
    diag "reviewer disposition sentence tells the reviewer to return REPLAN_OR_SPLIT, a Control routing decision"
    tmp=1
  fi

  return $tmp
}

# --- active repository taxonomy (Bounded/Architectural, not Planned) ----------

# Extracts the paragraph naming the focused-instrument closure rule. Blank
# lines delimit paragraphs, so this survives normal prose wrapping.
closure_paragraph() {
  awk -v RS='' '/focused instrument/ { print; exit }' "$1"
}

check_active_taxonomy() {
  local file=$1
  local para
  local flat
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing project instructions: $file"
    return 1
  fi

  para=$(closure_paragraph "$file")
  if [ -z "$para" ]; then
    diag "$file has no active focused-instrument closure paragraph"
    return 1
  fi
  flat=$(printf '%s\n' "$para" | tr '\n' ' ')

  if printf '%s' "$flat" | grep -Eq '(^|[^A-Za-z])A Planned change'; then
    diag "active focused-instrument rule is attached to nonexistent Planned work, not Bounded or Architectural"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -F 'Bounded or Architectural' >/dev/null; then
    diag "active focused-instrument rule does not apply to Bounded or Architectural work"
    tmp=1
  fi

  return $tmp
}

# --- design-skill / Plan Mode capability boundary -----------------------------

# Extracts the skill's active "## The control session" section (through the
# next "## " heading). Historical prose outside this section (e.g. an old
# HTML comment) must not be able to satisfy the contract on its behalf.
control_section() {
  awk '
    /^## The control session$/ { p = 1; next }
    p && /^## / { exit }
    p { print }
  ' "$1"
}

# Extracts the approved design's active "### Design methods and Plan Mode"
# section (through the next "## " or "### " heading).
design_methods_section() {
  awk '
    /^### Design methods and Plan Mode$/ { p = 1; next }
    p && /^#{2,3} / { exit }
    p { print }
  ' "$1"
}

# Extracts only the "#### Decision" subsection of the active "2026-08-25 —
# Dely is an automation-first thin control protocol" record (through the
# next "#### " heading), not the whole multi-thousand-line decision history,
# so an unrelated superseded decision cannot stand in for the active one.
decision_section() {
  awk '
    /^### 2026-08-25 — Dely is an automation-first thin control protocol$/ { p = 1; next }
    p && /^### / { exit }
    p { print }
  ' "$1" | awk '
    /^#### Decision$/ { p = 1; next }
    p && /^#### / { exit }
    p { print }
  '
}

# Reject-only core: the boundary must never collapse into a strict split or an
# exclusive-ownership claim, wherever the language appears (skill, design, or
# decision record).
check_design_boundary_rejects() {
  local file=$1
  local flat
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing file: $file"
    return 1
  fi
  flat=$(tr '\n' ' ' <"$file")

  if printf '%s' "$flat" | grep -Fqi 'design ownership is split'; then
    diag "still states design ownership is split between a skill and Plan Mode"
    tmp=1
  fi
  if printf '%s' "$flat" | grep -Ei 'owns how to explore, ask, compare, and present' >/dev/null && \
     printf '%s' "$flat" | grep -Ei 'independently owns tool gating and plan-approval' >/dev/null; then
    diag "a skill exclusively owns exploration/questions/design while Plan Mode independently owns only gating/approval UX"
    tmp=1
  fi
  if printf '%s' "$flat" | grep -Ei '(active (design )?skill|Plan Mode)[^.]{0,80}owns (the )?(whole |entire )?design method' >/dev/null; then
    diag "a decision claims the active skill or Plan Mode owns the whole design method"
    tmp=1
  fi

  return $tmp
}

# Positive core shared by all three active owners (skill, approved design,
# durable decision): who owns the design outcome and approval boundary, who
# selects skills/modes, what Plan Mode names, and that refinement routes
# through normal precedence — without forcing the shorter durable decision to
# also carry the fuller skill/design-only clauses below.
check_design_boundary_core() {
  local file=$1
  local flat
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing file: $file"
    return 1
  fi
  check_design_boundary_rejects "$file" || tmp=1
  flat=$(tr '\n' ' ' <"$file")

  if ! printf '%s' "$flat" | grep -Ei 'design outcome and approval boundary' >/dev/null; then
    diag "does not say Dely owns the design outcome and approval boundary"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'user, project, and harness' >/dev/null; then
    diag "does not say the user, project, and harness determine active design skills and native modes"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'question and plan surfaces' >/dev/null; then
    diag "Plan Mode's question and plan surfaces are not named"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'artifact representation' >/dev/null; then
    diag "Plan Mode's artifact representation is not named"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'mode transitions' >/dev/null; then
    diag "Plan Mode's mode transitions are not named"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'refine (exploration and )?(design )?methodology' >/dev/null; then
    diag "compatible design skills are not said to refine methodology within Plan Mode's constraints"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'instruction and tool precedence' >/dev/null; then
    diag "does not defer overlap to normal harness instruction and tool precedence"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'does not select, activate' >/dev/null; then
    diag "does not say Dely does not select or activate either mechanism"
    tmp=1
  fi

  return $tmp
}

# Full checker for the skill and approved design: the shared positive core
# plus their stricter, owner-specific clauses. The shorter durable decision
# is not required to carry these two.
check_design_boundary() {
  local file=$1
  local flat
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing file: $file"
    return 1
  fi
  check_design_boundary_core "$file" || tmp=1
  flat=$(tr '\n' ' ' <"$file")

  if ! printf '%s' "$flat" | grep -Ei 'universal interview or planning method' >/dev/null; then
    diag "does not disclaim a universal interview or planning method"
    tmp=1
  fi
  if ! printf '%s' "$flat" | grep -Ei 'material scope change' >/dev/null; then
    diag "does not require renewed approval for a material scope change"
    tmp=1
  fi

  return $tmp
}

# Runs a boundary checker (full = positive assertions + rejects; reject =
# rejects only) against one extractor's output, so each owning surface is
# checked on its own active section rather than the whole file. A regression
# in one owner must fail even when matching tokens survive elsewhere in that
# same file (e.g. a historical comment, or another owner's paragraph).
check_design_boundary_section() {
  local extractor=$1
  local src=$2
  local mode=$3
  local tmp
  local rc=0

  tmp=$(mktemp "${TMPDIR:-/tmp}/delivery-contract-section.XXXXXX")
  "$extractor" "$src" >"$tmp"
  if [ ! -s "$tmp" ]; then
    diag "$src has no active $extractor section"
    rm -f "$tmp"
    return 1
  fi
  if [ "$mode" = "core" ]; then
    check_design_boundary_core "$tmp" || rc=1
  else
    check_design_boundary "$tmp" || rc=1
  fi
  rm -f "$tmp"
  return $rc
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
  check_design_boundary_section control_section "$file" full || tmp=1
  check_shapes "$file" || tmp=1
  check_frontmatter_routing "$file" || tmp=1
  check_orca_mandatory "$file" || tmp=1
  check_freshness_review "$file" || tmp=1
  check_reviewer_disposition "$file" || tmp=1
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

if [ ! -f "$agents" ]; then
  fail "AGENTS.md is absent"
else
  agents_out=$(mktemp "${TMPDIR:-/tmp}/delivery-contract-agents.XXXXXX")
  if ! check_active_taxonomy "$agents" >"$agents_out" 2>&1; then
    fail "active AGENTS.md closure paragraph failed the taxonomy check"
    cat "$agents_out" >&2
  fi
  rm -f "$agents_out"
fi

if [ ! -f "$design" ]; then
  fail "approved design is absent: docs/_plans/2026-08-24-automation-first-dely-design.md"
else
  design_out=$(mktemp "${TMPDIR:-/tmp}/delivery-contract-design.XXXXXX")
  if ! check_design_boundary_section design_methods_section "$design" full >"$design_out" 2>&1; then
    fail "active approved-design Design methods and Plan Mode section failed the design-boundary check"
    cat "$design_out" >&2
  fi
  rm -f "$design_out"
fi

if [ ! -f "$decisions" ]; then
  fail "docs/decisions.md is absent"
else
  decisions_out=$(mktemp "${TMPDIR:-/tmp}/delivery-contract-decisions.XXXXXX")
  if ! check_design_boundary_section decision_section "$decisions" core >"$decisions_out" 2>&1; then
    fail "active docs/decisions.md Decision subsection failed the design-boundary check"
    cat "$decisions_out" >&2
  fi
  rm -f "$decisions_out"
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

# Fixture 2c: a real degraded copy of the shipped skill — everything else
# intact — with the active reviewer disposition sentence replaced by Control
# routing values. This is the exact present-but-wrong shape a whole-file grep
# for REPLAN_OR_SPLIT alone would miss, since that value also appears
# legitimately in the Remediation/Failure text.
if [ -f "$skill" ]; then
  awk -v RS='' -v ORS='\n\n' '
    /Return exactly one/ {
      gsub(/\n/, " ")
      gsub(/Return exactly one( role)? disposition: `ACCEPT`, `[A-Z_]+`, or `[A-Z_]+`\./, \
        "Return exactly one role disposition: `ACCEPT`, `REMEDIATE_ONCE`, or `REPLAN_OR_SPLIT`.")
    }
    { print }
  ' "$skill" >"$scratch/degraded-review-vocab.md"
  expect_check_fail check_reviewer_disposition "$scratch/degraded-review-vocab.md" \
    "reviewer disposition replaced by REMEDIATE_ONCE/REPLAN_OR_SPLIT Control routing values" \
    "$scratch/out-degraded-review-vocab"
fi

# Fixture 2d: a real degraded copy of the active AGENTS.md — everything else
# intact — with the focused-instrument closure subject forced back to the
# nonexistent `Planned` shape.
if [ -f "$agents" ]; then
  awk -v RS='' -v ORS='\n\n' '
    /focused instrument/ {
      gsub(/\n/, " ")
      gsub(/A (Planned|Bounded or Architectural) change to/, "A Planned change to")
    }
    { print }
  ' "$agents" >"$scratch/degraded-agents-taxonomy.md"
  expect_check_fail check_active_taxonomy "$scratch/degraded-agents-taxonomy.md" \
    "active focused-instrument rule attached to nonexistent Planned work" \
    "$scratch/out-degraded-agents-taxonomy"
fi

# Fixture 2e: a complete-looking Control section that states every required
# boundary phrase but still splits ownership — the exact present-but-wrong
# shape a whole-file grep for the positive phrases alone would miss.
cat >"$scratch/split-boundary.md" <<'EOF'
## Control

Dely owns the design outcome and approval boundary, not a universal interview
or planning method. The user, project, and harness determine which design
skills and native modes are active.

Design ownership is split: the active design skill owns how to explore, ask,
compare, and present. Native Plan Mode independently owns tool gating and
plan-approval UX, including question and plan surfaces, artifact
representation, and mode transitions. Skills refine design methodology using
normal harness instruction and tool precedence. A material scope change
requires renewed approval. Dely does not select, activate, configure,
emulate, or compose either mechanism.
EOF
expect_check_fail check_design_boundary "$scratch/split-boundary.md" \
  "complete-looking boundary language that still splits exploration/design from gating/approval" \
  "$scratch/out-split-boundary"

# Thin wrappers so expect_check_fail (one checker, one file) can drive the
# extraction-scoped check for each owning surface.
check_control_section_full() { check_design_boundary_section control_section "$1" full; }
check_design_methods_section_full() { check_design_boundary_section design_methods_section "$1" full; }
check_decision_section_core() { check_design_boundary_section decision_section "$1" core; }

# Fixture 2f: a real degraded copy of the active decisions.md — everything
# else intact — with the capability-boundary sentence replaced by an
# exclusive-ownership claim, exercised through the scoped `#### Decision`
# extractor rather than a whole-file grep.
if [ -f "$decisions" ]; then
  awk -v RS='' -v ORS='\n\n' '
    /design outcome and approval boundary/ {
      gsub(/\n/, " ")
      gsub(/compatible active design skills may refine methodology within those constraints\./, \
        "the active design skill owns the whole design method.")
    }
    { print }
  ' "$decisions" >"$scratch/degraded-decision-boundary.md"
  expect_check_fail check_decision_section_core "$scratch/degraded-decision-boundary.md" \
    "degraded decision record claiming the active skill owns the whole design method" \
    "$scratch/out-degraded-decision-boundary"
fi

# Fixture 2i: a real degraded copy of the active decisions.md — everything
# else byte-identical — whose active Decision capability paragraph is
# replaced entirely by neutral prose disclaiming any boundary, while the
# same historical tokens survive elsewhere in the file, outside the extracted
# `#### Decision` subsection. A reject-only check cannot tell this apart from
# a correct decision: no forbidden phrase appears, so it must be caught by a
# positive requirement instead.
if [ -f "$decisions" ]; then
  awk -v RS='' -v ORS='\n\n' '
    /Dely owns only the design outcome and approval boundary/ {
      gsub(/\n/, " ")
      gsub(/Dely owns only the design outcome and approval boundary, task boundaries, role independence, bounded remediation, exception routing, and exact-HEAD closure\. The user, project, and harness determine which design skills and native modes are active\. Native Plan Mode governs its enforced action constraints, question and plan surfaces, artifact representation, and mode transitions; compatible active design skills may refine methodology within those constraints\. Normal harness instruction and tool precedence governs when more than one applies\. Dely does not select, activate, emulate, or compose them, and neither can bypass approval\./, \
        "The design-method capability boundary is intentionally unspecified here; another artifact owns it.")
    }
    { print }
  ' "$decisions" >"$scratch/neutral-decision-boundary.md"
  expect_check_fail check_decision_section_core "$scratch/neutral-decision-boundary.md" \
    "active durable Decision capability paragraph replaced by neutral unspecified-boundary prose while historical tokens survive elsewhere in the file" \
    "$scratch/out-neutral-decision-boundary"
fi

# Fixture 2g: a real degraded copy of the approved design — everything else
# byte-identical — whose active "Design methods and Plan Mode" section is
# given the explicit strict-split sentences. Reproduces the reviewer
# counterexample where the design was not an input to the script at all, so
# whole-file scope never saw it; the new design_methods_section extractor
# must fail it.
if [ -f "$design" ]; then
  awk '
    /^### Design methods and Plan Mode$/ {
      print; print "";
      print "Design ownership is split: the active design skill owns how to explore, ask,"
      print "compare, and present, and native Plan Mode independently owns tool gating and"
      print "plan-approval UX."
      next
    }
    { print }
  ' "$design" >"$scratch/degraded-design-methods.md"
  expect_check_fail check_design_methods_section_full "$scratch/degraded-design-methods.md" \
    "approved design's active section reverted to the rejected strict split" \
    "$scratch/out-degraded-design-methods"
fi

# Fixture 2h: a real degraded copy of the shipped skill — everything else
# byte-identical — whose active Control paragraph is reworded to an
# exclusive-ownership claim that does not match any reject regex verbatim,
# while the original required positive phrases survive only in a trailing
# historical HTML comment outside the active section. Whole-file token
# presence would still find every required phrase and pass; only scoping the
# check to the extracted "## The control session" section catches it.
if [ -f "$skill" ]; then
  awk -v RS='' -v ORS='\n\n' '
    /Native Plan Mode governs its enforced action constraints/ {
      $0 = "Design belongs solely to the active design skill. Native Plan Mode supplies only permission gates and approval UI."
    }
    { print }
  ' "$skill" >"$scratch/degraded-control-comment.md"
  cat >>"$scratch/degraded-control-comment.md" <<'EOF'

<!-- historical: earlier draft said design outcome and approval boundary, universal
interview or planning method, user, project, and harness, question and plan surfaces,
artifact representation, mode transitions, refine exploration and design methodology,
instruction and tool precedence, material scope change, does not select, activate -->
EOF
  expect_check_fail check_control_section_full "$scratch/degraded-control-comment.md" \
    "active Control paragraph paraphrased into exclusive ownership while the required phrases survive only in a historical comment elsewhere in the file" \
    "$scratch/out-degraded-control-comment"
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
