#!/usr/bin/env bash
# Focused check: delivery-evidence classifies a standalone pipe conservatively.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
reader="$root/bin/delivery-evidence"
[ -f "$reader" ] || { printf '%s\n' "missing reader: $reader" >&2; exit 1; }

journal=$(mktemp -d "${TMPDIR:-/tmp}/delivery-evidence-pipeline.XXXXXX")
json_out=$(mktemp "${TMPDIR:-/tmp}/delivery-evidence-pipeline-json.XXXXXX")
human_out=$(mktemp "${TMPDIR:-/tmp}/delivery-evidence-pipeline-human.XXXXXX")
cleanup() { rm -rf "$journal" "$json_out" "$human_out"; }
trap cleanup EXIT

session='pipeline-fixture'
direct_cmd='true'
or_cmd='false || true'
pipe_cmd='true | cat'

write_record() {
  jq -nc --arg cmd "$1" --arg id "$2" '{
    observed_at: "2026-08-20T00:00:00Z",
    payload: {
      session_id: "pipeline-fixture",
      cwd: "/tmp",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: {command: $cmd, description: $id},
      tool_use_id: $id,
      duration_ms: 1,
      tool_response: {stdout: "ok\n", stderr: "", interrupted: false}
    }
  }'
}

{
  write_record "$direct_cmd" 'direct'
  write_record "$or_cmd" 'or-fallback'
  write_record "$pipe_cmd" 'single-pipe'
} > "$journal/${session}.raw.jsonl"

DELIVERY_JOURNAL_DIR="$journal" bash "$reader" --json "$session" > "$json_out"

count=$(jq -s 'length' "$json_out")
if [ "$count" != "3" ]; then
  printf '%s\n' "expected 3 JSON records, got $count" >&2
  exit 1
fi

flag_for() {
  jq -r --arg cmd "$1" 'select(.command == $cmd) | .pipeline_present | tostring' "$json_out"
}

pipe_flag=$(flag_for "$pipe_cmd")
if [ "$pipe_flag" != "true" ]; then
  printf '%s\n' "missing pipeline_present: expected true for single-pipe command, got ${pipe_flag}" >&2
  exit 1
fi

direct_flag=$(flag_for "$direct_cmd")
if [ "$direct_flag" != "false" ]; then
  printf '%s\n' "expected pipeline_present=false for direct command, got ${direct_flag}" >&2
  exit 1
fi

or_flag=$(flag_for "$or_cmd")
if [ "$or_flag" != "false" ]; then
  printf '%s\n' "expected pipeline_present=false for || fallback, got ${or_flag}" >&2
  exit 1
fi

DELIVERY_JOURNAL_DIR="$journal" bash "$reader" "$session" > "$human_out"

block_for() {
  awk -v cmd="$1" '
    BEGIN { prefix = "$ " cmd }
    $0 == prefix { grab = 1; next }
    grab && /^\$ / { exit }
    grab { print }
  ' "$human_out"
}

has_warning() {
  block_for "$1" | grep -F -q 'does not prove every stage'
}

if has_warning "$direct_cmd"; then
  printf '%s\n' "human output warned on the direct command" >&2
  exit 1
fi
if has_warning "$or_cmd"; then
  printf '%s\n' "human output warned on the || fallback" >&2
  exit 1
fi
if ! has_warning "$pipe_cmd"; then
  printf '%s\n' "human output did not warn on the single-pipe command" >&2
  exit 1
fi

printf '%s\n' 'delivery-evidence pipeline classification: ok'
