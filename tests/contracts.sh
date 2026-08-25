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

exit "$fail"
