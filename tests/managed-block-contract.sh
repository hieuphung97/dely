#!/usr/bin/env bash
# Focused check: the setup skill writes a managed block with exactly two
# non-empty phase rows — implement and review — discovered live, and states
# no coordinator, control, or release field exists. Fixture copies run
# through the same checks; a negative fixture that passes is a test failure.
# Does not require claude, codex, grok or orca, and does not run a binary —
# the doctor and its rails are removed as product components.
set -u

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
skill="$root/skills/setup/SKILL.md"

failures=0
fail() {
  printf '%s\n' "FAIL: $*" >&2
  failures=$((failures + 1))
}

diag() {
  printf '%s\n' "FAIL: $*" >&2
}

# Text of the fenced block under "## What to write".
managed_block_template() {
  awk '
    /^## What to write[[:space:]]*$/ { p = 1; next }
    p && /^```/ { fence = !fence }
    p && !fence && /^## / { exit }
    p { print }
  ' "$1"
}

check_two_rows() {
  local file=$1
  local block
  local tmp=0

  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi

  block=$(managed_block_template "$file")
  if [ -z "$block" ]; then
    diag "$file has no What to write section"
    return 1
  fi

  if ! printf '%s\n' "$block" | grep -F '`implement`' >/dev/null; then
    diag "template block has no implement row"
    tmp=1
  fi
  if ! printf '%s\n' "$block" | grep -F '`review`' >/dev/null; then
    diag "template block has no review row"
    tmp=1
  fi
  if printf '%s\n' "$block" | grep -F '`control`' >/dev/null; then
    diag "template block still has a control row"
    tmp=1
  fi
  if printf '%s\n' "$block" | grep -F '`release`' >/dev/null; then
    diag "template block still has a release row"
    tmp=1
  fi
  if printf '%s\n' "$block" | grep -Ei '^Coordinator:' >/dev/null; then
    diag "template block still has a Coordinator line"
    tmp=1
  fi

  return $tmp
}

# Minimally parses the fenced managed table's data rows (skipping the header
# and the `---` separator row) and requires exactly two rows, exactly four
# cells each, no empty cell, and the row set exactly {implement, review} with
# no duplicate or extra phase. A word-presence check cannot catch a
# malformed table that still contains the right words.
check_table_shape() {
  local file=$1
  local block

  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi

  block=$(managed_block_template "$file")
  if [ -z "$block" ]; then
    diag "$file has no What to write section"
    return 1
  fi

  printf '%s\n' "$block" | awk '
    function trim(s) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
    function is_sep(s,    t) { t = s; gsub(/[|:[:space:]-]/, "", t); return (t == "") }
    /^\|/ {
      if (!header_seen) { header_seen = 1; next }
      if (is_sep($0)) { next }
      n = split($0, a, "|")
      ncells = n - 2
      empty_here = 0
      for (i = 2; i < n; i++) {
        c = trim(a[i])
        if (c == "") empty_here = 1
      }
      if (ncells != 4) {
        print "FAIL: table row has " ncells " cell(s), expected 4: " $0 > "/dev/stderr"
        bad = 1
      }
      if (empty_here) {
        print "FAIL: table row has an empty required cell: " $0 > "/dev/stderr"
        bad = 1
      }
      phase = trim(a[2])
      gsub(/`/, "", phase)
      rows++
      count[phase]++
    }
    END {
      if (rows != 2) {
        print "FAIL: table has " rows " data row(s), expected exactly 2" > "/dev/stderr"
        bad = 1
      }
      if (count["implement"] != 1) {
        print "FAIL: expected exactly one implement row, found " (count["implement"] + 0) > "/dev/stderr"
        bad = 1
      }
      if (count["review"] != 1) {
        print "FAIL: expected exactly one review row, found " (count["review"] + 0) > "/dev/stderr"
        bad = 1
      }
      for (p in count) {
        if (p != "implement" && p != "review") {
          print "FAIL: unexpected extra or duplicate phase row: " p > "/dev/stderr"
          bad = 1
        }
      }
      exit (bad ? 1 : 0)
    }
  '
}

check_no_coordinator_control_release_fields() {
  local file=$1
  local tmp=0
  local flat

  if [ ! -f "$file" ]; then
    diag "missing skill: $file"
    return 1
  fi

  # Prose wraps across lines under a 500-line budget; flatten before phrase
  # matching so a wrap boundary cannot hide or fake a phrase.
  flat=$(tr '\n' ' ' <"$file")

  if ! printf '%s\n' "$flat" | grep -Ei 'no coordinator or orchestrator field' >/dev/null; then
    diag "does not state there is no coordinator/orchestrator field"
    tmp=1
  fi
  if ! printf '%s\n' "$flat" | grep -Ei 'no .?control.? row' >/dev/null; then
    diag "does not state there is no control row"
    tmp=1
  fi
  if ! printf '%s\n' "$flat" | grep -Ei 'no .?release.? row' >/dev/null; then
    diag "does not state there is no release row"
    tmp=1
  fi
  if ! printf '%s\n' "$flat" | grep -Ei 'discover|live harness surface|discovered live' >/dev/null; then
    diag "does not say values are discovered from the live harness surface"
    tmp=1
  fi
  if ! printf '%s\n' "$flat" | grep -Ei 'preference' >/dev/null; then
    diag "does not treat defaults as preferences rather than reproducible pins"
    tmp=1
  fi
  if printf '%s\n' "$flat" | grep -Eiq 'model catalogue' \
    && ! printf '%s\n' "$flat" | grep -Eiq 'no model catalogue|not store a catalogue|Do not store'; then
    diag "implies a stored model catalogue"
    tmp=1
  fi

  return $tmp
}

run_all_checks() {
  local file=$1
  local tmp=0
  check_two_rows "$file" || tmp=1
  check_table_shape "$file" || tmp=1
  check_no_coordinator_control_release_fields "$file" || tmp=1
  return $tmp
}

if [ ! -f "$skill" ]; then
  fail "skills/setup/SKILL.md is absent"
else
  shipped_out=$(mktemp "${TMPDIR:-/tmp}/managed-block-shipped.XXXXXX")
  if ! run_all_checks "$skill" >"$shipped_out" 2>&1; then
    fail "shipped setup skill failed the managed-block check"
    cat "$shipped_out" >&2
  fi
  rm -f "$shipped_out"
fi

scratch=$(mktemp -d "${TMPDIR:-/tmp}/managed-block-contract.XXXXXX")
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

# Fixture 1: a well-formed-looking block that still carries Coordinator,
# control and release — present but wrong for the two-row contract.
cat >"$scratch/four-row.md" <<'EOF'
## What to write

```markdown
<!-- dely:begin -->
## Dely

Planned or Critical work must invoke `dely:delivery`.

Coordinator: Orca

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `control` | Claude Code | `opus` | `high` |
| `implement` | Claude Code | `sonnet` | `medium` |
| `review` | Codex | `gpt-5.6-sol` | `medium` |
| `release` | Grok Build | `grok-4.6` | `medium` |
<!-- dely:end -->
```
EOF
expect_check_fail check_two_rows "$scratch/four-row.md" \
  "template block still carries Coordinator, control and release" \
  "$scratch/out-four-row"

# Fixture 2: a bundled model catalogue and pinned "always overrides defaults"
# stance rather than discovery-as-preference.
cat >"$scratch/catalogue.md" <<'EOF'
## Discovery

Choose from this package's bundled model catalogue below; it is always
authoritative and reproducible, never a mere preference.

| Harness | Models |
| --- | --- |
| Claude Code | sonnet, opus, haiku |
| Codex | gpt-5.6-sol, gpt-5.6-terra |
EOF
expect_check_fail check_no_coordinator_control_release_fields "$scratch/catalogue.md" \
  "bundled model catalogue instead of live discovery and preference language" \
  "$scratch/out-catalogue"

# Fixture 3: names implement and review with no Coordinator/control/release —
# passing word-presence checks — but the table itself is malformed: the
# implement row has empty Harness/Model/Effort cells, and an extra
# `investigate` phase row is present. Only real table parsing catches this.
cat >"$scratch/malformed-table.md" <<'EOF'
## What to write

```markdown
<!-- dely:begin -->
## Dely

Bounded or Architectural work invokes `dely:delivery`; Spike starts no
delivery run.

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | | | |
| `review` | Codex | `gpt-5.6-sol` | `medium` |
| `investigate` | Claude Code | `sonnet` | `medium` |
<!-- dely:end -->
```
EOF
expect_check_fail check_table_shape "$scratch/malformed-table.md" \
  "implement row with empty cells plus an extra investigate phase row" \
  "$scratch/out-malformed-table"

if [ "$failures" -ne 0 ]; then
  printf '%s\n' "managed-block-contract: ${failures} failure(s)" >&2
  exit 1
fi
printf '%s\n' "managed-block-contract: ok"
