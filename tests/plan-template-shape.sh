#!/usr/bin/env bash
# Focused check: the delivery plan template still carries the four named
# acceptance columns, the skill's Acceptance section names baseline-red as
# insufficient, and both plugin manifests agree on a version that is not 0.6.0.
#
# The directory to inspect is the first argument, or PLAN_TEMPLATE_ROOT, or
# this repository. Negative cases copy the template and skill into a scratch
# directory, degrade one thing, and run the same check against the copy — they
# cannot be driven by editing the repository's own files.
#
# With a directory argument (or PLAN_TEMPLATE_ROOT), only that tree is
# inspected. With neither, this script also drives the fixture cases below.
# Does not call claude, codex, grok or orca, and does not require a git
# repository.
set -u

here=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

inspect_root="${1:-${PLAN_TEMPLATE_ROOT:-}}"
drive_fixtures=0
if [ -z "$inspect_root" ]; then
  inspect_root=$here
  drive_fixtures=1
else
  inspect_root=$(CDPATH= cd -- "$inspect_root" && pwd)
fi

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq not on PATH; cannot parse plugin manifests" >&2
  exit 1
fi

failures=0
fail() {
  printf '%s\n' "FAIL: $*" >&2
  failures=$((failures + 1))
}

# Inspect diagnostics. Do not increment the driver counter: a fixture that
# the check must reject prints FAIL and returns non-zero, and that is success
# for the case.
diag() {
  printf '%s\n' "FAIL: $*" >&2
}

# Print the first letter-bearing table row after ## Acceptance.
acceptance_header() {
  awk '
    /^## Acceptance[[:space:]]*$/ { in_acc = 1; next }
    in_acc && /^## / { exit }
    in_acc && /^\|/ && /[A-Za-z]/ { print; exit }
  ' "$1"
}

# One trimmed header cell per line.
header_cells() {
  awk '
    function trim(s) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
      return s
    }
    {
      n = split($0, a, "|")
      for (i = 1; i <= n; i++) {
        c = trim(a[i])
        if (c != "") print c
      }
    }
  '
}

check_template() {
  local root=$1
  local file="$root/skills/delivery/templates/plan.md"
  local header
  local cell
  local has_req=0 has_inst=0 has_ce=0 has_red=0

  if [ ! -f "$file" ]; then
    diag "missing plan template: $file"
    return 1
  fi

  header=$(acceptance_header "$file")
  if [ -z "$header" ]; then
    diag "plan template has no acceptance table header"
    return 1
  fi

  while IFS= read -r cell; do
    case "$cell" in
      Requirement) has_req=1 ;;
      Instrument) has_inst=1 ;;
      Counterexample) has_ce=1 ;;
      "Observed red") has_red=1 ;;
    esac
  done <<EOF
$(printf '%s\n' "$header" | header_cells)
EOF

  if [ "$has_req" -ne 1 ] || [ "$has_inst" -ne 1 ] || [ "$has_ce" -ne 1 ] || [ "$has_red" -ne 1 ]; then
    diag "acceptance header is missing a required column (Requirement, Instrument, Counterexample, Observed red): $header"
    return 1
  fi
  return 0
}

# Text of ## Execution envelope up to the next ## heading in the plan
# template. Checks that the automation-first execution envelope — protected
# dirty paths, branch/base/remote/PR target, resolved phase pins, and
# mutation/release authority — is a real, task-ready section rather than
# left to reader inference.
execution_envelope_section() {
  awk '
    /^## Execution envelope[[:space:]]*$/ { p = 1; next }
    p && /^## / { exit }
    p { print }
  ' "$1"
}

check_execution_envelope() {
  local root=$1
  local file="$root/skills/delivery/templates/plan.md"
  local section
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing plan template: $file"
    return 1
  fi

  section=$(execution_envelope_section "$file")
  if [ -z "$section" ]; then
    diag "plan template has no Execution envelope section"
    return 1
  fi

  if ! printf '%s\n' "$section" | grep -Ei 'protected dirty path' >/dev/null; then
    diag "execution envelope does not name protected dirty paths"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'branch' >/dev/null; then
    diag "execution envelope does not name the branch"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'base' >/dev/null; then
    diag "execution envelope does not name the base"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'remote' >/dev/null; then
    diag "execution envelope does not name the remote"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'pull.request target' >/dev/null; then
    diag "execution envelope does not name the pull-request target"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'harness, model, and effort|harness.{0,15}model.{0,15}effort' >/dev/null; then
    diag "execution envelope does not name resolved harness/model/effort phase pins"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'authority' >/dev/null; then
    diag "execution envelope does not name authority"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'merge' >/dev/null; then
    diag "execution envelope does not name merge as out of authority"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'force-push' >/dev/null; then
    diag "execution envelope does not name force-push as out of authority"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'stash' >/dev/null; then
    diag "execution envelope does not name stash as out of authority"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'reset' >/dev/null; then
    diag "execution envelope does not name reset as out of authority"
    tmp=1
  fi

  return $tmp
}

# Text of ### Acceptance up to the next ## heading.
acceptance_section() {
  awk '
    /^### Acceptance[[:space:]]*$/ { p = 1; next }
    p && /^## / { exit }
    p { print }
  ' "$1"
}

check_skill() {
  local root=$1
  local file="$root/skills/delivery/SKILL.md"
  local section
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi

  section=$(acceptance_section "$file")
  if [ -z "$section" ]; then
    diag "SKILL.md has no Acceptance section"
    return 1
  fi

  if ! printf '%s\n' "$section" | grep -Ei 'baseline-red' >/dev/null; then
    diag "Acceptance section does not name baseline-red"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'insufficient' >/dev/null; then
    diag "Acceptance section does not name baseline-red as insufficient"
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'counterexample' >/dev/null; then
    diag "Acceptance section does not require a counterexample"
    tmp=1
  fi
  return $tmp
}

check_manifests() {
  local root=$1
  local claude="$root/.claude-plugin/plugin.json"
  local codex="$root/.codex-plugin/plugin.json"
  local claude_ver codex_ver
  local tmp=0

  if [ ! -f "$claude" ]; then
    diag "missing $claude"
    tmp=1
  fi
  if [ ! -f "$codex" ]; then
    diag "missing $codex"
    tmp=1
  fi
  if [ "$tmp" -ne 0 ]; then
    return 1
  fi

  if ! jq -e . "$claude" >/dev/null 2>&1; then
    diag "cannot parse $claude"
    tmp=1
  fi
  if ! jq -e . "$codex" >/dev/null 2>&1; then
    diag "cannot parse $codex"
    tmp=1
  fi
  if [ "$tmp" -ne 0 ]; then
    return 1
  fi

  claude_ver=$(jq -r '.version // empty' "$claude")
  codex_ver=$(jq -r '.version // empty' "$codex")
  if [ -z "$claude_ver" ] || [ -z "$codex_ver" ]; then
    diag "a plugin manifest is missing version"
    return 1
  fi
  if [ "$claude_ver" != "$codex_ver" ]; then
    diag "plugin manifest versions differ: claude=${claude_ver} codex=${codex_ver}"
    tmp=1
  fi
  if [ "$claude_ver" = "0.6.0" ] || [ "$codex_ver" = "0.6.0" ]; then
    diag "plugin manifest version is still 0.6.0"
    tmp=1
  fi
  return $tmp
}

inspect_tree() {
  local root=$1
  local tmp=0
  check_template "$root" || tmp=1
  check_execution_envelope "$root" || tmp=1
  check_skill "$root" || tmp=1
  if [ -f "$root/.claude-plugin/plugin.json" ] || [ -f "$root/.codex-plugin/plugin.json" ]; then
    check_manifests "$root" || tmp=1
  fi
  return $tmp
}

if [ "$drive_fixtures" -eq 0 ]; then
  if inspect_tree "$inspect_root"; then
    printf '%s\n' "plan-template-shape: ok"
    exit 0
  fi
  exit 1
fi

if ! inspect_tree "$inspect_root"; then
  fail "repository template, skill or manifests (case 1)"
fi

scratch=$(mktemp -d "${TMPDIR:-/tmp}/plan-template-shape.XXXXXX")
cleanup() { rm -rf "$scratch"; }
trap cleanup EXIT

seed() {
  local dest=$1
  mkdir -p "$dest/skills/delivery/templates"
  cp "$here/skills/delivery/templates/plan.md" "$dest/skills/delivery/templates/plan.md"
  cp "$here/skills/delivery/SKILL.md" "$dest/skills/delivery/SKILL.md"
}

set_acceptance_header() {
  local file=$1
  local header=$2
  local tmp
  tmp=$(mktemp "$scratch/header.XXXXXX")
  awk -v header="$header" '
    /^## Acceptance[[:space:]]*$/ { print; in_acc = 1; next }
    in_acc && /^\|/ && /[A-Za-z]/ && !done {
      print header
      done = 1
      next
    }
    { print }
  ' "$file" >"$tmp"
  mv "$tmp" "$file"
}

expect_inspect_fail() {
  local root=$1
  local why=$2
  local out="$scratch/out-$(basename "$root")"
  if inspect_tree "$root" >"$out" 2>&1; then
    fail "expected inspect to fail for ${why}"
    cat "$out" >&2
    return 1
  fi
}

expect_inspect_pass() {
  local root=$1
  local why=$2
  local out="$scratch/out-$(basename "$root")"
  if ! inspect_tree "$root" >"$out" 2>&1; then
    fail "expected inspect to pass for ${why}"
    cat "$out" >&2
    return 1
  fi
}

# --- case 2: three old columns ----------------------------------------------

case2="$scratch/three-col"
seed "$case2"
set_acceptance_header "$case2/skills/delivery/templates/plan.md" \
  '| Requirement | Instrument | Discriminates? |'
expect_inspect_fail "$case2" "acceptance table reduced to the three old columns"

# --- case 3: Counterexample renamed -----------------------------------------

case3="$scratch/renamed-ce"
seed "$case3"
set_acceptance_header "$case3/skills/delivery/templates/plan.md" \
  '| Requirement | Instrument | Notes | Observed red |'
expect_inspect_fail "$case3" "four columns with Counterexample renamed"

# --- case 4: Observed red renamed -------------------------------------------

case4="$scratch/renamed-red"
seed "$case4"
set_acceptance_header "$case4/skills/delivery/templates/plan.md" \
  '| Requirement | Instrument | Counterexample | Evidence |'
expect_inspect_fail "$case4" "four columns with Observed red renamed"

# --- case 5: word only in prose, header still three columns -----------------

case5="$scratch/prose-only"
seed "$case5"
set_acceptance_header "$case5/skills/delivery/templates/plan.md" \
  '| Requirement | Instrument | Discriminates? |'
prose_tmp=$(mktemp "$scratch/prose.XXXXXX")
awk '
  /^## Acceptance[[:space:]]*$/ { print; in_acc = 1; next }
  in_acc && /^\|[[:space:]]*-/ && !done {
    print
    print ""
    print "Design fills Counterexample; implement fills Observed red."
    done = 1
    next
  }
  { print }
' "$case5/skills/delivery/templates/plan.md" >"$prose_tmp"
mv "$prose_tmp" "$case5/skills/delivery/templates/plan.md"
expect_inspect_fail "$case5" "Counterexample only in prose under a three-column header"

# --- case 6: counterexample only in implement, Acceptance unchanged ---------

case6="$scratch/skill-implement-only"
seed "$case6"
old_acc="$scratch/old-acceptance.md"
cat >"$old_acc" <<'EOF'
### Acceptance

One table: each requirement, the instrument that proves it, and whether that
instrument can tell a pass from a failure.

**An acceptance row is invalid until you have settled that its instrument
discriminates.** A row whose instrument passes both before and after the change
proves nothing and will be found at review. This is the largest single cause of
lost rounds in the record — eight plans.

Record what the available instruments cannot observe. A green suite that never
exercises a surface is not evidence about that surface.

Prefer the simplest instrument that proves the contract. Browser automation,
performance thresholds and retained evidence packages need a stated risk; they are
not default ceremony.

EOF
skill6="$case6/skills/delivery/SKILL.md"
skill6_tmp=$(mktemp "$scratch/skill6.XXXXXX")
awk '
  FNR == NR { old = old $0 "\n"; next }
  /^### Acceptance[[:space:]]*$/ { printf "%s", old; skip = 1; next }
  skip && /^## / { skip = 0 }
  skip { next }
  { print }
' "$old_acc" "$skill6" >"$skill6_tmp"
mv "$skill6_tmp" "$skill6"
if ! awk '/^## implement[[:space:]]*$/,/^## /' "$skill6" | grep -Ei 'counterexample' >/dev/null; then
  skill6_tmp=$(mktemp "$scratch/skill6b.XXXXXX")
  awk '
    /^## implement[[:space:]]*$/ {
      print
      print ""
      print "The counterexample named in the plan is observed red and cited."
      next
    }
    { print }
  ' "$skill6" >"$skill6_tmp"
  mv "$skill6_tmp" "$skill6"
fi
expect_inspect_fail "$case6" "SKILL.md mentions counterexample only in implement"

# --- case 7: four required names plus a fifth column — pass -----------------

case7="$scratch/five-col"
seed "$case7"
set_acceptance_header "$case7/skills/delivery/templates/plan.md" \
  '| Requirement | Instrument | Counterexample | Observed red | Owner |'
expect_inspect_pass "$case7" "four required columns plus a fifth"

if [ "$failures" -ne 0 ]; then
  printf '%s\n' "plan-template-shape: $failures failure(s)" >&2
  exit 1
fi

printf '%s\n' "plan-template-shape: ok"
