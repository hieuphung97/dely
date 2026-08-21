#!/usr/bin/env bash
# PostToolUse (Bash): journal the raw hook payload.
#
# Why this exists: gate evidence is currently whatever the session says the
# terminal printed. That claim has been fabricated more than once, and nothing
# downstream can check it. A journal written by the tool layer can be checked.
#
# This iteration is a PROBE, on purpose. It records the payload verbatim so the
# schema is observed rather than assumed — in particular whether the Bash
# tool_response carries an exit code. Shaping comes after one real capture.
#
# Contract: never writes to stdout, always exits 0. A journal must not be able
# to fail a turn.

set -u

journal_dir="${DELIVERY_JOURNAL_DIR:-$HOME/.delivery-journal}"
mkdir -p "$journal_dir" 2>/dev/null || exit 0

payload=$(cat 2>/dev/null) || exit 0
[ -n "$payload" ] || exit 0

observed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || printf 'unknown')

if command -v jq >/dev/null 2>&1; then
  # Claude Code and Codex send `session_id`; Grok sends `sessionId`. Reading only
  # one of them filed every Grok event under "unknown", which is where the whole
  # session's evidence went before this was observed.
  session_id=$(printf '%s' "$payload" | jq -r '.session_id // .sessionId // "unknown"' 2>/dev/null)
  [ -n "$session_id" ] || session_id='unknown'

  # One file per event, not one appended line per event.
  #
  # Appending to a shared file loses data. `jq` writes its output in chunks of
  # roughly 4 KB, so a record larger than that reaches the file as several
  # writes, and a concurrently firing hook can land between them. Observed
  # 2026-08-20 in a Codex review session: 4 of 22 events were destroyed exactly
  # that way, two JSON objects fused mid-string at column 4110. The payloads
  # most likely to exceed the chunk size are gate outputs, which is the evidence
  # this journal exists to keep, so the failure was aimed at the worst target.
  #
  # A lock would also work and is worse here: there is no `flock` on macOS, and
  # a lock a crashed hook fails to release would make every later hook wait.
  # This hook must never be able to delay or fail a turn.
  session_dir="${journal_dir}/${session_id}"
  mkdir -p "$session_dir" 2>/dev/null || exit 0

  # Colons out of the filename; they are legal on APFS but confuse enough tools
  # to be not worth it. The name sorts lexicographically into arrival order,
  # except within one second, where the record's own `observed_at` is the
  # authority rather than the name.
  stamp=$(printf '%s' "$observed_at" | tr -d ':-')
  out="${session_dir}/${stamp}-$$-${RANDOM}.json"
  if ! printf '%s' "$payload" \
    | jq -c --arg at "$observed_at" '{observed_at: $at, payload: .}' \
      > "$out" 2>/dev/null; then
    rm -f "$out" 2>/dev/null
  fi
else
  # No jq: keep the payload anyway, unwrapped, one file per event for the same
  # reason as above.
  mkdir -p "${journal_dir}/unparsed" 2>/dev/null || exit 0
  printf '%s\n' "$payload" > "${journal_dir}/unparsed/${observed_at}-$$-${RANDOM}.json" 2>/dev/null
fi

exit 0
