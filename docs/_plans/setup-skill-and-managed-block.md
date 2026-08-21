# Plan — a `dely:setup` core skill that writes one managed block in `AGENTS.md`, and a program that checks it

Decision record: `docs/decisions.md`, "2026-08-21 — Project configuration is a
managed block in `AGENTS.md`, written by a second core skill `dely:setup`"

**Baseline:** the SHA of the commit carrying that decision record amendment and
this plan.

## Goal

`dely` ships two core skills. `dely:setup` configures a project at the start of a
Control Session: it discovers the installed harnesses' models and effort levels
from local sources, offers a quick path and a customize path, and writes exactly
one managed block into the project's `AGENTS.md` between `<!-- dely:begin -->` and
`<!-- dely:end -->`, holding a `Dely` heading, a `Coordinator` line, and a
`Phase | Harness | Model | Effort` table for `control`, `implement`, `review` and
`release`. `bin/delivery-doctor` gains a section that reads that block and reports
whether it is absent (the deliberate fallback), well formed, or broken. This
repository migrates its own phase table into such a block. The package version
moves to `0.6.0` and the README stops carrying a settled question as open.

Out of reach in this unit: any change to `skills/delivery/SKILL.md`, to the hooks,
to the evidence reader, or to the four phases. Setup does not install, trust or
enumerate anything. Nothing here proves that a harness discovers the new skill —
that is the forward smoke after migration.

## Allowed scope

```
skills/setup/SKILL.md                  new
bin/delivery-doctor                    managed-block section
tests/managed-block-contract.sh        new focused instrument
.claude-plugin/plugin.json             version
.codex-plugin/plugin.json              version, interface prompt
AGENTS.md                              self-migration, and the new closure gate
README.md                              document setup; reconcile State
```

Carried without being listed and checked here rather than assumed:

- **Colocated tests of allowed source.** `bin/delivery-doctor` has no colocated
  test; its tests live in `tests/`, and `tests/delivery-doctor-grok-hook.sh` is
  the existing one. It must still pass unchanged, so it is inside scope for
  running and outside scope for editing.
- **Registry or inventory tests enumerating what this plan adds.** Checked: there
  is no skill-inventory test in this repository, and `.claude-plugin/plugin.json`
  carries no `skills` key because Claude Code discovers `skills/` by directory.
  This yielded nothing.
- **Documents owning an allowed path.** `README.md` owns the layout listing and
  the install instructions; `AGENTS.md` owns the closure gates and the phase
  selection; `docs/decisions.md` owns the contract and is already amended at the
  baseline. `docs/harness-surface.md` and `docs/findings.md` are addressed under
  forbidden scope below.

## Forbidden scope

- `skills/delivery/SKILL.md` — its name and contract are unchanged by decision.
  The fallback-without-a-block behaviour it must exhibit is already what it does:
  it names no models, and `AGENTS.md` supplies them or does not.
- `hooks/session-start-context.sh`, `hooks/post-tool-journal.sh` — `AGENTS.md`
  forbids editing either while a plan is running, because Grok executes them by
  absolute path from whichever copy its adapter points at.
- `hooks/hooks.json`, `hooks/grok-hooks.json.template`, `git-hooks/pre-push`,
  `bin/delivery-evidence` — no new event, no new rail. Name-suggests-relevance:
  `hooks/grok-hooks.json.template` is about hook wiring, not project
  configuration.
- `docs/findings.md` §20 and `docs/harness-surface.md` — both hold model and
  effort tables this plan proved stale on 2026-08-21. Correcting them is a
  separate observation-owned unit; the decision record carries the new readings
  and cites where the old ones are wrong. Editing them here would mix an
  observation correction into a contract change.
- `docs/options.md` — the README's second open item, whether `intellectronica/ruler`
  retires per-harness manifests, is genuinely still open there. Only the
  `cc-safety-net` sentence is reconciled.

## Tasks

### 1. `dely:setup` exists as a core skill and states its own contract

**Behaviour.** A harness that has the package loaded can invoke `dely:setup`, and
the skill it loads states: the two paths, the managed-block schema, the discovery
commands per harness, the pinning rule including the literal `default`, the
refusal conditions, the coordinator rule, and what setup will not do.

**Direction.** `skills/setup/SKILL.md`, frontmatter `name: setup` and a
`description` written the way `delivery`'s is — what it is for and when not to use
it — because that description is the discovery surface. Follow `delivery`'s own
rule that the skill holds portable shape and never concrete environment values:
the discovery *commands* are in the skill, the discovered *catalogue* is not.

State the three discovery commands exactly as they were run at design:
`claude -p "/model" --output-format json`, `claude -p "/effort"
--output-format json`, `codex debug models`, and `grok models`. Record beside them
that the two Claude probes are answered locally at zero cost and zero turns, that
Codex `visibility: hide` slugs are not offered, that Codex reasoning levels are
per slug rather than per harness, and that Grok effort is taken from the installed
CLI's help and observed validation and is never discovered by dispatching to the
model.

State the refusals as refusals: broken markers, more than one managed block, or a
legacy phase table that contradicts the block are reported to the human unchanged.
State the non-goals: no install, no hook trust, no writes to `~/.claude`,
`~/.codex` or `~/.grok`, no coordinator installation, no enumeration or invocation
of project-owned workflow plugins, no `Skills` column, no dependency resolver.
Install guidance may be shown only when the human explicitly asks.

Include the Claude Code limitation in the skill's own words: Claude Code does not
read `AGENTS.md`, so the persistent instruction reaches Codex and Grok natively and
reaches Claude Code only where the project has a `CLAUDE.md` importing it. Setup
reports this; it does not write `CLAUDE.md`.

**Files.** `skills/setup/SKILL.md`.

**Focused verification.** `tests/managed-block-contract.sh` asserts the file
exists, that its frontmatter `name` is `setup`, and that it carries a non-empty
`description`. Fails if the file is absent, which is its state at the baseline.

**Document impact.** `README.md` — it owns the layout listing, which currently
names `skills/delivery/SKILL.md` as "the workflow, one file".

### 2. `bin/delivery-doctor` reads the managed block and distinguishes absent from broken

**Behaviour.** `delivery-doctor <repo>` reports one of: no managed block, named as
the deliberate fallback rather than a failure; a well-formed block, reported `ok`;
or a failure naming which part is wrong. It fails on more than one `<!-- dely:begin -->`,
on a `begin` without a matching `end` or an `end` before its `begin`, on a block
missing the `Dely` heading, missing the `Coordinator` line, missing the
`Phase | Harness | Model | Effort` header row, or missing any of the four phase
rows. It reads only the region between the markers; prose outside it never causes
a verdict.

**Direction.** A section in the existing script, in the style of the Grok adapter
section: `ok` / `warn` / `bad` lines, `bad` incrementing `failures`. Absent block
is `warn`, never `bad` — the decision record makes no-block a supported state, and
a doctor that fails a supported state trains people to ignore it. The four phase
names are `control`, `implement`, `review`, `release`. Do not validate the *values*
in Model or Effort against any catalogue: this package stores no catalogue, and
`default` is a legal value meaning the flag is omitted.

**Files.** `bin/delivery-doctor`.

**Focused verification.** `tests/managed-block-contract.sh`, fixture-driven, in the
shape of `tests/delivery-doctor-grok-hook.sh`: build a throwaway repository per
case, run the doctor against it, and assert on the managed-block line. Cases, each
of which must be distinguishable from the others:

1. no `AGENTS.md` at all — not a failure
2. `AGENTS.md` with no markers — not a failure, reported as the fallback
3. a complete well-formed block — `ok`
4. a well-formed block with unrelated prose and a second table outside the
   markers — still `ok`, proving the reader is bounded by the markers
5. two `<!-- dely:begin -->` markers — failure
6. `begin` with no `end` — failure
7. block missing the `Coordinator` line — failure
8. block missing the `review` row — failure
9. block whose table header is not `Phase | Harness | Model | Effort` — failure
10. a block whose Model cell is the literal `default` — `ok`, proving the doctor
    does not validate values against a catalogue

Case 4 and case 10 are the two that stop this check from being a grep for four
strings anywhere in the file. Case 8 is the one the log says gets missed: the
previous adapter check passed an adapter with a required event deleted.

**Document impact.** `README.md` — it owns the "Checking the wiring" section, which
enumerates what `delivery-doctor` verifies.

### 3. This repository's own `AGENTS.md` becomes the first managed block

**Behaviour.** `bin/delivery-doctor` run against this repository reports the
managed block `ok`. The project's dispatch selection is unchanged in substance:
`control` on Claude Code `opus` `high`, `implement` on Grok Build `grok-4.6`
`medium`, `review` on Codex `gpt-5.6-sol` `medium`, `release` on Grok Build
`grok-4.6` `medium`, coordinator Orca.

**Direction.** Replace the existing `## Phase dispatch` table with the managed
block. The two columns the minimal schema does not carry must survive as prose
immediately outside the block, not be deleted: the worker surface rule
(interactive TUI under the coordinator, no headless command in a shell tab) and
the review sandbox pin `--dangerously-bypass-approvals-and-sandbox`. The paragraph
explaining that this table is a deployment selection rather than the portable
protocol, and the sentence that `design` runs in the control session, also stay
outside the block.

Add the new focused instrument to the closure gates. Add the persistent
instruction that Planned or Critical work invokes `dely:delivery` inside the
managed block, since that instruction is what setup writes for every consumer.

**Files.** `AGENTS.md`.

**Focused verification.** `bash tests/managed-block-contract.sh` includes a final
case running the doctor against this repository itself and asserting `ok` on the
managed-block line. At the baseline this repository has no markers, so that case
is red for a reason distinct from the fixture cases.

**Document impact.** `AGENTS.md` owns its own gate list and must gain the new gate
command, or the gate exists and nothing runs it.

### 4. The package version, the Codex interface prompt, and the README

**Behaviour.** Both manifests declare `0.6.0`. The Codex interface `defaultPrompt`
mentions configuration as well as delivery, so a Codex session's default entry
point surfaces both skills. The README documents `dely:setup`, lists
`skills/setup/SKILL.md` in the layout, states the minimal onboarding sequence, and
its **State** section no longer describes the `cc-safety-net` question as open.

**Direction.** `0.5.0` to `0.6.0` in `.claude-plugin/plugin.json` and
`.codex-plugin/plugin.json` — a new core skill is a minor bump, made explicit here
so release does not infer it.

Minimal onboarding, stated as four steps and nothing more: install `dely` in the
harness, open a session in the project, invoke `dely:setup`, then ask for a change
normally.

In **State**, replace the `cc-safety-net` clause with what was settled on
2026-08-20 — the secret-scanning plan is dropped, `git-hooks/pre-push` is retained
because `git push --dry-run origin HEAD:main` was not blocked — and keep the
`intellectronica/ruler` question open, because it is.

Say plainly in the README that a project with no managed block still works, on the
current harness with harness defaults, and that `cc-safety-net` is an optional
recommended rail: recommended on Claude Code, recommended on Codex only with
explicit hook trust, and not claimed functional on Grok, which discovers plugin
hooks and dispatches none of them.

**Files.** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `README.md`.

**Focused verification.** `tests/managed-block-contract.sh` asserts both manifests
parse and both report the same version, and that the version is not `0.5.0`. The
README reconciliation has no instrument and is read by a human at review; the log
records that an acceptance row with no instrument is worth keeping only when
someone actually reads it, and review is where that happens.

**Document impact.** This task is the document reconciliation for tasks 1 to 3.

## Acceptance

| Requirement | Instrument | Discriminates? |
| --- | --- | --- |
| `dely:setup` exists as a core skill with usable frontmatter | `bash tests/managed-block-contract.sh`, skill cases | Yes — red at the baseline, where `skills/setup/` does not exist. Settled by running the test against the baseline tree before writing the skill. |
| The doctor accepts a well-formed managed block | same test, case 3 | Yes — the doctor prints no managed-block line at the baseline, so the assertion has nothing to match. |
| The doctor treats an absent block as the supported fallback, not a failure | same test, cases 1 and 2 | Yes — it must assert a non-failing line specifically, so a doctor that failed on absence and a doctor that said nothing both fail this row. |
| The doctor reads only between the markers | same test, case 4 | Yes — a block-shaped table outside the markers plus a valid block inside must still be `ok`; an implementation that greps the whole file passes case 3 and fails here. |
| The doctor refuses broken and duplicated markers | same test, cases 5 and 6 | Yes — these differ from case 3 only in the markers, so a check that ignores marker structure passes 3 and fails these. |
| The doctor refuses a block missing a required part | same test, cases 7, 8 and 9 | Yes — case 8 removes one phase row from an otherwise valid block, which is the exact shape the adapter check previously let through. |
| The doctor does not validate values against a catalogue | same test, case 10 | Yes — a doctor that checked Model against a stored list would fail on the literal `default` and fail this row. |
| This repository's own `AGENTS.md` carries a valid managed block | same test, final case, doctor run against this repository | Yes — red at the baseline, where this repository has no markers. |
| Both manifests declare the bumped version | same test, manifest case | Yes — asserts the version is not `0.5.0` and that both files agree, so bumping one file only fails. |
| The existing Grok adapter check still passes | `bash tests/delivery-doctor-grok-hook.sh` | Yes — it drives `bin/delivery-doctor`, which this plan edits, and it already distinguishes ten adapter shapes. |
| Repository shape and syntax unchanged | the four closure gates in `AGENTS.md` | Partly — `bash -n` and `jq -e` prove syntax, not behaviour. They must be extended to cover the new test script, or the new file is unparsed by any gate. |
| The README no longer contradicts the settled `cc-safety-net` decision | a human reads the diff at review | No instrument. Recorded deliberately: the contradiction is semantic, between two prose passages, and a grep for `Still open` would pass on any rewording. Review reads it. |

**Cannot be observed before installation.** Nothing in this plan proves that any
harness discovers `dely:setup`, that its description causes a session to invoke it,
that the managed block reaches a dispatched worker, or that the persistent
instruction causes a future session to invoke `dely:delivery`. Every check here is
static and runs against files in this checkout. All three harnesses run a copy of
this package taken at install time, so at the moment these gates pass, every
installed copy is still `0.5.0` and still has one skill.

**Forward smoke, after release and after every cache is refreshed.** Record the
result in `docs/findings.md`, not here:

1. `claude plugin list` reports `dely@dely` at `0.6.0`; the equivalent for Codex
   and for `grok plugin details dely`.
2. In a scratch repository with no `AGENTS.md`, open a session in each harness and
   ask it to configure the project for delivery without naming the skill. Record
   whether `dely:setup` was discovered and invoked, or had to be named.
3. Invoke `dely:setup`, take the quick path, and record whether the written block
   passes `delivery-doctor` and whether the values it wrote match what the harness
   itself reports.
4. Re-run the Grok adapter regeneration from the newly installed root, since a
   version bump moves that path.
5. In this repository, open a fresh session in each harness and ask for a Planned
   change without naming a skill. Record whether the managed instruction caused
   `dely:delivery` to be invoked — and expect the answer to differ between Claude
   Code and the other two, for the `AGENTS.md` discovery reason in the decision
   record.

## Stop conditions

`BLOCKED` or `NEEDS_REPLAN` rather than working around it:

- A discovery command behaves differently from what the decision record records —
  a Claude probe that reports a non-zero `num_turns` or `total_cost_usd`, or
  `codex debug models` that does not carry `supported_reasoning_levels`. The
  contract's discovery rule would then be built on a reading that no longer holds.
- The managed-block schema cannot express this repository's own selection without
  deleting prose the project owns. The decision record says the sandbox pin and
  the worker-surface rule move outside the block; if either turns out to need to
  be *inside* it, the schema is wrong and that is a design question.
- `tests/delivery-doctor-grok-hook.sh` goes red. This plan edits the program that
  test drives, and a regression there is a lost rail, not a test to adjust.
- Any task requires editing `skills/delivery/SKILL.md`, the hooks, or
  `bin/delivery-evidence`.

Assumptions that hold for one environment and are not verified for the others:
`grok`, `codex`, `claude`, `jq` and `orca` are all on `PATH` on this machine and
the existing tests already exit non-zero when `grok` or `jq` is missing. The new
test must not require `claude`, `codex`, `grok` or `orca` — it checks file shape
through `bin/delivery-doctor` and must pass on a machine with none of them
installed, or it becomes a gate that only this laptop can run.

## Closure gates

All from the repository root.

```
git diff --check

bash -n bin/delivery-doctor bin/delivery-evidence git-hooks/pre-push \
  hooks/post-tool-journal.sh hooks/session-start-context.sh \
  tests/managed-block-contract.sh

jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json \
  .codex-plugin/plugin.json hooks/hooks.json hooks/grok-hooks.json.template >/dev/null

bash tests/delivery-evidence-pipeline.sh

bash tests/delivery-doctor-grok-hook.sh

bash tests/managed-block-contract.sh

git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

The `bash -n` gate gains the new test script and the `AGENTS.md` gate list must be
updated to match, or the two drift on the first run. Report every gate with the
exact command, the summary line verbatim, and the exit code; `$?` after a pipe
reports the last command in the pipe, not the gate. Never background a gate.
