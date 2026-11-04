#!/bin/bash
# Pre-trust Claude Code at a probe path for the parameterized rows of
# probe/checklist.md: open the harness in an Orca terminal, answer its own trust
# dialog, and verify the answer in the harness's store. An Orca terminal opened
# this way is not an agent start, so the dialog still appears; on Orca 1.4.220
# and later a Claude Code worker started by Orca never shows it.
#
# Usage: probe/trust.sh <repo path under ~/dely-probe> [harness]
#
# Only `claude` is supported, because its store key is the one that has been
# measured. For any other harness, answer the dialog by hand: a script that
# reports success from the screen is worse than no script. The earlier probe
# script did exactly that, twice, while `hasTrustDialogAccepted` stayed false,
# and the delivery then failed its second preflight for the first reason.
#
# Dely itself never answers a dialog. This is probe tooling, it is not shipped
# in the skill, and no skill references it.
set -eu

ROOT="$HOME/dely-probe"
target=${1-}
harness=${2-claude}

if [ -z "$target" ]; then
  echo "usage: probe/trust.sh <repo path under ~/dely-probe> [harness]" >&2
  exit 2
fi

if [ ! -d "$target" ]; then
  echo "REFUSED $target is not a directory" >&2
  exit 2
fi
repo=$(cd "$target" && pwd -P)

# Hard limit: this script only ever opens a harness on a path under
# ~/dely-probe/. It is checked after resolving symlinks and `..`, and before
# anything is created.
case "$repo/" in
  "$ROOT"/*) ;;
  *) echo "REFUSED $repo is not under $ROOT/" >&2; exit 2 ;;
esac

if [ "$harness" != claude ]; then
  echo "REFUSED harness '$harness' has no measured store key; answer its dialog by hand" >&2
  exit 2
fi

store="$HOME/.claude.json"
trusted() {
  node -e '
    const fs = require("fs");
    try {
      const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const p = (j.projects || {})[process.argv[2]] || {};
      process.exit(p.hasTrustDialogAccepted === true ? 0 : 1);
    } catch (e) {
      process.exit(1);
    }
  ' "$store" "$repo"
}

if trusted; then
  echo "TRUSTED $repo already; no terminal opened"
  exit 0
fi

handle=$(orca terminal create --worktree "path:$repo" --title "probe-trust" \
  --command "claude --dangerously-skip-permissions" --json |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(((JSON.parse(s).result||{}).terminal||{}).handle||"")}catch(e){}})')

if [ -z "$handle" ]; then
  echo "NOT_TRUSTED $repo terminal create returned no handle" >&2
  exit 1
fi
cleanup() { orca terminal close --terminal "$handle" --json >/dev/null 2>&1 || true; }
trap cleanup EXIT

# --screen renders the frame. Without it a read returns accumulated output,
# which a TUI leaves as stacked fragments, and an empty tail once a previous
# read has consumed the cursor.
screen() {
  orca terminal read --terminal "$handle" --screen --json |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write((((JSON.parse(s).result||{}).terminal||{}).tail||[]).join("\n"))}catch(e){}})'
}

# Claude has reworded this dialog at least once, so match several of its parts
# rather than one sentence. This only decides when to answer; whether the answer
# took is decided by the store, below.
dialog='do you trust|trust the files|quick safety check|security guide|no, exit'
seen=
for _ in $(seq 1 30); do
  if screen | grep -qiE "$dialog"; then seen=1; break; fi
  sleep 2
done
if [ -z "$seen" ]; then
  echo "NOT_TRUSTED $repo no trust dialog appeared in 60 s; last screen: $(screen | tail -5 | tr '\n' ' ')" >&2
  exit 1
fi

# The cursor can sit on the refusing choice, so move up before confirming.
answer() {
  orca terminal send --terminal "$handle" --text $'\x1b[A' --json >/dev/null
  sleep 1
  orca terminal send --terminal "$handle" --text $'\r' --json >/dev/null
  sleep 6
}

answer
if ! trusted; then
  answer
fi

if trusted; then
  echo "TRUSTED $repo verified in $store"
  exit 0
fi

echo "NOT_TRUSTED $repo dialog was answered but $store still reports hasTrustDialogAccepted false; last screen: $(screen | tail -5 | tr '\n' ' ')" >&2
exit 1
