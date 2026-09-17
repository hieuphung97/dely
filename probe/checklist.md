# Live checklist

This replaces the structural suite that Dely deleted in 0.19.0. A structural
suite told us the files had the shape we last agreed on. It never told us a
worker started, acknowledged, stalled, died, or hit a dialog. Everything that
actually broke in the 0.18.0 series was found by running the real thing, so
that is what is run now.

A separate agent session runs this before a release, against a candidate
installed for real. A human is needed for the first trust of each probe
repository, and otherwise only when a row goes wrong.

Dely itself never answers a harness dialog. `trust.sh` in this directory does,
because a probe has to stand in for the human somewhere, and it is not part of
the shipped skill. No skill references this directory.

## Input

- the candidate SHA;
- Orca running, with orchestration enabled;
- Claude Code, Codex CLI and Cursor Agent CLI installed and signed in;
- `~/dely-probe/` writable. Both scripts here refuse every path outside it.

Record the Orca version. A row that passed on one Orca build is not evidence
about the next one: rows 1, 4 and 5 are rerun after every Orca upgrade,
before the next delivery relies on the new build. Orca upgraded itself from
1.4.203 to 1.4.204 in the middle of the 0.20.0 checklist, which is the
reason.

## Step 1 — install the candidate from a snapshot

Never point a harness at the working tree. Take a snapshot, install from it,
and check what actually landed:

```bash
sha=<candidate SHA>
snap=~/dely-probe/.snap-$sha
rm -rf "$snap" && mkdir -p "$snap"
git -C <checkout> archive "$sha" | tar -x -C "$snap"
```

Install from `$snap` with the commands the README gives, for Claude Code and
Codex CLI. Watch the Codex marketplace: `codex plugin marketplace add` was
observed keeping a stale marketplace of the same name, installing the previous
version, and reporting success. Remove the marketplace and the plugin, then add
and install again.

**There is no snapshot install for Cursor Agent CLI.** `cursor-agent plugin
marketplace add` takes a git URL only — a local path is refused — and installing
what it indexes needs the interactive `/plugin` panel. Cursor reads the Claude
plugin cache, measured during the 2026-09-14 probe rounds, so a Cursor row runs
on the Claude install; confirm that rather than assuming it. It only holds once
every older Cursor copy is gone or already matches the snapshot hash:

```bash
find ~/.cursor/plugins/cache/dely \
     ~/.cursor/plugins/marketplaces/github.com/hieuphung97/dely \
     -name SKILL.md -path '*delivery*' -exec shasum -a 256 {} + 2>/dev/null
```

Anything there with a different hash wins over the Claude cache. Until it is
removed or refreshed, a row with Cursor in any role cannot run, and saying so is
the correct outcome for that row — not running it against whatever Cursor has.
On 2026-09-16 two such copies blocked every Cursor row of the 0.19.0 release.

Then verify by hash, at every location that can serve the skill:

```bash
shasum -a 256 "$snap/skills/delivery/SKILL.md"
find ~/.claude/plugins ~/.claude/skills ~/.agents/skills ~/.codex ~/.cursor \
  -name SKILL.md -path '*delivery*' -exec shasum -a 256 {} +
```

`dely` with no arguments now prints the version, SHA and sha256 of
`SKILL.md`, so a candidate can identify itself from inside whichever copy
actually ran — a stronger check than hashing paths from outside.

Include the marketplace source directory, not only the plugin cache. A Claude
Control was observed running `scripts/dely` straight out of the marketplace
path it was added from, so a cache that matches proves nothing on its own.

Every hash must match the snapshot. A copy with a different hash — including a
symlink left behind by an older install — wins over the plugin and silently
runs a different protocol. Stop and report rather than deleting someone's
install: report the path and the hash and ask.

**A harness reporting a successful install is not evidence.** Cursor once ran
an old branch for ten merges while reporting success every time.

## Step 2 — build the probe repositories

```bash
probe/mkrepo.sh r1 "Claude Code" claude-opus-5 medium "Codex CLI" <slug> <effort>
probe/mkrepo.sh r2 "Codex CLI" <slug> <effort> "Cursor Agent CLI" <slug> default
probe/mkrepo.sh r3 "Cursor Agent CLI" <slug> default "Claude Code" claude-opus-5 medium
```

The paths are fixed at `~/dely-probe/r1`, `r2` and `r3` so that a harness trust
entry, which is keyed on the path, survives a rebuild. The first run needs a
human to trust each harness at each path once; later runs need none. Take the
model slugs from the harness's own discovery command, not from this file.

## Step 3 — rows 1 to 3, the rotated deliveries

For each repository, launch a Control and give it the delivery:

```bash
orca terminal create --worktree path:~/dely-probe/rN \
  --command "<binary> <permission default>"
```

Wait for the harness to be idle, then send the Control prompt: use
`dely:delivery` for the change described in `REQUEST.md`; the design contract
is pre-approved as Bounded within `REQUEST.md`; stop only where the skill
requires a human.

Follow it with `orca orchestration run-list` filtered by `coordinator_handle`,
`orca orchestration worker-list`, and `orca terminal read --screen`, until the
Control screen stops changing and no worker is `dispatched`.

Use `--screen`. Without it a read returns accumulated output, which comes back
as stacked fragments for any TUI and as an empty tail once a previous read has
consumed the cursor. `worker-list` may also report an empty `taskTitle`, so
identify a dispatch by its id and the order it appeared, not by its title.

Collect: the SHA on the remote, the disposition in the handoff, how many times
a human had to act and why, wall time, and per-phase time. Also record, as
tracking data and not as a pass condition, the Control harness and model; how
many model requests Control made during each worker wait and when they fell
relative to the dispatch — from `token_usage_record` lines in a Codex rollout
under `~/.codex/sessions`, from assistant messages with `usage` in a Claude
session under `~/.claude/projects`, and by counting assistant records in a
Cursor agent transcript (Cursor stores no token counts locally); and whether
Control read `scripts/dely.js`.

**Pass:** the branch is on the remote, the review disposition is `ACCEPT`, and
no human acted. For the row whose Control wakes by `waker`, every `wait_bg`
event in that Run's log is followed by a `settled`, `attention` or `stalled`
event before its `notify`, and the Run's log has no `error` event. A
`wait_bg` event with `which: ALREADY_WAITING` starts no waiter and has no
`notify` of its own, so it is not paired. A retried `FAILED` dispatch writes
an `error` event, so a Run that needed that recovery does not pass row 3
and is reported as such rather than as a waker failure. Presence
of `wait_bg` and `notify` is not enough: on `e874990` a Codex Control launched
`dely wait-bg` inside a new Orca terminal, the waiter watched the wrong
terminal and failed after 1 s with "no longer bound", and the log still
carried `wait_bg` and `notify`, so the old wording passed it. Without the
events at all the row passed without exercising the path it exists to test:
on `82aa354` a Codex Control reached `ACCEPT` with a blocking `dely wait`,
and branch, disposition and human count could not tell.

All three rows run for a release. Rows 2 and 3 rotate which harness is Control,
implementer and reviewer, and a rotation is the only thing that exercises a
harness in a role it does not hold in row 1. The release floor is all seven
rows, not row 1: a release that ran fewer says so in its decision record and
names which rows it skipped. The 0.19.0 release did exactly that — it ran rows
1, 4, 5 and 7 only — and recorded the exception rather than moving the floor.

## Step 4 — row 4, a worker that dies after it acknowledges

Inside one of the rows above, after the implement worker has acknowledged
**and** Control's own wait for that Run is running
(`pgrep -f "dely.js wait --run <run>"` for a background Control, the
`wait-bg` waiter for a waker one), kill the worker's agent process from outside
Orca. The kill trigger polls every 1 s and fires when that wait is running
**and** the implementer process is still alive **and** no `settled` event
exists yet. If the implementer settles first, record the row as not run for
that attempt rather than killing anything: a Sonnet 5 implementer settled
about 30 s after dispatch, and slower triggers missed it twice. An
acknowledgement is logged a few seconds after launch, but Control may
not start waiting for another 20 s while it finishes its turn; a kill in that
window measures Control's turn, not the helper. On `90fc7a9` a kill 4 s after
the `dispatch` event read 34 s to `ATTENTION`, of which 18 s passed before any
wait existed.

**Pass:** Control reports `ATTENTION` within 30 s and dispatches the same task
again exactly once. Expect about one `POLL_S` (15 s) plus a round-trip from the
start of the wait: `wait` blocks in `check --wait` before it reads
`worker-list`. Measured 16 s from wait start on Orca 1.4.203 and 1.4.204, and
8 s from a kill 8 s into the wait.

This is the row that catches a helper which prints `DISPATCHED` without ever
waiting for the acknowledgement: such a helper passes row 1 whenever the worker
happens to start, and fails here.

The signal is Orca's, not Dely's. `dely wait` reports `ATTENTION` when
`dispatchStatus` is `dispatched` and either `nextAction.kind` is not `none`
or `projection.attention.requiresAction` is true. An absent `nextAction` is
absent rather than `none`, and is not `ATTENTION`.

This row exercises the second of the skill's two `ATTENTION` routes: the
killed worker has `nextAction: none`, so there is no argv to run. Control
checks it with `worker-read` and `worker-show`, and with the process gone
runs `worker-stop`, then `worker-abandon` when the stop reports
`stop_unknown`, then `worker-release`, then one fresh `dely dispatch` with
the same prompt file. That is the "again exactly once" in the pass
condition. That projection has already changed shape between Orca releases,
so record the Orca version next to the result, and when this row fails,
check the projection directly before blaming the helper.

Measured on Orca 1.4.203 during this delivery's design:

| Worker state | `dispatchStatus` | `liveness.verdict` | `nextAction.kind` | `attention.requiresAction` |
| --- | --- | --- | --- | --- |
| Healthy, working (45 samples over 92 s) | `dispatched` | `live` | `none` | `false` |
| Killed after acknowledgement (from ≤1 s, held ≥132 s) | `dispatched` | `unverifiable` / `missing_status` | `none` | `true` |
| Settled, awaiting release | `completed` | `live` | `release` | `false` |
| Starting, ~1–2 s transient | `pending` | `unverifiable` | `none` | `true` |

`worker-show`'s `observation.status` and the terminal's `connected` flag
were both measured against the killed worker and neither moves, so
neither is a substitute.

## Step 5 — row 5, a pin that has not answered its dialog

Use a path that no harness has trusted — a new directory each time, never
`r1` to `r3` — with a Claude Code pin, and run `dely preflight` inside a Run.

**Pass:** `PREFLIGHT … FAIL` in under 60 s, the printed `last output` contains
at least one line of the dialog, and `orca terminal list` shows nothing left
behind. One line is enough, and on Claude Code it is often only the tail: Orca's
prompt delivery presses Enter into the dialog, where `No, exit` is preselected,
so Claude has exited to a shell before the helper reads the last 400
characters. On `90fc7a9` the quote held `Security guide`, a line of that
dialog and one `probe/trust.sh` matches on; `harnesses.json` records the
mechanism.

The quote is the point, not the verdict. A failure that arrives on time with an
empty quote tells the human nothing, and that is exactly how this failed before
the launch-gate fix: 150 s and no cause.

## Step 6 — row 6, a worker that goes quiet

Dispatch a Claude Code worker whose spec is to acknowledge and then stay silent
for ten minutes.

**Pass:** `STALLED` at the configured threshold, with the idle minutes and the
last output. Orca's own liveness reads `live` throughout; that is the condition
this row exists for.

Terminal workers are out of scope here: a redrawing TUI keeps the stream
advancing, so their stall surfaces at `DEADLINE` instead.

## Step 7 — row 7, the trust intervention loop

This row checks the whole loop, not just the refusal: a delivery stops on an
untrusted pin, a human trusts it, and the same Run continues to `ACCEPT`.

Setup:

- a path no harness has trusted, `~/dely-probe/t-<sha>`;
- Control is Codex CLI or Cursor Agent CLI, **never Claude Code**, because
  Claude's own startup dialog is the trust step: answering it would pre-trust
  the path and the row would test nothing;
- the `implement` pin is Claude Code.

Steps and their pass conditions:

1. Control starts the delivery and dispatches the implementer, which cannot
   acknowledge behind Claude's dialog. From 0.20.0 a delivery does not
   preflight first, so the sequence is `NO_ACK` after `ACK_S` (60 s), then one
   `dely preflight` that fails the Claude pin. The clock starts at the Run's
   `no_ack` event: a dispatch that never acknowledges writes `no_ack`, not
   `dispatch`. **Pass:** within 150 s of the `no_ack` event, the log for the
   Run shows a `preflight` failing the Claude pin and Control has stopped on a
   message naming the harness, the path, and what the human must do; there is
   exactly one `no_ack` before that `preflight` and **no `dispatch` after
   it**; `orca orchestration worker-list` shows every dispatch released;
   `orca terminal list` has no leftover terminal. Measured on `b8094bf`: 63 s
   from the dispatch to `no_ack`, 79 s more to the failing `preflight` — a
   Control turn and a 56 s preflight — and 25 s more to the stop, 104 s from
   `no_ack`. The 150 s leaves room for a slower Control turn. On `90fc7a9`,
   whose skill had lost the `PREFLIGHT … FAIL` route, Control dispatched a
   second time into the same dialog and stopped about 4 min after the first
   dispatch.
2. Act as the human: `probe/trust.sh ~/dely-probe/t-<sha>`. It opens Claude in
   an Orca terminal, answers the dialog, verifies
   `projects[<path>].hasTrustDialogAccepted` in `~/.claude.json`, and closes
   the terminal. **Pass:** it prints `TRUSTED`. On `NOT_TRUSTED`, stop and
   call the human — do not loop.
3. Send Control one line: `Đã trust Claude Code trong repo này. Chạy lại
   preflight và tiếp tục.` followed by Enter. If Orca answers
   `agent_prompt_blocked`, Control is holding a menu: send `\r` first, then the
   text.
4. **Pass:** the same Run gets a second preflight, it passes both pins, the
   delivery reaches `ACCEPT`, the SHA is on the remote, and nothing else was
   sent to Control.

Ways of failing that this row separates from passing: failing at 150 s with an
empty quote; telling the human to answer in a terminal that has already been
released; opening a new Run or dispatching without preflighting again; and
hanging because a batch was never acknowledged.

**Leaves behind:** a trust entry for `t-<sha>` in `~/.claude.json` and a
repository registered in Orca. Remove both by hand; Orca has no command for the
second.

## Step 8 — clean up

- uninstall the candidate from all three harnesses;
- delete the snapshot;
- keep `r1` to `r3` so their trust entries survive;
- remove the row 5 and row 7 paths, and their trust entries.

## What this cannot see

The deferred harnesses. Windows. A race between an acknowledgement and a
replayed batch. A quota exhausted mid-run. A Control that skips a gate because
the model was having a bad day. A shape change between two Orca releases, until
the rows are run again.

## Results

Put the table in the pull request body: one line per row, with the verdict, the
number, and what was left behind.
