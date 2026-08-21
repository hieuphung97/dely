#!/usr/bin/env bash
# SessionStart: resolve repository identifiers and inject them as context.
#
# Why this exists: every identifier a session states about the repository —
# HEAD, branch, baseline, whether the tree is clean — has at some point been
# retyped from memory and been wrong. This hook makes those values arrive
# already resolved, so the session cites rather than recalls.
#
# Contract: stdout is either valid JSON beginning with "{", or nothing.
# Any failure is silent. A session must never fail because of this hook.
#
# A hook that injects a WRONG value is worse than no hook, because the text it
# injects tells the session to cite it and not re-derive it. Two such defects
# were found on the first real run and are recorded in docs/findings.md:
#   1. `grep -c .` exits 1 on zero matches, so `|| printf 0` appended a second
#      zero, the integer test then failed, and a clean tree was reported dirty.
#      Fixed by counting with `wc -l`, which exits 0, and by validating the
#      count with `case` instead of `[ -eq ]`.
#   2. `origin/main` came from the local remote-tracking ref, which had not been
#      fetched since a merge, so a stale baseline was presented as current.
#      Fixed by labelling it and reporting when it was last fetched. This hook
#      deliberately does no network I/O.

# No `set -e`: a broken hook must not become a broken session.
set -u

emit_nothing() { exit 0; }

command -v jq >/dev/null 2>&1 || emit_nothing

# The session's own id, so a session can cite its own journal instead of guessing
# which file is its own. A review found a handoff citing the wrong journal
# session, which is the identifier failure class this hook exists to remove,
# applied to the evidence layer rather than to git.
#
# Read from the hook payload on stdin. `-t 0` guards the case where this script
# is run by hand — delivery-doctor parses it — so it cannot block on a terminal.
session_id=''
if [ ! -t 0 ]; then
  payload=$(cat 2>/dev/null || printf '')
  [ -n "$payload" ] && session_id=$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null)
fi

journal_dir="${DELIVERY_JOURNAL_DIR:-$HOME/.delivery-journal}"
if [ -n "$session_id" ]; then
  journal_line="- This session's evidence journal: ${journal_dir}/${session_id}.raw.jsonl"
else
  journal_line="- This session's evidence journal: unresolved — quote gate output verbatim instead of citing a file"
fi

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$project_dir" 2>/dev/null || emit_nothing

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || emit_nothing

head_sha=$(git rev-parse HEAD 2>/dev/null) || emit_nothing
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'DETACHED')

# `wc -l` exits 0 on empty input; `grep -c` does not. That difference produced
# the clean-reported-as-dirty defect.
dirty_count=$(git status --porcelain 2>/dev/null | wc -l 2>/dev/null | tr -d '[:space:]')
case "$dirty_count" in
  0)          tree_state='clean' ;;
  ''|*[!0-9]*) tree_state='could not be determined' ;;
  1)          tree_state='dirty, 1 path' ;;
  *)          tree_state="dirty, ${dirty_count} paths" ;;
esac

# Default integration branch, resolved rather than assumed.
default_ref=''
for candidate in origin/main origin/master; do
  if git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
    default_ref="$candidate"
    break
  fi
done

default_sha='unresolved'
merge_base='unresolved'
position='unresolved'
if [ -n "$default_ref" ]; then
  default_sha=$(git rev-parse "$default_ref" 2>/dev/null || printf 'unresolved')
  merge_base=$(git merge-base HEAD "$default_ref" 2>/dev/null || printf 'unresolved')
  counts=$(git rev-list --left-right --count "${default_ref}...HEAD" 2>/dev/null)
  if [ -n "$counts" ]; then
    behind=$(printf '%s' "$counts" | awk '{print $1}')
    ahead=$(printf '%s' "$counts" | awk '{print $2}')
    position="${ahead} ahead, ${behind} behind"
  fi
fi

# How stale the remote-tracking ref may be. Local check only, no fetch.
#
# The marker is repeated inline on every affected line rather than stated once
# in a paragraph above them. A caveat above three values is the structure that
# gets skimmed past, and this workflow has a recorded instance of exactly that:
# a transition card pinned a pre-fix fingerprint as the post-fix target.
git_dir=$(git rev-parse --git-dir 2>/dev/null)
fetch_note='never fetched in this clone'
stale_mark='  [STALE: never fetched]'
if [ -n "$git_dir" ] && [ -f "${git_dir}/FETCH_HEAD" ]; then
  fetched_at=$(date -u -r "${git_dir}/FETCH_HEAD" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || printf '')
  fetched_epoch=$(date -r "${git_dir}/FETCH_HEAD" '+%s' 2>/dev/null || printf '')
  now_epoch=$(date '+%s' 2>/dev/null || printf '')
  if [ -n "$fetched_at" ]; then
    fetch_note="last fetch ${fetched_at}"
    stale_mark=''
    if [ -n "$fetched_epoch" ] && [ -n "$now_epoch" ]; then
      age=$(( now_epoch - fetched_epoch ))
      if [ "$age" -gt 3600 ]; then
        hours=$(( age / 3600 ))
        fetch_note="${fetch_note} — ${hours}h ago"
        stale_mark="  [STALE: ${hours}h since fetch]"
      fi
    fi
  fi
fi

upstream=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || printf 'none')
upstream_sha='n/a'
if [ "$upstream" != 'none' ]; then
  upstream_sha=$(git rev-parse "$upstream" 2>/dev/null || printf 'unresolved')
fi

context=$(cat <<EOF
Repository identifiers, resolved by \`git\` at session start. Cite these rather
than restating them from memory. Re-resolve before any claim if the tree may
have moved since.

- Working directory: ${project_dir}
- Branch: ${branch}
- HEAD: ${head_sha}
- Tree: ${tree_state}
- Upstream: ${upstream} (${upstream_sha})
- Session: ${session_id:-unresolved}
${journal_line}

The journal records each command and its output verbatim, and whether the call
succeeded. A passing command's exit code is implied by that rather than stored in
a field, so cite the journal for output and the command's own echoed status for
an exit code. Do not claim a tool-captured exit code for a command that passed.

The three values below come from the local remote-tracking ref, not from the
remote (${fetch_note}). A \`[STALE]\` marker means the ref has not been fetched
recently and the value may be wrong even though it is internally consistent. Run
\`git fetch origin\` before using any marked value as a baseline.

- Default ref: ${default_ref:-none} (${default_sha})${stale_mark}
- Merge base with default ref: ${merge_base}${stale_mark}
- Position relative to ${default_ref:-default ref}: ${position}${stale_mark}
EOF
)

jq -n --arg ctx "$context" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}' \
  2>/dev/null || emit_nothing
