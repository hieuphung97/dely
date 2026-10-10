# Decisions

What has been settled, what is still open, and what was rejected and why.
Rationale is kept because the reasons are the reusable part.

Last updated 2026-10-10.

---

## Settled

### 2026-10-10 — Every dispatch file lives in its Run's folder under `.dely/local/runs/`, kept until the run closes

#### Context

Issue #69: a consumer project found 16 untracked dispatch files in its
repository root, written between 2026-09-09 and 2026-09-10 and left for a
month. Six came from two delivery runs (four and two handoffs and reviews),
ten from a chain of five read-only Spikes (five prompts, five handoffs). No
delivery prompt survived; every report did.

Read from 0.24.1:

- `SKILL.md` tells Control to write the prompt to an untracked file inside the
  worktree and delete it after the worker returns. The handoff "is a file in
  the worktree; its path travels as `payload.reportPath`". Nothing names who
  deletes a report, or when, and no Release step mentions dispatch files.
- A report cannot be deleted when its worker returns: Control routes on it, a
  review re-reads the implement handoff, and remediation goes back to the
  original parties. The only point where nothing reads it any more is the
  run's close, and no step exists there.
- A Spike "starts no delivery run" and the skill's description excludes it,
  so a Spike that dispatched Orca workers ran outside every rule here,
  including prompt deletion. Its reports were inputs to later Spikes in the
  same chain, so per-dispatch deletion would have been wrong too.
- `dely dispatch --spec-file` accepts any path; nothing names a default
  location, so Control chose the repository root, where the files show in
  `git status` and carry no owner.
- `dely log` writes the object Control passes; it has no field for files left
  behind, so the residue was invisible in maintenance logging.

#### Decision

1. Every dispatch file of a Run — the prompt Control writes and the handoff
   the prompt names — lives in `<repo>/.dely/local/runs/<run>/`, where `<run>`
   is the Orca Run id. It is still inside the worktree, so the reason for the
   2026-09-04 rule (no second permission surface, no prompt in a shell
   argument) holds.
2. `dely dispatch` refuses, with `REFUSED` and before any `worker-start`, a
   `--spec-file` whose resolved path is not inside that folder; the message
   names the folder. When `.dely/local/.gitignore` is absent the helper
   writes it with the single line `*`, the same file `dely:setup` writes; an
   existing file is never rewritten.
3. Dispatch files are kept until the run closes; the rule that deleted the
   prompt after its worker returned is withdrawn. At close — after release,
   or when the run stops early — Control deletes the Run's folder, then runs
   `dely log --run <run> --repo <path> --json '<object>'`.
4. `dely log` adds `residue`: the sorted repo-relative paths of every file
   still under that Run's folder, `[]` when the folder is absent or empty,
   `null` when no repository is known (`--repo` absent and no `repo` in the
   object). The log stays an observer: it deletes nothing, and without
   `~/.dely/` it writes and creates nothing.
5. A Spike that dispatches workers follows the same rule: its own Run, every
   dispatch through `dely dispatch`, its files in that Run's folder. A report
   a later dispatch of the same Spike reads stays there until the Spike
   reports its recommendation; then Control deletes the folder and runs
   `dely log`. A Spike still starts no delivery run. The skill's description
   says so, so a Spike that dispatches loads it.

This amends the 2026-09-04 record (decision four) and the portable launch
rule in the 2026-08-26 Antigravity record in place.

#### Alternatives considered

**Keep the location free and add only a close step.** Rejected: a Spike does
not load this skill, so a rule only in prose does not reach it; a refusal in
the helper reaches every Control that dispatches through it, and its message
teaches the path.

**Delete the handoff with the prompt when the worker returns.** Rejected:
routing, review and remediation read it later (issue #69, point two).

**A new subcommand that creates the folder and prints its path.** Rejected
as more interface than the gap needs: Control knows the Run id, and the
helper writes the ignore file at the first dispatch.

**Let `dely log` delete the folder.** Rejected: logging is opt-in on
`~/.dely/`, and cleanup must not be; an observer that deletes would also hide
the residue it is meant to show.

**`.tmp/dely/` or another project-chosen directory.** Rejected: one home per
Run is what makes the close step and the residue check mechanical; a
directory shared across runs cannot be deleted by one of them.

#### Consequences

- Breaking: a Control that writes prompts anywhere else is refused at
  dispatch, including the consumer mitigation in issue #69 (`.tmp/dely/`).
- Between Control writing the first prompt and the first dispatch, the file
  can show in `git status` when `.dely/local/.gitignore` does not exist yet.
- `git clean -fdx` deletes an open run's folder, as it deletes any ignored
  file.
- Not improved: the helper cannot make a worker write its handoff where the
  prompt says; `residue` sees only the Run's folder, not a stray file
  elsewhere. Off-protocol dispatch kinds and verdicts (issue #69, point six)
  are not addressed.

#### Non-goals

The `wait-bg --out` default in the system temporary directory. Cleaning up
consumer repositories. A retention policy for reports after close.

#### Deferred

Checking that a handoff landed inside the Run's folder. Trigger: a live row
or a consumer report shows a handoff written elsewhere under 0.25.0.

### 2026-10-05 — Pins live in `.dely/`, with a personal file that overrides the team's per phase

#### Context

Issue #62 asked for pins a person can set without committing them: a team uses
different harnesses and models, and the only place a pin could live was the
managed block in `AGENTS.md`, which every clone shares. That block was already
described as a deployment selection, not protocol, yet `setup`'s quick path
rewrote it with whichever harness ran setup, so two people on two harnesses
would rewrite the shared file back and forth.

Two further facts, read from 0.23.1:

- `skills/setup/SKILL.md` and the README promise that without pins Dely runs
  both roles on Control's harness with defaults. `pin()` in `dely.js` instead
  throws `no implement pin in AGENTS.md`, or fails reading a missing
  `AGENTS.md`, so the promised fallback never ran.
- The block is loaded into every session and every worker, because harnesses
  auto-load `AGENTS.md` (2026-09-06 record).

#### Decision

Pins are read from two optional JSON files in the repository:

```
.dely/pins.json            team pins, tracked
.dely/local/pins.json      personal pins, never tracked
.dely/local/.gitignore     contains *, so nothing under .dely/local is tracked
```

Each file is an object whose only keys are `implement` and `review`; each
value has exactly `harness` (an `id` from `harnesses.json`), `model` and
`effort`, all strings. Any other key, a missing field, an unknown harness, or
invalid JSON stops the helper with the file's path. A file may name one phase
or both.

Per phase, the first source that names it wins:

1. the personal file — `.dely/local/pins.json` in the worktree passed as
   `--repo`, or, when that worktree has none, in the main checkout. The main
   checkout is the parent of `git rev-parse --git-common-dir`, used only when
   that directory is named `.git`. One personal file is read, never both;
2. `.dely/pins.json` in that worktree;
3. Control's own harness, read from Orca's `agentIdentity` for the calling
   terminal, with Model and Effort `default`.

`dely pins --repo <path>` prints the resolved pin for each phase and its
source (`local`, `team` or `control`). Control runs it when it builds the
execution envelope and records the sources; `preflight` and `dispatch` use the
same resolver.

If `AGENTS.md` still contains `<!-- dely:begin -->`, the helper stops and says
the pins moved to `.dely/pins.json` and to run `dely:setup`. It does not read
the block. `AGENTS.md` keeps one routing line, which `setup` appends when it is
absent:

> Bounded or Architectural work invokes `dely:delivery`; Spike starts no
> delivery run.

`setup` asks whether a choice is for the team or only for this person and
writes the matching file. The managed block, its markers and its refusal cases
are gone. When `setup` finds an old block it offers to replace it with the
routing line and does so only on a yes.

This supersedes the 2026-09-16 Deferred item "A `~/.dely/config.json` for
anything the directory marker cannot express": per-person configuration lives
in the repository, not in the home directory.

#### Alternatives considered

**Keep the table in `AGENTS.md` and add a personal file beside it.** Rejected:
`setup` keeps editing a file people own, with markers and refusal cases, and
the table keeps riding into every worker's context.

**Read the old block as a fallback during a transition.** Rejected by the
owner. A loud stop replaces it, so an upgrade cannot silently move a project's
workers to Control's harness.

**Personal pins inside `.git/`.** Rejected: few tools keep user-edited
settings there, editors hide it, and Codex's workspace-write sandbox makes
`.git` read-only, so `setup` could not write the file from a sandboxed Codex
Control.

**One personal file in the home directory, keyed by project.** Rejected by the
owner, who wants every setting managed in its repository. It would also have
collided with `~/.dely/`, whose existence turns logging on.

**`AGENTS.local.md` or another `AGENTS.*` name.** Rejected: Codex reads
`AGENTS.override.md` instead of `AGENTS.md`, and a file in that family risks a
harness giving it a meaning of its own.

**Committed per-person files such as `.dely/pins/<email>.json`.** Rejected: it
commits preferences and email addresses, churns history, and fails for
outside contributors.

**Hooks to make sure Dely is invoked.** Rejected: a hook cannot decide whether
work is Spike, Bounded or Architectural; it can only inject the same sentence
`AGENTS.md` already carries, or block tools, which would also block Spikes,
Control's own plan and record writes, and the workers. Hook formats differ per
harness, some harnesses have none, and project hooks need trust that `setup`
never grants.

**Keep the markdown table format.** Rejected: a table parsed by regex accepts a
mistyped phase silently; JSON with fixed keys fails on it.

#### Consequences

- Breaking: a project with the old block stops at its first `dely` call until
  `setup` runs again or the block is replaced by hand.
- `git clean -fdx` deletes `.dely/local/`, as it deletes any ignored file.
- A personal file created by hand without `.dely/local/.gitignore` is not
  ignored; the README tells people to use `setup`.
- This repository keeps its own block until a follow-up delivery: the
  installed 0.23.1 helper that runs this delivery reads `AGENTS.md` for every
  dispatch, including the reviews.
- Not improved: a team that treats its review pin as policy cannot stop a
  person overriding it; the override is visible only in that person's
  envelope.

#### Non-goals

A home-directory configuration file. Per-worktree team pins. Merging two
personal files. Partial phase entries (a model without a harness). Hooks.

#### Verification, 2026-10-05

A separate Claude Code session (`claude-sonnet-5-5`, medium) ran
`probe/checklist.md` on a snapshot of `de8c6bd` with Orca 1.4.220, Claude Code
2.1.289 and Codex CLI 0.160.0, in the scope the owner chose. Report:
`~/dely-probe/checklist-pins-de8c6bd.md`; evidence
`~/dely-probe/live-pins-de8c6bd/`.

- Argv stub against `v0.23.1`, `DELY_NAMED_INTENDED` empty: the mutant
  dropping `--effort` failed, the candidate passed with no intended
  difference.
- Rejected-message stub and the new pin-resolution stub: every wrong copy
  failed on its row (nine for pin resolution), the candidate passed.
- Control row, `background`, Claude Code: Control ran `dely pins` first and
  recorded both phases from the team file; implement and review settled, the
  review accepted, and the pushed SHA equalled the reviewed head.
- Control row, `waker`, Codex CLI (`gpt-5.6-terra`, medium): the owner
  answered Codex's folder-trust dialog; every `wait_bg` was followed by
  `settled` before `notify`; the pushed SHA equalled the reviewed head; a
  blocking `wait` from the Codex Control's own terminal printed `REFUSED`.
- Setup, Quick path, "only for me", in a repository with no team pins:
  `.dely/local/pins.json` and `.dely/local/.gitignore` (`*`) were written,
  `git status --porcelain` was empty, no root `.gitignore` appeared, and
  `dely pins` reported both phases from `local`.

Not run, because the owner scoped the probe to stubs, Control rows and the
setup row: the live worker rows for Claude Code 2.1.289 and Codex CLI 0.160.0,
rows 4 to 7, and every OMP and Pi row. A personal pin was exercised live only
through `dely pins`, not through a dispatch; the pin-resolution stub covers
dispatch against a fake Orca.

#### Deferred

Moving this repository's own pins to `.dely/pins.json` and replacing its
block with the routing line. Trigger: 0.24.0 installed as the running plugin.
Done 2026-10-05: pins are in `.dely/pins.json` and `AGENTS.md` carries the
routing line.

A way for a team to forbid personal overrides of a phase. Trigger: a team asks
for it.

### 2026-10-05 — OMP's pin is unchecked while Orca reports no OMP status

#### Context

Measured on 2026-10-05 (evidence `~/dely-probe/omp-ready-1420/NOTES.md`):

- Orca 1.4.220 with OMP 18.6.1: `worker-start --agent omp` passed agent
  readiness in about 8 s, four of four. stablyai/orca#24068 is closed
  (PR #24295).
- Every OMP worker's `worker-show` projection had `liveness`
  `{verdict: unverifiable, reason: missing_status}` and no `provider`, pinned
  or not (stablyai/orca#24436; fix PR stablyai/orca#24196 is open).
- Dely 0.23.0 `dely dispatch` with an OMP pin `google-vertex/gemini-3.8-flash`
  `medium` printed `FAILED <id> pin not applied: expected
  google-vertex/gemini-3.8-flash, saw none`, although the OMP session log
  shows the extension applied the pin (`thinking_level_change` from `high` to
  `medium` before the first user message).
- `worker-start --agent omp --model …` is refused on 1.4.220 ("does not
  support launch-time model selection"); stablyai/orca#24796 (merged
  2026-10-03) is not in that release.
- `omp --model google-vertex/gemini-3.8-flash:low` started with thinking
  `low` (session log), so an effort can travel in the model name.

#### Decision

OMP's `modelPin` is `spec-unchecked`: the pin still travels as a spec line,
and dispatch skips the post-acknowledgement model check. The extension still
applies the pin and fails closed on a bad one. The README role row and the
checklist follow; the user checks the model in OMP's session log.

This amends the 2026-09-27 record's post-acknowledgement check and its
rejected alternative in the 2026-09-28 record, whose premise "Orca does
report the model" no longer holds. It supersedes the two OMP items in the
2026-09-27 Deferred list.

#### Alternatives considered

**Keep `spec` and wait for stablyai/orca#24196.** Rejected: every pinned OMP
dispatch fails today.

**Read OMP's session log from the helper.** Rejected: it puts a
harness-private file format in the helper.

#### Consequences

- No harness uses `spec` now; its check in `dely.js` stays dormant.
- An OMP worker that did not load the extension runs OMP's default unseen, as
  for Pi.

#### Verification, 2026-10-05

A separate Claude Code session ran `probe/checklist.md` on a snapshot of
`c7e96e4` (Orca 1.4.220, OMP 18.6.1), in the scope the owner chose: OMP rows
plus stubs. Report: `~/dely-probe/checklist-omp-c7e96e4.md`; raw evidence
`~/dely-probe/live-0231/`.

- The OMP install from the snapshot resolved to the linked package and passed
  the hash chain.
- The rejected-message stub passed (RED, LOG PASS, GREEN). The argv stub
  against `v0.23.0` passed with `DELY_NAMED_INTENDED` empty: `spec` and
  `spec-unchecked` launch the same argv.
- OMP parameterized worker row, pin `google-vertex/gemini-3.5-flash`
  `medium`: preflight PASS in 9 s; implement and review both `DISPATCHED`
  and settled with `worker_done`; the review returned `ACCEPT`. In both
  session logs the pinned model and level precede the first user message,
  and every assistant message ran the pinned model.
- Row 8, pin `google-vertex/gemini-3.5-flash` `low` (model and level both
  differ from the default): `DISPATCHED` without a model check; 19 of 19
  assistant messages ran the pin.
- Row 9, an unknown selector: `NO_ACK` quoting `DELY-PIN-FAIL`; OMP wrote no
  session for it.
- Row 10, Model `default`: no `dely-pin:` line in the first user message;
  the worker ran OMP's default.

Finding: `dely wait` returned `ATTENTION` 15 s after it started for a healthy
OMP worker (liveness `unverifiable` / `missing_status`, `nextAction` `none`,
`requiresAction` `true`), which settled about 20 s later. That is the
projection a killed worker shows (row 4 table), and the behaviour the
2026-09-28 record saw under Orca 1.4.215. The `limits` sentence "a crash is
noticed after about 10 minutes" was therefore replaced in `4d7d581` by "Dely
reports a working OMP worker as needing attention". `limits` and `notes` do
not change a launch, so no row reran.

Not run, because the owner scoped this delivery to OMP rows plus stubs: the
Claude Code and Codex CLI worker rows (upgraded to 2.1.289 and 0.160.0), the
Control rows per wake mode and for OMP and Pi, rows 4 to 7, and Pi rows 13 to
16 (Pi upgraded to 1.0.2). Row 11 did not run because neither `start()` nor
the extension changed. OMP crash timing on Orca 1.4.220 was not measured.

#### Deferred

Pinning OMP by flag. Trigger: an Orca release containing
stablyai/orca#24796. `modelFlag: true`, no `modelPin`, effort as
`<selector>:<level>` in the Model cell; then delete the `spec` mode and its
check from `dely.js`, `SKILL.md`, `skills/setup/SKILL.md` and the `modelPin`
gate. Pi keeps the extension.

Returning OMP to `spec`: only if a later decision keeps the spec pin and Orca
reports OMP's model again (stablyai/orca#24196).

Telling a live OMP worker from a dead one in `dely wait`. Trigger: an Orca
release containing stablyai/orca#24196, or a decision to read a signal other
than the projection; until then the projection cannot tell them apart.

### 2026-10-01 — README shows a role table derived from `harnesses.json`; `limits` are user caveats; the checklist runs rows by what changed

#### Context

An independent architecture review of PR #61 at `65a54b0`
(`~/dely-probe/arch-review/roles-architecture-review.md`) found no Blocking
issue and no regression. It found that the README rewrite of 2026-09-30:

- lost the logo, the usage video, the table of contents, "How Dely works",
  the Log section, and the invocation for Claude Code and Codex;
- showed protocol words ("Control wake") that a user cannot act on;
- paraphrased `limits` by hand, which had already drifted.

It also found three maintenance problems:

- `notes` repeat the decision record and hold two false Pi statements (both
  corrected in the 2026-09-28 section): a whitespace pin cell now fails closed,
  and with a `pi` key Pi loads only the extensions the key lists;
- the version rule ignores `harnesses.json`, `extensions/` and `package.json`,
  although the helper builds every launch from `harnesses.json`;
- the checklist floor (16 parameterized rows on any shared change) cannot be
  met in practice.

The owner said that a new user needs to know, per harness, which roles it can
take and what to watch out for. The owner chose to fix all of this before
merging PR #61.

#### Decision

- **`limits` is the one user-facing caveat per harness.** It is written in
  user words, and a sentence about one role starts "As Control," or "As a
  worker,". `setup` prints it. README copies it verbatim.
- **README's role table is derived, not hand-written.** For each harness the
  row is `| name | Control | Implementer | Reviewer | limits |`:
  - Control is ✗ when `status` is `deferred` or `controlWake` is
    `unsupported`; ⚠ when `limits` has a sentence starting "As Control,";
    otherwise ✓;
  - Implementer and Reviewer are ✗ when `deferred`; ⚠ when `limits` has a
    sentence starting "As a worker,"; otherwise ✓.

  A closure gate builds every row from `harnesses.json` and requires README to
  contain it exactly.
- **README follows the review's outline:**
  1. logo, video and contents;
  2. Quickstart;
  3. How Dely works, with what Control, implementer and reviewer are;
  4. the role table;
  5. Orca and Dely installs, with every harness's invocation;
  6. choosing models;
  7. Log;
  8. troubleshooting.
- **`notes` keep only why a field has its value,** with the date of the
  decision section that measured it. History moves to, or stays in, this
  record. A sentence is removed only when this record already holds it. This
  supersedes earlier sections that say a measurement goes into an entry's
  `notes`.
- **The version rule also covers `harnesses.json`, `extensions/` and
  `package.json`.**
- **The helper:**
  - passes `--ack` on its first `check --wait` (Orca's one-call form);
  - resolves `--repo` before the handle check;
  - adds Orca's own guidance to the missing-handle error.

  `SKILL.md` says that a spec line must not start `dely-pin:`, and what to do
  when `--ack` returns `ERROR`.
- **The checklist runs rows by what changed:**
  - an argv stub row compares `dispatch` and `preflight` launches with the
    newest release tag, with the pin built from both snapshots' capabilities,
    pinned, `default`, and Effort-only for entries that take an effort. It
    stands in for the live worker rows of entries
    whose launch fields did not change. Its list of intended differences is
    written from this record before it runs, never from its output;
  - an entry changes when a launch field changes; `limits` and `notes` do
    not count;
  - Control rows run once per wake mode (Claude Code for `background`, Codex
    CLI for `waker`) whenever wait, settle, acknowledgement or `notify` logic
    or the `SKILL.md` Control text changes. They also run per harness when
    its entry changes, or when it upgrades and a deployment uses it as
    Control;
  - an Orca upgrade reruns the live worker row for each harness a deployment
    uses, the Control row per wake mode, rows 4 and 5, and Pi rows 13 to 16;
  - OMP rows 8 to 10 and the OMP worker row are a standing named skip while
    stablyai/orca#24068 is open.

#### Alternatives considered

**A `roles` object in `harnesses.json`.** Rejected again: `status`,
`controlWake` and role-prefixed `limits` carry every mark the table needs.

**A README generator.** Rejected: the repository has no build step. A gate in
the existing lexical style catches the same drift.

**Keeping the 16-row floor.** Rejected: the 40ee718 run took 3 h 40 min in a
narrowed scope and still had blocked rows. A floor no release meets is
skipped by name every time.

#### Consequences

A user picks harnesses per role from one table whose marks cannot drift from
the data. Adding a harness touches one entry and its README install block;
the row follows from the entry. `limits` sentences are now part of the
public README, so they must stay short and actionable. The gate proves that
README matches the data, not that the data is true.

#### Non-goals

- Changing how a rejected-only batch is surfaced.
- `start()` for a Pi entry with `modelFlag: true`.
- Filtering Antigravity's discovery.
- Re-measuring Grok as Control, which needs a paid account.

#### Verification, 2026-10-01

The live checklist ran on `20490dc` under Orca 1.4.218, in the scope the
tiering rules give this candidate: Orca was upgraded, wait logic changed, and
Cursor and OMP had not been checked as Control on a 0.23.0 helper. Report:
`~/dely-probe/checklist-readme-20490dc.md`.

- **Passed:**
  - installs and hashes for Claude Code, Codex, OMP and Pi;
  - the Orca-rejected message stub row;
  - the argv stub row against `v0.22.0`, whose intended differences equal
    the list written from this record (Antigravity `--model`, Pi new);
  - the argv stub row against `40ee718`, with no difference, so worker
    launches did not change since the previous live run;
  - implementer and reviewer for Cursor and Claude Code;
  - Control for Claude Code and Cursor (background) and for Codex and OMP
    18.4.8 (waker), with the `REFUSED` checks;
  - row 4 under a waker Control, row 5, and Pi rows 13, 14 and 15.
- **Passed after a failed attempt:**
  - row 4 under a background Control: on the first attempt, Control read
    the killed worker's screen as alive and did not redispatch; the second
    attempt passed;
  - the OMP Control and Pi row 13, blocked first by Google Vertex errors
    (429, then 403 billing).
- **Partial: Pi row 16.** The helper reported `ATTENTION` 15 s after the
  kill. A redispatched Pi worker did not acknowledge within 60 s while Vertex
  was slow, so the end-to-end row was not observed.
- **Observed, not changed:**
  - Claude, Codex and Cursor Controls acknowledged a settled batch with a
    separate `orca orchestration check --ack` before dispatching the
    review, instead of passing it to the next wait. Both forms are accepted,
    and no batch replayed. The one-call `--ack` form worked from the observer
    and from the OMP Control;
  - Claude and OMP Controls did not release settled workers, as a Pi
    Control did on 2026-09-30;
  - Orca 1.4.218 reports an unanswered Claude trust dialog as
    `agent_readiness` in 20 s, where 1.4.217 took 58 s.
- **Not run, with reasons:**
  - **Live worker rows for Copilot, Antigravity, Grok and Pi.** Their entries
    changed against `v0.22.0`. They passed live on `40ee718` (Pi as
    implementer in rows 13 and 16, not as reviewer). The argv stub against
    `40ee718` shows no launch difference since then. The Orca 1.4.218
    upgrade reruns the deployment harnesses and Pi rows 13 to 16, so
    Copilot, Antigravity and Grok are not re-verified against Orca 1.4.218,
    and Pi only as implementer; the checklist names that gap.
  - **Control rows for Copilot, Antigravity and Pi.** Their entries changed,
    and they passed as Control on `40ee718`. The wait change since then is
    covered by the per-wake-mode Control rows on `20490dc`: Claude and Cursor
    for `background`, Codex and OMP for `waker`. Owner's scope. Grok's
    Control row is under Deferred.
  - **OMP rows 8 to 10 and the OMP worker row:** standing skip while
    stablyai/orca#24068 is open.
  - **Kiro:** `deferred`.
  - **Rows 6, 7 and 11:** by the owner's scope. Row 6 last ran live on
    `40ee718`, before this delivery changed the `wait` loop's acknowledgement.
    The `STALLED` path itself did not change.
- **Open, recorded here:**
  - Controls of several harnesses (Pi, Claude, OMP) leave settled workers
    unreleased. This is probably `SKILL.md`'s completion accounting, not a
    harness limit, though only Pi's `limits` says so;
  - the role-table gate does not enforce row order;
  - there is no OMP row for a level the model does not offer (row 15 is
    Pi-only);
  - the argv stub's unexpected-difference lines carry no mode, and the
    routed live worker row runs only the pinned mode, so the recorded line is
    the only signal for a `default` or Effort-only difference. An intended
    `effortFlag` change cannot pass the row, which fails safe;
  - a `waitInterrupted` result after a combined `--ack` ends in the same
    `ERROR` as before, one call later.

#### Deferred

Grok as Control on the 0.23.0 helper. Trigger: a Grok account without the
free-tier limit.

Workers left unreleased by Controls. Trigger: the next delivery that touches
`SKILL.md`'s completion accounting.

---

### 2026-09-30 — Each harness states what it can do per role, with limits; Copilot, Antigravity and Grok are supported

#### Context

The question "which harness can be Control, implementer or reviewer" had no
honest answer in the package. `status` said `supported` for Pi, whose Control
kills its own helper under a model-chosen timeout, and `deferred` for three
harnesses whose last measurement was a month and several releases old.

**Measurement, 2026-09-29, Orca 1.4.215.** Two probe sessions measured every
harness in every role. The reports are
`~/dely-probe/role-spike/A-report.md` (Copilot, Antigravity, Grok, Kiro) and
`~/dely-probe/role-spike/B-report.md` (OMP and Pi as reviewer, Claude Code's
Bash timeout, Codex and Cursor as Control). Per role, n = 1:

- Copilot CLI 1.0.89 (it self-updated from 1.0.83 during the run): Control by
  background wake worked. As implementer and reviewer it worked once the
  path was trusted. Its trust dialog is not detected by Orca, which accepts the
  input, so the helper sees only `NO_ACK` after 60 s; 2 of 7 launches left the
  prompt unsent. Orca refuses `--model`.
- Antigravity CLI 1.2.13: Control by waker worked. As implementer and reviewer
  it worked, but the first launch on a new path lost the prompt 3 of 4 times
  (0 of 6 once trusted). Orca now accepts `--model` for it; `--effort` is
  rejected or silently drops the pin.
- Grok Build 1.0.44: Control by waker worked with no model request during the
  wait. As implementer and reviewer it worked after one trust answer per path;
  1.0.44 asks in every repository that has an `AGENTS.md`, and Orca detects the
  dialog within about 2 s. Orca refuses `--model`.
- Kiro CLI 2.21.0: a worker never became ready in Orca (3 of 3); Control by
  `wait-bg` worked once, but only with a global confirmation setting whose
  default exits.
- Codex CLI 0.157.1 as Control: the wake worked (1 request per wait), but its
  tool shell had no `ORCA_TERMINAL_HANDLE`, so the helper failed until the
  model found its own handle. Not re-measured on 0.159.1.
- Claude Code as Control: a long command moved to the background instead of
  being killed, and `dely preflight` completed.
- OMP and Pi as reviewer: both found a planted defect.

Killed Copilot, Antigravity and Grok workers reached `attention.requiresAction`
within 1.5 s. The same probes found two helper defects that apply to every
harness: an Orca-rejected heartbeat counted as the acknowledgement, and an
Orca-rejected `worker_done` settled a wait (a Cursor Control released a live
worker on it).

**Real use, `~/.dely/log.jsonl`**, counting only Runs in the owner's
repositories and dropping stub lines (a design review corrected Control's
first counts):

- 37 Runs.
- Implementer: Cursor about 211. Reviewers: Cursor about 133, Codex about 92,
  Claude 12. OMP implemented 7 times, all in this repository. Pi: none.
- Every real Control waited in the background.
- Six batches settled twice because they were never acknowledged.
- Real `preflight` failures: a wait already active on the Run (4), the Run
  bound to another terminal (4), a relative `--repo` (2), and a shell startup
  prompt (oh-my-zsh) holding a Cursor worker (2).

**A design review** (`~/dely-probe/arch-review/refactor-design-review.md`)
rejected the first proposal, a `roles` object with per-role statuses, as a
re-encoding of fields that already exist.

#### Decision

The schema keeps `status` (whether a harness is offered as a worker) and
`controlWake` (how it can be Control, or `unsupported`). An entry may carry
`limits`, one short sentence of what a user must know, which `setup` prints
next to the harness it offers. The values are:

- **Copilot CLI:** supported, `controlWake: background`.
- **Antigravity CLI:** supported, `controlWake: waker`, `modelFlag: true`,
  `effortFlag: false`, discovery `agy models`.
- **Grok Build:** supported, `controlWake: waker`.
- **Kiro CLI:** stays `deferred`, because a worker never becomes ready;
  `controlWake` becomes `waker`, as measured.

Each of the first three carries its launch limits. Existing entries gain
limits too:

- Codex: as Control it can start the next helper command before the last one
  ends, and its 0.157.1 shell lacked the terminal handle.
- Pi: its Control must run the helper without a tool timeout, and its pin is
  unchecked.
- OMP: a dead worker surfaces only at `STALLED`, and OMP 18.4.4 workers did
  not start on Orca 1.4.217.
- Cursor: no effort pin.

The helper:

- ignores messages Orca rejected when it looks for an acknowledgement or a
  settling message;
- takes `--ack <deliveryId>` on `wait` and `wait-bg`, to acknowledge the
  previous batch the way Orca does, instead of acknowledging by itself;
- checks for `ORCA_TERMINAL_HANDLE` before it dispatches;
- adds a one-line hint to Orca's "bound to another terminal" and "active
  waiter" errors;
- records the `dispatchId` of a settling message and the Control harness of a
  wait.

The pin extension stops the worker when it cannot apply a pin, including a
`setModel` that throws and a `dely-pin:` line it cannot parse. `SKILL.md`
tells Control to run the helper with no tool timeout and to pass the settled
id to its next wait. A gate checks the enumerated values in `harnesses.json`.

#### Alternatives considered

**A `roles` object with `supported`/`limited`/`unsupported` per role.**
Rejected: `status` and `controlWake` already hold both axes; no consumer
would branch on `limited`; implementer and reviewer never differed in any
measurement or code path.

**Refusing a dispatch or a wait for an unsupported role in the helper.**
Rejected: Orca's own readiness gate already fails a worker that cannot start,
and a hand-kept refusal would outlive the harness's fix and block
re-measuring.

**`wait` acknowledging by itself.** Rejected: it reverses Orca's documented
process-then-acknowledge order; `--ack` on the next wait is Orca's own idiom.

**A fixed log schema with an outcome enum.** Rejected: Orca's own dispatch
record holds agent, model and outcome; only the `dispatchId` and the Control
harness were missing.

**Leaving Copilot, Antigravity and Grok deferred.** Rejected by the owner:
each worked in every role it was measured in, and its limits can be stated.

#### Consequences

A user reading `setup` or README sees what each harness can do and what it
costs. Three more harnesses are supported on one measurement per role, and
all three self-update often; their `notes` name the measured versions, and
their live rows run when their entry or the shared launch code changes.

Kiro stays out, and its Control result is recorded, not offered.

#### Verification, 2026-09-30

The live checklist ran on `40ee718` under Orca 1.4.217, in a scope the owner
chose, narrower than the checklist's release floor. Report:
`~/dely-probe/checklist-roles-40ee718.md`.

- **Passed:**
  - installs and hashes for Claude Code, Codex, Copilot, Antigravity, Grok,
    OMP and Pi, and the README install, verify, update and remove commands for
    Copilot, Antigravity and Grok;
  - the Orca-rejected message stub row;
  - implementer and reviewer for Claude Code, Codex 0.159.2, Cursor, Copilot,
    Antigravity and Grok;
  - Control for Claude Code, Copilot (background), Codex, Antigravity and Pi
    0.99.1 (waker), each with the `REFUSED` check where it applies;
  - row 4 under a background and a waker Control, rows 5 and 6, rows 11 and
    13 to 16.
- **Passed after failed attempts:**
  - Copilot's worker passed on its third attempt. Copilot 1.0.89 shows an app
    promo at launch that Orca does not detect, and the pasted prompt was left
    unsent twice; after a human answered "No, thanks" once, it did not return.
  - Antigravity passed on its third preflight on a new path, which is its
    stated limit.
- **Partial:** row 7. The trust loop completed, but a Codex Control ran
  `dely dispatch` while `dely preflight` was still running (its tool call
  yields after 30 s). That is now Codex's Control limit.
- **Blocked outside Dely:**
  - Grok as Control stopped on Grok's free usage limit twice, so its waker
    path was not re-measured on this candidate.
  - OMP self-updated to 18.4.4. Orca 1.4.217 did not see an OMP 18.4.4 worker
    as ready in four attempts (stablyai/orca#24068 gives the cause), so OMP pin
    rows 8 to 10 and the OMP parameterized worker row could not run. That is
    now OMP's limit.
- **Not run, by the owner's choice:** Control rows for Cursor, OMP and Kiro,
  and the parameterized worker row for Pi. Pi as implementer ran in rows 13
  and 16; Pi as reviewer was not exercised on this candidate.
  Cursor's launch argv is byte-identical to 0.22.0 in stub comparisons, this
  delivery's helper commits leave OMP's argv unchanged, and each wake mode was
  exercised by another harness.
- **Observed but not changed:** a Pi Control never ran `worker-release`.
- **Accepted as not met:** the hint for Orca's "active actionable waiter"
  error states that a `dely wait` for the Run is still running, rather than
  naming a command; the design review proposed the same condition.
- **Open, recorded here:**
  - the `rejected` log event lists every message of the batch without marking
    the rejected ones;
  - `agy models` still offers `gemini-3-flash-preview`, which failed to
    acknowledge in the Spike;
  - Codex 0.159.1's "Update available" screen matches Orca's
    blocking-dialog pattern;
  - `setup` has no route for a preflight `ERROR`;
  - a missing-handle `error` log line records `--repo` unresolved, because the
    handle check runs before the path is resolved.

#### Deferred

A Kiro worker. Trigger: an Orca release in which `worker-start --agent kiro`
becomes ready.

A pinned Copilot or Grok worker. Trigger: an Orca release whose
`worker-start` accepts `--model` for them.

OMP 18.4 workers and OMP pin rows 8 to 10. Trigger: an Orca release that
closes stablyai/orca#24068.

Grok as Control on this candidate's helper. Trigger: a Grok account without
the free-tier limit.

### 2026-09-28 — Pi is a supported harness and shares OMP's package and pin extension

#### Context

Pi (`pi-coding-agent`) 0.87.1 was measured under Orca 1.4.215 on 2026-09-28,
in fresh git roots under `~/dely-probe/`, as a worker and as Control, with
Dely 0.22.0 installed. OMP is a fork of Pi, and Orca's own status extension
for both says they "expose the same extension API".

**Orca launches Pi but cannot pin or observe its model.**
`worker-start --agent pi --model …` is refused ("Agent pi does not support
launch-time model selection"): Orca's model-capability map has no `pi` entry
at all. For a Pi worker, `worker-show` reports `projection.provider` as
`{"id":"pi","model":null}`, because Orca's status extension adds the model to
its posts only for OMP. `worker-read` has no transcript for Pi
(`provider_unsupported`); it falls back to the terminal.

**Worker.** Orca launches bare `pi`. A worker acknowledged 12 s after start,
wrote a file without an approval prompt (Pi has no approval step), and sent
`worker_done`. Killing its process turned `attention.requiresAction` true
within 3 s, so `dely wait` reaches `ATTENTION` for Pi, which it does not for
OMP.

**Trust.** Pi asks "Trust project folder?", with Trust preselected, only when
the working directory or an ancestor holds `.pi/settings.json`,
`.pi/extensions`, `.pi/skills`, `.pi/prompts`, `.pi/themes`, `.pi/SYSTEM.md`
or a project `.agents/skills`. A fresh repository with none of these started
without a dialog. Orca delivers Pi's prompt on the command line, so a worker
held by the dialog never acknowledges.

**Package.** A root `package.json` with a `pi` key declaring `extensions`
and `skills` is loaded by Pi (`pi install <path>` or
`pi install git:github.com/<owner>/<repo>@<ref>`, which clones that ref under
`~/.pi/agent/git/`) and, measured the same day, by OMP, which reads
`omp ?? pi`. With only the `omp` key that 0.22.0 ships, Pi loads the skills
from `skills/` by convention but not the extension. Pi also loads a package's
`extensions/` directory by convention, whatever the manifest key says (found
by the task review). Pi therefore loads the extension from the `pi` key and
also, whatever the key, from `extensions/`; the 0.22.0 layout (`omp` key,
`omp/dely-pin.ts`) gives Pi neither. OMP needs the key: without an `omp` or
`pi` key it treats the package as no plugin at all.
Corrected 2026-10-01: with a `pi` key, Pi loads only the extensions that key
lists ("a manifest, when present, is used exclusively"); it falls back to
`extensions/` by convention only when there is no key. The Pi architecture
review's resolver run showed this.

**The pin extension fails every Pi pin that names an effort.** Inside Pi a
registry model describes its levels as `thinkingLevelMap`
(`{off: null, minimal: "minimal", …, max: null}`), a third shape after OMP's
`thinking.efforts` and the array `omp models --json` prints. The 0.22.0
extension checks only the other two, and printed `DELY-PIN-FAIL` for the valid
pin `google-vertex/gemini-3.5-flash low`. On both Pi and OMP, calling
`setThinkingLevel(level)` and reading `getThinkingLevel()` back returned the
requested level when the model offers it and something else when it does not:
`max` came back as `high` on both, and an unknown level as `minimal` on Pi and
as nothing on OMP.

**Control.** Pi has no background job that ends a turn and wakes it; asked to
run one, the model used `nohup … &`, and nothing woke it when the job ended. A
full `dely wait-bg --control pi` cycle with an OMP worker settled, and Pi
processed the wake. Pi's bash tool runs a command under a timeout the model
chooses: Pi Controls in the live checklist chose 10 s, 20 s and 30 s, and in 2
of 6 Control sessions that timeout killed the helper mid-command (found by
the integration review). It killed `dely preflight` twice and a review
`dely dispatch` once in one session, leaving unreleased preflight workers
whose stale `worker_done` then settled the next `wait-bg` at once; in the
other it killed an implement `dely dispatch` during its 60 s acknowledgement
wait, so that dispatch wrote no `dispatch`, `NO_ACK` or stop event.

**Discovery.** `pi --list-models` prints a table (`provider`, `model`, …),
not JSON. `pi --help` lists the `--thinking` levels.

#### Decision

Pi is `supported` in `harnesses.json` under id `pi`, as worker and as Control:
`controlWake: waker`, `trust: dialog`, `modelFlag: false`,
`effortFlag: false`, `modelPin: spec-unchecked`, `permissionDefault: none`,
and discovery by two commands whose output is already the catalogue:
`pi --list-models` reduced to `<provider>/<model>` lines, and the `--thinking`
levels read from `pi --help`.

`modelPin: spec-unchecked` carries the pin exactly as `spec` does, a
`dely-pin:` line in the spec applied by the shipped extension, but
`dely dispatch` skips the post-acknowledgement check of
`projection.provider.model`, because Orca does not report Pi's model. OMP
keeps `spec` and the check. No other harness names `modelPin`.

One package serves both. The root `package.json` declares the extension and
the skills under `pi`, which OMP also reads, and the extension moves from
`omp/dely-pin.ts` to `extensions/dely-pin.ts`. The extension no longer reads a
harness's registry shape for levels: it sets the level, reads it back, and
fails the same way on a mismatch as on an unknown selector.

Pi installs from a tag with `pi install git:github.com/hieuphung97/dely@v<version>`.

`dely` resolves `--repo` to an absolute path before any use. Live row 17 on
the first candidate failed because a Pi Control passed `--repo .` and the
helper handed Orca the selector `path:.`, which Orca cannot match; the defect
predated Pi and applied to every Control. The path is normalized lexically
with `path.resolve`, without resolving symlinks: a canonical absolute path,
such as `$(pwd)` prints, reaches Orca unchanged, while a trailing slash or a
`.` or `..` segment is collapsed, and `--repo .` yields the working
directory's physical path.

This amends the 2026-09-27 OMP record's package key, extension path and level
check; its reasoning stands.

#### Alternatives considered

**Treat a present provider with a null model as unverifiable for every
`modelPin` harness.** Rejected: it would weaken the check that was reviewed
and measured for OMP, where Orca does report the model.

**Leave Pi unpinned until Orca supports it.** Rejected: pinning works now and
fails closed on a bad pin; only the missing-extension case is unseen.

**Add a third registry shape to the extension.** Rejected: the read-back is
shape-agnostic and removes code; a fourth shape would need another branch.

**A discovery field that joins table columns.** Rejected: `discovery.models`
is already a command, so a pipeline yields selectors with no schema change.

**A second `package.json` key, or a Pi-only package.** Rejected: OMP reads the
`pi` key, so one manifest is enough.

#### Consequences

A project can pin Pi's model and effort per phase. A bad selector or level
stops the worker before its first request and surfaces as `NO_ACK`.

**If Pi does not load the extension, a pinned Pi worker runs its own default
and nothing reports it.** OMP catches this case through Orca's projection; Pi
cannot until Orca reports its model.

A repository with `.pi/` resources or `.agents/skills` holds a Pi worker at
Pi's trust dialog until a human opens Pi there once.

A dead Pi worker is seen by `ATTENTION`. A stuck but live one is seen only by
`DEADLINE`, because Orca has no Pi transcript for `STALLED` to read.

**A Pi Control can kill its own helper.** When the model gives `dely dispatch`
or `dely preflight` a bash timeout shorter than the helper needs (`ACK_S`,
60 s, plus the pin check for `dispatch`; `PREFLIGHT_S`, 150 s, for
`preflight`), the helper dies without recording or cleaning up. A dispatch of
an OMP worker killed that way also skips OMP's post-acknowledgement pin check.
This decision does not guard against it; the Control must not run the helper
under such a timeout.

A Model or Effort cell that contains whitespace yields a pin line the
extension does not recognize, so no pin applies. OMP's projection check
catches this; on Pi the worker runs its default unseen. `setup` writes
discovered tokens, which contain no whitespace, so only a hand edit reaches
it. Corrected 2026-10-01: the extension now stops on any `dely-pin:` line it
cannot parse, so such a cell fails closed on Pi too.

Pi rows join the live checklist. They run when `start()`, the extension or the
`pi` entry changes, and after a Pi upgrade; the release floor stays ten rows.

**Live verification, on Pi 0.87.1, OMP 18.3.4 and Orca 1.4.215.** On a
snapshot of `c436785`: the OMP and Pi install checks passed; OMP rows 8 to 11
passed (row 8's projection held the pin 6.2 s before the acknowledgement, and
with the extension disabled the dispatch printed `FAILED … pin not applied`);
Pi rows 13 to 16 passed (every request of row 13 ran the pinned
`google-vertex/gemini-3.5-flash` `low`, rows 14 and 15 stopped at `NO_ACK`
quoting `DELY-PIN-FAIL` with no request, and a killed Pi worker reached
`ATTENTION` 0.2 s after the kill); row 17 failed on the relative `--repo`
described above. After the helper fix, row 17 ran again on a snapshot of
`5fecbc1` and passed in both Runs, with no `error` event and every `dispatch`
recording an absolute `repo` (see below). Rows 1 to 7 and 12 were not run: Claude Code,
Codex CLI and Cursor Agent CLI launch byte-identical to 0.22.0 for an absolute
`--repo`, which task reviews reproduced against a 0.22.0 snapshot, and row 12
(OMP as Control) runs `dispatch`, `preflight` and `log`, whose only change is
that an absolute `--repo` passes unchanged and a relative one now works, while
`start()` and the pin check are unchanged for `spec` harnesses. In row 17's
first Run on `5fecbc1`, the Pi Control's 30 s bash timeout killed the
implement `dely dispatch`, so that dispatch recorded nothing; the review
dispatch and both of the second Run's dispatches recorded an absolute `repo`.

Under Orca 1.4.215, `dely wait` reported `ATTENTION` with `missing_status`
three times for OMP workers that were alive and working (Run
`run_e7119838e66e`: 13:45:29Z, 15:34:02Z and 00:05:28Z), and once `STALLED`
(15:21:35Z), whose printed reason was `transcript_parse_failed` while the log
line records only `idleMinutes: 10`. Control confirmed the process and its output each
time and waited again with `--skip`. This decision does not change that.

#### Non-goals

Verifying a Pi worker's model without Orca's help. A background-wake Pi
Control. Detecting a stuck Pi worker before `DEADLINE`.

#### Deferred

`modelPin: spec` for Pi, then `modelFlag: true`. Trigger: an Orca release
that reports Pi's model in `projection.provider.model`, then one whose
`worker-start --agent pi` accepts `--model`. Requested on
[stablyai/orca#23388](https://github.com/stablyai/orca/issues/23388#issuecomment-5871097741).

### 2026-09-27 — OMP is a supported harness, and its model pin travels in the spec

#### Context

OMP (Oh My Pi) 18.3.3 was measured under Orca 1.4.212 on 2026-09-27, in a
fresh git root under `~/dely-probe/`, as a worker and as Control. The
installed Dely was 0.20.1.

**Orca already knows OMP.** Its agent id is `omp`, and a terminal running it
reports `agentIdentity: "omp"`. Orca launches it as
`omp --extension ~/.omp/agent/extensions/orca-agent-status.ts --config <orca>/omp-managed-status-extension/fresh-session.yml`,
with no approval flag. OMP's own `tools.approvalMode` defaults to `yolo`.

**Worker.** A worker started by `worker-start --agent omp` showed no trust
dialog, received its prompt, wrote a file without an approval prompt, sent the
`ack` heartbeat 23 s after start, and sent `worker_done --outcome succeeded`.
Orca reads OMP's own transcript (`worker-read` source `transcript`, provider
`omp`).

**A killed worker stays live.** After `kill -9` of the OMP process, Orca kept
`liveness.verdict` at `live` (source `agent_status`), `nextAction` at `none`
and `attention.requiresAction` at `false` for at least six minutes. The other
supported harnesses flip `requiresAction` to `true`
(2026-09-16 record). `dely wait` reads that transcript, so a dead OMP worker
reaches `STALLED` after `--stall-min`, not `ATTENTION`; this is read from the
helper's code, not observed.

**Control.** OMP's bash tool runs a command as an `async` job, ends the turn,
and starts a new turn when the job exits: no model request was made during a
5 min 17 s wait. A job's timeout defaults to 300 s and accepts at most
3600 s, which is exactly `dely wait`'s default 60 min. An idle OMP session also
starts a turn from `orca terminal send`, and a full 0.20.1 `dely wait-bg`
cycle with a Claude Code worker settled end to end with an OMP Control.

**The model cannot be pinned the way the other harnesses pin it.**
`worker-start --agent omp --model …` is refused: "Agent omp does not support
launch-time model selection". Orca's own new-tab picker applies `--model` to
OMP; only orchestration refuses it. Four other routes were measured or
examined:

- A project `.omp/config.yml` with `modelRoles.default: <selector>:<thinking>`
  is honoured by an Orca-launched worker. It is a file in the user's
  repository, shared by both phases. An invalid selector there is silent:
  the worker ran the model of the most recent OMP session, and the session
  recorded `resolvedModelIsFallback: false`.
- Orca's per-agent default arguments and OMP's global
  `~/.omp/agent/config.yml` change every OMP session on the machine,
  including the user's own, and cannot differ by phase.
- Orca installs a `/orca-model` command into OMP, but the prompt is already
  submitted when the worker starts, so the first requests would run on the
  wrong model.
- An OMP extension on `before_agent_start` that reads a `dely-pin:` line from
  the prompt and calls `setModel` and `setThinkingLevel` switched the model
  before the first request: every request ran on the pinned model, and Orca's
  `projection.provider.model` reported it. On an invalid selector, a `throw`
  from the handler is swallowed and the turn runs on the default model;
  `ctx.shutdown()` lets the turn finish, `worker_done` included, before
  closing; only `process.exit` stopped the worker before its first request,
  with no heartbeat, leaving its message on the terminal.

**How the extension reaches OMP.** OMP installs a Claude-format marketplace
plugin and loads its `skills/`, but loads a plugin's `tools/*.ts` as custom
tools, whose API has no `on` or `setModel`. OMP's own package format, a
`package.json` with `omp.extensions` and `omp.skills`, installed by
`omp plugin install <path>`, loaded both the extension with the full API and
the skills. A local path is installed as a symlink. Uninstalling it needs
`bun` on PATH, and so, presumably, does installing from a git URL; neither was
measured with `bun` present.

#### Decision

OMP is `supported` in `harnesses.json` under id `omp`, as worker and as
Control. Its entry carries `controlWake: waker`, `trust: none`,
`modelFlag: false`, `effortFlag: false`, `modelPin: spec`,
`permissionDefault: --approval-mode yolo`, and discovery from
`omp models --json`, offering each model's `selector` and its `thinking`
levels.

`modelPin: spec` means the pin travels in the dispatch spec. When the pinned
Model is not `default`, `dely dispatch` appends one line,
`dely-pin: <selector>` or `dely-pin: <selector>:<effort>`. An Effort pinned
with Model `default` is refused, as `effortRequiresModel` already refuses it
for a flag. With Model `default`, no line is written and OMP's own default
applies.

The package ships `omp/dely-pin.ts`, declared by a root `package.json` under
`omp.extensions` next to `omp.skills`. The extension acts only on the first
agent start of a session, and only on a line that begins with `dely-pin:`. A
selector OMP does not offer, or a model it cannot switch to, prints a line
beginning `DELY-PIN-FAIL` and exits the process, so the dispatch surfaces as
`NO_ACK` quoting that line.

Amended 2026-09-28 (see the Pi record above): the extension is now
`extensions/dely-pin.ts`, declared under the `pi` key that OMP also reads, and
it checks a level by setting it and reading it back rather than by reading
OMP's registry shape.

OMP is installed from a local checkout with `omp plugin install <path>`, not
from the `dely` marketplace.

This amends the 2026-09-16 record that dropped the code for harnesses Dely
cannot support: Dely again ships code for one harness. It is data-driven in
the helper (`modelPin` in `harnesses.json`, not a test of the harness id) and
confined to one file the other harnesses never load.

**Amended the same day, after an independent architecture review of the
candidate.** The review found no defect for Claude Code, Codex CLI or Cursor
Agent CLI (their `worker-start` argv and output byte-identical to 0.20.1 in
every reproduced case) and eight gaps for OMP. The pin, as first built, was
applied by the first `dely-pin:` line in the prompt, so a line inside a spec
overrode the `AGENTS.md` pin silently; and when the extension was not loaded
at all the pin line was ignored and nothing noticed. Both are closed by one
check rather than two mechanisms:

- The pin line is `dely-pin: <selector>` or `dely-pin: <selector> <effort>`,
  split on whitespace, so a model id that contains `:` is not mistaken for an
  effort. The extension applies the **last** such line; the helper's line is
  always last.
- After the worker acknowledges, `dely dispatch` reads `worker-show`
  `projection.provider.model` for a `modelPin: spec` dispatch with a pinned
  Model. If it is not the pinned selector, or Orca reports none, the helper
  stops and releases the worker and prints `FAILED`, which the skill already
  routes. Harnesses without `modelPin` never reach this check.

`permissionDefault` for OMP is `none`: Orca passes no approval flag to `omp`,
and an OMP worker's approvals follow the user's `tools.approvalMode`. The root
`package.json` is a third version string and is gated with the two manifests,
and it must not set `type`, because `dely.js` is CommonJS and resolves its
module type from that file.

#### Alternatives considered

**Pin through a project `.omp/config.yml`.** Rejected: it writes a harness
store into the user's repository, both phases share it, and a mistyped
selector runs another model silently.

**Pin through Orca's per-agent default arguments or OMP's global config.**
Rejected: they change the user's own OMP sessions, cannot differ by phase,
and Orca's setting has no CLI.

**Send `/orca-model` to the worker after it starts.** Rejected: the prompt is
already running, so the first requests use the wrong model.

**Leave the model unpinned, as for a harness without `--model`.** Rejected:
the user asked for a pin, and an unpinned worker is an environment that
changes without announcing itself.

**Fail the extension with `throw` or `ctx.shutdown()`.** Rejected by
measurement: both let the worker run on the default model.

**`controlWake: background`.** Rejected for now: the mechanism works, but an
OMP background job is killed at 3600 s, which is `dely wait`'s default
deadline, and a waker Control was measured end to end.

**Ship OMP through the `dely` marketplace.** Rejected: OMP loads a marketplace
plugin's skills but cannot load an extension from it.

**Wait until Orca accepts `--model` for `omp`.** Deferred, not rejected; see
below. Orca 1.4.212 already carries `--model` wiring for `omp`; orchestration
refuses it only because that agent entry lacks the capability flag the other
pinned agents carry. Orca has no effort options for `omp`.

**Launch `omp --model … --thinking …` in a terminal and hand it to
`worker-start --terminal`.** Rejected: it is the adopt path 0.19.0 deleted
for Antigravity, with its prompt-before-ready race and residual terminal; it
bypasses Orca's own OMP launch that carries its status extension; and
`omp --model` fuzzy-matches, so a mistyped selector may run another model.

**Refuse a spec that already contains a `dely-pin:` line.** Not needed: the
post-acknowledgement check already fails such a dispatch when a Model is
pinned.

#### Consequences

A project can pin OMP's model and effort per phase without touching its
repository or its users' OMP configuration, and a bad pin stops the worker
before it spends a request.

The extension loads into every OMP session on a machine that installed Dely,
including sessions that have nothing to do with a delivery. It does nothing
unless the first prompt of the session has a line beginning `dely-pin:`; a
person who types such a line with a bad selector ends their own session.
With Model `default` the helper writes no line and checks nothing, so a spec
that itself carries a `dely-pin:` line still switches that worker's model
unnoticed; no instrument covers this, and it is accepted as rare.

OMP has no workspace-trust gate. A repository's `.omp/extensions`,
`.omp/skills` and `.omp/config.yml` take effect in an OMP worker without a
prompt, with the approvals of the user's `tools.approvalMode`. Dely's
`setup` and `delivery` skills are not namespaced in OMP and take precedence
over a project's own skills of the same name.

A dead OMP worker is found by `STALLED` after the stall interval, not by
`ATTENTION`. This decision does not improve that.

OMP users install from a checkout with `omp plugin install`, which links
it rather than copying it: OMP runs whatever that checkout holds, so it must
be a dedicated clone, never a working checkout of this repository. Updating
is `git pull` in that clone. `omp plugin uninstall dely` needs `bun`.
Without it, `omp plugin disable dely` only deactivates Dely and leaves it
registered; removal is the manual steps README gives (delete the linked
package, remove the then-empty `node_modules`, delete the `dely` key from the
plugin lock), measured in an isolated home.

The live release floor is ten rows: rows 10 and 11 check string handling in
`start()` and the extension, and run when either changes. Rows 8, 9 and 12
rerun after every OMP upgrade, as rows 1, 4 and 5 do after every Orca one.

**Live verification ran rows 8 to 12 of `probe/checklist.md` only, on OMP
18.3.4 and Orca 1.4.212.** OMP updated itself from 18.3.3 between the
measurements above and the checklist. The first run, on a snapshot of
`cdb7813`, failed rows 8 and 9. Inside OMP a registry model's `thinking` is an
object, `{mode, efforts, requiresEffort}`; `omp models --json` flattens it to
an array. The extension checked the array form, so every pin with an Effort
exited. It also wrote `DELY-PIN-FAIL` with `console.error`, which OMP sends to
its own log file, so the `NO_ACK` quote did not carry it. After the fix, which
reads `thinking.efforts` and writes the line to stderr from an exit handler,
rows 8, 9 and 11 were run again on a snapshot of `d69e0f5`. Row 9 passed, row
11 passed, and row 8 showed the pinned model on every request. Its pass
condition named the session's first `model_change`, which is always OMP's
configured default at session start, and was reworded to the last one before
the first user message.

Rows 1 to 7 were not run. They exercise Claude Code, Codex CLI and Cursor
Agent CLI deliveries, and for those harnesses the helper's `worker-start`
argv and spec are byte-for-byte those of 0.20.1. The implementer's stub-`orca`
check showed that, and the task reviewer reproduced it against a 0.20.1
snapshot. This release names that exception here rather than moving the
floor.

After the architecture-review amendment, rows 8 to 11 ran again on a
snapshot of `c7dbfff` (OMP 18.3.4, Orca 1.4.212, pin
`google-vertex/gemini-3.5-flash` / `low` against the configured default
`google-vertex/gemini-3.8-flash`), and all passed. Orca's
`projection.provider.model` already held the pin 4.0 s before the `ack`
heartbeat and never showed the default, so the post-acknowledgement check
needs no lag allowance beyond its five-second bound. With the extension
disabled, the same dispatch printed `FAILED … pin not applied: expected
google-vertex/gemini-3.5-flash, saw google-vertex/gemini-3.8-flash`. Row 12
was not rerun: it pins Model `default`, which the check does not reach.
`omp plugin disable dely` deactivates Dely but leaves it registered; without
`bun`, removal is the manual steps README gives.

#### Non-goals

Detecting a dead OMP worker sooner than `STALLED`.

A background-wake OMP Control.

Installing OMP from a git URL, or uninstalling it with `bun` through
`omp plugin uninstall dely`; neither was measured.

#### Deferred

Pinning OMP's model by flag. Trigger: an Orca release whose
`worker-start --agent omp` accepts `--model`. `modelFlag` becomes `true`, the
spec line carries only an effort, and the post-acknowledgement check keeps
running. The request is filed as
[stablyai/orca#23388](https://github.com/stablyai/orca/issues/23388).

Deleting OMP's use of `extensions/dely-pin.ts` and `modelPin`, and its
separate install path; the package stays while Pi needs it. Trigger: an Orca
release that also accepts `--effort` for `omp`; `effortFlag` becomes `true`, and OMP installs from the `dely`
marketplace, which already loads its skills.

`controlWake: background` for OMP. Trigger: a measured OMP job timeout above
`dely wait`'s deadline, or a helper deadline below it.

### 2026-09-18 — Live verification runs before review; review-round cost from `~/.dely/log`

#### Context

A Spike read the pre-0.20.0 tab-separated log at `~/.dely/log` (machine-local,
one delivery per line). Extra review rounds recur when `probe/checklist.md`
runs after the review: its findings produce new commits, the reviewed head is
no longer the released head, and another review follows. This repository's
2026-09-16 record already names two such 0.20.0 defects ("Found by live
verification of `82aa354`, not by review"; "Also found by live verification,
of `90fc7a9`"). `AGENTS.md` said only that live verification before a release
is that checklist, which is true and does not order it against the review.

**Measurement.** The command below was run on 2026-09-18 against this
machine's `~/.dely/log`. A reviewer reruns it unchanged.

```bash
python3 << 'PY'
from pathlib import Path
import re, statistics
from collections import Counter

log = Path.home().joinpath(".dely/log").read_text().splitlines()
TOKEN = r"(CHANGES_REQUESTED|NEEDS_REPLAN|BLOCKED|APPROVED|APPROVE|ACCEPT|REPLAN)"


def norm(tok):
    if tok.startswith("CHANGES_REQUESTED"):
        return "CHANGES_REQUESTED"
    if tok in ("ACCEPT", "APPROVE", "APPROVED"):
        return "ACCEPT"
    return tok


def parse_reviews(s):
    s = s.strip()
    if not s:
        return [], "empty"
    prose = bool(
        re.search(TOKEN + r"\s*x\d+", s)
        or re.search(r"\d+\s+" + TOKEN, s)
        or "each after CHANGES_REQUESTED" in s
        or "ruled ACCEPT" in s
    )
    if not prose:
        out = []
        for p in s.split(","):
            p = p.strip()
            if not p:
                continue
            out.append(norm(p.split("(", 1)[0].strip()))
        return out, "list"
    rest, out = s, []
    m = re.search(
        r"ACCEPT\s*x(\d+)\s*\(each after CHANGES_REQUESTED\)", rest
    )
    if m:
        n = int(m.group(1))
        out.extend(["CHANGES_REQUESTED", "ACCEPT"] * n)
        rest = rest[: m.start()] + rest[m.end() :]
    for m in re.finditer(r"(\d+)\s+" + TOKEN, rest):
        n, tok = int(m.group(1)), m.group(2)
        out.extend([norm(tok)] * n)
    for m in re.finditer(TOKEN + r"\s*x(\d+)", rest):
        tok, n = m.group(1), int(m.group(2))
        out.extend([norm(tok)] * n)
    if re.search(r"\band ACCEPT\b", rest) and not re.search(
        r"\band ACCEPT\s*x\d+|\band \d+\s+ACCEPT", rest
    ):
        out.append("ACCEPT")
    return out, "prose"


def take(fields, keyed, names, positional):
    for n in names:
        if n in keyed:
            return keyed[n], n + "="
    if len(fields) > positional:
        return fields[positional], "positional-" + str(positional + 1)
    return "", "missing"


rows = []
for i, line in enumerate(log, 1):
    fields = line.split("\t")
    keyed = {}
    for f in fields[1:]:
        if "=" in f:
            k, _, v = f.partition("=")
            keyed[k] = v
    rev, rev_src = take(
        fields, keyed, ("review-dispositions", "reviews"), 5
    )
    rnd, rnd_src = take(
        fields, keyed, ("implementation-rounds", "rounds"), 4
    )
    reviews, kind = parse_reviews(rev)
    m = re.search(r"\d+", rnd.strip())
    rows.append(
        {
            "i": i,
            "date": fields[0][:10],
            "rev_src": rev_src,
            "rnd_src": rnd_src,
            "kind": kind,
            "n": len(reviews),
            "cr": sum(x == "CHANGES_REQUESTED" for x in reviews),
            "first": bool(reviews) and reviews[0] == "ACCEPT",
            "rounds": int(m.group(0)) if m else None,
            "git_root": keyed.get("git-root", ""),
            "order_stated": "each after CHANGES_REQUESTED" in rev,
        }
    )

ns = [r["n"] for r in rows]
total = sum(ns)
cr = sum(r["cr"] for r in rows)
stated = sum(1 for r in rows if r["n"] > 0)
first = sum(1 for r in rows if r["first"])
print("deliveries", len(rows))
print("stated_dispositions", stated)
print("reviews_median", statistics.median(ns))
print("reviews_mean", round(statistics.mean(ns), 2))
print("reviews_max", max(ns))
print("reviews_total", total)
print("changes_requested", cr)
print("changes_requested_pct", round(100 * cr / total, 1))
print("first_accept", first)
print("first_accept_of", stated)
print("first_accept_pct", round(100 * first / stated, 1))
print("review_field_source", dict(Counter(r["rev_src"] for r in rows)))
print("parse_kind", dict(Counter(r["kind"] for r in rows)))
print("rounds_field_source", dict(Counter(r["rnd_src"] for r in rows)))
for r in rows:
    if r["i"] in (28, 29, 52, 53):
        print(
            f"line {r['i']} {r['date']} n={r['n']} cr={r['cr']} "
            f"first_accept={str(r['first']).lower()} rounds={r['rounds']}"
        )

print("log_first_date", rows[0]["date"])
print("log_last_date", rows[-1]["date"])
probe = [r for r in rows if "/dely-probe/" in r["git_root"]]
kept = [r for r in rows if "/dely-probe/" not in r["git_root"]]
print("probe_fixture_lines", ",".join(str(r["i"]) for r in probe))


def emit(prefix, rs):
    ns = [r["n"] for r in rs]
    total = sum(ns)
    cr = sum(r["cr"] for r in rs)
    stated = sum(1 for r in rs if r["n"] > 0)
    first = sum(1 for r in rs if r["first"])
    print(prefix + "deliveries", len(rs))
    print(prefix + "stated_dispositions", stated)
    print(prefix + "reviews_median", statistics.median(ns))
    print(prefix + "reviews_mean", round(statistics.mean(ns), 2))
    print(prefix + "reviews_max", max(ns))
    print(prefix + "reviews_total", total)
    print(prefix + "changes_requested", cr)
    print(prefix + "changes_requested_pct", round(100 * cr / total, 1))
    print(prefix + "first_accept", first)
    print(prefix + "first_accept_of", stated)
    print(prefix + "first_accept_pct", round(100 * first / stated, 1))


emit("without_probe_", kept)
assumed = [
    r for r in rows if r["kind"] == "prose" and not r["order_stated"]
]
print(
    "first_accept_order_assumed_lines",
    ",".join(str(r["i"]) for r in assumed),
)
print(
    "first_accept_max_if_assumed_accept",
    first + sum(1 for r in assumed if not r["first"]),
)
PY
```

Output:

```
deliveries 56
stated_dispositions 56
reviews_median 3.0
reviews_mean 4.45
reviews_max 20
reviews_total 249
changes_requested 107
changes_requested_pct 43.0
first_accept 30
first_accept_of 56
first_accept_pct 53.6
review_field_source {'reviews=': 18, 'review-dispositions=': 32, 'positional-6': 6}
parse_kind {'list': 53, 'prose': 3}
rounds_field_source {'rounds=': 18, 'implementation-rounds=': 32, 'positional-5': 6}
line 28 2026-09-04 n=14 cr=8 first_accept=false rounds=5
line 29 2026-09-04 n=8 cr=3 first_accept=true rounds=7
line 52 2026-09-12 n=18 cr=14 first_accept=false rounds=16
line 53 2026-09-14 n=11 cr=6 first_accept=false rounds=8
log_first_date 2026-08-26
log_last_date 2026-09-16
probe_fixture_lines 55,56
without_probe_deliveries 54
without_probe_stated_dispositions 54
without_probe_reviews_median 3.0
without_probe_reviews_mean 4.57
without_probe_reviews_max 20
without_probe_reviews_total 247
without_probe_changes_requested 107
without_probe_changes_requested_pct 43.3
without_probe_first_accept 28
without_probe_first_accept_of 54
without_probe_first_accept_pct 51.9
first_accept_order_assumed_lines 52,53
first_accept_max_if_assumed_accept 32
```

**Counting rule.** The log is not uniform.

Field extraction prefers `review-dispositions=` over `reviews=` over tab
field 6, and `implementation-rounds=` over `rounds=` over tab field 5
(leading integer, so line 28's `5 tasks + 6 remediations` counts as 5).
Early lines use the short keys; later lines use the long keys. Six lines
(2026-09-02 to 2026-09-04, lines 23 to 28) omit those keys: the named
disposition field is empty, and dispositions sit in the sixth tab field.
They were counted, not dropped.

Comma lists split on comma, strip, take the token before `(`, then map:
`CHANGES_REQUESTED(split)` is one `CHANGES_REQUESTED` (line 29); `APPROVE`
and `APPROVED` count as `ACCEPT`; `BLOCKED`, `NEEDS_REPLAN`, and `REPLAN`
count as reviews that are neither `CHANGES_REQUESTED` nor first-review
accepts.

Prose multipliers (lines 28, 52, 53) expand `N TOKEN` and `TOKEN xN`.
`ACCEPT xN (each after CHANGES_REQUESTED)` is N pairs of
`CHANGES_REQUESTED` then `ACCEPT`. `APPROVED ruled ACCEPT by the human` is
one `ACCEPT`. A trailing `and ACCEPT` not already consumed adds one
`ACCEPT`. Line 52 is 18 reviews, 14 `CHANGES_REQUESTED`. Line 53 is 11
reviews, 6 `CHANGES_REQUESTED`. Line 28 is 14 reviews, 8
`CHANGES_REQUESTED`. For lines 52 and 53 the log gives counts, not order;
`first_accept=false` for them is an assumption (the parser takes the first
token in the text as the first review). Line 28 states the order. Maximum
effect on the first-accept figure is 32 of 56 instead of 30 of 56.

A naive comma split of the same extracted fields counts line 52 as three
reviews with no `CHANGES_REQUESTED` and line 53 as two; it also misses
`CHANGES_REQUESTED(split)` on line 29 and reads line 28 as two reviews with
none. That parse reports 213 reviews, 78 `CHANGES_REQUESTED` (36.6%),
median 2, mean 3.8. The difference is the proof that the numbers depend on
the rule above.

All 56 deliveries state review dispositions once the empty named keys are
read as the positional sixth field. Reviews per delivery: median 3, mean
4.45, max 20. Total reviews 249, of which 107 were `CHANGES_REQUESTED`
(43.0%). The first review accepted on 30 of 56 deliveries (53.6%). The
measurement includes two probe-fixture deliveries (lines 55 and 56;
`git-root` under `~/dely-probe/`). Without them: 54 deliveries, median 3.0,
mean 4.57, max 20, 247 reviews, 107 `CHANGES_REQUESTED` (43.3%), first
accept 28 of 54 (51.9%).

**Expensive deliveries.** Twenty-nine deliveries cost three or more reviews
or four or more rounds. Their `drift` / `drift-cause` fields are Control's
own summary, so class 1 is partly self-reported. Each delivery is assigned
one primary class.

**Control asserted in its own record something it had not run the command
to establish** (11). 2026-08-29 (dely: a decision record supplied a
mechanism the probe had not observed); 2026-08-30 (a consumer project:
design premises asserted rather than checked); 2026-08-31 (dely: Control's
record amendment left a contradicting scope sentence); 2026-09-02 (a
consumer project, three deliveries: scope reasoned from subject matter
rather than paths; acceptance rows asserted existence where the requirement
was correctness; a census stated as measured was eight low); 2026-09-03 (a
consumer project: eleven censuses used a search narrower than the finding);
2026-09-04 (dely: Control asserted extent six times without running the
command); 2026-09-05 (dely: a rule about what the execution plane retained
was written without measuring it); 2026-09-06 (dely, two deliveries:
compressed release history and a shortened quoted prompt, both erring
toward Control's argument).

**The contract named an instrument that could not discriminate or could
not exist** (8). 2026-08-26 (dely: a stored-catalogue check still passed
after remediation); 2026-08-28 (a consumer project: every acceptance row
measured the label rather than the painted control; dely: a falsified
harness row passed every gate; dely: three instruments named the forbidden
content without requiring an enumeration of how a label could evade the
match); 2026-08-30 (a consumer project: an acceptance instrument that could
not fail); 2026-09-06 (a consumer project, two deliveries: a literal census
that cannot be made sound in a test file; a counterexample no type-checker
fixture can reject); 2026-09-07 (a consumer project: an acceptance row that
demanded the test suite reject a mutation of itself).

**Real domain complexity the review existed to find** (6). 2026-08-26
(dely: evidence defects and a replan); 2026-08-30 (a consumer project: a
tier rule as prose judgement over hundreds of call sites, each found by
review); 2026-09-02 (a consumer project: one rule defined two ways, so two
non-equivalent predicates shipped); 2026-09-04 (a consumer project: every
task's real scope exceeded its stated scope; the same drift also reports
sections asserting their own pre-state, which is class 1 on the same
delivery); 2026-09-05 (dely: the version rule lived only in a superseded
record); 2026-09-09 (a consumer project: twenty reviews finding concurrency
and coverage defects under the earlier per-task-review protocol).

**Live verification landed after the review** (3). 2026-09-12 (dely:
measured live Orca semantics forced peek-only acknowledgement and
whole-batch consumption, and a sidecar that could not be identified on real
Orca was removed); 2026-09-14 (dely, two deliveries: live probes found
shapes that diverged from Orca 1.4.200; a live checklist row found a launch
gate invisible to worker-read).

One further delivery (2026-08-26, dely, four `ACCEPT` reviews, drift "No
drift") meets the numeric bar because Architectural work had one review per
task, not because of those classes.

The first two classes already have rules in `skills/delivery/SKILL.md`. On
extent: "Any claim about extent — a scope, a count, a set of call sites —
names the command that produced it, reports its output, and enumerates
rather than samples. Naming the command is not the measurement; the command
must have been run." On instruments: "An acceptance row is invalid until
its instrument discriminates." The 0.20.1 review of `0364472` returned
`CHANGES_REQUESTED` with seven findings. Two of them were record-accuracy
errors in Control-authored files: "Orca version recorded as 1.4.204 though
every run was 1.4.205", and "the stale-settle record blamed Codex only".
The second is an extent claim as that rule defines one (a set of call
sites); the first is a wrong version string, not an extent claim.

#### Decision

When a delivery requires `probe/checklist.md`, it runs before the review
dispatch, so the reviewed head is the verified head. If remediation changes
what a worker launch does, the affected rows rerun before the re-review.
This ordering lives in `AGENTS.md` as a project rule for this repository,
not in `SKILL.md`, because the checklist is this repository's live
verification of worker launch. The portable protocol has no such file and
must not grow a Control obligation that only this repo can observe.

#### Alternatives considered

**A new `SKILL.md` obligation on Control to re-run every cited command
before dispatching review.** Rejected: the same class as the two rules that
already exist and are already violated, with nothing new observing it.
0.20.1's review of `0364472` is the latest instance.

**A closure gate checking Control's record against the log.** Rejected:
`~/.dely/log` and `~/.dely/log.jsonl` are machine-local and opt-in, so a
reviewer on another machine cannot reproduce the gate.

#### Consequences

No log holds per-round token or request cost; the numbers count rounds and
dispositions only. The 20-review delivery ran under the earlier
per-task-review protocol, which Bounded work can no longer reach. The
numbers reproduce only on the machine holding `~/.dely/log`. That file
ends on 2026-09-16. `~/.dely/log.jsonl` holds later deliveries and is not
measured.

When a delivery edits `probe/checklist.md` itself, the candidate is still
installed from a `git archive` snapshot and that snapshot's checklist runs
before review. Circularity remains for a row whose criterion is the new
text: running it cannot prove the criterion is the right one, so that row
is reviewed as prose. If a later live run on the released install requires
a commit, that commit is a new delivery, not another round of the same one.

### 2026-09-17 — Control learns helper usage from `dely`; checklist order, kill trigger, and Codex Control notes

#### Context

After 0.20.0 shipped, a probe of the official install passed rows 1, 2, 4,
5, 6, 7 and row 3 on rerun. A Control-cost measurement on the same task
found all three Controls sleeping during worker waits, and every Control
reading `scripts/dely.js` (about 6–8% of weighted context). The cut of the
usage block from `SKILL.md`, relying on `dely` printing its own usage, is
the cause: models read the source instead.

The first candidate `147fc46` failed live row 2 because the printed usage
named no flags, and the Codex Control in row 3 passed only by reading the
source; so the earlier Controls read `scripts/dely.js` because it was the
only place the flags were written.

#### Decision

Add one sentence to the skill: Control learns the helper's interface by
running `scripts/dely` with no arguments, which prints its identity and
usage, and does not read `scripts/dely.js`. The helper's printed usage
carries every subcommand's required and optional flags from one table,
names `dely <subcommand> --help` for that subcommand's usage line, and
is the interface the skill sentence points to. Missing-flag errors name the
missing flags. Checklist rows 1, 4 and 5 are rerun after every Orca
upgrade, before the next delivery relies on the new build. Row 3's waker
pass condition is event order, not presence: every
`wait_bg` is followed by `settled`, `attention` or `stalled` before its
`notify`, and the Run's log has no `error`. Row 4's kill trigger polls
every 1 s and fires only while Control's wait is running, the implementer
process is still alive, and no `settled` event exists yet; if the
implementer settles first, the row is not run for that attempt. Rows 1 to 3
collect Control harness and model, request timing during each wait, and
whether Control read `scripts/dely.js`, as tracking data not a pass
condition. Codex Control measurements go into the `codex` entry's `notes`.

#### Alternatives considered

**Helper retry when Orca closes the connection.** Rejected: it would match
Orca's error text, the lexical classification the 2026-09-15 architecture
review removed; Orca already prints its recovery command; one incident.

**A stale-settle filter in `wait`.** Rejected: it re-implements Orca's
batch and acknowledgement semantics.

**A `wait-bg` check against the Run's coordinator.** Rejected: Orca
already reports the mismatch within a second; one incident.

**A `harnesses.json` field listing Control models that sleep.** Rejected:
a catalogue, and sleeping is not stable per model.

**Demoting Codex to worker only.** Rejected: contrary to every harness
serving every role.

#### Consequences

A Sonnet 5 Claude Control preflighted before its first dispatch in 3 of 3
runs against the skill's text; recorded and monitored, not fixed.

On both Control harnesses (Codex in two of three Codex Control runs on
2026-09-17, and a Claude Sonnet 5 Control in live row 2 on `0364472`) a
Control that did not acknowledge the implementer's batch had its next wait
settle on the same stale `worker_done`, costing extra wake cycles. `dely
wait` exits on `SETTLED` before acknowledging, by design, because the
skill's result handling makes acknowledgement Control's step after
processing the batch. Recorded and monitored; a helper change is out of
this scope.

### 2026-09-16 — Harness facts move to `harnesses.json`, the skill keeps only its protocol, and the log becomes machine-readable

#### Context

0.19.0 deleted what the 2026-09-15 architecture review found unearned: the
structural suite, the CI job, and the code for four harnesses this package
cannot support. It deleted; it did not redesign. What it left behind has four
measured problems.

**Harness facts live in prose that only a human can read.**
`skills/delivery/references/harnesses.md` is a seven-row Markdown table, and
`dely.js` reads it with `harnessCell()`, which splits a Markdown line on `|`
and indexes column 6 to find a Control wake mode. `skills/setup/SKILL.md`
does not read it at all: it restates the same facts as prose, hardcoding
`claude`, `codex` and `cursor-agent`, their discovery commands, and which of
them needs a `CLAUDE.md` import. The same fact is therefore written in three
places, and 0.19.0 shipped with one of them already wrong — the table says
Codex's setup step is `Orca preflight`, while Codex CLI 0.154.0 shows its own
trust dialog on a fresh directory ("Do you trust the contents of this
directory?"). Measured 2026-09-16 during the 0.19.0 checklist.

**`SKILL.md` is 445 lines, and its largest section is a copy of something the
helper already prints.** "Launching a worker" is 113 lines of `dely` usage
text, transcribing exit codes and flag semantics that `dely` itself owns. A
transcription cannot be checked against its source, and it is the part of the
file most likely to drift. Three further sections — Evidence, Changing this
skill, Language — state policy no dispatch ever consults. Measured on the
0.18.0 probe rounds: a Cursor worker read `SKILL.md` three times in one
delivery and `dely.js` three times, because the skill is long enough that a
worker re-reads it rather than holding it.

**The log is opt-in, human-formatted, and was empty when it was needed.**
0.19.0 appends one tab-separated physical line to `~/.dely/log`, only after a
delivery is accepted and all checks are green. Every failure the 0.18.0 and
0.19.0 series actually had — lost nudge wakes, a verify blocking past Codex's
30 s exec yield, a launch failing at 150 s with an empty quote, a killed
worker invisible for 6 min — happened in a delivery that never reached that
point, so none of them is in any log. The format is also declared not to be a
parsing schema, which leaves an agent asked to debug a run with nothing to
read.

**`dely wait` cannot see a dead worker on the current execution plane.**
Measured 2026-09-16 on Orca 1.4.203 during the 0.19.0 checklist: after a
worker's agent process was killed, `worker-list` held `terminalState:
active`, `stage.worker: ready` and `nextAction: none` for 6 min 8 s, so
`wait` — which reports `ATTENTION` only on `nextAction.kind !== "none"` —
reported nothing. The same case gave `ATTENTION` in 16 s on Orca 1.4.200.
Checklist row 4 failed for that reason and the release recorded it as an
execution-plane finding rather than a helper defect.

This delivery re-measured it. On Orca 1.4.203, `worker-list` already carries
the signal, in the same payload `wait` reads, in a field 0.19.0 does not
consult:

| Worker state | `dispatchStatus` | `liveness.verdict` | `nextAction.kind` | `attention.requiresAction` |
| --- | --- | --- | --- | --- |
| Healthy, working (45 samples over 92 s) | `dispatched` | `live` | `none` | `false` |
| Killed after acknowledgement (from ≤1 s, held ≥132 s) | `dispatched` | `unverifiable` / `missing_status` | `none` | **`true`** |
| Settled, awaiting release | `completed` | `live` | `release` | `false` |
| Starting, ~1–2 s transient | `pending` | `unverifiable` | `none` | **`true`** |

Two candidate signals proposed by the 0.19.0 review do not discriminate:
`worker-show`'s `observation.status` stays `"live"` on a killed worker, and
the terminal's `connected` stays `true` with `orphaned: false`. Both were
checked against the killed worker above.

#### Decision

**One machine-readable file owns every harness fact.** `harnesses.json` at the
repository root carries one entry per harness, with `id` (the Orca agent id),
`binary`, `status` (`supported` or `deferred`), `controlWake`, `trust`,
`discovery`, `modelFlag`, `effortFlag`, `permissionDefault`,
`forbiddenHeadless`, `instructionsFile`, and `notes` carrying what was
measured — including for `deferred` entries, which is where the facts about
GitHub Copilot CLI, Antigravity CLI, Grok Build and Kiro CLI now live.
`skills/delivery/references/harnesses.md` is deleted. The helper, `skills/setup`
and `skills/delivery` all read `harnesses.json` by a path relative to
themselves; every harness's plugin cache holds the whole repository, verified
2026-09-16 for the Claude, Cursor and Codex caches, so the root path resolves.
Codex's `trust` is `dialog`, not `orca-preflight`.

`effortRequiresModel` is the one fact kept above the per-harness entries, and
it is enforced rather than stored: `start()` refuses a pin that names an effort
while leaving the model at `default`, because `--effort` requires `--model` and
that combination otherwise fails inside `worker-start` after a terminal already
exists. Two other top-level fields the first cut carried were removed, their
content stated in the entries it belongs to.

`permissionDefault` is carried although the 2026-09-15 review's field list
omitted it: setup's trust step and `probe/checklist.md` both launch
`<binary> <permissionDefault>`, and deleting `harnesses.md` leaves that fact
no other home.

**`skills/setup` states no harness-specific fact.** Its discovery commands,
trust steps, permission defaults and instructions-file rule are read from
`harnesses.json`. A harness is added or moved between `supported` and
`deferred` by editing that file, not the skill.

**`SKILL.md` keeps its protocol and drops its transcriptions.** It holds the
two gates and Control, shape and acceptance, the execution envelope, Orca and
the helper, implementation and handoff, review and remediation, release, and a
failure table holding only rows that result handling does not already carry.
Plan Mode and Investigation are one sentence each. Evidence, Changing this
skill, and Language are deleted. The log section is three lines. The `dely`
usage block is deleted, because `dely` prints its own usage.

The 2026-09-15 review estimated this at about 220 lines, summing a per-section
budget of 217. Measured after the cut, at the 80-column prose every other file
in this repository uses, it is **346 lines** — against 445 at baseline, with
3016 words against 3624 and no prose line over 78. (It was 323 at `698dc28`;
the review remediation added the two `ATTENTION` routes and the `dely log`
sentence, and the two live-verification fixes below added the `--control` rule
and restored the `PREFLIGHT … FAIL` route.) The estimate was
not wrong about what to delete; it undercounted what one section must hold.
"Orca and the helper" was budgeted 45 lines for the run-create, preflight,
dispatch, wait and result-handling sequence, and it also has to carry the
prompt-file rules, the rule that a dispatch prompt reproduces an acceptance row
as written, the model-and-effort pinning rule, and escalate-rather-than-guess.
It measures 82. The protocol is the contract and the budget was an estimate, so
the number moves and the contract does not.

**The log is JSON Lines, records failures, and stays opt-in.** `~/.dely/log.jsonl`,
one JSON object per line. The helper writes `preflight`, `dispatch` (with
seconds to acknowledgement), `no_ack`, `settled`, `attention`, `stalled`,
`deadline`, `error`, `wait_bg` and `notify`; Control writes one closing
`delivery` object with shape, implementation rounds, dispositions, the pull
request or pushed SHA, human interventions, and `stopped_at` when the delivery
ended early. Every line carries `ts`, `run`, `repo`, the Dely SHA and the Orca
version. Aborted and failed deliveries are recorded; that is the point.
Screen quotes are written in full, because the file is machine-local. Dely
never reads it to decide anything at runtime; an agent reads it when asked to
debug or improve a run. `dely log` writes the closing object so Control does
not hand-assemble JSON in a model turn.

The trigger is unchanged from 0.19.0: Dely never creates `~/.dely/`, and a
missing directory is skipped silently. **This supersedes the 2026-09-15
review's decision 9, which made the log on by default.** That decision's
reason — a log is empty exactly when you need it — is real, but it is weakest
on the maintainer's own machine, where `mkdir ~/.dely` once turns it on
permanently for every later run including the broken ones, and strongest
against third-party installs, which would otherwise accumulate quoted screen
contents on disk without being asked. An environment variable was rejected as
the switch: the helper runs inside terminals Orca creates, which inherit the
Orca application's environment rather than Control's shell, so `wait-bg`'s
waiter would not see it. `README.md` states that the file may contain
sensitive content.

**Preflight leaves the per-delivery path.** It runs in `skills/setup`, and
again after a dispatch returns `NO_ACK`. A delivery no longer preflights
before its first dispatch.

**The dispatch spec says the worker needs nothing else.** `dely dispatch`
appends, alongside the acknowledgement instruction, a sentence stating that
the Orca preamble and the spec file are sufficient and that no other skill
should be read.

**`dely` with no arguments prints its identity.** The version from the plugin
manifest, the Dely SHA where one is resolvable, and the sha256 of
`skills/delivery/SKILL.md`, in addition to the usage line. This is the
check `probe/checklist.md` step 1 already performs by hand at every install
location.

**`dely wait` reports `ATTENTION` on the measured signal.** A worker needs
attention when its `dispatchStatus` is `dispatched` **and** either
`nextAction.kind` is not `none` **or** `attention.requiresAction` is true. The
`dispatchStatus` guard is load-bearing in both directions: without it the
1–2 s starting transient raises `ATTENTION` on every healthy dispatch, and a
settled worker's `nextAction: release` does the same. An **absent**
`nextAction.kind` counts as `none`: a row with no projection, or a projection
carrying no `nextAction`, is a field Orca did not supply rather than a demand
for attention, and treating it as one regressed against 0.19.0 until the
independent review caught it. A row whose `nextAction` is absent but whose
`requiresAction` is true is still attention — the killed-worker signal does
not depend on the other field existing.

`ATTENTION` therefore has two routes, and the skill states both. A
`nextAction` other than `none` is a request from the plane, and Control runs
the argv it printed. `nextAction: none` with `requiresAction` is the plane
losing sight of the worker: Control reads it with `worker-read` and
`worker-show`, and with the process gone runs `worker-stop`, then
`worker-abandon` when the stop reports `stop_unknown`, then `worker-release`,
then one fresh `dely dispatch` with the same prompt file; a second time on the
same input goes to the human. Row 4 of `probe/checklist.md` keeps its pass
criterion and exercises the second route.

**The waker guard reads the harness it runs in, not the one it is told.**
Found by live verification of `82aa354`, not by review. `SKILL.md` wrote
`dely wait --run <run> --control <agent>` without saying whose agent. In
checklist row 3 on Orca 1.4.203, a Codex Control — wake mode `waker` — passed
`--control cursor` while waiting on its Cursor implementer and
`--control claude` while waiting on its Claude reviewer, zero times its own id,
per its own session record. The guard looked up the wake mode of the id it was
given, found `background`, and let a waker Control run a blocking in-turn
`wait`: the failure `wait-bg` exists to prevent, since Codex yields exec after
at most 30 s with no wake on exit. Row 3 still reached `ACCEPT` only because
both phases finished in about two minutes.

`wait` now resolves `ORCA_TERMINAL_HANDLE` through `orca terminal list` to that
terminal's `agentIdentity`, and refuses a waker on that identity whatever
`--control` says, naming both in the refusal. `--control` remains the fallback
outside Orca and when the handle is unknown; the `wait-bg` waiter still passes
with `DELY_WAITER=1`. The mechanism was measured before it was written: in rows
1, 2 and 3 each Run's `coordinator_handle` equalled its Control's terminal,
which `run-create` can only bind if `ORCA_TERMINAL_HANDLE` was set inside the
Control's command environment, and the Codex terminal reported
`agentIdentity: "codex"`. The skill now also says `--control` is this
Control's own id.

It is recorded as a finding of the verification rather than folded silently
into the review remediation because the release floor let it through: rows 1
to 3 pass on branch, `ACCEPT` and human count, and none of those can see which
wait a Control used. Checklist step 3 now requires a waker Control's row to
show `wait_bg` and `notify` in the log for its Run.

**A failed preflight stops dispatch again.** Also found by live verification,
of `90fc7a9`. 0.19.0 stated a `PREFLIGHT … FAIL` route twice: do not dispatch
to any pin, relay the reason, rerun preflight when the human is done. This
record's cut of `SKILL.md` moved preflight off the delivery path and dropped
that route with it; what remained was "`NO_ACK`: run setup's `dely preflight`,
then one fresh `dely dispatch`", with no condition on the preflight. Neither
the task 2 survival list nor the review of `698dc28` named it. In checklist
row 7 on Orca 1.4.204 a Cursor Control did exactly what the text said: `NO_ACK`
after 63 s, preflight failing the Claude pin on its trust dialog, then a second
dispatch into the same dialog and a second `NO_ACK` 63 s later, before
stopping. It still named the harness, the path and the action, and the rest
of the loop — `trust.sh`, one message, a passing preflight in the same Run,
`ACCEPT` — passed. The route is restored in result handling and the failure
table, and a fresh dispatch after `NO_ACK` now depends on every pin passing.
Checklist row 7's first step, written for 0.19.0's preflight-first flow and
unable to finish in its 60 s as a result, now bounds the stop at 150 s from
the Run's `no_ack` event — the first event a dispatch that never acknowledges
writes — and requires a `preflight` failing the Claude pin and no `dispatch`
after it. Measured on `b8094bf`: 63 s from the dispatch to `no_ack`, then 79 s
to the failing preflight and 25 s to the stop, 104 s from `no_ack`. The bound
this entry first carried, `ACK_S` plus 90 s from the first `dispatch` event,
anchored on an event that case never writes and was corrected at re-review.

Rows 1, 3 and 4 were not rerun for this change: their Runs logged no `no_ack`
and no `preflight` event, so the route never lay on their path, and rows 5 and
6 exercise only the helper, which this change does not touch. Rows 2 and 7 run
on the commit that carries it.

One Minor finding is recorded and deliberately not fixed. `preflight`'s printed
and logged `seconds` start after `worker-start` returns, so they omit the launch
— 15 logged against 56 s of wall time for an untrusted Claude pin. The placement
is inherited from 0.19.0; moving it changes the helper and would reopen rows 5
and 6.

#### Alternatives considered

**Keep `harnesses.md` and add a parser.** Rejected: the parse is the defect.
`harnessCell()` indexes a fixed column of a Markdown table, so reordering the
columns silently changes what the helper reads, and setup cannot use it at all
without writing a second parser.

**Put `harnesses.json` under `skills/delivery/`.** Rejected: `skills/setup`
would then reach into a sibling skill for its own configuration, and the file
describes the package rather than one skill.

**Use `worker-show observation.status` or the terminal's `connected` flag for
row 4**, as the 0.19.0 review suggested. Rejected on measurement: both stay
unchanged when the agent process is killed, so neither discriminates. They are
recorded here so the next reader does not re-propose them.

**Debounce `attention.requiresAction` over two polls** instead of guarding on
`dispatchStatus`. Rejected: it delays a real detection by a poll interval to
solve a transient that the status field already excludes exactly.

**On by default with a `~/.dely/log.off` marker.** Rejected with the
superseded decision above: it logs on machines whose owner never asked, and
the opt-out is discoverable only by reading documentation.

#### Consequences

Adding a harness is one JSON entry plus whatever install text `README.md`
owes it; it is no longer an edit to two skills and a Markdown table.

`SKILL.md` stops describing the helper's interface, so the helper's usage text
becomes the only statement of it. A change to `dely`'s flags no longer has a
second place to update, and no longer has a second place to contradict.

The log now contains quoted screen output from every worker, including
whatever a failing harness printed — credentials in a shell prompt, repository
contents, error text. It is machine-local, it is not created unless the
directory exists, and `README.md` says so. It is still a file a user may not
expect to be able to share.

This does not make row 4 pass on an Orca build that reports neither signal. It
moves the helper onto the best field this build offers and names the field, so
the next failure is diagnosable. `attention.requiresAction` is Orca's
projection and has already changed shape once between 1.4.200 and 1.4.203;
rows 1, 4 and 5 remain worth rerunning after every Orca upgrade.

Removing preflight from the delivery path means an untrusted pin is now
discovered by a dispatch returning `NO_ACK` rather than before the first
dispatch. The cost is one wasted dispatch; the saving is one round trip on
every delivery whose pins were already trusted, which is most of them.

A hazard this delivery hit and did not fix: a Control that acknowledges a batch
outside `dely wait` cannot use `orca orchestration check --peek` to decide
whether anything is pending. `--peek` returns the messages but leaves
`deliveryId` null, and only `check --wait` assigns one, so a drain loop keyed on
`deliveryId` exits while a `worker_done` is still unacknowledged. The next
`wait` then settles on that stale message, which is indistinguishable from the
current worker finishing — it was caught here only by checking `worker-list`
before acting on the result. Per-delivery Runs stop a stale report settling a
different delivery's wait; nothing stops one settling a later wait in the same
Run. The helper's own loop acks the `deliveryId` from `check --wait` and is not
affected. Recorded rather than fixed because the fix belongs in the batch
mechanics the orchestration guide owns, not in this delivery's scope.

#### Non-goals

Supporting the four deferred harnesses. Their measured facts are preserved in
`harnesses.json` so that promoting one is an edit to `status` and its `notes`,
but nothing in this delivery runs them.

Making `harnesses.json` a public configuration surface for users. It is a
package artifact; a project pins harnesses through `AGENTS.md`, as before.

A schema file or a validator for `harnesses.json`. The closure gate parses it
with `jq`; a malformed entry fails there.

#### Deferred

Promoting a deferred harness to `supported`. Trigger: a release that runs at
least one checklist row with that harness in a role.

A `~/.dely/config.json` for anything the directory marker cannot express.
Trigger: a second setting that needs to be configured at all.
Superseded 2026-10-05: configuration lives in the repository under `.dely/`
(see that day's record on pins).

### 2026-09-16 — Dely drops its structural suite, its CI job, and the code for harnesses it cannot support

#### Context

A clean-slate architecture review of 0.18.0 at `3ee4e1a` on 2026-09-15 measured
the package against what the live probes of 2026-09-13 and 2026-09-14 actually
exercised. Three findings decided this entry.

**The suite was a change detector, not a defect detector.** Measured in this
repository on 2026-09-16: 89 CI runs of the `contracts` workflow, 86 green, one
cancelled, two red. One red was the commit adding the logo assets, where the
disclosure grep matched coordinates inside an SVG path — a false positive. The
other was an external contributor's pull request, whose logs have since expired.
No defect in this repository's own shipped code was first found by CI. Every
defect that mattered in the 0.18.0 series was found by running the real thing:
lost nudge wakes, a verify that blocked past Codex's 30 s exec yield, an
Antigravity launch that failed after 150 s with an empty quote. Meanwhile
`tests/contracts.sh` took 56 commits on `main` against 39 for everything under
`skills/`: the file changed more often than the thing it protected, because it
pinned prose verbatim.

**The fake hid the live failures.** `tests/fixtures/fake-orca.js` diverged from
the real CLI in at least four shapes — `source: stream`, a top-level `stage`,
`ownershipState`, `requiresAction`. The 51 tests were green through every probe
round that failed. The suite also left one temporary directory per run under the
OS temp directory; 1,340 had accumulated by the time they were counted.

**Roughly 45% of the helper served a harness that is deferred or a screen it
should not be reading.** The Antigravity adopt path exists to patch
`worker-start` for one harness and is the only place with a known residual leak.
The `GATES` list is lexical string matching against a TUI: two entries had
already been removed as false positives, and the raw screen tail carries the
same information. `pinWhy` fails closed for harnesses that cannot take
`--model`, which is meaningless once every supported harness accepts it.

The probe rounds ran nine harness-by-role cells over Claude Code, Codex CLI and
Cursor Agent CLI, and all nine went through Orca's orchestration lifecycle.
Copilot, Antigravity, Grok and Kiro were each reached, but each needed either a
launch patch, a Control wake mode with no measured event path, or a step Orca
cannot express.

#### Decision

0.19.0 ships the protocol and the helper the probes exercised, and nothing else.

- **No structural suite and no CI job.** `tests/` and
  `.github/workflows/contracts.yml` are deleted. The closure gates in
  `AGENTS.md` are static checks: whitespace, JSON validity, shell and JavaScript
  syntax enumerated from `git ls-files`, the absence commands, the disclosure
  greps, and a version gate. `CONTRIBUTING.md` and the pull-request template no
  longer name a suite.
- **The version pin lives in `AGENTS.md`.** The gate names the literal version
  and both manifests must match it, so a delivery that changes `skills/`
  advances the version in the same delivery. This replaces the pin that used to
  sit inside `contracts.sh` and the CI step that compared the two manifests.
- **The helper loses the adopt path, the gate classifier and the pin
  validator.** With them go `dely.cmd` and the launcher's Electron branch:
  no probe ever ran either, on any platform. Preflight's early failure comes
  from Orca's own projection instead of from dialog strings: a dispatch whose
  `stage.worker` reads `start_unknown` is dropped with the worker's screen
  quoted. On an untrusted Claude pin that projection was measured flipping at
  about 41 s, and the refusal it produces was measured at 56 s. The classifier
  it replaces managed 39 s, and the timeout that was briefly the only path left
  took 192 s. So this costs 17 s against the classifier, and that is the price
  paid to stop matching dialog strings.
- **Install and discovery name the harnesses this release supports.** Grok
  Build, Antigravity CLI, Kiro CLI and GitHub Copilot CLI keep their measured
  launch mechanics in `skills/delivery/references/harnesses.md`; they lose their
  install sections and their discovery commands. This narrows what is
  documented. It does not declare a closed set, and each of them returns as a
  status change once its integration cost is paid.
- **Verification is a live checklist.** `probe/checklist.md` carries seven rows —
  three rotated deliveries, a killed worker, an untrusted pin, an idle
  transcript worker, and a full trust-intervention loop — run by a separate
  agent session before a release, against a candidate installed for real from a
  `git archive` snapshot and verified by hash at every install location.
  `probe/mkrepo.sh` builds the probe repositories and `probe/trust.sh` acts as
  the human on a trust dialog. Both refuse any path outside `~/dely-probe/`.
  `trust.sh` reports trust from the harness store, because the earlier probe
  script reported success twice from the screen while
  `projects[<path>].hasTrustDialogAccepted` stayed false. Dely itself still
  never answers a dialog, and no skill references `probe/`.
- **This release ran rows 1, 4, 5 and 7, and three of them passed.** Rows 1, 5
  and 7 passed. Row 4 ran and failed, on Orca 1.4.203, for a reason in the
  execution plane: a worker killed after its acknowledgement had a dead process
  and a terminal back at a shell prompt, while the `worker-list` projection kept
  reporting `terminalState: "active"`, `stage.worker: "ready"` and
  `nextAction: "none"` for 6 minutes and 8 seconds, so `dely wait` had nothing
  to report and went on waiting. The same case measured 16 s to `ATTENTION` on
  Orca 1.4.200, and `wait`'s `ATTENTION` path is unchanged from 0.18.0 — the
  whole function differs by one hunk, the removal of the adopted-terminal close
  after `SETTLED`. Rows 2, 3 and 6 were not run. Running four of seven rows is
  an exception recorded here, not the standard: the floor is all seven.

#### Alternatives considered

- **Keep the suite and fix the fake.** Rejected: the fake would have to track a
  CLI that is not this project's, and the four shape divergences were found by
  running the real CLI, which is the thing the fake exists to avoid. Fixing it
  buys a green suite, not a caught defect.
- **Keep the suite, delete only the prose pins.** Rejected: the prose pins are
  most of the 56 commits and most of what it caught. What is left is syntax and
  JSON validity, which the static gates now do in four lines.
- **Keep CI for the version comparison alone.** Rejected: a literal pin in
  `AGENTS.md` is the same check without a workflow, and it is visible in the
  file a Control already reads.
- **Keep the Antigravity adopt path until its harness returns.** Rejected: it
  is the only residual leak in the helper, it patches a bug in another tool, and
  the measured facts needed to bring the harness back are in the harness
  reference, not in the code.
- **Delete `references/harnesses.md` in this delivery.** Rejected: the helper
  still reads its `Control wake` column, and the redesign delivery replaces it
  with `harnesses.json`. Deleting it twice is worse than deleting it once.

#### Consequences

- A contributor no longer gets a green check that says the change is shaped
  right. The pull-request template asks what was run instead, and a maintainer
  runs the live checklist before a release.
- A regression in the helper is now caught by a live row or not at all. Between
  releases the package has no automated coverage.
- The four deferred harnesses lose their only coverage. Antigravity workers stop
  launching at all, because the adopt path was what made them start.
- Windows and the Electron runtime lose their documented path. Neither was ever
  observed working, so this records the state rather than changing it.
- This does not make `SKILL.md` shorter, does not change the log, does not move
  preflight, and does not make setup harness-agnostic. Those are the redesign
  delivery's contract and should not be judged against this one.

#### Non-goals

- Reducing what a delivery costs to run. The deletions remove code, not steps.
- Changing the protocol. Gates, shapes, acceptance, handoff, independent review,
  one remediation pass and release are untouched.
- Changing distribution. The three plugin manifests stay.

#### Deferred

- `harnesses.json`, the harness-agnostic setup skill, the JSONL log, the shorter
  `SKILL.md`, preflight at setup and after `NO_ACK`, and `dely` with no
  arguments printing version, SHA and the `SKILL.md` hash. Trigger: the redesign
  delivery on `main`, which follows this one.
- Checklist rows 2, 3 and 6 on this release. Trigger: the next release, whose
  floor is all seven rows.
- Returning a deferred harness. Trigger: a measured launch path that needs no
  patch in Dely, and a Control wake mode with an observed event.
- Rerunning rows 1, 4 and 5 after an Orca upgrade. Recommended, not yet
  confirmed as a rule; trigger is the first time an Orca upgrade breaks a row.

### 2026-09-14 — Dely coordinates on Orca's own supervised loop; the 0.18.0 runtime is replaced by a small helper

#### Context

The 2026-09-11 runtime (`dely.js`, 1,736 lines, 3,751 lines of tests and a fake
Orca) passed every review and CI. Live probes on 2026-09-13 in fresh repositories,
with every harness pinned to the candidate, still stalled Controls:

- **Nudge wake lost events.** A `worker_done` that arrived while a nudge-mode
  Control's turn was still active was never nudged. That lost 2 of 2 wakes in one
  Antigravity delivery. A Copilot Control's nudge sat unsubmitted after its TUI
  reloaded. Orca's own guide calls a nudge best-effort attention.
- **Nudge-form verify misbehaved under a real Control.** It blocked about 56 s,
  beyond Codex's 30 s exec yield. Codex started a second verify, and that one
  wrote FAIL although both workers succeeded.
- **Most live defects sat in code that re-derives what Orca already reports.**
  Examples: adopted-terminal ownership read from a shape only the fake used, a
  fallback that also closed a terminal a human took over, verify-Run restore and
  fencing, an Antigravity log classifier that blamed every unexplained NO_ACK on
  quota, and Kiro's adopted argv.
- **Dead time, not wrong code, dominated.** Measured: a worker dead of a
  connection loss undetected for 2 h 15 min, an unsubmitted prompt for 12 min,
  and lost wakes for 4 to 20 min.

A Spike on 2026-09-14 measured the alternative:

- **Control on Orca's own loop.** Control ran `orca skills get orchestration`,
  plus a slim protocol and an 83-line helper.
  - Claude and Cursor Controls delivered end to end.
  - A killed worker surfaced as `projection.attention.requiresAction` with
    `nextAction: worker-release`; Control followed it and dispatched once more.
  - Control diagnosed a signed-out Antigravity from `worker-read`, with no
    classifier.
- **Codex as Control.** Codex reaps any process its exec starts, `nohup`
  included. A waiter run as a separate Orca terminal survived, ran `check`
  with `--terminal` naming Control, and typed a wake line into Codex. Codex then
  delivered end to end and ignored Orca nudges. Orca allows one active waiter
  per Run.
- **Dead-time signals Orca already exposes.**
  - A preflight ACK-only dispatch per pin failed a signed-out Antigravity in
    106 s, before any work.
  - A 15 s wait cycle reported a killed worker 15 s after the kill.
  - A `worker-read` cursor that stopped advancing reported a stalled worker at
    140 s with a 2-minute threshold, while Orca liveness still said `live`.
- **Structured worker mode** (Orca 1.4.200, a user setting for new agent tabs).
  - Claude workers ran with no terminal in an untrusted repository, with model
    and effort pins kept.
  - Codex structured workers run their shell inside Codex's sandbox, cannot
    reach Orca, and never send `worker_done`.

#### Decision

1. **Control follows Orca's supervised loop.** The delivery skill tells Control
   to load `orca skills get orchestration` and follow it for Runs, consuming and
   acknowledging, completion accounting, recovery and cleanup. Dely keeps only
   the protocol: gates, shapes, acceptance, roles, review, remediation and
   release.
2. **A small helper replaces the runtime.** `skills/delivery/scripts/dely.js`
   has five commands:
   - `preflight`: one ACK-only dispatch per distinct pin at delivery start.
   - `dispatch`: pin to `worker-start`, then an ACK peek.
   - `wait`: whole-batch `SETTLED`, `ATTENTION` from Orca's projection, and
     `STALLED` from a non-advancing `worker-read` cursor.
   - `wait-bg`: a waiter in a separate Orca terminal, with a lock, that wakes
     Control by typing a line.
   - `notify`: the wake line itself.

   It keeps no verdict, run memory, classifier, adopted launch or nudge
   handling.
3. **Wake by harness.** A Control whose harness resumes when a background
   command exits (Claude Code, Cursor Agent CLI, GitHub Copilot CLI) runs `wait`
   in the background. Codex, Antigravity and Grok use `wait-bg`. Kiro is not
   supported as Control. Nudges are never a wake source.
4. **Pins.** `worker-start --model`/`--effort` for Claude, Codex and Cursor.
   Other harnesses take their model from Orca's per-agent default arguments.
5. **Setup ends with `dely preflight`.** The `dely:verify` skill is deleted.
6. **Worker mode is the user's Orca setting.** Structured Claude workers need
   no workspace trust. Codex workers must stay terminal workers while its
   structured sandbox cannot reach Orca.

This supersedes items 2, 4 and 5 of the 2026-09-11 decision and the runtime
parts of its item 9. Items 1, 3, 6 and 7 carry forward in reduced form.

#### Alternatives considered

**Keep the 0.18.0 runtime and restrict Control to background harnesses.**
Rejected: it keeps the code where the live defects were and the fake that hid
them, and still loses no fewer events for Codex.

**Mitigate nudges.** Rejected: the lost-event window is Orca's, and the helper's
own waker removes it.

**Protocol only, no helper.** Rejected after the Spike. The two operations
Controls get wrong are consuming whole batches and choosing a wait form, and a
hand-written waiter spun on an unacknowledged `status` batch.

**Structured workers for every harness.** Not available: Orca offers it for
Claude and Codex only, and Codex cannot report from it.

#### Consequences

- About 90% of the runtime and test code is deleted. Behaviour now depends on
  Orca's projection fields `attention`, `nextAction` and `liveness`, and on
  `worker-read` cursors, all measured live on Orca 1.4.200.
- A quiet but legitimate long command can trip `STALLED`. Control reads the last
  output and may wait again. The default threshold is set above normal quiet
  stretches.
- A waker terminal is left until its wait ends if Control abandons it.
- Control model quality is a precondition. Copilot's Free plan offers only Auto,
  and its Auto model once implemented the change itself instead of delivering it.
- Proactive human notification is not provided.
- **Known residual failures, none of them fixed.** Each was found in review of this delivery:
  - A failed row that Orca reports with `nextAction.kind: none` (already released or
    abandoned) produces no ATTENTION, so it surfaces only at `DEADLINE`.
  - A `worker-read` error sticks: `STALLED` keeps naming it after a later read succeeds.
  - The sleep between empty preflight polls is untested.
  - `wait-bg` quotes its values with JSON, not shell quoting, so `$` or a backtick in a
    Control-owned value would expand.
  - The fake Orca's second-waiter refusal cannot trigger, because fake invocations run
    one at a time.
  - Two phases sharing one pin print a single PREFLIGHT line, under the first phase.
  - The contracts rail against a `nudge` wake is lexical and case-sensitive.
  - `0.18.0` now names different content from the 0.18.0 candidates installed for the
    2026-09-13 probes. A plugin cache keyed by version can keep the old runtime, so
    installs are verified by hash, not by version.
  - Cursor Agent CLI as a background Control and Grok Build as a waker Control rest on
    the 2026-09-14 Spike alone. Both failed as nudge-mode Controls on 2026-09-11.
  - `STALLED` covers only workers whose `worker-read` source is a hook-reported transcript
    (Claude Code, Codex CLI). A terminal-stream cursor advanced about 940 bytes per 20 s
    under an idle Cursor TUI, so for terminal-stream workers (Cursor, Copilot, Antigravity,
    Grok) a stall surfaces only at `DEADLINE`, which Control treats as a checkpoint.
  - A `PREFLIGHT … FAIL` or `NO_ACK` line quotes the worker's screen or last transcript
    text read before the worker is stopped and released. Live, the earlier form printed
    Orca's projection JSON and lost a flaky Cursor preflight's cause for good.
  - Preflight waits about 150 s for each `worker_done`: a Cursor pin that passed one
    preflight failed the next at the 90 s budget.
  - `notify` never types into Control while Orca reports `agent_prompt_blocked`, because
    Orca raises that only while Control's TUI holds a permission or approval prompt,
    and typed text and Return there could approve it. It retries `--enter` every 30 s
    for up to 30 minutes, then leaves the result file unread. A Control whose prompt
    stays unanswered that long is not woken.

- **Amended 2026-09-14, after a re-probe of 397d4fd.** Background Controls (Claude Code,
  Cursor, Copilot) and waker Controls (Codex, Antigravity, Grok) each delivered, and the
  fault checks held. Six defects followed, and each is fixed:
  - **Antigravity workers lost their prompt.** A plain `worker-start` typed it before the
    TUI was ready, which was measured 0 of 4 on 2026-09-11. Dely again launches an
    Antigravity worker in its own terminal, waits for output quiescence, then adopts it
    with `worker-start --terminal`.
  - **A Codex Control ran `dely wait` inside its own exec** and stalled when Codex reaped
    it. `wait` now needs `--control`, and it refuses any harness whose Control wake is not
    `background`.
  - **A preflight failure line lost its cause:** it quoted the prompt preamble, not the
    dialog. The quote now prefers screen lines that name a known gate.
  - **A preflight on a gated pin always waited its full budget.** It now fails early when
    a known gate line is still on screen on two consecutive polls.
  - **A Control told the human to answer a released worker's dialog.** The skill now says
    a preflight failure needs the human to run the harness once in a new terminal, then a
    new preflight.
  - **Grok Build 1.0.30 asks a y/n security question in a fresh repository,** so its
    Setup cell is no longer `none`.
  - **Residuals of this fix.** No test settles one dispatch's `worker_done` while the
    adopt file records a different dispatch. The adopt file is rewritten without a lock,
    so a concurrent record and settle can lose an entry. Losing one leaks a terminal and
    never closes the wrong one.

#### Non-goals

- Fixing Orca's nudge.
- Codex structured workers.
- Kiro as Control.
- Changing this repository's pins.

#### Deferred

- **Proactive human notification.** Trigger: a delivery that waits on a human
  for longer than its stall threshold.
- **Codex structured workers.** Trigger: an Orca or Codex release that lets its
  sandbox reach Orca.

### 2026-09-11 — Workers acknowledge, Control sleeps until an event, and `dely:verify` proves the path before the first dispatch

**Superseded in part 2026-09-14:** the runtime, verify, adopted launch and nudge wake below are replaced by the 2026-09-14 decision above; this record keeps the measurements and history.

#### Context

Two failures stopped real deliveries after the move to Orca orchestration. A third
cost more than the work.

- **Launch barriers destroyed or parked workers.** This is how `worker-start`
  behaved in a fresh, untrusted `git init` path on 2026-09-11 (Orca 1.4.199):
  - **Claude Code 2.1.268:** the trust dialog opens on `No, exit` even with
    `--dangerously-skip-permissions`. The injected prompt plus Enter exited the
    agent while Orca kept reporting `ready` and `live`.
  - **Kiro:** its `--trust-all-tools` confirmation, which Orca adds, behaved the
    same way.
  - **Antigravity:** lost the prompt in 4 of 4 launches, even on a trusted path.
  - **Copilot:** parked on its trust dialog.
  - **Cursor:** failed fast, because Orca's trust preflight writes a slug Cursor
    does not use for long paths.
  - **Copilot's trust preflight** is a silent no-op, because `config.json` is now
    JSONC.
  - **Codex:** a version-update popup opened on `Update now` and appeared after the
    composer. An injected Enter updated Codex and exited it.
- **The trust handling this record deleted on 2026-09-04 rested on a confounded
  probe.** That probe ran in a git worktree of an already trusted repository, and
  worktrees inherit Claude Code's trust. Reproduced on 2026-09-11: a fresh repository
  shows the dialog; a worktree of this repository does not.
- **Control polled.** A Codex Control supervising one Cursor implementer in a new
  consuming project spent 18 turns and 3.10M input tokens in 6 minutes. Codex's
  `exec_command` yields after at most 30 000 ms, and nothing wakes the model when a
  process exits. The turn ended with `usage_limit_exceeded`. The worker's
  `worker_done` arrived ten minutes later and stayed unread for seven hours.

Measurements that shaped the decision, all on macOS, 2026-09-11:

- **Explicit acknowledgement.** A dispatch prompt whose first action is a heartbeat
  with subject `ack` was acknowledged in 6–22 s on all seven harnesses. In Orca's
  records since 2026-09-04, all 177 completed dispatches sent at least one message,
  and 34 of 40 failed dispatches never did. Heartbeats alone are not an early signal:
  22 of 48 Codex and 9 of 31 Claude Code dispatches sent `worker_done` first.
- **Event wake.**
  - Claude Code and Cursor Agent CLI resume when a background command they started
    exits. Cursor completed 3 of 3 full Control cycles this way.
  - Orca's mailbox nudge woke idle Claude Code, Codex, Copilot and Antigravity
    Controls.
  - Nudges failed twice on Cursor: once the text stayed unsubmitted in its composer;
    once a `worker_done` arrived while Control still held a waiter, and Orca never
    re-drove it.
  - A sidecar terminal consuming only heartbeats for the Control's handle meant a
    Codex Control ran exactly one turn to dispatch plus one per `worker_done`, with
    zero turns asleep.
- **Liveness.**
  - Orca reported `unverifiable` or `live` for an agent killed inside a live shell.
    Terminal-output silence over 90 s caught it (`SILENT 109s`).
  - A worker busy behind an animated spinner — which is how Antigravity's
    `RESOURCE_EXHAUSTED` backoff looks — kept output fresh. Only a deadline caught
    it (`DEADLINE 162s`, last output 0 s old).
- **Launch paths.**
  - `worker-start` succeeded for Claude Code, Codex and Cursor. It succeeded for
    Copilot in 5 of 5 runs once the path was trusted.
  - Antigravity succeeded 4 of 4 — two in parallel, one real review that returned
    `CHANGES_REQUESTED` on a planted defect, one real implement that went red then
    green — when its TUI was launched first, adopted after its output had been quiet
    for 3 s, and the path was trusted beforehand.
  - Readiness by `terminal wait --for tui-idle` returned after 1 s and lost the
    prompt.
  - Answering Antigravity's trust dialog inside the worker's own session failed in 4
    of the last 5 launches: Orca's readiness classifier kept matching the leftover
    dialog text.
- **Dry run.** A prototype dispatched one read-only task per pin and reported PASS
  on this repository (Cursor `cursor-grok-4.6-high` and Codex `gpt-5.6-sol` high,
  ACK 30 s and 49 s). It classified an untrusted Copilot path and an effort Orca
  rejects, both with no model call. It also passed with an Antigravity pin, and with
  a Codex Control in nudge mode.
- **Runtime.** The `orca` command is Node.js run on Orca's bundled Electron runtime
  (`ELECTRON_RUN_AS_NODE`, Node v24.20.0 on macOS). Wherever Orca runs, a Node
  runtime exists.
- **Delivery semantics.** These were measured with `status` messages after this
  record's first approval, when a review of the first runtime found that a
  heartbeat-only consumer is impossible. Orca's version-matched messaging guide
  states the same rule.
  - A consuming `check` returns the oldest FIFO Delivery, up to 50 messages. It
    replays exactly that batch until acknowledged, even after newer messages
    arrive.
  - `--types` only decides when a waiter wakes: a heartbeat-typed wait timed out
    while only `status` messages were pending.
  - `--peek` lists every unread message without consuming anything. `--all` lists
    the whole history, including acknowledged messages.
  - So whoever acknowledges a Delivery consumes every message in it, heartbeats and
    settling messages alike.
- **Terminal reuse.** Re-engaging a settled reviewer terminal with `worker-start
  --terminal` accepted the input but never submitted it. That Codex session had also
  switched itself from `gpt-5.6-sol` high to `gpt-5.6-luna` medium after warning
  that less than 10% of its weekly limit remained.

#### Decision

1. **One runtime owns dispatch mechanics.** Dely ships
   `skills/delivery/scripts/dely.js`: CommonJS, Node 18 or newer, no npm
   dependencies. The launchers `dely` (POSIX) and `dely.cmd` (Windows) run it on
   `node` from PATH, or on Orca's bundled runtime when `node` is absent. Every
   dispatch goes through `dely dispatch`. Control does not compose worker launches
   by hand.
2. **`dely:verify` proves the path, and dispatch enforces it.**
   - Verify runs a read-only preflight: trust state, a pending Codex update, runtime
     resolution.
   - It then sends one dispatch per distinct pin, with a task that acknowledges,
     writes and deletes a scratch file, and reads `HEAD`.
   - It records a `dely-verify-verdict` task in that Orca Run. Its result carries the
     verdict and the key: repository, both pins, Control harness and wake mode.
   - `dely dispatch` refuses when Orca holds no PASS verdict for the current key.
     Delivery then runs verify automatically, with no extra human gate, and stops
     with the reported fix on FAIL or BLOCKED.
   - A PASS lapses when the key changes. **Amended 2026-09-13:** it does not lapse on an
     environment escalation, which this record first said. Nothing implements that, and
     the next dispatch's ACK re-checks the environment; a quota or sign-in failure then
     reports `NO_ACK`, and the same failure twice goes to the human.
   - Verify restores the Control terminal's previously bound Run when it finishes,
     because creating a Run rebinds the caller and a delivery's `worker-start` then
     refuses to run.
3. **Workers acknowledge.** `dely dispatch` appends the acknowledgement instruction
   to the spec and waits 120 s by default. It observes the ACK only through
   `check --peek`, as a heartbeat from that dispatch's terminal, and never consumes
   a Delivery. No ACK stops the dispatch and reports a diagnosed cause. Recovery is
   one fresh start with the pins named again, never a retry into the same terminal
   and never a reused settled terminal. The same failure twice goes to the human.
4. **Launch path is a harness property, not a screen reading.**
   `references/harnesses.md` gains the columns Launch, Model pin, Control wake and
   Setup. `dely.js` reads them from that table.
   - Antigravity is adopted: launch, wait for output quiescence (at least 5 s since
     launch and 3 s of silence), then `worker-start --terminal`.
   - A model Orca cannot pin for a harness is pinned on the adopted launch argv.
   - Everything else uses `worker-start`.
   - No screen signature decides a route. Screen and log text only phrase the
     diagnosis.
5. **Control sleeps by its harness's wake mode.**
   - Claude Code, Cursor Agent CLI and GitHub Copilot CLI run `dely wait` as a
     background command.
   - Codex, Antigravity and Grok end their turn after dispatching. When
     nudged they run only `dely collect`, never the command quoted in the nudge text,
     because it would consume the message.
   - Kiro is not supported as Control.
   - **One consumer per Run at a time;** every other observer only peeks.
   - `dely wait` is that consumer in the background mode. It judges each Delivery as
     a whole: heartbeats only, it acknowledges and keeps waiting; any settling
     message, it acknowledges, prints the whole batch and exits `SETTLED`. It also
     exits `SILENT` (90 s without output after ACK) or `DEADLINE` (per dispatch,
     default 3600 s). It reports a dead dispatch as `collect` does, after consuming.
   - `dely collect` is that consumer in nudge mode. It reports settled work from
     `check --all` and `worker-list`, drains what remains, and checks silence and the
     deadline. A dispatch Orca has marked dead — no longer open, and it sent no
     settling message — is released and reported once as `FAILED`.
   - **Reported once is Dely's own memory, not Orca's bookkeeping.** The dispatch ids
     already reported, and those Dely stopped itself, live in
     `<git-dir>/dely/runs/<run>.json`, falling back to `~/.dely/runs` when the working
     directory is not a git repository. Orca's `terminalState` cannot carry it: an
     adopted dispatch is born `retained`, and `worker-release` can report success while
     releasing nothing.
   - **Amended 2026-09-12.** A `dely sidecar` process was this record's watchdog for a
     nudge-mode Control. It is removed. Orca already reports a dead worker
     (`liveness.verdict` `exited`, `dispatchStatus` `failed`), a sidecar terminal
     cannot be recognised by title because the shell rewrites it, and its liveness
     needs fields Orca does not send. What the sidecar alone covered — a worker that
     neither sends a message nor exits — now goes to the human.
6. **Setup hands trust to the human.** `dely:setup` opens each pinned harness once in
   an Orca terminal for the human to answer that harness's own trust dialog, then
   runs `dely:verify`. Setup still never answers a dialog and never writes a harness
   store. Codex needs no step: Orca's preflight trusts it.
7. **Tests.** `node --test tests/scripts.test.js` is a closure gate. It exercises the
   runtime against a fake `orca` with no model call.
8. **Amended in place.** The 2026-09-04 record's recovery route (retry into the same
   terminal) and its claim that `agent_prompt_blocked` was never observed are
   corrected. So is the 2026-08-29 trust record's superseding note.
9. **Amended 2026-09-13, after a live probe of 0.18.0 before merge.** Every harness
   was pinned to the candidate. Five deliveries in fresh repositories rotated Claude
   Code, Codex, Cursor, Copilot and Antigravity through Control, implement and
   review. All five reviews returned `ACCEPT` and pushed correct code, and injected
   faults held (`FAILED` exit 8 in 1 s for a killed worker, `SILENT` exit 6 at 93 s,
   report-once). Controls still stalled where the runtime left them a choice:
   - Claude Code invented a run id, and Copilot dispatched on the verify Run that
     `dely status` printed. So `dely open` creates and binds the delivery Run and
     prints it, `dely dispatch` refuses a Run that is not the one bound to Control,
     and `dely status` prints no run id.
   - Codex and Copilot, in nudge mode, ran the background form of verify. Codex then
     slept after a PASS with nothing left to wake it. So one `dely verify` picks the
     form from the Control wake column, and `dely wait` refuses a nudge-mode Control.
   - Copilot's nudge stayed unsubmitted in its composer after its TUI reloaded.
     Copilot 1.0.83 resumed on its own when a detached shell it started exited, so its
     wake mode is background.
   - Settled workers were never released, leaving two to four live harness sessions
     per delivery. `wait` and `collect` now release a dispatch after its
     `worker_done`, and Orca decides whether that terminal closes. Dely closes a
     terminal itself only when it created that terminal for an adopted launch, which
     `worker-release` retains. It knows this from its own run memory, written at
     launch, never from Orca's row shape. It also leaves the terminal open when Orca
     reports the terminal `user_owned`. Two readings of the row failed first: the
     top-level `ownershipState` the fake used, which real Orca nests under
     `resource`, and a `terminalState: retained` fallback, which also matches a
     terminal a human took over.
   - Any unexplained `NO_ACK` was blamed on Antigravity quota, because diagnosis read
     the three oldest Antigravity logs for every harness. It now reads Antigravity's
     newest log only for an Antigravity worker.
   - Codex and Copilot also load `~/.agents/skills`, where a stale 0.17.8 copy from
     `npx skills add` shadowed the 0.18.0 plugin while `codex plugin list` reported
     0.18.0. Install guidance now covers that directory.
   - Smaller fixes: Kiro's adopted argv needs `chat`; `dely wait` with nothing open
     exits; a group skipped because another is BLOCKED reads `SKIPPED`; an
     unregistered repository names `orca repo add`; verify opens no Run when every pin
     is BLOCKED.

   The nudge's quoted `check` command was run by both nudge-mode Controls and lost
   nothing, because an unacknowledged Delivery is replayed; that prohibition is kept
   but no longer carries the delivery.

This decision ships in **0.18.0**.

#### Alternatives considered

**Keep Control composing `orca` commands.** Rejected: it polls on harnesses that
cannot wake on exit, it improvises keystrokes, and it has no mechanism to enforce a
proven environment.

**A sidecar that consumes only heartbeats, and a dispatch that consumes to see the
ACK.** This was this record's first approved design. Superseded the same day: a
Delivery carries its whole FIFO batch whatever `--types` says, so either consumer
would acknowledge a settling message batched with a heartbeat. The dispatch would
lose it, and the sidecar would either lose it or stall on replay. Replaced by
peek-only ACK observation and a single whole-batch consumer.

**Rely on Orca's nudge for every Control.** Rejected: measured to race, and to stay
unsubmitted on Cursor. Harness-native background wake is used wherever it exists.

**A sidecar that wakes a sleeping nudge-mode Control on silence or deadline.**
Shipped, then superseded on 2026-09-12 after its re-review and a round of probes. As
an Orca terminal it cannot be found again: the shell rewrites the title, and
`terminal show` sends no field that says whether it still runs, so `collect` either
opens one per wake and leaks shells or never reopens one. As a detached process it
survives and can wake Control, but the detach command differs per operating system —
macOS has no `setsid` — and Orca cannot see or reclaim it. `orca automations` is
agent-backed, hourly at finest, and creates a worktree per run. Worker heartbeats run
1.5 to 15 minutes apart and are the agent's, not a clock. What remains is what Orca
already answers on the next wake: liveness, silence and the deadline, all read by
`dely collect`.

**Clear gates by screen signatures on every dispatch.** A prototype handled every
harness, but needed five fix iterations. Grok and Cursor updated themselves in the
background during the same probe, which ages any signature. Rejected in favour of
trust at setup and fail-closed diagnosis.

**Write the harness trust stores.** Rejected: it is authority the envelope does not
grant, and Orca's own writer was already wrong for two of three harnesses.

**Run the dry run on every delivery.** Rejected: it spends a worker session per pin
per delivery. The first real dispatch's ACK already re-checks the environment.

**Store the verdict in a file.** Rejected: the project keeps no log, `~/.dely` is
opt-in, and Orca is already the evidence store.

**bash with jq, or bash plus PowerShell twins.** Rejected: jq is not present
everywhere, bash does not run natively on Windows, and twins drift.

**Orca structured worker mode for Claude Code and Codex.** Not tried. It needs three
UI-only settings and is disabled while agent default arguments exist. Deferred.

**Name the skill `dely:check`, `dely:test`, `dely:ready` or `dely:doctor`.**
Rejected:

- `check` collides with the `orca orchestration check` command quoted in every nudge.
- `test` reads as project tests.
- `ready` is an Orca state.
- `doctor` names a rail this repository deleted and gates as absent. `verify` runs
  the live delivery path, not a static inspection.

#### Consequences

- **Dely is no longer prose-only.** It ships and tests a runtime. Its skills name
  runtime commands instead of Orca argv.
- **The bundled-runtime fallback depends on Orca's launcher layout,** which is not a
  public interface. When it breaks, verify reports BLOCKED and asks for Node 18 or
  newer.
- **Only macOS is measured live.** Linux runs the tests in CI. Windows is designed,
  not measured.
- **Nudge-mode Controls depend on Orca delivering the nudge, and on the worker
  speaking at all.** A worker that neither sends a message nor exits wakes nobody, and
  a human ends that wait. Measured across this delivery's 17 dispatches: no wake
  depended on a watchdog, and both failures were Control's own stop and terminal
  close.
- **The known residual failures, none of them fixed.** Each was measured during this
  delivery, and each needs a human to notice:
  - A git directory that resolves but cannot be written makes the dead-dispatch memory a
    silent no-op, so the `FAILED` line repeats on every collect.
  - A `.git` that is readable but not writable dies with an uncaught `EACCES` before
    reporting anything at all.
  - A throw raised inside `finishVerify` after the verdict is written cannot change that
    verdict.
  - The window between claiming a dispatch id and printing its `FAILED` line: a crash
    there loses that report permanently. At-most-once is the deliberate trade against
    duplicating the line.
  - `dely collect` on a Run whose only dispatch is dead and already reported exits 0 with
    no line, the same code a fully settled batch uses.
  - `collectSettles` turns a repeated delivery id into `ERROR ack failed`. That is the
    right bound for an ack-failure hang; whether real Orca ever reissues an id is unknown.
  - `skills/delivery/SKILL.md`'s "exit 8 when nothing is still open" over-claims: a fully
    settled batch with nothing open exits 0.
  - `releaseDispatch` parses the release receipt into two lines that do nothing. The
    contract holds by not depending on the receipt, not by those lines.
  - The report-once guard is held twice, by the memory read and by `remember()`'s return
    value; removing either alone keeps every test green.
  - `tests/fixtures/fake-orca.js` puts `stage` at the top level, where real Orca nests it
    under `projection`; the runtime reads both, and only the fake's shape is tested. For
    `ownershipState` and `retainedReason` the fake now emits real Orca's `resource`
    nesting, after an integration review found the runtime read only the fake's
    top-level copy and so never closed an adopted terminal against real Orca.
  - While a nudge-mode verify is asleep, a Control that dispatches anyway, is refused,
    and runs `dely open` has that new binding overwritten when `verify collect`
    restores the Run saved before verify.
  - `dely collect` accepts and ignores `--repo`.
  - `dely open` requires `--repo` and does not use it.
  - `dely collect` re-reads the whole Run history, so every call releases, and closes
    the terminal of, every past `worker_done` again. The repeats are redundant.
  - `dely dispatch` refuses a verify Run only when its objective matches the current key.
    A verify Run from another key, or a Run missing from `run-list`, passes that check.
  - An adopted terminal is closed only when the run memory that recorded its launch is
    found. `wait` or `collect` run from another working directory leaves it open.
  - That close also needs the dispatch's `worker-list` row: when the list fails or omits
    the row, a Dely-created terminal is left open.
  - Only `user_owned` stops the close. A Dely-created terminal Orca retains as
    `user_requested` with `external` ownership is still closed.
  - Two closes sit outside that rule. A launch that never reaches `ready` or never
    acknowledges closes its handle even when Orca created it. Verify's cleanup closes
    its adopted terminals without the `user_owned` guard.
  - Orca fences `check --run <id>` to the Run the caller is bound to
    (`consumer_fenced`). The fake does not model it, so ordering between binding and
    consuming is untested.
  - `dely wait` decides `NOTHING_OPEN` after peeking for a pending settle. Whether live
    Orca moves `dispatchStatus` before the `worker_done` is delivered, and whether a
    settle can show in `--peek` yet never reach this consumer's `check --wait`, are
    unmeasured.
  - `skills/verify/SKILL.md`'s prohibition on the nudge's quoted `check` command is
    unpinned, as is `AGENTS.md`'s gate list.
- **`AGENTS.md`'s gate list is not pinned to the workflow.** `tests/contracts.sh` pins
  the workflow's run lines against its own literal list, so deleting a gate block from
  `AGENTS.md` alone leaves the gate green.
- **A verify run costs one short worker session per distinct pin,** about one to two
  minutes for `implement` and `review` together.
- **Setup becomes more than pin selection,** and needs a human present for trust.

This decision is **not** expected to improve review rework, model quality, Orca
defects, or quota limits beyond detecting them.

#### Non-goals

- Fixing Orca's nudge race, readiness classifier or trust preflight.
- Orca structured worker mode.
- Changing this repository's `implement` or `review` pins.
- Optimising Grok Build or Kiro CLI.
- Parallel task execution.

#### Deferred

- **Live Linux and Windows verification.** Trigger: the first `dely verify` run on
  either.
- **Grok Build and Kiro CLI optimisation.** Trigger: either becomes a pinned harness
  for a real delivery.
- **Orca structured worker mode.** Trigger: a human decision to change Orca settings.
- **Removing each workaround when Orca fixes its defect.** Trigger: an Orca release
  that fixes the nudge race, the residual-text classifier, a trust preflight, or
  prompt injection timing.
- **Fallback pins on quota exhaustion.** Trigger: a second delivery escalated for
  quota.
- **An ACK limit scaled by effort.** Trigger: a NO_ACK on a worker that later
  acknowledged.

### 2026-09-06 — The dispatch prompt carries the acceptance row as written

#### Context

Probe 5 repeated the controlled round under `0.17.7`, which forbids the prompt
from defining role dispositions. On the measured variable it worked: where the
previous round's prompt said "If the implementation meets the requirement and the
instrument passes, return role disposition ACCEPT", this one said only "Return
exactly one role disposition: ACCEPT or CHANGES_REQUESTED", echoing this skill's
own phrasing.
One observation, one harness, a nondeterministic model — a signal, not a proof.

With that defect closed, a second became visible. Control relayed the
counterexample and corrupted it. The source required the *instrument* to reject an
**implementation** emitting an unpadded value; Control wrote that the **script**
must reject that value as **input**. The implementer then reasoned about its code
rather than observing anything, and the reviewer tested the corrupted form — a
property of shell arithmetic rather than of the candidate — and accepted.

The failure mode had moved from omission to corruption. Only separating the two
made the second visible; while Control could override the contract outright, that
masked what it did to the evidence it passed on.

This is specific to Bounded work. An implementer reads the decision record, the
plan and the baseline, so for Architectural work the acceptance table is a file the
worker reads and Control relays nothing. A Bounded design is approved in chat, so
the row is real but not durable, and must pass through Control's prose.

#### Decision

Where the design contract states an acceptance row — its instrument, its
counterexample, and what was observed — the prompt carries that row as written
rather than a restatement of it. The contract check binds the sentence inside
`### Launching a worker`, as it already does for the disposition rule.

#### Consequences

`0.17.7` and this change share a failure boundary — Control altering
protocol-owned meaning while restating it into a prompt — and take different
remedies: one forbids the prompt from defining what it does not own, the other
requires verbatim carriage of what it must transmit.

The rule binds because `### Acceptance` is unscoped: a Bounded change alters where
the design contract is stored, not whether it has an acceptance shape. A Bounded
design that is prose with no row is already non-conforming rather than a case this
rule silently declines to cover.

Nothing here observes Control writing a prompt. As with `0.17.7`, only a further
probe tests this, and one probe is one observation.

This decision ships in **0.17.8**.

---

### 2026-09-06 — The dispatch prompt states the task, not the disposition criteria

#### Context

A controlled probe repeated an earlier harness round against the current protocol:
same configuration, same brief verbatim, same task, one variable changed. The
reviewer accepted a change whose counterexample had never been observed — the same
failure `0.17.3`, `0.17.5` and `0.17.6` had each been written to close. They were
not consecutive: `0.17.4` shipped between the first two and addressed something
else.

The reviewer was not at fault. Control's dispatch prompt told it: "If the
implementation meets the requirement and the instrument passes, return role
disposition ACCEPT." Control invented an acceptance criterion contradicting the
protocol, and the reviewer complied with what it was given.

A Spike then measured the channels to a dispatched worker. The Orca preamble has
three sections, all Orca-authored, with no slot Dely or the project can extend;
the only project-controlled content is the prompt Control writes. Separately, four
harnesses — Claude Code, Codex CLI, Cursor Agent CLI and GitHub Copilot CLI — were
each asked for a canary planted in `AGENTS.md`, with instructions not to read any
file: all four returned it, so `AGENTS.md` auto-loads into a worker's context. Those are the only two routes.

#### Decision

The dispatch prompt carries the task, its scope and the evidence required. It does
not define the role dispositions or the conditions for reaching one.

The change takes neither route to the worker. It removes the contradiction at its
source instead, and `tests/contracts.sh` pins the sentences **inside**
`### Launching a worker` rather than anywhere in the file, because placement is the
claim: the rule exists to be met while a prompt is being composed.

#### Consequences

The distinction from the three prior attempts is **addressee, not readership**.
`## Review` was in Control's context on all of them, since the skill loads in full.
What changed is that those regulated the reviewer while the observed failure was
Control — and a dispatched reviewer may not have the skill loaded at all, so
`## Review` could not reach it in any case.

No instrument here can observe Control writing a prompt. This change is not
verified by its own delivery; only a further probe tests it. The rule was reached
by measuring a failure rather than by reasoning about one, which is the part worth
reusing.

This decision ships in **0.17.7**.

---

### 2026-09-05 — The reviewer reproduces the counterexample; the dispatch-record lookup is deleted

#### Context

The record below required a disposition to wait until the reviewer had located
the counterexample's red run in the implementer's dispatch record, with an
escape for a record Orca cannot recover. A later delivery added a second escape,
for a counterexample the implementer had no authority to produce. A third case —
a record recovered only in part — was found and queued, and is not shipped.

A Spike then measured the lookup instead of extending it. Across all ten settled
dispatches of those deliveries, `worker-read` returned one of two shapes. Cursor
dispatches gave `source: terminal`, 120 lines, `truncated: true`, `cursor: null`
— no way to page backwards. Claude Code dispatches gave `source: transcript`
with a cursor, warning that older messages were omitted from the bounded archive.

Searching a Cursor implementer's retained window for its own evidence found the
fixture command zero times and the failing output zero times. The window holds
the worker's closing summary, not the middle of the session where the
counterexample ran. `AGENTS.md` pins Cursor for `implement`, so in this
repository the implementer's dispatch record structurally cannot hold the red
run.

Across the five reviews written under the rule, none located the run. All five
reproduced the counterexample themselves and said so.

#### Decision

The lookup is deleted, with both of its escape branches. The surviving
obligation joins the rule it always belonged to: the reviewer observes the
counterexample discriminate for itself, and an instrument red only because the
behaviour was absent is not that observation. Review's opening paragraph no
longer describes `worker-read`; `## Evidence` and the `### Handoff`
`Verification` clause already carry that machinery, including what to do when
Orca cannot recover a dispatch item.

This removes the dependency on plane retention entirely, so the partial-recovery
case needs no branch. `tests/contracts.sh` pins the shortened prose verbatim.

#### Consequences

The `## Review` section falls from 353 words to 206. It remains 26 words larger
than the 180 it was before the lookup was introduced, so this is a reduction
against the peak and not a return to the starting point; the residue is the
discriminator sentence, which is the part that was load-bearing.

What the deletion does not do is make a reviewer look. Nothing in this
repository can observe that. The change moves the obligation to something a
reviewer can discharge from its own seat rather than one it provably could not.

The cost of the original rule was three deliveries of repair after it, because
it was written asserting what the plane retained without measuring it first.
That is the reusable part.

This decision ships in **0.17.6**.

---

### 2026-09-05 — The reviewer reads the implementer's dispatch record, and the contract-script ceiling is 280

#### Context

Probe round 7 ran a full Bounded delivery. The implementer did not observe its
counterexample; it used the instrument's failure against an absent feature as
the baseline — exactly what the implementation rule says does not count.
Control did not catch it. The reviewer did not catch it and returned ACCEPT.

None of the three broke a rule outright. The rules did not join up. The
counterexample obligation sat on the implementer, as prose in a handoff field
nothing can check. Review "gets ... the dispatch evidence" — passive. Control
handed the reviewer a three-line brief with no dispatch evidence in it, and
the reviewer had no instruction to go and get any. "Reproduce, do not accept"
named the gates. The reviewer ran the gates. Nothing said to reproduce the
counterexample.

`tests/contracts.sh` was at exactly 250 lines, with a hard `≤ 250` gate in
`AGENTS.md` and in `.github/workflows/contracts.yml`. The ceiling exists to
stop that script growing into a test suite.

#### Decision

The reviewer reads the implementer's dispatch record itself. Review no longer
describes dispatch evidence as something handed over. The capability is
`worker-read`: the hook-reported transcript when Orca can prove the worker
session, otherwise bounded terminal output with a typed `fallbackReason`. The
skill names that capability; it does not pin argv.

A disposition is not reachable until the reviewer has located, in the
implementer's dispatch record, the run where the counterexample was observed
red — an implementation that is present, runs, returns a pass, and is wrong.
An instrument red because the behaviour was absent is not that run. Where
Orca cannot recover the record, the reviewer says so with the reason the
plane gave, and treats the implementer's own account as the thing under
check rather than as the check.

**Superseded on 2026-09-05.** A Spike measured the dispatch record and found
it structurally cannot hold the red run under this repository's harness pin;
the lookup and its branches are deleted. The ceiling raise stands.

`tests/contracts.sh` pins that Review prose verbatim. The ceiling rises from
250 to 280 so the pin can exist. The raise is deliberate room for a pin the
contract needs; it is not permission to grow the script into a test suite.
The new budget is not spent beyond the pin.

The pin prevents the sentence from being silently weakened later. It cannot
make a future reviewer actually look. No instrument available in this
repository can observe that.

The coupled version is **0.17.3**.

#### Alternatives considered

**Keep review as a recipient of dispatch evidence Control attaches to the
brief.** Rejected: round 7 already showed Control omitting it, and a
recipient with nothing in the brief has no rule that tells them to fetch.

**Pin a keyword `grep` for `dispatch record` or `worker-read`.** Rejected:
that is the counterexample. A weakened "should read the dispatch record"
keeps the keywords, runs, and passes.

**Raise the ceiling only as far as the pin needs, to 260 or similar.**
Rejected: a one-off exact fit recreates the bind that forced this raise, and
the 280 figure is the approved room, not a target to fill.

**Leave the ceiling at 250 and drop a different check to make room.**
Rejected: the pin is the contract this delivery needs; deleting another
check to avoid a decided raise would spend the wrong budget.

#### Consequences

Review independence now includes fetching evidence, not only refusing the
implementer's reasoning. A review that stops at green gates is incomplete
when the counterexample run is missing from the dispatch record.

The verbatim pin will turn red on a semantics-preserving rewrap of the
Review section, the same way the maintenance-log pin does. That is accepted.

A later reader should not judge this pin against reviewer behaviour. The
gap is named, not solved.

#### Non-goals

No new evidence mechanism. No argv for `worker-read`. No checklist, numbered
procedure, or extra Review subsection. No change to the CI version guard,
which this delivery is the first to exercise on its guarded path. No
instrument that observes whether a reviewer looked.

#### Deferred

A further ceiling raise. Trigger: a pin the contract needs that does not fit
in the remaining budget, with the same reason — room for a pin, not growth
into a test suite. An eighth harness is one possible such pin, not a
pre-committed reason to raise.

### 2026-09-04 — Orca orchestration is the execution plane, and Dely stops hand-rolling dispatch

#### Context

Dely already requires Orca and forbids headless dispatch, but it wrote its own
procedure for the parts of a dispatch Orca can perform: waiting for a worker,
deciding whether a prompt was submitted, recovering from a harness dialog, and
identifying a session. That procedure is prose, and it has been failing.

Twenty-eight accepted deliveries are recorded in the opt-in machine-local
maintenance log. Across them, roughly one hundred and forty review dispositions
carry about fifty-five `CHANGES_REQUESTED` — near two in five. Twenty of the
twenty-eight deliveries carry at least one, and thirteen fail their first review.
The rate is not converging: deliveries in the first half of the window carry
zero to three, deliveries in the last week carry four, five and eight. The
protocol repository fares far better than the consuming application repository
that exercises it at scale, which is where the contract's assumptions break.

Sixteen frictions recurred across four consecutive delivery waves in that
consuming repository. Nine of the ten worst deliveries name Control's own
contract — an under-scoped plan, an unchecked premise, a wrong census, a rule
defined twice — rather than an implementer's work, as the drift source. The
remediation clause routes an in-contract finding to "the original implementer",
which is the wrong party for a defect in the plan.

A probe on 2026-09-04 measured the execution plane rather than reasoning about
it, and it changed the design:

- Orca knows all seven harnesses, but under agent ids that are not the binary
  names. `agy`, `kiro-cli` and `cursor-agent` return `agent_unconfigured`;
  `antigravity`, `kiro` and `cursor` are the ids that resolve.
- `worker-start` exits 0 with a receipt that reports `launch.requested`
  beside `launch.effective`. The rule "name the model and effort on every
  dispatch" had had no evidence behind it until this record cited that
  receipt; a later measurement withdrew that evidence. The rule stands, and
  now rests on the launch argv rather than on a receipt.
- Two typed failures appeared to correspond to two paragraphs Dely wrote by
  hand: a modal sitting between launch and composer, and input that never took.
  A later ten-round probe withdrew that reading — it never once observed
  `agent_prompt_blocked`, on any harness, and saw `agent_prompt_stalled`
  returned for a modal repeatedly. What the codes replace is real; the
  distinction between them was not.
- The modal that actually blocked a launch was not a trust dialog. It was a
  version-update prompt. The trust-handling column has been enumerating
  instances of a class it cannot finish enumerating: trust dialogs, update
  nags, session-restore pickers, changelogs.
- Worse, one of its cells is wrong. On a path with no entry in Claude Code's
  exact-path trust store, a launch carrying `--dangerously-skip-permissions`
  reached the composer with no dialog shown and no entry created. The cell
  asserts that flag "does not suppress it" and tells Control to select an
  option that never appears — while the same cell warns that a bare Enter
  quits the worker. Acting on the stale instruction is actively harmful.

  **This bullet's measurement was withdrawn on 2026-09-11 and is amended here
  on 2026-09-16.** The probe ran in a git worktree of an already trusted
  repository, and worktrees inherit Claude Code's trust, so no dialog was ever
  going to appear. A fresh repository shows the dialog with `No, exit`
  preselected even with the flag, reproduced on Claude Code 2.1.268. The
  reasoning that followed from it — that the trust column enumerated a class it
  could not finish enumerating — still stands on the other cells and is why the
  column went; the Claude cell was not one of its examples. The 2026-09-11
  record states the correction, and `harnesses.json` now carries it as the
  Claude entry's measured note. Amended in place rather than deleted, because
  the reasoning is still load-bearing and because a reader who finds only the
  original text acts on a claim that skips the one setup step needing a human.
  A task-1 implementer in the 0.20.0 delivery did exactly that, reading this
  bullet and not the correction 600 lines later.
- Orca's injected worker preamble already requires a short executive summary in
  the message body and a `payload.reportPath` pointing at any long-form
  artifact. The convention this project was about to invent already exists.

#### Decision

1. Orchestration is a required Orca capability. When it is absent, the existing
   rule applies unchanged: stop, with no headless fallback. `README.md`
   documents enabling it once, in the shared prerequisites, because the
   requirement is harness-independent.
2. Dispatch mechanics come from the plane. `worker-start` starts a worker and
   reports what was requested, `check --wait` is the completion wait, the worker reports once
   with `worker_done` and an outcome, `worker-release` returns the terminal,
   and `worker-read` is the bounded evidence read. The blocking-wait paragraph,
   the submission-detection paragraph with its ninety-second allowance and
   single-Enter procedure, and the session-id capture instruction are deleted;
   the dispatch id replaces the last of these.
3. One recovery route replaces the dialog catalogue: a dispatch that does not
   reach `ready` is diagnosed by reading its terminal and handling what is
   actually there, then retried into that same terminal. This record first
   split that route across two typed errors; a later measurement found the
   plane does not distinguish them, and the single route is what every
   recovery actually performed. It enumerates no vendor's dialogs, so it does
   not go stale when a vendor ships a new one. Amended 2026-09-11: the retry
   into the same terminal is withdrawn. A live re-review retried into a reused
   Codex terminal left its prompt unsubmitted and its model drifted, and a
   later probe did observe `agent_prompt_blocked`. Recovery is now one fresh
   start with the pins named again. See `2026-09-11 — Workers acknowledge,
   Control sleeps until an event, and dely:verify proves the path before the
   first dispatch`.
4. The prompt and the handoff stay files inside the worktree. Messages carry a
   short body and a `payload.reportPath`. The reason is this skill's own rule:
   a task spec and a message body are shell arguments, and prompts do not go in
   shell arguments. Amended 2026-10-10: both files live in the Run's folder,
   `.dely/local/runs/<run>/`, and are kept until the run closes. See
   `2026-10-10 — Every dispatch file lives in its Run's folder under
   .dely/local/runs/, kept until the run closes`.
5. `references/harnesses.md` keeps only facts verified in this delivery — the
   Orca agent id, the forbidden headless forms, and answers whose wrong choice
   destroys the worker. An unverified per-harness fact is deleted rather than
   carried, because this skill tells Control to prefer that file over a
   harness's own help output, which makes a stale cell worse than an empty one.
   This supersedes the column list settled on 2026-08-28, which named trust
   handling as a column of this table; that record is amended in place rather
   than rewritten, because its reason for the file's existence still holds.
6. No worker runs while a review of the same working tree runs, and the reason
   is stated: the tree and its gate surface are shared mutable state, and a
   review reproduces gates in that tree.
7. A review states what it did not verify, mirroring the design side's existing
   record of what the instruments cannot observe.
8. Control owns the plan and the decision record for the whole run, including
   remediating findings inside them. Amending them is not implementing the
   candidate. The reviewer that raised such a finding scope-checks the
   amendment.
9. Any claim about extent — an allowed scope, a count, a set of call sites —
   states the command that produced it, and where the claim is a count or a
   scope its instrument enumerates rather than samples.
10. `One pass` means one remediation pass per finding, not per review.
11. The plan is deleted in the release commit, before the release-binding
    review, so its deletion is inside the candidate that review verdicts.
12. The maintenance log's field labels are named. The text has said "labelled
    fields" without saying which, and five different spellings are already in
    service across the recorded lines.

#### Alternatives considered

**Terminal primitives plus a sentinel file.** Wait on `tui-idle` and have the
worker end a handoff file with the existing end-of-handoff sentinel. Rejected:
idle cannot distinguish a finished worker from one waiting on a question, which
is a distinction this skill already depends on; the idle detector is documented
for six agent CLIs that do not include four of the seven harnesses here; and a
worker's death stays silent until a deadline instead of arriving as an outcome.
The file half survives in decision four for a different reason — shell-argument
safety — not as a completion mechanism.

**Optional orchestration with a fallback path.** Rejected: two dispatch paths in
one contract, of which the rare one rots unexercised. The probe also showed the
adoption cost is lower than assumed; the feature was already enabled and already
carrying this project's own deliveries.

**Task graphs with dependencies, and the plane's decision gates.** Rejected:
tasks are sequential by contract, so a dependency graph buys nothing and invites
the concurrency that decision six forbids. Decision gates would add a second
approval surface beside the in-chat approval this skill treats as its boundary.

**A ready-indicator column in the harness reference.** This was the shape
proposed before the probe. Rejected by the probe itself: a cell can go stale, and
one already had. A typed error cannot go stale the way an enumerated fact does.

**Deleting the maintenance log as redundant with the plane's run records.** The
run records hold dispatch lifecycle; they do not hold why a delivery drifted.
Reading the log showed its drift-cause sentences are the source of nearly every
friction this record fixes, at a cost of one appended line per accepted delivery.
Rejected, and the log's field labels are named instead.

**Raising the contract script's line ceiling.** Rejected for this delivery. The
budget is met by removing a check the hosting platform already performs, and the
ceiling should be revisited on its own evidence rather than inside the change it
constrains.

**A mandatory read-only scoping dispatch before planning.** Correct in diagnosis
and wrong in shape: it adds a phase, taxing every future delivery, to fix what
decision nine fixes with one sentence. Deferred rather than adopted.

#### Consequences

This decision ships in **0.17.1**. `0.17.0` was not reusable: that number had
already been tagged and released on 2026-09-01 for the tree that added the
seventh harness, and this record's own change merged three days later. Bumping
the manifests without advancing the number left two contents sharing one
version, and an install of `0.17.0` from the release surface returned the
protocol this decision replaced. A delivery that changes anything under
`skills/` advances the version within that same delivery — whether it authors
a decision record, amends an existing one, or touches no record at all. The
earlier wording bound only the author of a new decision, who would name the
version in this section; pull request #42 amended existing records, so there
was no section to fill and the manifests stayed at 0.17.1 while the protocol
changed. The obligation is stated in `AGENTS.md`, which a delivery actually
reads. `tests/contracts.sh` takes a fixture root and so cannot read Git
history by design, which is why continuous integration has to carry the
guard. CI on `pull_request` now fails when `skills/` changes without a
change to both versioned manifests. That step fires only on `pull_request`,
so a direct push to `main` is uncovered. It proves both versioned manifests
changed, never that the number is right: a manifest edited without advancing
its `version` satisfies it. It is satisfiable by bumping the manifests
alone; the existing pin in `tests/contracts.sh` is what forces the third
site to follow. **0.17.2** carries that dispatch-claim correction and this
rule.

Dely's dependence on Orca deepens from launching terminals to owning the worker
lifecycle. The orchestration guide documents its own contract migrations, so the
mitigation is the practice this skill already follows: reference the version-
matched guide, state invariants, and never pin argv.

Control must run inside an Orca-managed terminal, because a run binds to a
coordinator handle. Users must enable a feature that ships disabled.

Removing the issue-form checker trades a fast local signal for a slower one: the
hosting platform surfaces a malformed issue form on its own pages rather than in
continuous integration.

The skill gets shorter while gaining rules, because the deleted procedure is
longer than the delegation that replaces it.

This decision is **not** expected to improve: concurrency safety, which the plane
explicitly declines to schedule or infer, leaving decision six as Dely's own
rule; mid-run dispatch drops in any individual harness; or a vendor's first-run
modals, which decision three routes rather than prevents.

#### Non-goals

Parallel task execution. Workers on another connected host. Nested workers.
Replacing the in-chat approval gate. A capability matrix describing the harness
that Control itself runs on.

#### Deferred

- Giving the repeated completion wait a stated exit. `timeout` occurs nowhere in
  the skill; the wait is bounded only by whatever deadline Control passes the
  plane. Trigger: a measurement showing the plane does not always surface a dead
  worker as an arriving settling message.
- A worker that ends its turn without finishing or reporting has no typed error.
  The plane reports the terminal alive and ready, so only a Control-side deadline
  distinguishes it from slow work. Trigger: a second occurrence, or a typed
  signal appearing in the plane.
- The prerequisite command is unverified against a disabled runtime. `README.md`
  tells a reader that `orca orchestration run-list --json` confirms orchestration
  is enabled; nobody has observed it fail when orchestration is disabled. An
  instrument only ever seen green is the defect this record is about. Trigger: a
  runtime with the feature off.
- The issue-form checker's removal rests on an unobserved premise: that the
  hosting platform rejects a malformed issue form. Nothing in the repository
  depended on the checker, but that argument was not tested. Trigger: a malformed
  form reaching a contributor.
- Absence assertions are literal, so a paraphrased restoration of deleted text
  passes. Inside the limit already stated: the checker proves a phrase present or
  absent, never that a rule means what it says.
- Wording defects left unabsorbed, each recorded rather than fixed because none
  lets an instrument accept a wrong implementation: the launch table's intro
  promises a note per harness while two of seven carry one, with no statement
  that an empty cell means "not measured here"; the Claude Code cell records the
  model pin but not the effort pin the receipts also show; a general rule about
  omitting effort sits in one row; the troubleshooting entry names orchestration
  as a possible missing capability but offers no command that distinguishes it;
  the preflight fence's comment column is misaligned; and the release-ordering
  check pins a line whose semantics-preserving rewrap would turn it red, and
  lacks a guard that keeps shell noise off a correct failure.

- Restoring any per-harness behavioural claim deleted by decision 5. The launch
  table previously asserted, for each harness, whether an interactive launch
  prompts a workspace trust dialog, whether the permission-default flag suppresses
  it, which option is preselected, and which keystroke is destructive; plus
  per-harness launch notes covering the `--agent` launcher, Kiro's `/tools
  trust-all` step and its interactive flag, Cursor's `--force --trust` and its
  `-w` prohibition, and Copilot's unavailable-model fallback and its
  session-restore picker answered with Escape. One of those claims was measured
  false on 2026-09-04 and the rest were not measured at all. Trigger for restoring
  any single one: a launch that a probe shows it would have prevented.
- Requiring the implementer to re-run the scope command before implementing.
  Trigger: drift-cause sentences still naming late scope discovery after roughly
  ten further deliveries.
- Raising the contract script's line ceiling. Settled 2026-09-05 at 280 for a
  verbatim review pin, not for an eighth harness. A further raise is deferred
  from that later record.
- Flipping the Kiro launch prescription away from its interactive flag. Trigger:
  a second machine or a second version reproducing the stall.
- Handling a first-run vendor modal beyond reading the terminal. Trigger: a
  blocked launch that reading the terminal cannot clear.

#### Limits of this delivery's evidence

`tests/contracts.sh` is a structural checker. It proves a phrase present or absent
and that a named section contains it; it cannot prove a rule means what it says,
that Control will follow it, or that the execution plane behaves as described.
Runtime behaviour was measured once, on one machine and one Orca build, by the
2026-09-04 probe and by this delivery's own dispatches; no gate re-measures it.
Several rules ship with no executable instrument and a human reading the diff as
their declared check, which is only worth keeping if someone reads it.

### 2026-08-31 — GitHub Copilot CLI is a first-class seventh harness, and it needs no sidecar

#### Context

Dely ships as an installable package for Claude Code, Codex CLI, Grok Build,
Antigravity CLI, Kiro CLI, and Cursor Agent CLI. The 2026-08-27 packaging rule
says a plugin-capable harness gets a thin nested sidecar pointing at `./skills/`,
root `plugin.json` does not grow for another vendor, and `npx skills` is the
fallback only where no such sidecar exists. That record also rejected raising the
`tests/contracts.sh` 250-line cap, on the grounds that a sixth harness must not
make a seventh impossible. This is that seventh harness.

Live GitHub Copilot CLI 1.0.82 was probed on macOS on 2026-08-31, against the
already-configured user profile:

- `copilot plugin marketplace add https://github.com/hieuphung97/dely.git`
  reports `Marketplace "dely" added successfully` and caches this repository's
  existing `.claude-plugin/marketplace.json`. `copilot plugin marketplace browse
  dely` lists the `dely` plugin. `copilot plugin install dely@dely` reports
  `Installed 2 skills`, `copilot plugin update dely` reports `Updated 2 skills`,
  `copilot plugin uninstall dely` succeeds, and `copilot skill list` shows
  `delivery` and `setup`. Install copies the whole package into
  `~/.copilot/installed-plugins/dely/dely/`.
- Copilot therefore resolves this repository through manifests that already
  exist. It reads the root `plugin.json` and finds `skills/` by convention; no
  Copilot-specific manifest was present during any of those runs.
- `copilot plugins list` reports repository instructions `AGENTS.md` and
  `CLAUDE.md` as loaded; `--no-custom-instructions` is the flag that disables
  that loading.
- `copilot --help` enumerates `--effort, --reasoning-effort` as
  `none|minimal|low|medium|high|xhigh|max`.
- There is no non-interactive model listing. `copilot models` fails with
  `Invalid command format`. `copilot -p "/model"` is not answered locally: it
  dispatched a real turn that auto-routed to `claude-haiku-4.5`. An unavailable
  `--model` value neither lists alternatives nor stops the run — the TUI prints
  `Model "claude-sonnet-4.5" from --model flag is not available. Using "auto"
  instead.` and continues. Entitlement is per account, so any stored slug list
  would be wrong for some reader.
- An interactive launch carrying `--allow-all` still opens `Confirm folder
  trust` — `Do you trust the files in this folder?` with `1. Yes` preselected,
  `2. Yes, and remember this folder for future sessions`, and `3. No (Esc)`. The
  permission flag does not suppress it.
- A second surface follows trust: `Restore interrupted sessions`, listing
  interrupted sessions from every folder with them preselected, footed
  `enter restore · esc start fresh`. It appeared on a first launch in a
  brand-new empty directory, listing sessions belonging to other paths. Enter
  there adopts an unrelated session instead of starting the dispatched worker.
- `-p, --prompt` is the non-interactive form. `--allow-all` is the documented
  equivalent of `--allow-all-tools --allow-all-paths --allow-all-urls`, with
  `--yolo` as its alias.

#### Decision

GitHub Copilot CLI is a first-class harness, equal in kind to the other six.
Its exact label everywhere a human reads or selects one is `GitHub Copilot CLI`.

Packaging adds nothing. The 2026-08-27 rule is satisfied by observation rather
than by a new file: Copilot installs from the manifests already in this
repository, so there is no `.copilot-plugin/` sidecar, no growth of root
`plugin.json`, no second skill tree, and no `npx skills` path for Copilot. A
sidecar is added later only if Copilot stops resolving this repository.

Install is documented with native Copilot verbs and the same shape as the Claude
and Codex sections: `copilot plugin marketplace add` of the git URL, then
`copilot plugin install dely@dely`, with `copilot plugin list`, `copilot plugin
update dely`, and `copilot plugin uninstall dely`. Because Copilot registers the
marketplace separately, uninstalling the plugin leaves that entry behind, and
`copilot plugin marketplace remove dely` is documented beside it.

Setup discovers Copilot effort from `copilot --help`'s `--effort` flag and does
not discover a model. Model is written as the literal `default`, which omits the
flag. A human may still name a slug, and setup does not invent one, store a
catalogue, or learn one by prompting the model. Setup does not write
`~/.copilot`. Copilot is a native `AGENTS.md` reader and also loads `CLAUDE.md`,
so neither file is called inert on Copilot; the `CLAUDE.md` write offer stays
Claude-Code-only.

Workers launch as an interactive `copilot` TUI carrying `--allow-all`. Never
`-p`/`--prompt`. `--model` and `--effort` are pinned from the managed block, each
omitted when its cell is `default`. A pin the account cannot use is not an
error: Control reads the `Using "auto" instead` line rather than assuming the pin
held. Trust is answered with the preselected `1. Yes`, never
`2. Yes, and remember this folder for future sessions`, because a dispatch must
not leave persistent trusted-folder state on the machine. Where the
`Restore interrupted sessions` picker follows, Control presses Esc to start
fresh; Enter there is a wrong-session hazard, not a submission.

The two versioned manifests advance together to `0.17.0`; root `plugin.json` and
`.cursor-plugin/plugin.json` stay versionless and unchanged. Human bug reports
offer the exact label `GitHub Copilot CLI`. `tests/contracts.sh` covers the
harness row, the discovery subsection, the README path, the permission default,
the forbidden headless form, and the dropdown **without exceeding 250 lines**, by
sharing loops and folding the existing per-harness verbatim subsection checks
into one helper rather than pasting a third block. The portable delivery protocol
still names no harness, and this repository's own phase pins are unchanged:
harness support is not deployment selection.

Amended 2026-08-31, after the first live Copilot dispatch, which implemented the
`AGENTS.md` edit described below. Every claim in the row above held against a
real worker. Orca documents no `copilot` launcher id, so Control composed
`copilot --allow-all --effort high` itself and ran it through an Orca terminal in
the worktree; the `--effort` flag was accepted and, with `--model` omitted, the
TUI reported `Auto`. `Confirm folder trust` appeared for a path already holding
the repository, with `--allow-all` on the argv and `1. Yes` preselected;
confirming it left `trustedFolders` empty, which is the point of preferring it
over the remembering option. The `Restore interrupted sessions` picker then
appeared and listed sessions belonging to four other directories, so Esc was
load-bearing rather than theoretical. The work prompt submitted on the first
Enter; no second Enter was needed. One difference from the other harnesses is
worth noting without being made into a rule from a single incident: this worker
reported its closure gates as a count rather than per-command output, so Control
reproduced them itself rather than accepting that account as the check.

`AGENTS.md` was deliberately outside this change for as long as it carried an
uncommitted managed-block edit at baseline, because Dely does not combine
ownership with a protected dirty path. Amended 2026-08-31: after both tasks were
accepted, the human released that path and asked for it in this delivery, so it
is now inside the change — commit `2abdb26`, the Copilot dispatch described
above, adds the seventh harness to its intro sentence and corrects the `review`
model cell. The ownership rule did not bend; the path stopped being protected.

#### Alternatives considered

- Add a `.copilot-plugin/plugin.json` sidecar for symmetry with Claude, Codex,
  and Cursor. Rejected: a live install, update, and uninstall cycle succeeded
  without it. A manifest whose absence changes nothing observable is decoration,
  and the packaging rule exists to prevent duplicate identity, not to require a
  file per vendor.
- `npx skills --agent copilot` as the install path. Rejected: Copilot has native
  plugin verbs, and the rule gives `npx skills` only to a harness that lacks
  them.
- Discover Copilot models by reading the `/model` picker in a session, or by
  calling the Copilot models endpoint. Rejected: setup's discovery is
  non-interactive by contract, and no local command lists models. Writing
  `default` is the honest result of live discovery finding nothing.
- Store a Copilot model list in this package. Rejected for the same reason as
  every other harness, and additionally because entitlement is per account —
  `claude-sonnet-4.5` was refused on the probing account while auto-routing
  chose `claude-haiku-4.5`.
- Treat the `Restore interrupted sessions` picker as a dispatch heartbeat and
  press Enter. Rejected: Enter there restores whatever session is preselected,
  including one from another folder.
- Answer trust with `2. Yes, and remember this folder for future sessions` to
  make later dispatches quieter. Rejected: a worker dispatch must not write
  persistent machine state that outlives it.
- Raise the `tests/contracts.sh` 250-line cap for the seventh harness. Rejected
  again, on the reasoning already recorded on 2026-08-27.
- Pin this repository's `implement` or `review` phase to Copilot to dogfood it.
  Rejected: harness support is not deployment selection.
- Include the `AGENTS.md` prose that enumerates supported harnesses. Rejected:
  that path is protected-dirty at baseline. Amended 2026-08-31: once both tasks
  were accepted, the human released that path and asked for it in this delivery,
  so a later commit adds `GitHub Copilot CLI` to the sentence and corrects the
  managed block's `review` model to `gpt-5.6-sol` — `gpt-5.6-sol-medium` is not
  a Kiro model id, and the effort belongs in the separate `--effort` flag. That
  is still not a phase pin change: the harnesses selected there are the human's.

#### Consequences

Copilot users get the same two skills through the manifests that already exist,
and the package gains a seventh harness without gaining a seventh file. Existing
Claude, Codex, Grok, Antigravity, Kiro, and Cursor surfaces are unchanged.
Copilot joins the copy-on-install family, so the cache-refresh boundary now
covers six plugin harnesses against Kiro's shared store, and `0.17.0` is what
makes those copies refresh.

Folding the per-harness verbatim subsection checks into one helper makes the
approved-policy strings data rather than pasted blocks. That is what buys room
under the 250-line cap; it also means a future harness costs roughly one line
there instead of three.

This does not improve model pinning on Copilot. The block can carry a slug, but
nothing in Dely can prove the account is entitled to it before the TUI reports a
substitution, and nothing here makes Copilot's model surface scriptable.

`AGENTS.md` named six harnesses while the README named seven, until the human
released that protected path late in the delivery. It now names seven, so this
repository's own instructions and its README agree, and the interim disagreement
this record originally predicted never reached `main`.

#### Non-goals

No `.copilot-plugin/` sidecar, root `plugin.json` growth, second skill tree,
`npx skills` path for Copilot, Copilot hooks, custom agents, MCP configuration,
`--add-dir` skill loading, autopilot or plan mode, ACP server use, remote or
cloud session control, headless `-p` dispatch, write to `~/.copilot`, Orca
change, phase-pin change, change to review depth, remediation routing, the
two-row managed block, or `skills/delivery/SKILL.md`.

#### Deferred

Add a `.copilot-plugin/` sidecar only if Copilot stops resolving this repository
from root `plugin.json` — the observable being `copilot plugin install dely@dely`
no longer reporting two installed skills. Document a Copilot model pin path only
when a non-interactive listing exists. Adopt an Orca `--agent copilot` launcher
if one appears; the first live dispatch, recorded above, used a hand-composed
argv because no such launcher id is documented, and that stays the route until
one is. Revisit the
250-line cap only if an eighth harness cannot fit after the helper refactor —
the trigger is a measured overrun, not a preference.

### 2026-08-29 — Workspace trust is a second gate; Control answers it in the TUI


**Superseded on 2026-09-04.** Measurement contradicted this record's central
instruction. On a path with no entry in Claude Code's exact-path trust store, a
launch carrying `--dangerously-skip-permissions` reached the composer with no
dialog shown and no trust entry created. The instruction to select
`Yes, I trust this folder`, the warning that a bare Enter quits the worker, the
Trust handling column this record defends, and its rejection of leaving that
column empty are all withdrawn: the column was deleted outright. What stands is
the observation that a modal can sit between launch and composer — but it is not
always a trust dialog, and it is now handled by reading that terminal and
retrying into it rather than by an enumerated per-harness answer. This note
first attributed that routing to a typed `agent_prompt_blocked`; a later probe
never observed that code, so the route does not depend on it. See
`2026-09-04 — Orca orchestration is the execution plane, and Dely stops
hand-rolling dispatch`. Amended 2026-09-11: a later probe did observe that code, and the retry into
the same terminal is withdrawn in favour of one fresh start. No screen reading
routes recovery. See `2026-09-11 — Workers acknowledge, Control sleeps until an
event, and dely:verify proves the path before the first dispatch`.
#### Context

`skills/delivery/references/harnesses.md` already records a per-harness
permission default, which covers tool approval only. Four of the six
harnesses still prompt a workspace-trust dialog on first interactive launch
in a path that is not yet trusted: Claude Code, Codex CLI, Antigravity CLI,
and Cursor Agent CLI. Grok Build and Kiro CLI open at the composer with no
workspace-trust surface. Kiro still has a separate tool-trust step,
`/tools trust-all`, already in Launch notes.

Probes on 2026-08-29, each in a fresh `git init` directory with the argv the
table records, showed: Claude Code defaults to `No, exit`; Codex CLI to
`Yes, continue`; Antigravity CLI to `Yes, I trust this folder`; Cursor Agent
CLI to `[a] Trust this workspace` when launched with `--force` alone.
`cursor-agent --force --trust` opens at the composer. `--help` documents
`--trust  Trust the current workspace without prompting`. The other three
prompting harnesses persist trust in machine-global config
(`~/.claude.json`, `~/.codex/config.toml`,
`~/.gemini/antigravity-cli/settings.json`).

These probes bind to the CLI builds installed on one machine on 2026-08-29.
A harness that redesigns its dialog silently invalidates a cell, and no
check in this repository catches that.

#### Decision

The two gates stay distinct. Permission default remains tool approval.
Trust handling records the workspace-trust surface. Only Cursor has an
argv flag for it (`--trust`), so Launch notes carry `--force --trust`.
Dely's envelope does not authorise writing those machine-global config
files, so for Claude Code, Codex CLI, and Antigravity CLI, Control answers
the dialog in the TUI — the same shape as the existing Kiro
`/tools trust-all` step. Claude Code's dialog defaults to exit: a bare
Enter quits the worker, so Control selects `Yes, I trust this folder` and
confirms before sending the work prompt.

#### Alternatives considered

- Write the machine-global trust stores from the envelope. Rejected: the
  envelope does not authorise that write.
- Treat a bare Enter as "accept trust" on every harness. Rejected: Claude
  Code's default is `No, exit`.
- Leave the Trust handling column empty. Rejected: a dispatched worker TUI
  stalls on a dialog the record never mentions.

#### Consequences

Control must confirm workspace trust in the TUI for Claude Code, Codex CLI,
and Antigravity CLI, and must not send Enter on Claude Code until
`Yes, I trust this folder` is selected. Cursor workers launch with
`--trust`. The table pin in `tests/contracts.sh` tracks the cells
verbatim; it does not re-probe the live TUIs.

#### Non-goals

No write to `~/.claude.json`, `~/.codex/config.toml`, or
`~/.gemini/antigravity-cli/settings.json`. No change to permission
defaults, forbidden headless forms, or Kiro's `/tools trust-all` step
beyond recording that it is the tool-trust path, not a workspace-trust
dialog. No automated check that a harness still shows the recorded dialog.

### 2026-08-29 — Cursor keeps its sidecar, and its plugin surfaces are not what they appear

#### Context

A Spike after `0.16.0` probed Cursor Agent CLI 2026.08.25-3e8eec8 directly and
against Cursor's own documentation. Several beliefs this file records turned out
to rest on misread evidence.

`~/.claude/plugins/installed_plugins.json` holds `superpowers`, `codex`,
`ponytail` and `dely@0.14.1`, all user scope, while `~/.cursor/plugins/local/`
was empty. The four entries Cursor's `/plugin` → `Installed` list shows under
`User`, labelled `(Claude Code)`, are Claude Code's installed plugins surfaced by
Cursor, not Cursor installs. That is why `cursor-agent plugin marketplace remove
dely` left `dely` installed, and why those entries offer only `Try in chat` with
no `Uninstall`.

An earlier reading — that Cursor had indexed and installed this repository before
`.cursor-plugin/plugin.json` existed, so the sidecar was redundant — was that
same surfaced Claude Code install, at the very version, `0.14.1`, that predates
the Cursor work. That test never happened.

The test has now happened. Pinning the marketplace to tag `v0.14.1`, whose commit
`54623e1` carries no `.cursor-plugin/`, indexed `1 plugin` and its marketplace
detail resolved `Skills: 2 (delivery, setup)`. So the sidecar is not required by
this build.

**Which manifest it used is not established.** The probe observed an outcome, not
a mechanism, and `54623e1` ships three candidates: a root `plugin.json` of
`{name, description}`, the `.claude-plugin/` pair, and `.codex-plugin/plugin.json`.
Cursor's documentation says Agent Plugins "require a root `plugin.json` with the
standard's schema identifier", and this repository's root manifest deliberately
carries no `$schema` — the 2026-08-27 record settled that adding one would break
the Antigravity lock — so the root file probably does not qualify as an Agent
Plugin. That narrows the field; it does not identify the winner. Any sentence
naming the mechanism would repeat the misreading this section exists to correct.
Cursor's documentation names `.cursor-plugin/plugin.json`, required field `name`,
as the Cursor Plugin format.

Installing from the marketplace produced the first Cursor-managed copy:
`~/.cursor/plugins/cache/dely/dely/<merge SHA>`, a full clone pinned to the
commit. It is labelled by marketplace name, `dely (dely)`, and its detail view
does offer `Uninstall`.

Cursor's CLI changelog dates the shell marketplace commands to 2026-07-13 and
defines `remove` as deleting a user-scoped marketplace. Cursor staff, forum,
2026-07: "There isn't a separate non-interactive command like `cursor-agent
plugin install <plugin-id>` yet."

#### Decision

`.cursor-plugin/plugin.json` stays. It is the documented Cursor Plugin format.
The fallback observed on 2026.08.25 is undocumented behaviour and is recorded as
a datum, not relied on. Removing the sidecar would be a deliberate decision
against the documentation, not an inference from "it worked without it".

These surfaces are recorded so no later reading mistakes them again. The install
and uninstall behaviour is settled in the 2026-08-28 README record; the Context
above cites two of its facts as evidence, and this paragraph adds only what that
record does not say — the `(Claude Code)` entries are a read-only view of another
harness's store, which is why they resist `plugin marketplace remove` and offer
no `Uninstall`. `plugin marketplace add` on a URL
whose manifest carries an existing marketplace name overwrites that marketplace
rather than adding a second.

#### Alternatives considered

- Delete the sidecar as redundant. Rejected: the redundancy evidence was the
  misread described above, and the documented format is the sidecar.
- Say nothing and leave the earlier reading in place. Rejected: it had already
  produced one wrong conclusion and a deferred trigger keyed on a meaningless
  number.

#### Consequences

The 2026-08-27 deferred trigger for `.cursor-plugin/marketplace.json` is amended
in place: it was keyed on a reindex reporting 0 plugins, and `update` reports `0
plugins indexed` on the same URL where `add` reports `1 plugin` seconds later.
That count does not mean what the trigger assumed, so the trigger is replaced.

This repository ships a format the documentation names and this build does not
appear to require. That is a deliberate margin, not a dependency: if Cursor ever
begins enforcing the Cursor Plugin format, the sidecar is already there; if it
never does, the file costs one manifest.

#### Non-goals

No change to any manifest, to `README.md`, or to what `setup` writes. No Cursor
hooks, rules, MCP, or Marketplace submission. No attempt to make the Claude Code
store manageable from Cursor.

#### Deferred

Whether a Cursor-managed install classifies differently from a surfaced Claude
Code one in any way that matters beyond the label and the `Uninstall` action —
trigger: a behaviour difference actually bites. Refreshing the Cursor-managed
install past the commit it is pinned to — trigger: a human wants the newer
version in Cursor.

### 2026-08-28 — README's Cursor uninstall step names the marketplace, not the plugin

#### Context

`README.md`'s `### Cursor Agent CLI` fenced block labelled
`cursor-agent plugin marketplace remove dely` as `# uninstall`. It does not
uninstall. Verified twice on cursor-agent 2026.08.25-3e8eec8: after running
it, a new Cursor session still listed `dely` in `/plugin` → `Installed` with
both skills present. Cursor's own CLI changelog (2026-07-13) defines
`plugin marketplace remove` as deleting a user-scoped marketplace; installed
plugins are unaffected. Every other harness section in the README pairs
`# uninstall` with a command that actually uninstalls.

Uninstalling is interactive: `/plugin` → `Installed` → select `dely` →
`Uninstall`, observed present on a Cursor-managed install. That action
appears only for plugins Cursor manages; Cursor also lists Claude Code's own
installed plugins in the same panel, labelled `(Claude Code)`, offering only
`Try in chat`. Cursor staff, forum, 2026-07: "There isn't a separate
non-interactive command like `cursor-agent plugin install <plugin-id>` yet."
There is no non-interactive install or uninstall command from `cursor-agent`
itself (Claude Code has one, `claude plugin uninstall dely`, documented in
this repository's own `README.md`).

#### Decision

The fenced block's comment now says what `plugin marketplace remove` does —
removes the marketplace, not the plugin. The prose tells the reader that
uninstalling `dely` itself happens in `/plugin` → `Installed` → `Uninstall`,
that no non-interactive command exists for it, and that the `Uninstall`
action is absent for a `dely` installed through Claude Code.
`tests/contracts.sh` extracts the fenced block on its own and requires all
four `plugin marketplace` commands plus the new comment inside it, and
separately forbids `# uninstall` from appearing anywhere in the Cursor
section, so a half-edit that fixes the prose but leaves the fenced block's
`# uninstall` — or that re-adds `# uninstall` beside the fence's `remove`
line while keeping the new comment elsewhere in the block — still fails
contracts.

#### Alternatives considered

- Say uninstalling is impossible. Rejected: it is possible, just interactive.
- Drop the `remove` command from the fenced block. Rejected: it is still a
  real, useful command — it just isn't uninstall.

#### Consequences

The Cursor section stops promising a working `# uninstall` command that
silently no-ops. Readers who copy the fenced block get an accurate comment;
readers who want to actually uninstall are pointed at `/plugin` →
`Installed`.

#### Non-goals

No change to the four `plugin marketplace` commands, to `/plugin`, `/dely`,
`/delivery`, `/setup`, or to any other harness section.

#### Deferred

Document a non-interactive Cursor uninstall command if and when Cursor ships
one.

### 2026-08-28 — Harness launch mechanics ship inside the delivery skill

#### Context

`AGENTS.md:53-67` carries operational knowledge about six external CLIs: the
permission default for each, the headless invocation forms forbidden for each,
Kiro's two-step `/tools trust-all` launch, and Cursor's launch notes. It sits
under `AGENTS.md:52`, "The table is this repository's deployment selection, not
the portable protocol" — true of the pin table above it, false of the fifteen
lines below it. Changing a pin changes nothing there; those lines describe how
six tools behave, not what this repository chose.

None of it reaches another project. The managed block `setup` writes, templated
at `skills/setup/SKILL.md:40-52`, is one invocation sentence and a four-row pin
table. A project installing Dely gets the portable protocol and its own pins,
and nothing about launching any harness. A Kiro worker dispatched from another
project launches without `/tools trust-all`, because the only place that
instruction exists is a file that does not ship.

`skills/delivery/SKILL.md:134-136` states the skill "has no compatibility matrix
around one". The matrix exists; it was parked where that sentence could stay
literally true.

Probes on 2026-08-28 made the cost concrete. A blocking confirmation is
invisible to the execution plane: with Claude Code's workspace-trust dialog on
screen, `orca terminal wait --for tui-idle` returned `satisfied: true` and
`agentWait` was `null`. Following the documented dispatch procedure against that
state typed the work prompt into the dialog, and Enter selected its highlighted
row, `No, exit`; the worker exited and the prompt was never delivered. Workspace
trust is per-harness and per-path: after Claude Code recorded
`hasTrustDialogAccepted` for a directory, Antigravity CLI and Cursor Agent CLI
both still prompted for that same directory, while Codex, Grok and Kiro did not
prompt at all. The defaults disagree — Claude Code highlights `No, exit`,
Antigravity `Yes, I trust this folder`, Cursor `[a] Trust this workspace` — so no
single keystroke is safe.

That is the third item of its kind. Kiro's two-step has been stranded since
2026-08-26 and Cursor's launch notes since 2026-08-27. Recording trust handling
in `AGENTS.md` would strand a third.

Portability is constrained by how each harness installs. `.cursor-plugin/plugin.json`
points at `./skills/`, and the Kiro path installs with
`npx skills add … --skill delivery --skill setup`, which selects skill
directories. A file outside `skills/` reaches neither. A directory inside a skill
reaches all of them: `skills/delivery/templates/` is present in
`~/.agents/skills/delivery/`, `~/.grok/installed-plugins/dely-*/skills/delivery/`,
`~/.gemini/config/plugins/dely/skills/delivery/`, and the Claude plugin cache.

#### Decision

Per-harness launch mechanics live in `skills/delivery/references/harnesses.md`
and ship inside the delivery skill. The file is a table keyed by harness:
permission default, forbidden headless forms, launch notes, and trust handling.
The trust column is present and empty; filling it is a later delivery, and a
column added later would be a schema change instead of a row edit.

**Superseded in part on 2026-09-04.** The trust column was filled, then removed
together with the rest of the trust catalogue, and an Orca agent id column was
added. The reasoning above stands as the reason the file exists and ships inside
the skill; only its column list is out of date. See
`2026-09-04 — Orca orchestration is the execution plane, and Dely stops
hand-rolling dispatch`.

`skills/delivery/SKILL.md` names that path where it instructs Control to compose
a worker launch. The protocol body still names no harness: the matrix is a
reference the skill owns rather than prose the skill contains.
`SKILL.md:134-136` is rewritten to say where the matrix lives instead of denying
one exists. The denial is not left standing, because a shipped artifact that
contradicts its own contents is the defect corrected in `README.md` earlier the
same day.

`AGENTS.md` keeps what the protocol delegates to it — gate commands, artifact
paths, default branch, the managed pin block — plus this repository's own rules:
self-update ordering, the absence of a phase-implied sandbox, and native Internet
access. It loses lines 53-67 and gains a pointer.

`AGENTS.md` also loses three restatements that the shipped package already
carries and that arrive no earlier than it: review independence, the
no-headless-fallback rule, and the design/release dispatch rule. All three are
read only during a delivery, by which time the skill is loaded.

The three are not carried the same way, and the distinction is recorded because
an earlier draft of this record got it wrong. Review independence and the
no-headless-fallback rule are duplicated in `skills/delivery/SKILL.md`. The
design/release sentence is a compound: its release half is duplicated at
`SKILL.md:282`, but its design half — that design runs in the current
interactive session and is not dispatched — has no counterpart in
`skills/delivery/SKILL.md` at all. It is carried by `skills/setup/SKILL.md:19-21`,
"There is no control row, because the current interactive session already exists
and is never dispatched", which ships in the same package. So the rule is
entailed by the package rather than duplicated inside one skill, and removing it
from `AGENTS.md` loses nothing. Saying it "duplicates the protocol" without that
qualification was false, and a task 2 review blocked on it.

Restatements that do arrive earlier stay: the default branch and the sentence
selecting which shape invokes the skill are needed before any skill is invoked,
because `CLAUDE.md` is one line, `@AGENTS.md`, loaded every session, while
`SKILL.md` loads on invocation.

`tests/contracts.sh` retargets its permission-flag grep and its verbatim dispatch
pin from `AGENTS.md` to the reference, and adds a negative check that `AGENTS.md`
no longer carries the per-harness flags.

The reference states each harness fact once. An earlier form of this decision
required both a table and a retargeted verbatim pin on the original prose
paragraph, which forced the same facts into the file twice: a pinned paragraph
and an unpinned table. A task 1 review demonstrated that shape is not merely
redundant but unprotected — falsifying a table row to claim `--yolo` as Cursor's
permission default, contradicting the paragraph four lines above it, passed every
gate with `rc 0`, because the table was checked only for the presence of literal
flag strings that the paragraph already supplied. That is the drift class this
record's Context names as the problem being solved, reintroduced inside the file
built to end it. The verbatim pin therefore targets the table rows, and the prose
paragraph is deleted rather than carried alongside them. The protection an
earlier decision placed on that sentence survives; only its carrier changes.

This amends the 2026-08-27 "Composed TUI argv carries the execution plane's
permission default" decision, whose closing paragraph placed the per-harness
permission defaults in this repository's `AGENTS.md`. The rule it settled is
unchanged; only the file that carries the defaults moves. That record is amended
in place rather than rewritten.

#### Alternatives considered

- A third skill, `dely:harness`. Rejected: the Kiro install line names skills
  explicitly, so every existing user's documented install command would change,
  and the skill would surface as a slash command in every palette for no
  user-facing purpose.
- A data file at the package root, `harnesses.json`. Rejected on the portability
  constraint: it reaches neither the Cursor sidecar's `./skills/` tree nor a
  `--skill`-selected Kiro install.
- `setup` generates the mechanics into each project's `AGENTS.md`. Not rejected
  on merit — it is the only option putting the mechanics in context before the
  skill is invoked. Deferred: it ends the managed block's minimality, the
  generated text must vary with the pins chosen, and each project keeps a copy
  that goes stale when the plugin updates.
- Leave it in `AGENTS.md`. Rejected: that is the status quo that stranded Kiro's
  two-step and Cursor's launch notes, and would strand trust handling next.

#### Consequences

The shipped protocol changes, so the package version advances to `0.16.0`. Under
`AGENTS.md`'s self-update rule the change takes effect for the delivery after the
one shipping it.

`tests/contracts.sh` is at 247 lines against a hard `≤ 250` gate. Retargeting is
roughly neutral; the added negative check is not. If the work cannot fit, the
outcome is `NEEDS_REPLAN`, not a raised cap — raising a gate to fit a plan is the
failure the gate exists to catch.

A project already running Dely receives the reference only after it updates the
plugin. Until then its behaviour is unchanged, not worse.

The reference becomes a maintenance surface: when a harness changes its CLI, that
shows up there, versioned with the package rather than with any one project.

#### Non-goals

No trust-handling content in the reference; that is the next delivery and the
first real exercise of the new home. No change to the pin table, to how `setup`
discovers models and effort, or to what `setup` writes. No new ability for the
execution plane to distinguish a blocking confirmation from an idle prompt; that
limitation is recorded, not fixed.

#### Deferred

`setup` generating harness mechanics into a project's `AGENTS.md` — trigger: a
project needs them in context before the delivery skill is invoked. Trust
handling rows in the reference — trigger: this decision lands. Asking Orca to
expose a "blocked on confirmation" terminal state — trigger: a second observed
worker loss, or an Orca release offering such a state. The count stands at
one: the loss this record's own Context describes, not a further one. A second,
distinct legibility gap was observed on 2026-08-28 and gets its own trigger:
`orca terminal read` renders a harness's ghost-text suggestion in the same place
as a pending prompt, so reading the input box does not establish that anything is
waiting to be submitted — trigger: a dispatch that sends Enter on the strength of
that reading and loses or misdirects a worker. The stale line count in
this file's 2026-08-25 record, the `/add-plugin superpowers` reference, and the
`/dely` palette filter's undefended coupling to the word "Dely" in
`skills/setup/SKILL.md`'s description — no trigger; recorded and unowned.

### 2026-08-27 — Cursor Agent CLI is a first-class sixth harness

#### Context

Dely ships as an installable package for Claude Code, Codex CLI, Grok Build,
Antigravity CLI, and Kiro CLI. Those five adapters share one `skills/` tree.
Claude and Codex use nested sidecars (`.claude-plugin/`, `.codex-plugin/`).
Antigravity and Grok validate root `plugin.json` (`name` and `description`
only; Antigravity 1.1.19 is `additionalProperties: false`). Kiro has no
plugin sidecar that can share that tree, so it installs with `npx skills`.

Live Cursor Agent CLI 2026.08.25-3e8eec8 is an interactive TUI by default,
lists models through `cursor-agent models`, accepts `--model`, has no
`--effort` flag, and reads `AGENTS.md` natively. Its plugin CLI exposes
`plugin marketplace add|list|remove|update` and no `plugin install`. This
machine already had a user marketplace named `dely` pointing at this git
URL; `cursor-agent plugin marketplace update dely` indexed **0 plugins**.
Root `plugin.json` is not an Agent Plugin (`$schema` is required; adding it
would break the Antigravity lock). Cursor identifies format by path:
`.cursor-plugin/plugin.json` is a Cursor Plugin.

Superpowers installs on Cursor via `.cursor-plugin/plugin.json` with
`"skills": "./skills/"` and `/add-plugin superpowers`, not `npx skills`.

`tests/contracts.sh` is 249 lines with a hard `≤ 250` gate. A sixth
harness pasted as a second Kiro-sized block would blow that gate.

#### Decision

Cursor Agent CLI is a first-class harness, equal in kind to Claude Code,
Codex CLI, Grok Build, Antigravity CLI, and Kiro CLI.

Canonical skills stay in `skills/`. A plugin-capable harness gets a thin
nested sidecar that points at `./skills/` and does not copy the tree and
does not edit root `plugin.json`. A harness that owns the root manifest
(Antigravity; Grok also validates it) does not grow that file for another
vendor. `npx skills` remains the fallback only when a harness has no such
sidecar (Kiro). A harness with a native plugin path does not also get an
`npx skills` README section.

Cursor packaging is `.cursor-plugin/plugin.json` with `name` `dely`, the
same one-line description as the other manifests, and `"skills": "./skills/"`.
It carries no `version` (version stays the Claude and Codex pair), no hooks,
and no second skill tree. `.cursor-plugin/marketplace.json` is not added
unless a live reindex of this git marketplace still reports 0 plugins after
`plugin.json` exists. Amended 2026-08-29: that condition is unusable, because
`plugin marketplace update` reports `0 plugins indexed` where `add` reports
`1 plugin` on the same URL seconds later. The count is not a plugin count. The
file is added only if the marketplace detail view stops resolving this
repository's skills — it showed `Skills: 2 (delivery, setup)` on 2026-08-29.

Install is native Cursor: `cursor-agent plugin marketplace add` of the git
URL, then in a Cursor Agent session type `/plugin`, go to the `Marketplace`
tab, search `dely`, and choose `Install for you (user scope)`. Type `/dely`
to filter the palette to Dely's own `/delivery` and `/setup` before invoking
them. Do not document `npx skills --agent cursor`, PATH `agent`,
`cursor` (the IDE wrapper), or copying into `.cursor/skills/`.

Setup discovers models from `cursor-agent models` (offer the slug before
` - `). There is no `--effort` flag: write the literal `default` for Effort.
Do not invent an effort vocabulary, do not strip effort suffixes from slugs,
and do not synthesize parameterized `[effort=…]` forms. Omit unusable
discovery. Setup does not write `~/.cursor`. Cursor is a native `AGENTS.md`
reader; the CLI also applies `CLAUDE.md` as a rule, so that file is not
called inert on Cursor. The `CLAUDE.md` write offer stays Claude-Code-only.

Workers launch as an interactive `cursor-agent` TUI. Never PATH `agent`
(it collides with Grok). Never `-p`/`--print`. Never `-w`/`--worktree`.
Prefer Orca `--agent` when it can pin the block's model; otherwise
hand-compose `cursor-agent --model <slug>` (omit `--model` when the cell
is `default`) and carry `--force`. Do not put `--trust` or an unpinned
`--sandbox` on that argv. Do not copy Kiro's two-step unless `--force` on
argv is observed to be fatal.

The two versioned manifests advance together to `0.15.0`; root `plugin.json`
stays unchanged. Human bug reports offer the exact label `Cursor Agent CLI`.
`tests/contracts.sh` covers the new sidecar, discovery, README path, dispatch
sentence, permission default, and dropdown without exceeding 250 lines, by
sharing loops with the Kiro checks rather than pasting a second block. The
portable delivery protocol still names no harness. This repository's phase
pins are not a Cursor-support change.

#### Alternatives considered

- `npx skills --agent cursor --global` as the Cursor path. Rejected:
  Cursor has the sidecar family Dely already uses for Claude and Codex,
  and this git marketplace already indexed 0 plugins for lack of
  `.cursor-plugin/`.
- Native plugin and `npx skills`. Rejected: two install truths.
- Agent Plugins 1.0 at repo root (`$schema` on `plugin.json`). Rejected:
  conflicts with the checked Antigravity schema; Grok validates that
  file; Cursor might then see a second identity.
- Duplicate `skills/` under `.cursor/`. Rejected: that is the drift the
  packaging rule exists to prevent.
- PATH `agent` as the documented binary. Rejected: it collides with Grok.
- Raise the `tests/contracts.sh` 250-line cap. Rejected: that is how a
  sixth harness would make a seventh impossible.
- Change this repository's phase pins to Cursor. Rejected: harness
  support is not deployment selection.

#### Consequences

Cursor users get the same skills through a sidecar, not a sixth tree.
Existing Claude, Codex, Grok, Antigravity, and Kiro command surfaces are
unchanged. Plugin caches still copy the package at install time; Cursor
joins that copy-on-install family, not Kiro's shared symlink store.

Live `/plugin` → `Marketplace` tab install and official Marketplace search
remain consumer-profile checks: this repository does not mutate live harness
configuration during compatibility validation. Interactive plugin install is
the current Cursor CLI limit; there is no `plugin install` verb.

#### Non-goals

No Cursor hooks, rules, agents, commands, MCP, Cloud Agent, ACP, headless
`--print` dispatch, PATH `agent` launcher, `--worktree` worker checkout,
Orca change, write to `~/.cursor`, `npx skills` for Cursor, official
Marketplace submission, root `plugin.json` growth, change to review depth,
remediation, the two-row managed block, or `skills/delivery/SKILL.md`.

#### Deferred

Add `.cursor-plugin/marketplace.json` only if Cursor fails to resolve this
repository's plugin — the observable being the marketplace detail view showing
`Skills: 2 (delivery, setup)`, as it did on 2026-08-29. See that date's
amendment, which retires the reindex-count form of this trigger. Submit Dely
to the official Cursor Marketplace when a human wants Customize search
without a git URL. Prove Orca `--agent` plus `--model` on the first Cursor
dispatch; escalate if it cannot pin. Adopt a Kiro-style two-step only after
`--force` on argv is observed to be fatal. Offer parameterized `[effort=…]`
model forms in setup only if slugs that already encode effort are not
enough. The next harness follows this packaging rule rather than reopening
it.

### 2026-08-27 — Composed TUI argv carries the execution plane's permission default

#### Context

Commit `538bf9d` required Control, when composing a TUI launch argv itself, to
keep the execution plane's default permission-bypass flags for that harness
and add no unpinned sandbox. Twelve hours later, `1945bb8` rewrote that
sentence to stay harness-agnostic after a Kiro live-probe review. The rewrite
said to keep the launch command as-is and not add permission-bypass flags the
command did not already carry. That inverts the rule: Orca applies permission
defaults only on its `--agent` launcher path, and a hand-composed
`orca terminal create --command` gets none of them. Grok, Antigravity CLI, and
Kiro CLI cannot use launch-time model selection on `--agent`, so every
dispatch of those harnesses is composed by hand and hits the defect. The
released `v0.14.0` tag (`5c12c26`) carries the inversion, and a lexical
contract check required the inverted wording.

#### Decision

The portable delivery rule is restored without naming a harness. Composing
the TUI launch argv is not a request for a different permission posture than
the one the execution plane is already configured to apply for that agent;
that configured default is carried onto the composed argv. The rule still
forbids adding a sandbox the project did not pin. Kiro CLI's existing
exception stands: `--trust-all-tools` does not go on the argv.

This repository's `AGENTS.md` prefers Orca's `--agent` launcher whenever it
can pin the block's model and effort. Amended 2026-08-28: the per-harness
permission defaults used when argv is composed by hand moved out of `AGENTS.md`
into `skills/delivery/references/harnesses.md`, so they ship with the plugin.
The rule settled here is unchanged; only its carrier moved.

#### Alternatives considered

- Keep the inverted as-is wording because it is harness-agnostic. Rejected:
  agnostic wording that drops the configured default is the defect.
- Name harness-specific bypass flags in the portable skill. Rejected: that is
  what `1945bb8` set out to undo, and Kiro's default is not a bypass flag on
  argv.
- Rely on Orca's `--agent` path only. Rejected: three harnesses cannot pin
  model and effort that way, and `AGENTS.md` requires both on every dispatch.

#### Consequences

Hand-composed launches match the host's configured agent-tab permission
posture. The contract check now rejects the `v0.14.0` skill text. Live TUI
permission posture has no automated instrument; Control confirms it by
launching the composed argv and reading the TUI.

### 2026-08-26 — Kiro CLI is a first-class fifth harness

#### Context

Dely shipped as an installable package for Claude Code, Codex CLI, Grok Build,
and Antigravity CLI. `dely:setup` discovered models and effort from those four
CLIs, but it could not offer Kiro CLI. Live Kiro CLI 2.16.2 exposes an
interactive TUI, lists models as JSON through `kiro-cli chat --list-models
--format json`, accepts `--model` and `--effort`, and reads `AGENTS.md`
natively. Its default agent discovers skills from `.kiro/skills/` and
`~/.kiro/skills/`. The open `npx skills` installer supports Kiro CLI at those
paths, and Orca 1.4.188 ships a Kiro launcher.

The repository's root `plugin.json` is deliberately limited to `name` and
`description` for Antigravity CLI 1.1.19. A Kiro Power using Agent Plugins 1.0
would require additional root manifest fields, so one root manifest cannot
safely serve both checked command surfaces.

#### Decision

Kiro CLI is a first-class harness, equal in kind to Claude Code, Codex CLI,
Grok Build, and Antigravity CLI.

Kiro installs the existing `delivery` and `setup` skills with `npx skills`,
targeting the `kiro-cli` agent at global scope. The native Kiro commands are
`/delivery` and `/setup`; Dely does not add a Kiro-specific package or duplicate
the skill tree. Install, verification, update, and removal use the installer's
documented command surface.

Setup discovers Kiro models from `kiro-cli chat --list-models --format json`
and offers each `model_id`. It reads effort choices from `kiro-cli chat --help`
rather than prompting a model or storing a catalogue. An unavailable Kiro CLI
or an unusable discovery result is omitted, not guessed. Setup does not write
`~/.kiro` or create or modify custom agents. Kiro receives the managed Dely
block through its native `AGENTS.md` support.

Orca launches Kiro as a real interactive TUI, `kiro-cli chat --tui`, without
`--trust-all-tools` on that argv: putting it there opens a confirmation whose
default is "No, exit", and Orca's Enter kills the session. Once the TUI is
idle at its prompt, Control sends `/tools trust-all`, observed to trust tools
for the session with no confirmation dialog, then the work prompt. A headless
`kiro-cli chat --no-interactive` process in a shell tab is not a Dely worker. The portable delivery protocol
still names no harness and does not change. The two versioned manifests advance
together to `0.14.0`; root `plugin.json` stays unchanged. Human bug reports
offer all five supported harnesses.

#### Alternatives considered

- Package Dely as a Kiro Power at the repository root. Rejected because the
  required Agent Plugins manifest fields conflict with the checked strict
  Antigravity manifest.
- Add a nested Kiro Power with a second copy of `skills/`. Rejected because it
  creates two sources of truth for the delivery contract and templates.
- Tell Kiro users to copy or symlink the skills manually. Rejected because
  install, update, and removal would no longer be one verifiable public path.
- Create a custom Kiro agent for Dely. Rejected because Dely is a workflow skill,
  not a replacement agent, and setup does not mutate harness configuration.

#### Consequences

Kiro users get the same delivery and setup behaviour without a fifth package
format. The install command depends on the external `npx skills` command and
uses global scope, so running it intentionally mutates the user's Kiro skill
directory; Dely itself never performs that mutation. Kiro custom agents can
change default resource inheritance, so users of such agents remain responsible
for including the standard Kiro skill resources.

Live discovery may offer only `auto`, as observed on Kiro CLI 2.16.2. That is a
valid live result, not a reason to invent model names. This repository's own
phase pins remain Claude Code for implementation and Codex CLI for review.

#### Non-goals

No Kiro Power, `.kiro/` package, custom agent, hook, MCP server, steering file,
or write to `~/.kiro`. No Kiro IDE, Web, Mobile, Crew, ACP, or headless dispatch.
No Orca change. No change to review depth, remediation, the two-row managed
block, root `plugin.json`, or `skills/delivery/SKILL.md`.

#### Deferred

Adopt a Kiro Power only when one package manifest can satisfy every supported
harness without duplicating the skill tree. Configure custom-agent resources
only when a consumer explicitly needs an agent that disables default skill
inheritance. End-to-end global installation and live skill activation remain a
consumer-profile check because this repository does not mutate live harness
configuration during compatibility validation.

### 2026-08-26 — Antigravity CLI is a first-class fourth harness

#### Context

Dely shipped as an installable plugin for Claude Code, Codex CLI, and Grok Build.
`dely:setup` discovered models and effort from those three CLIs. The repository had
no root `plugin.json`. `agy plugin validate` of the checkout failed with
`missing plugin.json`. `agy plugin validate .claude-plugin` returned `[ok]` with
`skills : skipped (not found)`: a present, passing, empty plugin. Orca already
detects and launches `agy` as a TUI agent. Antigravity CLI reads `AGENTS.md`
natively. Its published plugin schema allows only `name` and `description`.
Live `agy` 1.1.19 lists models as TSV (`agy models`) and takes `--effort
low|medium|high`. Some model slugs already end in `-high`, `-medium`, or `-low`.

#### Decision

Antigravity CLI is a first-class harness, equal in kind to Claude Code, Codex CLI,
and Grok Build.

The repository root is the `agy` package: a root `plugin.json` with `name` `dely`
and the existing `skills/` tree. Version remains only in the Claude and Codex
manifests, bumped together. Install is `agy plugin install` of the git URL or a
local path. Setup discovers models with `agy models` (offer the slug column) and
effort from CLI help (`low|medium|high`), the same live-surface rule as the other
harnesses. An uninstalled `agy` is omitted, not an error. Model and Effort cells
are written as chosen; setup does not strip effort suffixes from slugs. Setup
does not write `~/.gemini` and does not offer `GEMINI.md`. This repository's
managed Dely table stays Claude Code for `implement` and Codex CLI for `review`.
`skills/delivery/SKILL.md` still does not name harnesses. It may carry two
portable launch rules only: write the worker prompt to an untracked file inside
the worktree, do not stage it, and delete that same file after the worker
returns (amended 2026-10-10: the file lives in the Run's folder under
`.dely/local/runs/` and is deleted with that folder when the run closes); when composing TUI argv, keep the execution plane's default
permission-bypass flags and add no unpinned sandbox. Install documentation
does not restate those rules. Refresh of an `agy` install is a second
`agy plugin install` of the same source; the CLI has no `plugin update`.

#### Alternatives considered

- A nested `.agy/` or `.antigravity-plugin/` bundle. Rejected because `agy plugin
  validate` and `agy plugin install` target the given directory's `plugin.json`
  and sibling `skills/`; a nested layout needs a different install path or
  duplicated skills.
- Documenting `agy plugin import claude` as the supported path. Rejected because
  import is a migration of an already-installed Claude copy, not first-class
  install of this repository, and Customize cannot offer `agy` until setup
  discovers it.
- Storing an Antigravity model catalogue in setup. Rejected by the existing
  discovery contract.
- Adding `version` to root `plugin.json`. Rejected because the published schema
  is `additionalProperties: false` with only `name` and `description`.
- Changing this repository's phase pins to Antigravity CLI. Rejected as out of
  scope: harness support is not a deployment-selection change.
- Revert the launch-rule commit and leave dispatch undocumented. Rejected after
  review: the portable rule belongs in `delivery`, not in this repository's
  install docs or phase-table notes.
- Invent `agy plugin update`. Rejected: the live CLI has no such subcommand.

#### Consequences

Consumers can install and pin Dely on `agy` the same way they do on the other
three harnesses. Plugin caches still copy the package at install time. A future
strict validator may reject unknown root-manifest fields, which is why that file
stays within the published properties. Live docs and live install paths for
staged plugins have disagreed (`~/.gemini/antigravity-cli/plugins/` versus
`~/.gemini/config/plugins/`); Dely documents the command, not a cache path.

#### Non-goals

No Antigravity 2.0 desktop or IDE packaging. No Orca change. No hooks, agents,
MCP, `.agents/skills/`, or `GEMINI.md`. No headless `agy -p` dispatch. No
`plugin@marketplace` beyond git-URL or local-path install. No change to review
depth, remediation, or the two-row managed block.

#### Deferred

Orca's ability to pass `--model` and `--effort` into a live `agy` TUI is an
execution-time capability, not a repository instrument. Prove or escalate it
when a delivery first dispatches `agy`. Interactive skill activation inside an
`agy` session is the same class of observation. A native Antigravity marketplace
selector is deferred until a consumer needs `plugin@marketplace` rather than a
git URL.

### 2026-08-25 — Dely ships a verifiable community-ready open-source surface

#### Context

Dely was publicly readable and its manifests and README named the MIT license,
but the repository did not contain the license grant itself. GitHub therefore
reported no detected license. The repository's community profile was 28%: it
found the README but no contribution guide, code of conduct, issue template,
pull-request template, or license file.

The three documented plugin-install commands matched the installed Claude Code,
Codex CLI, and Grok Build command surfaces, and both available plugin validators
accepted the package. That proved package shape, not self-service onboarding.
Orca was mandatory with no fallback, yet the README did not tell a new user how
to obtain or preflight it, verify an installation, update or uninstall Dely, or
recover from common failures.

Repository contracts passed locally, but no CI workflow ran them for pull
requests. The default branch had neither protection nor a ruleset, private
vulnerability reporting was disabled, and every merged pull request so far came
from the maintainer. `AGENTS.md` was precise guidance for coding agents, not a
substitute for a human contribution path.

#### Decision

This decision amends the earlier lean-package decision only where that decision
limited the shipped surface and fixed the package version. Its thin-protocol,
state-ownership, testing, and maintenance-log decisions remain in force.

Dely's next public package version is `0.13.0` in both versioned manifests. The
repository carries the canonical MIT license text with copyright `2026 Hieu
Phung`; a manifest label or a one-word README declaration is not the license
artifact.

The README owns the complete user path: supported prerequisites and environment,
Orca installation and preflight, installation in each supported harness, one
ordinary-use quickstart, post-install verification, update and uninstall
commands, troubleshooting, and the versions against which those commands were
checked. Guidance distinguishes tracking the default branch from an immutable
release where the harness supports a ref.

The repository carries the smallest GitHub-recognized community surface:

- `CONTRIBUTING.md` explains issue-first public-contract work,
  fork/branch/pull-request flow, English artifacts, repository gates, decision
  ownership, version reconciliation, and review expectations. External
  contributors do not need Dely or Orca; maintainers own this repository's
  delivery protocol.
- `CODE_OF_CONDUCT.md` adopts Contributor Covenant 2.1 and names
  `contact@hieuphung97.com` for enforcement reports.
- `SECURITY.md` supports the latest release, directs vulnerabilities to GitHub
  private vulnerability reporting, names the same email as a fallback, and
  forbids public vulnerability issues.
- Structured bug and feature issue forms request reproducible, decision-useful
  evidence. One pull-request template asks for scope, verification, contract and
  documentation impact, without copying Dely's internal handoff format.

One GitHub Actions workflow runs the repository closure gates on pull requests
and the default branch. Its unique required job is `contracts`. The structural
contract test checks the community artifacts and the CI entry point with one
fixture that demonstrates an incorrect entry point is rejected; it does not grow
back into an English prose interpreter.

After the workflow has reported `contracts` successfully, the repository enables
an active default-branch ruleset that requires a pull request, the `contracts`
status check, and resolved conversations, and rejects deletion and
non-fast-forward updates. It requires zero approving reviews so a solo
maintainer is not locked out of their own pull request. Private vulnerability
reporting is enabled at the same release boundary. Both settings are verified
through GitHub's API because Git cannot own forge configuration.

#### Alternatives considered

- Put all community guidance in the README. Rejected because GitHub would not
  surface contribution, conduct, security, issue, and pull-request guidance at
  the interactions where contributors need it, and a README license label still
  would not ship the canonical grant.
- Add a complete governance, ownership, support, funding, roadmap, and changelog
  suite. Rejected because one maintainer and GitHub Releases do not yet justify
  those extra state owners.
- Require one approving review immediately. Rejected because the sole maintainer
  cannot approve their own pull request; CI plus an explicit pull-request path is
  the enforceable boundary until another maintainer exists.
- Leave repository checks local. Rejected because external contributors need the
  same deterministic result without reproducing maintainer machine state.

#### Consequences

The installed plugin copy becomes slightly larger because license and community
files travel with the repository. That cost is accepted: the files define the
rights and collaboration contract of the package being copied.

A new user gets one route from prerequisites to ordinary use, while an external
contributor can submit a normal pull request without owning the Dely/Orca control
plane. Pull requests receive the same structural check before merge. The solo
maintainer retains the ability to merge an accepted, green pull request without a
fictional second approver.

Rulesets and private vulnerability reporting remain forge state rather than Git
artifacts. Their API verification is therefore required release evidence. If the
repository becomes private, GitHub plan limits and Actions billing must be
re-evaluated before relying on the same deployment.

Compatibility evidence does not modify live harness caches during a delivery.
Where a harness does not expose a safe isolated profile, validation is limited to
public remote access, manifest validation, and the verified command surface, and
that limit is stated rather than described as a clean-install smoke.

#### Non-goals

No CLA or DCO, `CODEOWNERS`, mandatory reviewer, governance board, support forum,
funding file, public roadmap, standalone changelog, documentation site,
localization, paid GitHub feature, code-scanning rollout, or automated mutation
of a user's harness configuration. The delivery and setup skill protocols do not
change.

#### Deferred

Require an approving review when a second active maintainer can provide one.
Add a dedicated support channel when support traffic outgrows issues. Add a
governance or ownership document when decision authority extends beyond one
maintainer. Automate clean-profile installation only when every supported harness
offers a disposable configuration boundary that does not touch live caches.

### 2026-08-25 — Dely is a lean automation-first plugin with an opt-in machine-local maintenance log

#### Context

The repository had 9,850 tracked lines after the automation-first release. The
runtime and installation surface accounted for 837 lines, while `docs/` accounted
for 6,918 and contract tests for 1,896. Claude Code, Codex CLI, and Grok Build each
copied the whole repository into an installed plugin, although their validators
reported only one skill directory and no commands or agents. Historical research,
completed migration material, a standalone push guard, and three prose-contract
test programs therefore shipped to ordinary users without contributing to plugin
installation or execution.

The delivery log had the same ownership problem. Every consuming project named and
tracked its own Markdown file even though the record exists to help a
later Dely maintenance session establish recurrence. That made plugin observations
part of project history and required every project to carry Dely-specific state.

#### Decision

Dely remains an automation-first thin control protocol. It owns the approved design
boundary, sequential implementation, independent review, bounded remediation, and
exact-HEAD release convergence. Orca owns dispatch, Git owns candidate state, and CI
plus the forge own release state. The shipped plugin surface is limited to the two
skills, their two Architectural templates, the harness manifests, concise installation
guidance, repository-maintainer instructions, this current decision, and one focused
structural contract test.

Completed research, superseded decisions, transient designs, the tracked project log,
and ancillary tooling outside the plugin component surface do not remain in the
current tree. Git history is their archive. The contract test checks only structural
public invariants; it does not attempt to parse or prove the semantics of the complete
English workflow contract.

The plugin version is `0.12.0` in both versioned manifests.

Maintenance logging is machine-local and opt-in at `~/.dely/log`:

- Dely never creates the directory or file. A missing path is skipped silently, and
  deleting the file opts out.
- Control appends exactly one physical line only after a delivery is accepted and all
  required checks are green. Aborted or incomplete deliveries are not recorded.
- The line contains an ISO-8601 UTC timestamp and labelled fields for the Git-root
  basename, plan, pull request or `none`, implementation-round count, ordered review
  dispositions, and one short drift-cause sentence. Tabs separate fields; embedded
  tabs and newlines become spaces. Acceptance is implicit because every record has
  already crossed that gate.
- Dely never reads this file for routing, recovery, or runtime decisions, and the text
  layout is not a public parsing schema.
- An append failure produces a visible warning but does not invalidate or block an
  otherwise accepted release.

#### Alternatives considered

- Keep a Git-ignored log inside each project. Rejected because it still creates plugin
  state in every checkout, splits observations across worktrees, requires ignore
  configuration, and can be committed accidentally.
- Keep the tracked project log. Rejected because plugin-maintenance observations do not
  belong in the consuming project's durable product history.
- Partition machine-local logs by repository or add a registry and stable hash.
  Rejected because one labelled line in one file is sufficient until basename
  collisions are observed to cost maintenance work.
- Retain all research and contract-test fixtures as maintainer-only material. Rejected
  because plugin managers copy them to every installation and Git already preserves
  them without keeping the current product surface ambiguous.
- Remove every test and durable decision. Rejected because one small structural check
  and one current rationale provide useful regression protection without restoring the
  previous documentation system.

#### Consequences

Ordinary installations become materially smaller and current documentation stops
presenting retired components as part of Dely. Projects no longer configure or commit a
delivery-log path. A maintainer who wants observations must create `~/.dely/log`
explicitly and is responsible for its permissions, retention, and deletion.

The machine-local log is not portable across machines. Two repositories with the same
root basename are not distinguished when no pull-request URL supplies context. Short
concurrent appends have no lock. Those limits are accepted because the log is optional
maintenance evidence and never a state owner.

Removing the standalone push guard is breaking for anyone who manually wired that file
as a Git hook. No compatibility stub remains. Dely's release contract still forbids
direct protected-branch release, force-push, and merge, but this decision does not claim
to replace repository branch protection.

Reducing the prose-contract suite also reduces the number of wording mutations rejected
mechanically. Independent review owns semantic verification; the remaining program
checks only shapes it can discriminate honestly.

#### Non-goals

No log reader, query command, rotation policy, lock manager, telemetry upload, automatic
instruction mutation, compatibility adapter, package builder, or second distribution
repository. No change to Orca, phase roles, review depth, remediation routing, setup's
two-row managed block, or the Architectural plan templates.

#### Deferred

Partition or strengthen project identity only after an observed basename collision makes
a record ambiguous. Add locking only after an observed concurrent append corrupts a
short record. Add rotation only after file growth causes a maintenance problem. A public
schema or reader requires a separate approved use case; ordinary maintenance reading by
a person or agent does not trigger one.
