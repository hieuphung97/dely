# Plan — harnesses state their role limits; Copilot, Antigravity and Grok are supported

Decision record: `docs/decisions.md`, section "2026-09-30 — Each harness
states what it can do per role, with limits; Copilot, Antigravity and Grok are
supported". It builds on the 2026-09-28 Pi and 2026-09-27 OMP records, still
unreleased on this branch.

**Baseline:**

## Goal

`harnesses.json` keeps its schema. It offers Copilot, Antigravity and Grok as
supported. Every entry that needs it gets a one-sentence `limits`. Kiro's
Control is corrected. `setup` prints the limits. The helper stops counting
Orca-rejected messages. It takes `--ack` on `wait` and `wait-bg`, checks for
`ORCA_TERMINAL_HANDLE`, hints at the two common Orca errors, and records
`dispatchId` and the Control harness. The pin extension fails closed on a
throwing `setModel` and on an unparseable pin line. README is short and
direct. The checklist runs parameterized worker and Control rows for every
supported harness. Version `0.23.0`, unreleased. Out of reach: a Kiro worker;
a pinned Copilot or Grok worker; a verified Pi pin.

## Allowed scope

```
harnesses.json
skills/delivery/scripts/dely.js
extensions/dely-pin.ts
skills/delivery/SKILL.md
skills/setup/SKILL.md
AGENTS.md                           (closure gates only)
README.md
probe/checklist.md
docs/decisions.md                   (Control only)
docs/_plans/roles-refactor.md       (Control only; deleted before the release-binding review)
```

Version strings stay `0.23.0`. This branch already carries 0.23.0 in both
manifests, `package.json` and the version gate, and it is unreleased
(`gh release list` ends at `v0.22.0`).

## Forbidden scope

`package.json` content, the plugin manifests, `probe/trust.sh`,
`probe/mkrepo.sh`, `skills/delivery/templates/`, `.github/`, and user or
harness configuration, except scratch installs that a task explicitly allows
and then removes.

## Execution envelope

Protected dirty paths: none. The owner's pin commits are separate (`abc9a2a`,
`9069365`, `0765b79`).

Branch: `feat/pi-harness` at `0765b79`, remote `origin`. Pull request #61 is
retitled and updated to cover this work.

Resolved pins, from `AGENTS.md` and checked 2026-09-30:

- `implement`: Codex CLI `gpt-6.1-sol` `medium`. Codex 0.159.1 lists
  `gpt-6.1-sol` with `medium`.
- `review`: Claude Code `claude-opus-5-5` `high`.

Authority: commit owned paths, run gates, push `feat/pi-harness`, update pull
request #61. No merge, force-push, stash, reset or clean.

## Tasks

### A. `harnesses.json` values, `limits`, `setup`, and the value gate

**Behaviour.**

- **`copilot`:** `status: supported`, `controlWake: background`, and `limits`
  on the trust dialog Orca does not detect (seen only as `NO_ACK`, once per
  path), no model pin, and occasional unsent prompts.
- **`antigravity`:** `status: supported`, `controlWake: waker`,
  `modelFlag: true`, `effortFlag: false`, and `limits` on the lost prompt at
  the first launch on a new path and on there being no effort pin.
  - `discovery`: `{"models": "agy models", "effort": null, "modelSlugBefore": "\t"}`,
    or the field that offers the slug column, as `skills/setup` supports
    today. Verify the command's output first.
- **`grok`:** `status: supported`, `controlWake: waker`, and `limits` on the
  per-path trust answer in every repository with `AGENTS.md`, and on there
  being no model pin.
- **`kiro`:** stays `deferred`. `controlWake: waker`. `notes` say why a
  worker never becomes ready.
- **`limits` on existing entries:**
  - `codex`: its Control's shell may lack `ORCA_TERMINAL_HANDLE`, measured on
    0.157.1; and Codex 0.159.2 never passes Orca 1.4.215's readiness check as
    a worker (`agent_readiness` timeout, with and without `-c`, measured
    2026-09-30), so it is not usable as a worker on that pair;
  - `pi`: as Control, run the helper with no tool timeout; the pin is
    unchecked;
  - `omp`: a dead worker surfaces only at `STALLED`;
  - `cursor`: no effort pin.
- **`notes`** of the four measured harnesses carry the measured versions and
  facts from the Spike reports named in the decision record. Remove the
  statements the Spike disproved.
- **`skills/setup/SKILL.md`:** one sentence. When an offered entry has
  `limits`, print it next to that harness.
- **`AGENTS.md`:** one gate line that fails unless every entry's `status` is
  `supported` or `deferred`, `controlWake` is `background`, `waker` or
  `unsupported`, and `modelPin`, when present, is `spec` or `spec-unchecked`.

**Focused verification.** Run the new gate on the candidate, then on a scratch
copy of `harnesses.json` with one bad value in each of the three fields; it
must pass and then fail three times. Run `jq` over the four promoted or
corrected entries to show every field the plan names. Run the Antigravity
discovery command.

### B. Helper and extension fixes

**Behaviour.**

- **Rejected messages.** `dispatch` and `preflight` do not count a message
  Orca rejected (its payload carries `_orcaLifecycleRejection`, or its subject
  starts `Rejected `) as the acknowledgement. `wait` does not return `SETTLED`
  for a batch whose only settling messages were rejected. It acknowledges
  that batch, logs it, and keeps waiting.
- **`--ack`.** `wait` and `wait-bg` accept `--ack <deliveryId>`. `wait` runs
  `orca orchestration check --run <run> --ack <id>` once before waiting.
  `wait-bg` forwards the flag to its waiter. Usage text shows the flag.
- **Terminal handle.** `dispatch` and `preflight` print `FAILED` with a one-line
  reason and do not start a worker when `ORCA_TERMINAL_HANDLE` is unset.
- **Hints.** When Orca's message contains "requires the coordinator terminal
  currently bound" or "already has an active actionable waiter", the helper
  appends one hint line naming the command to run. Orca's text is kept.
- **Log.** A `settled` event records each message's `dispatchId` (from its
  payload). `wait` and `wait-bg` events record the Control harness (the
  terminal's `agentIdentity`, else `--control`). `log --repo` given no value
  does not crash.
- **Extension.** A `dely-pin:` line the parser cannot read (wrong token count)
  and a `setModel` that throws both fail the same way as an unknown selector.
- **`skills/delivery/SKILL.md`:**
  - one sentence: run `dely preflight` and `dely dispatch` with no tool
    timeout, or one of at least 300 s;
  - "acknowledge" in Result handling becomes: pass the settled
    `deliveryId` as `--ack` to the next `dely wait` or `wait-bg`, or run
    `orca orchestration check --ack` when no wait follows.

**Focused verification.**

- Stub-`orca` check: a rejected heartbeat alone gives no `DISPATCHED`; a
  rejected `worker_done` alone gives no `SETTLED`; a valid one after it does.
- `--ack` is sent before the wait.
- An unset handle gives `FAILED` with no `worker-start` call.
- Both hint texts appear.
- The `settled` log line carries `dispatchId`.
- Claude Code, Codex CLI and Cursor Agent CLI argv, spec and stdout stay
  byte-identical to a `git archive 3155c22` helper for the unchanged paths.
- Node fake-`pi` extension check for the two new failure cases.
- Observe each red against a present-but-wrong variant first.

### C. README and checklist

**Behaviour.**

- **`README.md`**, rewritten short and direct, in this order:
  - what Dely is, in a few lines;
  - installing Orca;
  - a table of supported harnesses with Control wake and their `limits`, in
    one line each;
  - install guidance that says plainly: **install Dely only in the harness
    you use as the Control session**. Workers read no Dely skill, so a harness
    used only as implementer or reviewer needs Orca and its own login, not a
    Dely install. Then per-harness install, verify, update and remove
    commands for the harnesses that can be Control, **only as measured** in
    `/Users/hieuphung/dely-probe/install-probe/report.md` for Copilot,
    Antigravity and Grok, and as already documented for the others. (Added
    at the owner's request, 2026-09-30.)
  - one line for Kiro: measured, not supported;
  - pinning a model;
  - troubleshooting: shell startup prompts such as an oh-my-zsh update
    holding a worker, Orca disconnects, and a trust dialog at first launch;
  - `@v<version>` instead of a literal version.

  Drop explanation a user does not need to act.
- **`probe/checklist.md`:**
  - one worker row and one Control row, parameterized by harness, run for
    every supported harness whose entry or shared launch code changed;
  - the OMP and Pi pin rows kept;
  - a stub instrument row for Orca-rejected messages;
  - the release floor restated for the parameterized rows.

**Focused verification.** A human-equivalent read against the decision record
and the install probe report; `git diff --check`; the disclosure greps.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| A rejected ACK or `worker_done` does not advance a dispatch or a wait | Stub `orca` | Helper prints `DISPATCHED` or `SETTLED` on the rejection | |
| `--ack` acknowledges the previous batch before waiting | Stub `orca` records the `check --ack` call first | Flag parsed but ignored, so the batch replays | |
| A missing terminal handle fails before any launch | Stub `orca` with `ORCA_TERMINAL_HANDLE` unset | `worker-start` still called | |
| Unchanged harness paths stay unchanged | Stub comparison with the `3155c22` helper | Byte difference for Claude, Codex or Cursor | |
| The extension fails closed on a bad line and a throwing `setModel` | Node fake `pi` | Turn runs on the default model | |
| Enumerated values are gated | Gate on a scratch copy with bad values | Gate passes a bad value | |
| Promoted harnesses work in their roles | Live worker and Control rows for Copilot, Antigravity and Grok | Entry says supported but the row fails | |
| README install commands work | Install probe report, rerun on the candidate snapshot in the live verification | A command the probe did not verify | |

**Cannot be observed:** Copilot, Antigravity and Grok on versions other than
the ones measured; a Kiro worker; a pinned Copilot or Grok worker.

## Stop conditions

- The install probe cannot install Dely into one of the three harnesses: its
  Control is not offered. Record `controlWake` for it from the measurement
  anyway, but README gives no Control install for it. Report this rather than
  guessing.
- A task needs a new `harnesses.json` field other than `limits`:
  `NEEDS_REPLAN`.

## Closure gates

Every gate in `AGENTS.md`, including Task A's new gate, from the repository
root.
