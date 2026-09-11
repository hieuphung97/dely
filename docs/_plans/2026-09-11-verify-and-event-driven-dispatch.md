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
- **`dely sidecar --run <runId> --control-handle <handle>`** consumes whole
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

**Focused verification.** `node --test tests/scripts.test.js` (verify cases), plus
one live `dely verify run` on this repository whose report is quoted in the handoff.

**Document impact.** The setup skill owns its own "what setup will not do" list,
which changes.

### 3. The delivery contract routes every dispatch through the runtime

**Behaviour.** `skills/delivery/SKILL.md` requires:

- every dispatch through `dely dispatch`;
- an automatic `dely verify` when dispatch refuses;
- a stop with the reported fix on FAIL or BLOCKED;
- after ACK, Control sleeps by its harness's wake mode — `dely wait` in the
  background, or `dely sidecar` plus ending the turn — and on a nudge runs only
  `dely collect`;
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

### 4. The package, its gates and its record ship the change

**Behaviour.**

- `README.md` documents `dely:verify`, adds `--skill verify` to the Kiro command,
  names `/verify` in the palette text, and states the runtime requirement.
- `AGENTS.md` and `.github/workflows/contracts.yml` carry the new closure gate
  `node --test tests/scripts.test.js`.
- `CONTRIBUTING.md` names it.
- Both versioned manifests and the pin in `tests/contracts.sh` read `0.18.0`.

**Direction.** Stay within 280 lines of `tests/contracts.sh`. The workflow shape pin
in `tests/contracts.sh` changes only by the added run line.

**Files.** `README.md`, `AGENTS.md`, `.github/workflows/contracts.yml`,
`CONTRIBUTING.md`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
`tests/contracts.sh`.

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
| Sidecar wakes Control once and exits when a batch carries a settle (task 1b) | `node --test` case: a mixed Delivery; assert one `--ack` with `--terminal <control>`, one `send --type status`, exit 0, and no consuming `check` after the send | A sidecar that acknowledges and keeps looping, consuming its own wake message, or one that never acknowledges a mixed batch | |
| Collect reports settles already consumed by the sidecar (task 1b) | `node --test` case: `worker_done` present only in `--all` history (acknowledged); collect prints `SETTLED <dispatch> worker_done` and exits 0 | A collect that reports only from deliveries it consumes itself | |
| Fake Orca replays the oldest Delivery until acknowledged (task 1b) | `node --test` case: consume without ack, send a newer message, consume again; assert the same delivery id and contents | A fake that filters Delivery contents by `--types` or forms a new batch per call | |
| Verdict is written only after every dispatch settled, with the full key | `node --test` case: one dispatch settles PASS, one still open; assert no verdict task yet | A verify that writes PASS when dispatches start | |
| Launcher falls back to Orca's runtime when `node` is absent | `node --test` case running `dely` with a PATH lacking `node` and a fake Orca runtime | A launcher that requires `node` on PATH | |
| `dely.cmd` resolves the same runtimes on Windows | No executable instrument in CI; a human reads the diff | None | n/a |
| Delivery skill pins the refusal rule, the nudge-command prohibition and the removal of same-terminal retry | `bash tests/contracts.sh` | The rule moved outside `### Launching a worker`, or the old retry sentence kept | |
| README Kiro install includes `--skill verify` | `bash tests/contracts.sh` | README still installing only `delivery` and `setup` | |
| Live verify proves both Control wake modes on this repository | Live `dely verify run` (Claude Code Control) and `dely verify start` / `collect` (Codex Control); report quoted with RESULT and wake count | None executable offline; a human reads the quoted live reports | n/a |

**Cannot be observed:**

- Linux and Windows live behaviour: harness trust stores, the Orca launcher layout,
  and harness shells there.
- Whether an LLM Control actually runs verify when refused. The refusal is the
  mechanism; running verify is prose.
- Orca nudge reliability across Orca versions.
- Quota exhaustion in a live run.
- Grok and Kiro verify outcomes.

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
