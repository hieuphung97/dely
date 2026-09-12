# Plan — workers acknowledge, Control sleeps until an event, and `dely:verify` proves the path first

Decision record: `docs/decisions.md#2026-09-11--workers-acknowledge-control-sleeps-until-an-event-and-delyverify-proves-the-path-before-the-first-dispatch`

**Baseline:** `22bb184`

## Goal

Every dispatch goes through one packaged runtime, `skills/delivery/scripts/dely.js`.
The runtime refuses to dispatch until `dely:verify` has recorded a PASS in Orca for
this repository, these pins and this Control harness. It starts each worker on the
launch path its harness needs, and requires the worker to acknowledge first. It lets
Control sleep with zero model turns until the worker settles, goes silent, or passes
its deadline. `dely:setup` gains a human-answered trust step and ends by running
verify.

The first supported set is Claude Code, Codex CLI, Cursor Agent CLI, GitHub Copilot
CLI and Antigravity CLI. Grok Build and Kiro CLI go through the generic path and may
fail verify until they are optimized.

Out of reach:

- Live behaviour on Linux and Windows. Only macOS was measured.
- Orca defects. This plan works around them; it does not fix them.
- Orca structured worker mode.
- The rework rate of reviews.

## Allowed scope

```
skills/delivery/SKILL.md
skills/delivery/references/harnesses.md
skills/delivery/scripts/dely.js
skills/delivery/scripts/dely
skills/delivery/scripts/dely.cmd
skills/verify/SKILL.md
skills/setup/SKILL.md
tests/scripts.test.js
tests/fixtures/fake-orca.js
tests/contracts.sh
AGENTS.md
.github/workflows/contracts.yml
README.md
CONTRIBUTING.md
docs/decisions.md
.claude-plugin/plugin.json
.codex-plugin/plugin.json
docs/_plans/2026-09-11-verify-and-event-driven-dispatch.md
```

The existing entries were listed with `git ls-files -- skills/delivery/SKILL.md
skills/delivery/references/harnesses.md skills/setup/SKILL.md tests/contracts.sh
AGENTS.md .github/workflows/contracts.yml README.md docs/decisions.md
.claude-plugin/plugin.json .codex-plugin/plugin.json CONTRIBUTING.md`. That command
printed 11 paths. `test -e` reported `skills/delivery/scripts`, `skills/verify`,
`tests/scripts.test.js` and `tests/fixtures` absent at planning time.

Carried documents:

- `CONTRIBUTING.md` names the local structural check command, so a new closure gate
  obliges it.
- `README.md` owns the skill list, the Kiro `npx skills` install command, and the
  palette text naming `/delivery` and `/setup`.
- `.github/workflows/contracts.yml` must carry every `AGENTS.md` closure command,
  because `tests/contracts.sh` asserts that.
- No colocated tests exist for the new scripts. `tests/scripts.test.js` is the
  registry test for this plan.

## Forbidden scope

- `plugin.json` (root) and `.cursor-plugin/plugin.json`: they carry no version and
  point at `./skills/`, so the new skill directory ships without an edit.
- `.claude-plugin/marketplace.json`: it names the plugin, not its skills.
- `skills/delivery/templates/`: the templates are unchanged.
- `.github/ISSUE_TEMPLATE/`: the harness dropdown already lists all seven harnesses.
- The `implement` pin in `AGENTS.md`: this is a protocol change, not a deployment
  change. The `review` pin changed once, by human decision on 2026-09-11 — see the
  execution envelope.
- Any file under `bin/` or `hooks/`. Their absence is a closure gate, and `verify` is
  not a restoration of `bin/delivery-doctor`.

## Execution envelope

Protected dirty paths: none. `git status --porcelain` printed nothing at baseline.

Branch, base, remote and pull request:

- Branch `feat/verify-event-driven-dispatch`, created from `origin/main` at `acf9f54`.
- Push to `origin`.
- Pull request against `main`.

Resolved phase pins, from `AGENTS.md`:

- `implement`: Cursor Agent CLI, `cursor-grok-4.6-high`, effort `default` (flag omitted).
- `review`: Claude Code, `claude-opus-5`, effort `medium`. It was Codex CLI
  `gpt-5.6-sol` high through the review of task 1b.

Codex reported `weekly 13% left` on 2026-09-11. After the task 1b review its weekly
limit was 97% used, resetting 2026-09-15, with about five reviews still ahead. On
escalation the human changed the `review` pin to Claude Code `claude-opus-5` medium
for the rest of this delivery, in its own commit.

Frozen runtime: this delivery runs under the installed Dely `0.17.8`, per the
self-update rule in `AGENTS.md`. The new runtime takes effect for the next delivery.

Authority: this plan may branch, commit only its owned paths, run gates, push
`feat/verify-event-driven-dispatch`, and open or update its pull request. It may not
merge, force-push, stash, reset, clean, or edit anything outside owned scope. Live
runs of `dely verify` may start Orca Runs and short worker sessions in this
repository. They may not commit, and must leave `git status` unchanged.

## Tasks

### 1. One runtime dispatches, acknowledges, waits and wakes without polling

**Behaviour.** `dely dispatch` refuses when no Orca verdict matches the key. The key
is the repository, both pins, the Control harness and its wake mode. Otherwise it:

- starts the worker on its harness's launch path — `worker-start`, or adopt: launch
  the terminal, wait for output quiescence, then `worker-start --terminal`;
- adds the acknowledgement instruction to the spec;
- waits for the ACK;
- on no ACK, stops the dispatch and prints the diagnosed cause.

`dely wait` holds a waiter for heartbeat and settling types. It acknowledges
heartbeats without exiting, and exits `SETTLED`, `SILENT` or `DEADLINE`.

`dely sidecar` (superseded by task 1b) swallows only heartbeats on the Control's handle, and wakes Control
with a `status` message on silence or deadline.

`dely collect` drains and acknowledges the Run's deliveries and prints what settled.

The launchers `dely` and `dely.cmd` run `dely.js` on `node` 18 or newer from PATH,
and otherwise on Orca's bundled runtime.

**Direction.**

- CommonJS, no npm dependencies. Only `child_process`, `fs`, `os`, `path` and
  `crypto`.
- Read the harness properties from `references/harnesses.md`; do not duplicate them
  in code.
- Every Orca call goes through one function, so the fake Orca can record arguments.
- Exit codes and single-line outputs are the contract that Control and the tests read.

**Files.** `skills/delivery/scripts/dely.js`, `skills/delivery/scripts/dely`,
`skills/delivery/scripts/dely.cmd`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`, `skills/delivery/references/harnesses.md` (new
columns only), `tests/contracts.sh` (the `expected_harness_table` pin only).
`tests/contracts.sh` pins the harness table verbatim, so the column change and its
pin land in the same commit, or this task cannot pass its own closure gates.

The new columns and their values, taken from the decision record:

| Harness | Launch | Model pin | Control wake | Setup |
| --- | --- | --- | --- | --- |
| Claude Code | `worker-start` | Orca `--model`/`--effort` | background | trust dialog |
| Codex CLI | `worker-start` | Orca `--model`/`--effort` | nudge | Orca preflight |
| Grok Build | `worker-start` | argv (adopt) | nudge | none |
| Antigravity CLI | adopt | argv (adopt) | nudge | trust dialog |
| Kiro CLI | `worker-start` | argv (adopt) | unsupported | trust-all confirmation |
| Cursor Agent CLI | `worker-start` | Orca `--model` | background | trust dialog |
| GitHub Copilot CLI | `worker-start` | argv (adopt) | nudge | trust dialog |

**Focused verification.** `node --test tests/scripts.test.js`. It fails when any of
the acceptance counterexamples below is the implementation.

**Document impact.** `references/harnesses.md` owns the per-harness properties the
runtime reads.

### 1b. Consumption follows Orca's delivery semantics

Added at replan, 2026-09-11. Task 1 (`718bc27`, remediated in `088e8ce`) was scoped
re-reviewed `CHANGES_REQUESTED`. Six findings were fixed. The ACK/settlement finding
was not, because a Delivery carries its whole FIFO batch whatever `--types` says;
the decision record's delivery-semantics context measures it. Where task 1's
behaviour text and interface conflict with this task, this task supersedes it.

**Behaviour.**

- **`dely dispatch`** observes its ACK only through `check --peek`, as a heartbeat
  whose `from_handle` is the dispatch terminal. It never consumes or acknowledges a
  Delivery.
- **`dely wait`** consumes whole Deliveries. A heartbeats-only batch is acknowledged
  and it keeps waiting. A batch with any `worker_done`, `escalation` or `question` is
  acknowledged, printed whole as `SETTLED <types> <json>`, and exits 0. `SILENT` and
  `DEADLINE` are unchanged.
- **`dely sidecar --run <runId> --control-handle <handle>`** (removed by task 3c)
  consumes whole
  Deliveries with `--terminal <handle>`, waiting on all four types. A heartbeats-only
  batch is acknowledged. For a batch with any settling message, or on silence or
  deadline: acknowledge it, send one
  `orchestration send --to run:<runId> --run <runId> --type status --priority high --subject "dely wake: <reason>"`,
  and exit 0. It never keeps consuming after sending that message.
- **`dely collect --run <runId>`** prints one
  `SETTLED <dispatchId> <type> <body>` line per settling message. It finds them in
  `check --all` history, matching `from_handle` to each Run dispatch's terminal.
  Then it drains and acknowledges every remaining Delivery. Exit codes are
  unchanged: 0 when no Run dispatch is still `dispatched`, `WAITING` and 2
  otherwise, `ERROR` and 9 on Orca failure.
- **`tests/fixtures/fake-orca.js`** models the measured rules:
  - a consuming `check` forms its Delivery at consume time from every unread
    message, up to 50;
  - it replays that exact batch until acknowledged, even after newer messages
    arrive;
  - `--types` only decides whether a `--wait` returns before its timeout;
  - `--peek` returns unread messages without consuming;
  - `--all` returns history, including acknowledged messages.

**Direction.** Keep every other part of the task 1 interface and all 17 existing
cases. Existing cases that relied on the fake filtering Delivery contents are
corrected to the measured model; each such change must still fail against its
counterexample.

**Files.** `skills/delivery/scripts/dely.js`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`.

**Focused verification.** `node --test tests/scripts.test.js`. It fails against
`088e8ce` on the mixed-batch cases below.

**Document impact.** None beyond the decision record, which Control amended.

### 2. `dely:verify` proves the path, and setup hands trust to the human

**Behaviour.** `dely verify run` and `dely verify start` / `collect` run:

- the read-only preflight (trust state, a pending Codex update, a readable runtime);
- one dispatch per distinct pin;
- a task that writes and deletes a scratch file and prints `git rev-parse`.

They then record a `dely-verify-verdict` task whose result carries PASS or FAIL and
the full key. `dely verify status` answers from Orca with no model call.

`skills/verify/SKILL.md` tells Control:

- which mode its harness uses;
- to end its turn in nudge mode and run only `collect` when woken;
- never to run the command quoted in the nudge text.

`skills/setup/SKILL.md` gains a trust step. Setup opens each pinned harness in an
Orca terminal for the human to answer and never answers or writes a harness store.
Setup then runs verify.

**Direction.** Reuse task 1's dispatch, wait, sidecar and collect code paths. The
verdict is written only after every dispatch settled and the report was produced.

`orchestration run-create` rebinds the calling Control terminal to the new Run, and a
later `worker-start --run <delivery run>` then fails with "worker-start requires the
coordinator terminal currently bound to the Task Run" (observed 2026-09-11). Verify
records the bound Run from `orchestration run-current` before creating its own, and
restores it with `orchestration run-use --id <that run>` on every exit path.

**Files.** `skills/verify/SKILL.md`, `skills/setup/SKILL.md`,
`skills/delivery/scripts/dely.js`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`.

**Focused verification.** `node --test tests/scripts.test.js` (verify cases). Control,
not the implementer, then runs one live `dely verify run` on this repository after the
task commit and quotes its report for review. A dispatched worker that creates Runs
and dispatches workers is nested orchestration, and creating a Run rebinds the
calling terminal.

Also carried into this task: the task 1b re-review's Minor finding. `collect`
deduplicates by message `id`, and the fake assigns none. The fake assigns ids the
way Orca does, and `collect` must not merge distinct messages that lack an id.

**Document impact.** The setup skill owns its own "what setup will not do" list,
which changes.

### 3. The delivery contract routes every dispatch through the runtime

**Behaviour.** `skills/delivery/SKILL.md` requires:

- every dispatch through `dely dispatch`;
- an automatic `dely verify` when dispatch refuses;
- a stop with the reported fix on FAIL or BLOCKED;
- after ACK, Control sleeps by its harness's wake mode — `dely wait` in the
  background, or ending the turn — and on a nudge runs only `dely collect`;
- recovery from NO_ACK or SILENT is one fresh start, never a retry into the same
  terminal; a second failure on the same input goes to the human.

These sentences are removed:

- the one claiming `agent_prompt_blocked` and `agent_prompt_stalled` do not
  distinguish recoveries;
- the retry-into-the-same-terminal route.

**Direction.** Shorten `### Launching a worker` where the runtime now owns
mechanics. Keep the prompt-file rule, the disposition rule and the acceptance-row
carriage rule verbatim, because `tests/contracts.sh` pins them.

**Files.** `skills/delivery/SKILL.md`, `skills/delivery/references/harnesses.md`
(prose above the table), `tests/contracts.sh` (pins other than the harness table,
which task 1 owns).

**Focused verification.** `bash tests/contracts.sh` with new structural pins:

- the refusal rule inside `### Launching a worker`;
- the nudge-command prohibition;
- the absence of the retry-into-same-terminal sentence;
- the harness table verbatim.

It fails when a pin's sentence is weakened or relocated.

**Document impact.** The delivery skill owns the dispatch contract; the harness
reference owns the table.

**Remediation, by Control amendment after task 3's review.** The review found two
Important defects:

- the new pins pass when their sentences are inverted;
- in nudge mode `SILENT` and `DEADLINE` never reach the recovery route, and nothing
  stops a silent dispatch.

The second is a runtime defect from tasks 1 and 1b, and task 3's remediation owns it:

- `dely wait` and `dely collect` stop a silent dispatch with `worker-stop` before
  they report `SILENT <id> <s>` (exit 6). A fresh dispatch then never inherits the
  old one's silence.
- `dely collect --run <run> --repo <path>`:
  - reports a silent dispatch by its own silence check, and `DEADLINE` (exit 7)
    when a dispatch has run longer than the deadline;
- The deadline is measured from the dispatch's Orca `dispatchedAt`, not from the
  start of a wait or sidecar process.
- The skill's nudge mode runs only `dely collect`. The skill also:
  - states each command's usage;
  - routes `ERROR`, and a `SETTLED` batch that holds only `question` or `escalation`;
  - matches `SETTLED` lines to the dispatch id that `DISPATCHED` printed;
  - sends a second `REFUSED` right after a verify PASS to the human.
- The pins in `tests/contracts.sh` match the operative phrases on the flattened
  section.

Remediation files: `skills/delivery/SKILL.md`, `tests/contracts.sh`,
`skills/delivery/scripts/dely.js`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`.

The remediation shipped as `44ffe96`. Its scoped re-review accepted both Important
fixes but rejected the single-sidecar part: the lookup finds the sidecar by a title
the shell rewrites, and judges liveness by `terminal show` fields real Orca does not
send. That routed to `REPLAN_OR_SPLIT`, and task 3c is the human's replan.

### 3c. The sidecar is removed

**Behaviour.** Nudge-mode Control dispatches and ends its turn. Every nudge runs only
`dely collect --run <run>`, which reports what settled, asks Orca for each open
dispatch's liveness, and checks silence and the deadline. Nothing else watches, and
Dely opens no terminal of its own.

Removed from `skills/delivery/scripts/dely.js`: the `sidecar` command, `cmdSidecar`,
`startSidecar`, `startVerifySidecar`, `sidecarAlive`, `ensureRunSidecar`,
`coordinatorHandle`, the `sidecarHandle` state and cleanup, and `collect --repo`,
which only the sidecar needed. `dely verify start` sleeps with no sidecar, and
`dely verify collect` restarts none.

**Why, measured on 2026-09-11 and 2026-09-12.**

- Orca already knows a dead worker: `projection.liveness.verdict` is `exited`,
  `dispatchStatus` is `failed`, and `nextAction` names `worker-release`. No watchdog
  discovers that; `collect` reads it.
- Only a message wakes a nudge-mode Control, and the sender's handle does not matter:
  a message carrying Control's own handle nudged it, and so did one from another
  terminal.
- A sidecar terminal cannot be identified by title: the shell rewrites it. Judging it
  live needs fields Orca does not send.
- `orca automations` cannot be the watchdog: it is agent-backed, hourly at finest, and
  creates a worktree per run.
- Worker heartbeats are not a clock: measured 1.5 to 15 minutes apart across 16
  dispatches, sent by the agent rather than by Orca.
- In this delivery's 17 dispatches, no wake depended on a watchdog. Both failures were
  Control's own `worker-stop` and terminal close, each of which Control already knew.

**Direction.** Delete rather than replace. The wake modes stay: background Control
runs `dely wait`; nudge Control runs `dely collect`. One consumer per Run still holds,
and more simply, because `collect` is that consumer in nudge mode.

**Files.** `skills/delivery/scripts/dely.js`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`, `skills/delivery/SKILL.md`, `skills/verify/SKILL.md`,
`tests/contracts.sh`.

**Focused verification.** `node --test tests/scripts.test.js` plus
`bash tests/contracts.sh`, with the acceptance rows below.

**Document impact.** Decision 5 of the 2026-09-11 record is amended in place, and its
sidecar alternative is recorded as superseded.

**Remediation, after task 3c's review.** The review accepted the removal itself — no
orphaned helper, no dead state, every deleted test dead — and raised two Important
findings:

- **A.** The record justifies the deletion by saying `collect` reads Orca's
  dead-worker report, and it does not. Every branch of `collect` filters on
  `dispatchStatus === "dispatched"`, so a dispatch Orca has marked `failed` whose
  worker died before sending anything makes `collect` exit 0 printing nothing, and the
  skill gives Control no row for that. The fix is the code, not the claim: `collect`
  and `wait` report such a dispatch as `FAILED <id> <reason>` on a distinct exit code,
  taking the reason from Orca's own `liveness` and `lastError`. `wait` shares the
  blind spot, and without it a background Control waits out the full deadline.
  The skill routes that line like any other failed launch: one fresh dispatch, then
  the human.
- **B.** The sentence stating what the removal costs — a worker that neither sends a
  message nor exits wakes nobody — is unpinned in both skills. Deleting it from both
  leaves `tests/contracts.sh` green. `skills/verify/SKILL.md` has no pin at all.

Minor, in the same pass: a surviving test still named for the sidecar, and an orphaned
`rejectAck` fixture branch whose only consumer was deleted — wire it to one of the two
uncovered ack-failure paths or drop it.

Remediation files: `skills/delivery/scripts/dely.js`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`, `skills/delivery/SKILL.md`, `skills/verify/SKILL.md`,
`tests/contracts.sh`.

### 3d. A dead dispatch is released, reported once, and forgotten

**Why.** Task 3c's remediation made `collect` and `wait` report a dispatch Orca has
marked dead. Its scoped re-review accepted that, and found the reporting has no
lifecycle: nothing releases or remembers the dead dispatch, and its suspect filter is
`dispatchStatus !== "dispatched"`, which no action can clear. Measured by the reviewer
on a scratch copy of `53484ef`:

- a second `collect` on the same Run reports the same dead dispatch again, with no
  `worker-release` logged;
- with one dead and one live dispatch, `collect` never returns `WAITING` and `wait`
  exits at the top of its first loop, so the fresh dispatch the skill prescribes can
  never be waited on. The recovery row the same commit added is unreachable;
- a dispatch Control itself stopped on `SILENT` is reported as `FAILED` on the next
  collect, because `worker-stop` leaves liveness `exited`;
- the reason line can print a stale worker state, for example `ready`, as the cause.

**Behaviour.**

- `collect` and `wait` release a dead dispatch before reporting it, and never report
  it twice. Orca's own `nextAction` for a failed dispatch is `worker-release`.
  Measured live on 2026-09-12: after release, `worker-list` reports
  `terminalState: released` while `dispatchStatus` stays `failed`, and an unreleased
  one reads `reclaimable` or `retained`. The filter must rest on something release
  actually changes.
- A dead dispatch never masks a live one. Settles and `WAITING` are still reported,
  and `wait` keeps waiting for a dispatch that is still open.
- A dispatch Control stopped — the `SILENT` path — is never reported as `FAILED`.
- `wait` runs the dead check after it consumes, as `collect` does, so the ordinary
  completion path cannot depend on what `check --all` returns for a message that is
  not yet consumed.
- The reason never presents a stale worker state as the cause.
- The ack-failure test added for Minor D fails as an assertion, not as an unbounded
  hang.

**Files.** `skills/delivery/scripts/dely.js`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`, `skills/delivery/SKILL.md`, `tests/contracts.sh`.

**Focused verification.** `node --test tests/scripts.test.js` with the rows below, and
`bash tests/contracts.sh`.

**Document impact.** Decision 5's `collect` and `wait` bullets are corrected in the
same amendment that routes this task; `docs/decisions.md` said collect reads liveness
for each open dispatch, and it reads it for one that is no longer open.

### 4. The package, its gates and its record ship the change

**Behaviour.**

- `README.md` documents `dely:verify`, adds `--skill verify` to the Kiro command,
  names `/verify` in the palette text, and states the runtime requirement.
- `AGENTS.md` and `.github/workflows/contracts.yml` carry the new closure gate
  `node --test tests/scripts.test.js`.
- `CONTRIBUTING.md` names it.
- Both versioned manifests and the pin in `tests/contracts.sh` read `0.18.0`.
- Added by human decision on 2026-09-11, from task 2's scoped re-review (two Minor
  findings):
  - **N1:** after a `NO_ACK` or `FAIL` launch, `dely verify start` launches no
    further pin.
  - **N2:** an error thrown after a launch stops and releases every launched
    dispatch, removes `.dely-verify/` and records a FAIL verdict before restoring
    the Run. The clause about closing a sidecar is void: task 3c removed it.
- Added from task 3's review (out of scope there): a launch whose `worker-start`
  returns a state other than `ready` closes the terminal it created. Measured again on
  2026-09-12 on the `--agent` path, not only on adopt: a shell update prompt ate the
  first keystroke of the launch command, the dispatch failed with
  `agent_readiness: timeout`, and Orca listed the created terminal as residual.

  The re-review returned the disposition word `APPROVED`, which is outside the
  protocol's set. The human ruled it `ACCEPT`.

**Direction.** Stay within 280 lines of `tests/contracts.sh`. The workflow shape pin
in `tests/contracts.sh` changes only by the added run line. The N1 and N2 changes
reuse the existing cleanup and verdict paths.

**Files.** `README.md`, `AGENTS.md`, `.github/workflows/contracts.yml`,
`CONTRIBUTING.md`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
`tests/contracts.sh`, and for N1 and N2 `skills/delivery/scripts/dely.js`,
`tests/scripts.test.js`, `tests/fixtures/fake-orca.js`.

**Focused verification.** `bash tests/contracts.sh`, the `jq` manifest gate,
`test "$(wc -l < tests/contracts.sh)" -le 280`.

**Document impact.** README, CONTRIBUTING, AGENTS and CI own the paths they change.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Dispatch refuses without a PASS verdict for the exact key | `node --test` case: fake Orca holds a PASS verdict whose key differs only in Control harness | A lookup that accepts any PASS verdict for the repository | |
| Adopt starts the worker only after output quiescence | `node --test` case: fake `terminal wait --for tui-idle` is satisfied at once, while fake `lastOutputAt` keeps changing for 4 s | An implementation that calls `tui-idle` and then `worker-start --terminal` immediately | |
| Every spec carries the acknowledgement instruction | `node --test` case inspecting the recorded `worker-start --spec` argument | A dispatch that forwards Control's spec unchanged | |
| NO_ACK stops the dispatch and never retries into the same terminal | `node --test` case: no heartbeat within the ACK limit; assert `worker-stop` recorded and no `--terminal` + `--retry-of` call | A recovery that re-runs `worker-start --terminal <same> --retry-of` | |
| Wait swallows heartbeats and exits only on settle | `node --test` case: delivery 1 = heartbeat, delivery 2 = worker_done; assert both acked and exit `SETTLED` after the second | A wait that exits on the first delivery of any type | |
| Wait exits `DEADLINE` while output is fresh | `node --test` case: fake `lastOutputAt` always now, no settle | A wait that uses only silence or Orca liveness | |
| Wait exits `SILENT` when output is stale after ACK even though Orca says live | `node --test` case: liveness `live`, `lastOutputAt` older than the limit | A wait that trusts `projection.liveness` | |
| Sidecar swallows only heartbeats on the Control handle (superseded by task 1b; kept as the record of the first approved interface) | `node --test` case asserting `check --terminal <control> --types heartbeat` and no ack of a `worker_done` | A sidecar that waits on all types and suppresses the settling nudge | `718bc27` review |
| Dispatch observes its ACK without consuming a Delivery (task 1b) | `node --test` case: one Delivery holds the ACK heartbeat and `worker_done`; dispatch returns `DISPATCHED`, records no consuming `check` or `--ack`, and a later `dely collect` prints `SETTLED ... worker_done` | The `088e8ce` ACK wait, which consumes heartbeat-typed deliveries and stalls or loses a batched settle | |
| Wait judges a Delivery as a whole (task 1b) | `node --test` case: one Delivery holds a heartbeat and `worker_done`; wait acknowledges once and exits `SETTLED` listing both | A wait that acknowledges a heartbeat-typed batch and keeps waiting | |
| Sidecar wakes Control once and exits when a batch carries a settle (task 1b; superseded by task 3c, kept as the record of the shipped interface) | `node --test` case: a mixed Delivery; assert one `--ack` with `--terminal <control>`, one `send --type status`, exit 0, and no consuming `check` after the send | A sidecar that acknowledges and keeps looping, consuming its own wake message, or one that never acknowledges a mixed batch | |
| Collect reports settles already consumed by the sidecar (task 1b) | `node --test` case: `worker_done` present only in `--all` history (acknowledged); collect prints `SETTLED <dispatch> worker_done` and exits 0 | A collect that reports only from deliveries it consumes itself | |
| Fake Orca replays the oldest Delivery until acknowledged (task 1b) | `node --test` case: consume without ack, send a newer message, consume again; assert the same delivery id and contents | A fake that filters Delivery contents by `--types` or forms a new batch per call | |
| Verdict is written only after every dispatch settled, with the full key | `node --test` case: one dispatch settles PASS, one still open; assert no verdict task yet | A verify that writes PASS when dispatches start | |
| Verify restores the Control terminal's previously bound Run (task 2) | `node --test` case: fake `run-current` returns a delivery Run; after `dely verify run` (PASS, FAIL and BLOCKED paths) the last Run-binding call is `run-use --id <that run>` | A verify that creates its own Run and leaves Control bound to it | |
| Launcher falls back to Orca's runtime when `node` is absent | `node --test` case running `dely` with a PATH lacking `node` and a fake Orca runtime | A launcher that requires `node` on PATH | |
| `dely.cmd` resolves the same runtimes on Windows | No executable instrument in CI; a human reads the diff | None | n/a |
| Delivery skill pins the refusal rule, the nudge-command prohibition and the removal of same-terminal retry | `bash tests/contracts.sh` | The rule moved outside `### Launching a worker`, or the old retry sentence kept | |
| README Kiro install includes `--skill verify` | `bash tests/contracts.sh` | README still installing only `delivery` and `setup` | |
| Pins reject an inverted sentence (task 3 remediation) | `bash tests/contracts.sh` against each of: the nudge's quoted check command run; a human asked before `dely:verify`; a live terminal re-engaged; `NO_ACK`/`SILENT`/`FAILED` sent straight to the human | The `d6635b3` token pins, which pass all four | `review-3` |
| A silent dispatch is stopped before `SILENT` is reported (task 3 remediation) | `node --test` cases for `wait` and `collect`: stale output after ACK; assert `worker-stop --dispatch <id>` before exit 6, and a following `collect` does not report it again | The `d6635b3` runtime: wait exits `SILENT` with no stop, collect drains the wake and prints `WAITING` | `review-3` scratch driver |
| Collect reports `DEADLINE` from the dispatch's `dispatchedAt` (task 3 remediation) | `node --test` case: `dispatchedAt` older than the deadline, output fresh, a new collect process; assert exit 7 | A deadline measured from the start of the collect, wait or sidecar process | |
| Nudge-mode collect opens no terminal (task 3c) | `node --test` case: one dispatch still open; assert `WAITING`, and no `terminal create` or `terminal list` call | The `44ffe96` collect, which opens or reuses a sidecar on every `WAITING` | `rereview-3` |
| A failed dispatch with no message is reported (task 3c remediation) | `node --test` cases for `collect` and `wait`: one worker with `dispatchStatus` `failed` and `liveness.verdict` `exited`, no deliveries; assert a `FAILED <id> <reason>` line and a non-zero exit | The `36a5187` runtime, where collect exits 0 printing nothing and wait waits out the deadline | `review-3c` |
| A dead dispatch is released and reported once (task 3d) | `node --test` case: two collects on the same dead dispatch; assert `worker-release` before the `FAILED` line, and no `FAILED` from the second | The `53484ef` runtime, which re-reports forever and logs no release | `rereview-3c` P2a/P2b |
| A dead dispatch never masks a live one (task 3d) | `node --test` cases: one dead and one open dispatch; assert collect prints the `FAILED` line and `WAITING`, and that `wait` goes on to settle the live dispatch | The `53484ef` runtime, where collect never returns `WAITING` and wait exits at once | `rereview-3c` P3/P11 |
| A Control-stopped silent dispatch is never reported `FAILED` (task 3d) | `node --test` case: the pinned silence scenario, with liveness `exited` after the stop as `worker-stop` leaves it; assert the next collect does not report it | The `53484ef` runtime, which prints `FAILED disp_1 ready` | `rereview-3c` P9a/P9b |
| `wait` checks for a dead dispatch only after consuming (task 3d) | `node --test` case: a `worker_done` queued and liveness `exited`; assert `SETTLED`, with the dead check ordered after the consume | The `53484ef` order, whose happy path rests on `check --all` returning an unconsumed message | `rereview-3c` N3 |
| The reason never presents a stale worker state as the cause (task 3d) | `node --test` case: a failed dispatch whose `worker-show` still says `ready`; assert the line does not name `ready` as the cause | The `53484ef` reason line, which prints whatever `worker.state` holds | `rereview-3c` P8 |
| The statement of the lost behaviour is pinned in both skills (task 3c remediation) | `bash tests/contracts.sh` after deleting the sentence from each skill in turn | The `36a5187` pins, which stay green when it is deleted from both | `review-3c` |
| The runtime has no sidecar command (task 3c) | `node --test` case: `dely sidecar --run r --control-handle h` prints the usage line and exits 2 | A runtime that keeps the command while the skill stops naming it | |
| Verify sleeps and collects without a sidecar (task 3c) | `node --test` cases: `verify start` prints `SLEEP` and records no `terminal create`; `verify collect` with one dispatch open prints `WAITING` and records none either | The `44ffe96` verify, which starts a sidecar and restarts a missing one | |
| A `worker-start` that is not `ready` closes the terminal it created (task 4) | `node --test` cases on both paths: adopt, and `--agent`, each returning `failed`; assert `terminal close` for the created handle | The `d6635b3` paths, which close only on readiness timeout and `NO_ACK` | `review-3`, and a live `agent_readiness: timeout` on 2026-09-12 |
| After a failed launch, verify start launches no further pin (task 4, N1) | `node --test` case: first pin gets no ACK; assert exactly one `worker-start` | A start that launches every pin before checking for a failed launch | |
| A throw after a launch cleans up and records FAIL before restoring (task 4, N2) | `node --test` case: `state.json` write fails after one launch; assert `worker-stop` for that dispatch, a FAIL verdict, and `run-use --id <prev>` last | A catch that only restores the Run | |
| Live verify proves both Control wake modes on this repository | Live `dely verify run` (Claude Code Control) and `dely verify start` / `collect` (Codex Control); report quoted with RESULT and wake count | None executable offline; a human reads the quoted live reports | n/a |

**Cannot be observed:**

- Linux and Windows live behaviour: harness trust stores, the Orca launcher layout,
  and harness shells there.
- Whether an LLM Control actually runs verify when refused. The refusal is the
  mechanism; running verify is prose.
- Orca nudge reliability across Orca versions.
- Quota exhaustion in a live run.
- Grok and Kiro verify outcomes.
- Whether real Orca's `check --all` returns a message that is not yet consumed. Task
  3d removes the dependency by ordering, rather than settling the question.
- `dely verify collect` shares the dead-dispatch blind spot, bounded by
  `DELY_VERIFY_DEADLINE_S`, so a dead verify pin ends at `DEADLINE` rather than never.
- A worker that neither sends a message nor exits leaves a nudge-mode Control asleep.
  Nothing offline can observe that, and after task 3c a human ends that wait. Measured
  in this delivery: 0 of 17 dispatches.
- A same-terminal retry reworded to avoid every pinned phrase. The pins are lexical.
- `adoptedPermission` off macOS: Orca's data path there is unmeasured, and it falls
  back to the table's permission cell.

## Stop conditions

- Neither `node` 18+ nor Orca's bundled runtime is resolvable where the tests run.
- An Orca CLI flag this plan relies on behaves differently from what was recorded:
  `task-create --run`, `task-update --result`, `run-list --cursor`,
  `check --terminal`, `terminal show` `lastOutputAt`.
- `tests/contracts.sh` cannot hold the new pins within 280 lines.
- The fake Orca cannot model a counterexample row. Replace the instrument, or record
  that a human reads the diff.
- Codex quota exhausted during review. Escalate; do not change pins.
- Any assumption measured only on macOS turns out to be required for the CI run on
  `ubuntu-latest`.

## Closure gates

```
cd /Users/hieuphung/Projects/dely && git diff --check
cd /Users/hieuphung/Projects/dely && bash -n tests/contracts.sh
cd /Users/hieuphung/Projects/dely && jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null
cd /Users/hieuphung/Projects/dely && bash tests/contracts.sh
cd /Users/hieuphung/Projects/dely && node --test tests/scripts.test.js
cd /Users/hieuphung/Projects/dely && test "$(wc -l < tests/contracts.sh)" -le 280
cd /Users/hieuphung/Projects/dely && the absence gates and the disclosure grep exactly as listed in AGENTS.md
```
