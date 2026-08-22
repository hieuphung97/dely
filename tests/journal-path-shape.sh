#!/usr/bin/env bash
# Focused check: SessionStart advertises the per-session directory the writer
# creates, and delivery-doctor counts that layout as well as legacy .raw.jsonl.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
writer="$root/hooks/post-tool-journal.sh"
session_start="$root/hooks/session-start-context.sh"
doctor="$root/bin/delivery-doctor"
[ -f "$writer" ] || { printf '%s\n' "missing writer: $writer" >&2; exit 1; }
[ -f "$session_start" ] || { printf '%s\n' "missing SessionStart hook: $session_start" >&2; exit 1; }
[ -f "$doctor" ] || { printf '%s\n' "missing doctor: $doctor" >&2; exit 1; }

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq not on PATH; SessionStart and the doctor cannot run" >&2
  exit 1
fi

journal=$(mktemp -d "${TMPDIR:-/tmp}/journal-path-shape.XXXXXX")
out=$(mktemp "${TMPDIR:-/tmp}/journal-path-shape-doctor.XXXXXX")
cleanup() { rm -rf "$journal" "$out"; }
trap cleanup EXIT

failed=0
fail() {
  printf '%s\n' "$*" >&2
  failed=1
}

current_session='current-fixture'
legacy_session='legacy-fixture'

# Real current-layout data from the writer, not a hand-made directory.
printf '%s' "{\"session_id\":\"${current_session}\",\"tool_name\":\"Bash\"}" \
  | DELIVERY_JOURNAL_DIR="$journal" bash "$writer"
current_dir="${journal}/${current_session}"
if ! find "$current_dir" -maxdepth 1 -name '*.json' -type f | grep -q .; then
  printf '%s\n' "writer did not create a per-session event file under $current_dir" >&2
  exit 1
fi

# Deliberately supported legacy layout.
printf '%s\n' '{"observed_at":"2026-08-20T00:00:00Z","payload":{"session_id":"legacy-fixture"}}' \
  > "${journal}/${legacy_session}.raw.jsonl"

# Writer fallback directory; not a session.
mkdir -p "${journal}/unparsed"
printf '%s\n' '{"unparsed":true}' > "${journal}/unparsed/${legacy_session}.json"

# --- SessionStart must advertise the directory the writer creates ----------

start_json=$(printf '%s' "{\"session_id\":\"${current_session}\"}" \
  | CLAUDE_PROJECT_DIR="$root" DELIVERY_JOURNAL_DIR="$journal" bash "$session_start")
ctx=$(printf '%s' "$start_json" | jq -r '.hookSpecificOutput.additionalContext // empty')
got_path=$(printf '%s\n' "$ctx" | sed -n 's/^- This session'\''s evidence journal: //p')

if [ "$got_path" = "${current_dir}.raw.jsonl" ]; then
  fail "SessionStart still advertises the legacy flat path ${current_dir}.raw.jsonl"
elif [ "$got_path" != "$current_dir" ]; then
  fail "SessionStart advertised ${got_path:-<empty>}, expected per-session directory $current_dir"
fi

# --- doctor must count current directories and legacy files ----------------
# Combined fixture: one current directory, one legacy file, and unparsed/.
# A doctor that still counts only *.raw.jsonl returns 1. A doctor that counts
# every top-level directory returns 3. Both are wrong; expected is 2.

DELIVERY_JOURNAL_DIR="$journal" bash "$doctor" "$root" >"$out" 2>&1 || true

journal_line=$(grep -E 'journal directory exists' "$out" || true)
if [ -z "$journal_line" ]; then
  fail "doctor printed no journal-directory line"
  cat "$out" >&2
else
  count=$(printf '%s' "$journal_line" | grep -oE '[0-9]+' | tail -n 1)
  if [ "${count:-0}" != "2" ]; then
    fail "doctor counted ${count:-?} session(s) with one current directory, one legacy file, and unparsed/; expected 2"
    printf '%s\n' "$journal_line" >&2
  fi
  case "$journal_line" in
    *'session file'*)
      fail "doctor still calls every current target a session file: $journal_line"
      ;;
  esac
fi

if [ "$failed" -ne 0 ]; then
  exit 1
fi

printf '%s\n' 'journal path shape: ok'
