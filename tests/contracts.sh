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

skill_flat="$(tr '\n' ' ' < "$skill" | tr -s ' ')"

case "$skill_flat" in
  *"Dely never creates the directory or file"*) ;;
  *) fail_with "maintenance log must stay opt-in: no auto-creation clause in $skill" ;;
esac

case "$skill_flat" in
  *"missing path is skipped silently"*) ;;
  *) fail_with "maintenance log must skip a missing ~/.dely/log path silently" ;;
esac

case "$skill_flat" in
  *"does not invalidate or block an otherwise accepted release"*) ;;
  *) fail_with "an append failure must not block an otherwise accepted release" ;;
esac

exit "$fail"
