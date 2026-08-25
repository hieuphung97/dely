#!/usr/bin/env bash
# Focused structural contract checks for the dely package.
# Usage: tests/contracts.sh [root]
#   root defaults to "." so a fixture copy can be checked in isolation.
set -uo pipefail

root="${1:-.}"
fail=0

fail_with() {
  echo "FAIL: $1" >&2
  fail=1
}

claude_manifest="$root/.claude-plugin/plugin.json"
codex_manifest="$root/.codex-plugin/plugin.json"
skill="$root/skills/delivery/SKILL.md"

claude_version="$(jq -r .version "$claude_manifest" 2>/dev/null)"
codex_version="$(jq -r .version "$codex_manifest" 2>/dev/null)"

if [ "$claude_version" != "0.12.0" ] || [ "$codex_version" != "0.12.0" ]; then
  fail_with "manifest versions must both be 0.12.0 (claude=$claude_version codex=$codex_version)"
fi

# The whole maintenance-log section is matched verbatim (whitespace-normalized)
# rather than by scattered substrings: a substring check only proves a required
# clause is present somewhere, so a fixture that leaves it untouched but adds a
# contradictory instruction elsewhere (e.g. "Control creates the log if
# missing"), or one that flips a single word in a required clause (e.g. "are
# not recorded" -> "are recorded"), still passed. Exact-section matching
# rejects any such addition or mutation.
expected_log_section='Maintenance logging is machine-local and opt-in at `~/.dely/log`. Dely never creates the directory or file: a missing path is skipped silently, and deleting the file opts out. Only after a delivery is accepted and all required checks are green does Control append exactly one physical line; aborted or incomplete deliveries are not recorded. The line carries an ISO-8601 UTC timestamp and labelled fields for the Git-root basename, plan, pull request or `none`, implementation-round count, ordered review dispositions, and one short drift-cause sentence. Tabs separate fields; embedded tabs and newlines become spaces. Dely never reads this file for routing, recovery, or runtime decisions, and its text layout is not a public parsing schema. An append failure produces a visible warning but does not invalidate or block an otherwise accepted release.'

actual_log_section="$(awk '/^### Maintenance log$/{flag=1; next} flag && /^#/{exit} flag' "$skill" | tr '\n' ' ' | tr -s ' ')"
actual_log_section="${actual_log_section# }"
actual_log_section="${actual_log_section% }"

if [ "$actual_log_section" != "$expected_log_section" ]; then
  fail_with "maintenance log section in $skill no longer matches the approved opt-in, accepted-only, non-blocking contract verbatim"
fi

# Setup's managed block: the fenced "What to write" template must carry
# exactly two data rows, phases {implement, review} with no duplicate or
# extra phase (e.g. a lingering control/release row). Word-presence alone
# cannot catch an extra row that still contains the right words.
setup_skill="$root/skills/setup/SKILL.md"

managed_block_template() {
  awk '
    /^## What to write[[:space:]]*$/ { p = 1; next }
    p && /^```/ { fence = !fence }
    p && !fence && /^## / { exit }
    p { print }
  ' "$1"
}

setup_block_check="$(managed_block_template "$setup_skill" | awk '
  function trim(s) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
  /^\|/ {
    if (!header_seen) { header_seen = 1; next }
    t = $0; gsub(/[|:[:space:]-]/, "", t)
    if (t == "") next
    n = split($0, a, "|")
    phase = trim(a[2]); gsub(/`/, "", phase)
    rows++
    count[phase]++
  }
  END {
    if (rows != 2 || count["implement"] != 1 || count["review"] != 1) {
      print "bad"
      exit
    }
    for (p in count) if (p != "implement" && p != "review") { print "bad"; exit }
    print "ok"
  }
')"

if [ "$setup_block_check" != "ok" ]; then
  fail_with "$setup_skill managed block does not have exactly one implement and one review row"
fi

# Plan template's acceptance header: the four named columns must all be
# present, in any order, alongside whatever else the row carries.
plan_template="$root/skills/delivery/templates/plan.md"

acceptance_header="$(awk '
  /^## Acceptance[[:space:]]*$/ { in_acc = 1; next }
  in_acc && /^## / { exit }
  in_acc && /^\|/ && /[A-Za-z]/ { print; exit }
' "$plan_template")"

for col in Requirement Instrument Counterexample "Observed red"; do
  if ! printf '%s\n' "$acceptance_header" | grep -F "| $col " >/dev/null && \
     ! printf '%s\n' "$acceptance_header" | grep -F "| $col |" >/dev/null; then
    fail_with "$plan_template acceptance header is missing column: $col"
  fi
done

exit "$fail"
