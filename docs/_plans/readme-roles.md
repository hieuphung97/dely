# Plan — README role table derived from `harnesses.json`, and the review follow-ups

Decision record: `docs/decisions.md`, section "2026-10-01 — README shows a role
table derived from `harnesses.json`; `limits` are user caveats; the checklist
runs rows by what changed". The review it answers is
`~/dely-probe/arch-review/roles-architecture-review.md` ("the review" below).

**Baseline:** this plan's commit.

## Goal

This plan delivers:

- `harnesses.json` `limits` rewritten as role-prefixed user caveats, and
  `notes` trimmed to field justifications;
- a README a new user can act on, with a role table that a closure gate
  checks against `harnesses.json`;
- a version rule that covers runtime data;
- three small helper fixes and two `SKILL.md` sentences;
- a tiered checklist.

The version stays `0.23.0`, unreleased.

## Allowed scope

```
harnesses.json
AGENTS.md                           (closure gates and the version rule only)
README.md
skills/delivery/scripts/dely.js
skills/delivery/SKILL.md
probe/checklist.md
docs/decisions.md                   (Control only)
docs/_plans/readme-roles.md         (Control only; deleted in the release commit)
```

## Forbidden scope

- `package.json` content, the plugin manifests and `extensions/`;
- `skills/setup/SKILL.md`;
- `skills/delivery/templates/`, `probe/trust.sh`, `probe/mkrepo.sh`;
- `.github/`;
- any user or harness configuration;
- `assets/` (read only; the logo files exist).

## Execution envelope

Protected dirty paths: none.

Branch `feat/pi-harness`, remote `origin`, pull request #61. Its title and body
are updated to cover this work.

Resolved pins, from `AGENTS.md` (owner, `8c5fb6b`):

- `implement`: Cursor Agent CLI `cursor-grok-4.6-high`, effort `default`;
- `review`: Claude Code `claude-opus-5-5` `high`.

Orca is 1.4.218.

Authority: commit owned paths, run gates, push `feat/pi-harness`, update pull
request #61. No merge, force-push, stash, reset or clean.

## Tasks

### E. `limits`, `notes`, and the version rule

**Behaviour.**

- **`limits`.** Every `limits` is rewritten in user words. A sentence that
  applies to one role starts "As Control," or "As a worker,". Other sentences
  are general and change no mark. Each sentence is one a user can act on, or
  a plain warning. Use the review's §3c "Watch out for" column as the draft,
  apply its traceability table, and remove anything the sources do not
  support. In particular:
  - **Codex:** drop the 0.157.1 handle sentence, which 0.159.2 disproved.
    Keep the Control overlap, and say that workers need Codex 0.159.2 or
    newer with Orca 1.4.217 or newer.
  - **Cursor and Antigravity:** "choose the effort through the model name"
    replaces "no effort pin".
  - **Antigravity:** sign in before the first delivery; avoid
    `gemini-3-flash-preview`.
  - **Copilot:** answer "No, thanks" to the app prompt at the first launch.
  - **Grok:** the per-project trust answer. As Control, a free account ran
    out of usage mid-delivery.
  - **OMP:** workers on OMP 18.4 do not start under Orca 1.4.217
    (stablyai/orca#24068). No trust prompt. A crashed worker is noticed late.
    Install Dely in OMP to pin a model.
  - **Pi:** as Control, run Dely's commands with no time limit, and release
    leftover workers. Install Dely in Pi to pin a model, and check the model
    in Pi's session log.
  - **Claude:** put `@AGENTS.md` in `CLAUDE.md`.
  - **Kiro:** "Workers never start in Orca."

  No `limits` contains `|`.
- **`notes`.**
  - Keep only what justifies a field's value, and end with the date of the
    decision section that measured it.
  - Remove a sentence only if `docs/decisions.md` already holds that fact. If
    it does not, keep the sentence.
  - Correct the two false Pi sentences: a whitespace pin cell now fails
    closed; Pi loads the extension only through the `pi` key.
- **`AGENTS.md`.** The version rule names `skills/`, `harnesses.json`,
  `extensions/` and `package.json`.

**Focused verification.**

- A table of every `notes` sentence removed, each with the `docs/decisions.md`
  line that holds it.
- A table of every `limits` sentence, each with its source: a `harnesses.json`
  field, a report line, or an issue.
- `jq` showing that no field other than `limits` and `notes` changed.
- Every closure gate.

### F. README and the role-table gate

**Behaviour.**

- **README**, in this order:
  1. logo (as on `3155c22`);
  2. the one-sentence pitch;
  3. video and YouTube link (as on `3155c22`);
  4. contents;
  5. Quickstart in four steps;
  6. How Dely works:
     - you ask, Control designs, you approve, the implementer builds, the
       reviewer checks, Control opens the pull request, you merge;
     - one sentence each on what Control, implementer and reviewer are;
     - one line on Spike;
  7. "Choose a harness for each role":
     - the trust paragraph;
     - the mark legend;
     - the table, one row per `harnesses.json` entry in file order, each
       exactly as the gate builds it;
     - one line saying other agents may work and that `harnesses.json`
       records what was measured;
  8. Install Orca, as now plus the Orca CLI and orchestration doc links from
     `3155c22`;
  9. Install Dely:
     - as now, plus the invocation for Claude Code and Codex;
     - keep the line that a pinned OMP or Pi worker needs that harness's
       install;
  10. Choose models, in two sentences;
  11. Log (the `3155c22` section);
  12. Troubleshooting, as now;
  13. footer.

  Remove the old "Choose harnesses" table, "Pin a model" and the separate
  Kiro line. Public copy names harnesses and implies more.
- **Closure gate in `AGENTS.md`.** One command builds each row from
  `harnesses.json` with the rule in the decision record and fails unless
  README contains it as a whole line. Write the rule beside the gate in one
  sentence.

**Focused verification.**

- The gate passes on the candidate.
- It fails on each of these scratch copies:
  - a README row with one wrong mark;
  - a README row whose caveat differs by one word;
  - a `harnesses.json` whose `limits` gained an "As a worker," sentence that
    README lacks.
- `wc -l README.md`.
- Every invocation and install command traced to the `65a54b0` README or the
  install probe report.

### G. Helper and `SKILL.md`

**Behaviour.**

- **`wait --ack <id>`** sends one `check --run <run> --ack <id> --wait …`,
  Orca's own form, instead of a separate `check --ack`. A bare or refused
  `--ack` still prints `ERROR` and does not wait.
- **`dispatch` and `preflight`** resolve `--repo` before the handle check. The
  missing-handle `ERROR` adds Orca's guidance: pass your own terminal's handle
  as `ORCA_TERMINAL_HANDLE`, never another pane's.
- **`SKILL.md`, two sentences:**
  - a spec line must not start `dely-pin:`;
  - when `wait` prints `ERROR` for `--ack`, run
    `orca orchestration check --ack <settled id>` and wait again without
    `--ack`.

**Focused verification.**

- Stub `orca`, with each row observed red against a present-but-wrong variant
  first:
  - one `check` call carries both `--ack` and `--wait`;
  - a variant that drops `--ack` from that call replays the batch;
  - a refused ack gives `ERROR`;
  - the missing-handle `error` log line has an absolute `repo`;
  - the message carries Orca's guidance.
- Claude, Codex, Cursor, Copilot, Grok and OMP launch argv and stdout are
  byte-identical to `40ee718` for an absolute `--repo`.
- Use a scratch `HOME` for every stub run.

### H. Tiered checklist

**Behaviour.**

- **An argv stub row.** It dispatches every supported entry against a stub
  `orca`, with the candidate snapshot and the last release snapshot, and
  compares stdout and `worker-start` argv. Intended differences are named.
  A mutant that drops `--effort` must fail it. It stands in for the live
  worker row of every entry whose `harnesses.json` entry did not change.
- **The live worker row** runs for each entry that changed and for each
  harness upgrade that a deployment uses.
- **The Control row** runs:
  - once per wake mode (`background`, `waker`) when only wait or settle logic
    changed;
  - per harness when its entry changed, or when it upgraded and a deployment
    uses it as Control.
- **OMP rows 8 and 9** are a standing named skip while stablyai/orca#24068 is
  open.
- **Pi rows 13 to 16** join the Orca-upgrade rerun list.
- **The per-candidate harness list** is replaced by "every supported entry".
- **The release floor** is restated in these terms.

**Focused verification.**

- Run the argv stub row on `40ee718` against `3155c22`. It must pass, naming
  the intended differences: Antigravity `--model`, Pi new.
- Run it with the `--effort`-dropping mutant. It must fail.
- `git diff --check` and the disclosure greps.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| README rows match `harnesses.json` | Role-table gate on scratch copies | A gate that greps only `limits` passes a wrong mark | |
| `--ack` is Orca's one-call form | Stub `orca` call log | `--ack` parsed but not sent, so the batch replays | |
| Missing-handle error resolves `--repo` and keeps Orca's guidance | Stub, scratch `HOME` | Log line with a relative `repo` | |
| Launches unchanged | argv stub row against `40ee718` and `3155c22` | A mutant dropping `--effort` passes | |
| `limits` and README are true | Human-equivalent read against the sources | A caveat with no source | |
| Wait path still works live | Control row, background (Claude) and waker (Codex), Orca 1.4.218 | The live waiter replays or misses a batch | |
| Cursor and OMP as Control on the 0.23.0 helper | Control rows with Claude workers | The README marks ✓ but the row fails | |

**Cannot be observed:**

- Grok as Control (free-tier limit);
- OMP 18.4 workers (stablyai/orca#24068);
- whether a lexically matching `limits` is true.

## Stop conditions

- A `limits` sentence that a user needs has no source: report it rather than
  write it.
- A README row cannot be built from the data without a new field:
  `NEEDS_REPLAN`.
- A `notes` sentence has no home in the decision record and cannot stay
  short: report it.

## Closure gates

Every gate in `AGENTS.md`, including Task F's new gate.
