#!/usr/bin/env bash
# Focused check: the delivery skill's worker-launch/wait portion treats
# input_accepted as a transport receipt, waits 90 seconds for a heartbeat or
# visible progress, reads the TUI on the no-signal path, and sends Enter
# exactly once only when that read shows the prompt still pending. Fixture
# copies run through the same checker; a negative fixture that passes is a
# test failure. Does not require claude, codex, grok or orca.
set -u

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
skill="$root/skills/delivery/SKILL.md"

failures=0
fail() {
  printf '%s\n' "FAIL: $*" >&2
  failures=$((failures + 1))
}

diag() {
  printf '%s\n' "FAIL: $*" >&2
}

# Text of ### Launching a worker up to ### Model and effort per phase.
launch_wait_section() {
  awk '
    /^### Launching a worker[[:space:]]*$/ { p = 1 }
    p && /^### Model and effort per phase[[:space:]]*$/ { exit }
    p { print }
  ' "$1"
}

# Returns 0 if the launch/wait portion states the bounded recovery.
# Prints FAIL lines to stderr and returns 1 otherwise. Inspects only that
# portion of the given file; does not increment the driver counter.
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
    diag "$file has no Launching a worker section bounded by Model and effort per phase"
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
  if printf '%s\n' "$section" | grep -F 'input_accepted' | grep -Ei 'is proof|means the prompt is' | grep -Eiv 'not[[:space:]]+(proof|submission)' >/dev/null; then
    diag "launch/wait treats input_accepted as submission proof"
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
  if printf '%s\n' "$section" | grep -Ei 'do not read the TUI|without reading the TUI' >/dev/null; then
    diag "launch/wait skips the TUI read"
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

  if ! printf '%s\n' "$section" | grep -Ei 'Enter' >/dev/null; then
    diag "launch/wait does not send Enter"
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

  if ! printf '%s\n' "$section" | grep -Ei 'rendered' >/dev/null; then
    diag "launch/wait does not forbid inferring submission from a rendered prompt"
    tmp=1
  fi
  if printf '%s\n' "$section" | grep -Ei 'rendered' | grep -Ei 'proof|submitted' | grep -Eiv 'not |does not|never|alone' >/dev/null; then
    diag "launch/wait treats a rendered prompt as submission proof"
    tmp=1
  fi

  return $tmp
}

replace_launch_wait() {
  local src=$1
  local dest=$2
  local bodyfile=$3
  awk '
    NR == FNR { body = body $0 ORS; next }
    /^### Launching a worker[[:space:]]*$/ {
      printf "%s", body
      skip = 1
      next
    }
    skip && /^### Model and effort per phase[[:space:]]*$/ { skip = 0 }
    skip { next }
    { print }
  ' "$bodyfile" "$src" >"$dest"
}

expect_check_fail() {
  local file=$1
  local why=$2
  local out=$3
  if check_launch_wait "$file" >"$out" 2>&1; then
    fail "negative fixture passed the launch/wait check: ${why}"
    cat "$out" >&2
    return 1
  fi
  if [ ! -s "$out" ]; then
    fail "negative fixture ${why} was rejected with no FAIL line"
    return 1
  fi
}

if [ ! -f "$skill" ]; then
  fail "skills/delivery/SKILL.md is absent"
else
  shipped_out=$(mktemp "${TMPDIR:-/tmp}/dispatch-submission-shipped.XXXXXX")
  if ! check_launch_wait "$skill" >"$shipped_out" 2>&1; then
    fail "shipped delivery skill failed the launch/wait check"
    cat "$shipped_out" >&2
  fi
  rm -f "$shipped_out"
fi

scratch=$(mktemp -d "${TMPDIR:-/tmp}/dispatch-submission-contract.XXXXXX")
cleanup() { rm -rf "$scratch"; }
trap cleanup EXIT

# Fixture: send Enter immediately after every input_accepted, without a TUI read.
cat >"$scratch/body-immediate.md" <<'EOF'
### Launching a worker

Write the prompt to a file. Never inline it in a shell argument.

If `AGENTS.md` selects a coordinator, load that coordinator's native skill and
use it to launch a real interactive harness TUI for the phase.

Keep waiting blocking. A coordinator-selected worker is observed through that
coordinator until it completes or the timeout fires.

After every `input_accepted` receipt, send Enter immediately. Do not read the TUI.

EOF
replace_launch_wait "$skill" "$scratch/enter-immediately.md" "$scratch/body-immediate.md"
expect_check_fail "$scratch/enter-immediately.md" \
  "Enter immediately after every input_accepted without reading the TUI" \
  "$scratch/out-immediate"

# Fixture: wait 90 seconds, treat a rendered prompt as proof, skip input-box confirm.
cat >"$scratch/body-rendered.md" <<'EOF'
### Launching a worker

Write the prompt to a file. Never inline it in a shell argument.

If `AGENTS.md` selects a coordinator, load that coordinator's native skill and
use it to launch a real interactive harness TUI for the phase.

Keep waiting blocking. A coordinator-selected worker is observed through that
coordinator until it completes or the timeout fires.

After a coordinator-selected dispatch, `input_accepted` is a transport receipt,
not proof that the harness submitted the prompt. Control allows 90 seconds for
a dispatch heartbeat or visible agent progress. If neither appears, treat a
rendered copy of the prompt as proof of submission and send Enter without
confirming it remains in the input box.

EOF
replace_launch_wait "$skill" "$scratch/rendered-prompt.md" "$scratch/body-rendered.md"
expect_check_fail "$scratch/rendered-prompt.md" \
  "90-second wait that treats a rendered prompt as proof without an input-box read" \
  "$scratch/out-rendered"

# Fixture: trust input_accepted as submission and skip recovery.
cat >"$scratch/body-trust.md" <<'EOF'
### Launching a worker

Write the prompt to a file. Never inline it in a shell argument.

If `AGENTS.md` selects a coordinator, load that coordinator's native skill and
use it to launch a real interactive harness TUI for the phase.

Keep waiting blocking. A coordinator-selected worker is observed through that
coordinator until it completes or the timeout fires.

After a coordinator-selected dispatch, `input_accepted` is proof that the
harness submitted the prompt. Keep waiting for the ordinary timeout.

EOF
replace_launch_wait "$skill" "$scratch/trust-input-accepted.md" "$scratch/body-trust.md"
expect_check_fail "$scratch/trust-input-accepted.md" \
  "contract that trusts input_accepted as submission proof" \
  "$scratch/out-trust"

# Fixture: TUI read exists but a second missing signal authorizes another Enter.
cat >"$scratch/body-repeat.md" <<'EOF'
### Launching a worker

Write the prompt to a file. Never inline it in a shell argument.

If `AGENTS.md` selects a coordinator, load that coordinator's native skill and
use it to launch a real interactive harness TUI for the phase.

Keep waiting blocking. A coordinator-selected worker is observed through that
coordinator until it completes or the timeout fires.

After a coordinator-selected dispatch, `input_accepted` is a transport receipt,
not proof that the harness submitted the prompt. Control allows 90 seconds for
a dispatch heartbeat or visible agent progress. If neither appears, Control
reads the worker TUI. When that read shows the task still pending in the
input box, send Enter. If a second missing signal arrives, send Enter again.
Do not infer submission from a rendered copy of the prompt alone.

EOF
replace_launch_wait "$skill" "$scratch/repeated-enter.md" "$scratch/body-repeat.md"
expect_check_fail "$scratch/repeated-enter.md" \
  "contract that permits repeated Enter presses" \
  "$scratch/out-repeat"

if [ "$failures" -ne 0 ]; then
  printf '%s\n' "dispatch-submission-contract: ${failures} failure(s)" >&2
  exit 1
fi
printf '%s\n' "dispatch-submission-contract: ok"
