#!/usr/bin/env bash
# Focused check: delivery-doctor accepts a Grok adapter whose every command
# points at a root that is not the directory the doctor was run from, and
# still refuses a missing root, a root missing either hook script, a mixed
# adapter, an unexpected command shape, or malformed JSON.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
doctor="$root/bin/delivery-doctor"
template="$root/hooks/grok-hooks.json.template"
[ -f "$doctor" ] || { printf '%s\n' "missing doctor: $doctor" >&2; exit 1; }
[ -f "$template" ] || { printf '%s\n' "missing template: $template" >&2; exit 1; }

if ! command -v grok >/dev/null 2>&1; then
  printf '%s\n' "grok not on PATH; this test cannot drive the Grok check" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq not on PATH; delivery-doctor cannot parse the adapter" >&2
  exit 1
fi

scratch=$(mktemp -d "${TMPDIR:-/tmp}/delivery-doctor-grok-hook.XXXXXX")
cleanup() { rm -rf "$scratch"; }
trap cleanup EXIT

run_doctor() {
  local home="$1"
  local out="$2"
  HOME="$home" bash "$doctor" "$root" >"$out" 2>&1 || true
}

grok_ok_line() {
  grep -E '^  ok[[:space:]]+.*Grok hook' "$1" >/dev/null
}

grok_non_ok_line() {
  grep -E '^  (warn|FAIL)[[:space:]]+.*Grok hook' "$1" >/dev/null
}

write_adapter() {
  local dest="$1"
  local pkg="$2"
  mkdir -p "$(dirname "$dest")"
  sed "s#__PACKAGE_ROOT__#${pkg}#g" "$template" >"$dest"
}

expect_ok() {
  local out="$1"
  local why="$2"
  if ! grok_ok_line "$out"; then
    printf '%s\n' "expected ok Grok hook for ${why}" >&2
    cat "$out" >&2
    exit 1
  fi
}

expect_non_ok() {
  local out="$1"
  local why="$2"
  if grok_ok_line "$out"; then
    printf '%s\n' "expected non-ok Grok hook for ${why}" >&2
    cat "$out" >&2
    exit 1
  fi
  if ! grok_non_ok_line "$out"; then
    printf '%s\n' "missing non-ok Grok hook line for ${why}" >&2
    cat "$out" >&2
    exit 1
  fi
}

# --- case 1: valid adapter pointing at a complete foreign package root ------

foreign=$(mktemp -d "$scratch/foreign.XXXXXX")
mkdir -p "$foreign/hooks"
: >"$foreign/hooks/session-start-context.sh"
: >"$foreign/hooks/post-tool-journal.sh"

home1="$scratch/home-ok"
write_adapter "$home1/.grok/hooks/delivery.json" "$foreign"

out1="$scratch/out-ok"
run_doctor "$home1" "$out1"
expect_ok "$out1" "a complete foreign root"

# --- case 2: valid adapter pointing at a root that does not exist ----------

home2="$scratch/home-missing"
write_adapter "$home2/.grok/hooks/delivery.json" "${scratch}/does-not-exist"

out2="$scratch/out-missing"
run_doctor "$home2" "$out2"
expect_non_ok "$out2" "a missing root"

# --- case 3: malformed JSON ------------------------------------------------

home3="$scratch/home-bad-json"
mkdir -p "$home3/.grok/hooks"
printf '%s\n' '{ not json' >"$home3/.grok/hooks/delivery.json"

out3="$scratch/out-bad-json"
run_doctor "$home3" "$out3"
expect_non_ok "$out3" "malformed JSON"

# --- case 4: mixed adapter — SessionStart complete, PostToolUse missing -----

complete=$(mktemp -d "$scratch/complete.XXXXXX")
mkdir -p "$complete/hooks"
: >"$complete/hooks/session-start-context.sh"
: >"$complete/hooks/post-tool-journal.sh"
missing="${scratch}/mixed-missing"

home4="$scratch/home-mixed"
write_adapter "$home4/.grok/hooks/delivery.json" "$complete"
jq --arg missing "$missing" '
  .hooks.PostToolUse[0].hooks[0].command =
    "bash \"\($missing)/hooks/post-tool-journal.sh\"" |
  .hooks.PostToolUseFailure[0].hooks[0].command =
    "bash \"\($missing)/hooks/post-tool-journal.sh\""
' "$home4/.grok/hooks/delivery.json" >"$scratch/mixed.json"
mv "$scratch/mixed.json" "$home4/.grok/hooks/delivery.json"

out4="$scratch/out-mixed"
run_doctor "$home4" "$out4"
expect_non_ok "$out4" "a mixed adapter whose PostToolUse root is missing"

# --- case 5: root holding only post-tool-journal.sh ------------------------

journal_only=$(mktemp -d "$scratch/journal-only.XXXXXX")
mkdir -p "$journal_only/hooks"
: >"$journal_only/hooks/post-tool-journal.sh"

home5="$scratch/home-journal-only"
write_adapter "$home5/.grok/hooks/delivery.json" "$journal_only"

out5="$scratch/out-journal-only"
run_doctor "$home5" "$out5"
expect_non_ok "$out5" "a root holding only post-tool-journal.sh"

# --- case 6: unexpected command shape on a non-first event -----------------

home6="$scratch/home-shape"
write_adapter "$home6/.grok/hooks/delivery.json" "$foreign"
jq '
  .hooks.PostToolUse[0].hooks[0].command = "python3 /tmp/not-the-template.py"
' "$home6/.grok/hooks/delivery.json" >"$scratch/shape.json"
mv "$scratch/shape.json" "$home6/.grok/hooks/delivery.json"

out6="$scratch/out-shape"
run_doctor "$home6" "$out6"
expect_non_ok "$out6" "an unexpected command shape"

# --- case 7: otherwise complete adapter with one command blanked to "" -----

home7="$scratch/home-empty-cmd"
write_adapter "$home7/.grok/hooks/delivery.json" "$foreign"
jq '
  .hooks.PostToolUse[0].hooks[0].command = ""
' "$home7/.grok/hooks/delivery.json" >"$scratch/empty-cmd.json"
mv "$scratch/empty-cmd.json" "$home7/.grok/hooks/delivery.json"

out7="$scratch/out-empty-cmd"
run_doctor "$home7" "$out7"
expect_non_ok "$out7" "an otherwise complete adapter with one command blanked to empty"

printf '%s\n' "delivery-doctor-grok-hook: ok"
