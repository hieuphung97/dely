# Plan — harness launch mechanics ship inside the delivery skill

Decision record: `docs/decisions.md`, 2026-08-28 — Harness launch mechanics ship inside the delivery skill

**Baseline:** `0265467`, the commit carrying the decision record and this plan.

## Goal

Per-harness launch mechanics travel with the plugin instead of living only in
this repository's `AGENTS.md`, and `AGENTS.md` is left holding only what the
protocol delegates to it plus this project's own rules. Out of reach: trust
handling content, any change to what `setup` writes, and any new ability for the
execution plane to see a blocking confirmation.

## Allowed scope

```
skills/delivery/references/harnesses.md   (new)
skills/delivery/SKILL.md
AGENTS.md
tests/contracts.sh
docs/decisions.md
docs/_plans/2026-08-28-ship-harness-mechanics.md
docs/_plans/2026-08-27-cursor-agent-cli-harness.md   (deleted)
.claude-plugin/plugin.json
.codex-plugin/plugin.json
```

Carried without being listed: none. `skills/delivery/templates/` was checked and
yields nothing — the templates do not name a harness. `README.md` was checked and
yields nothing: it documents installation per harness, not worker launch, and
none of the moved lines appear in it. `.cursor-plugin/plugin.json` and root
`plugin.json` carry no version and are untouched.

## Forbidden scope

`skills/setup/SKILL.md` — its managed-block template is the deferred alternative,
not this plan. `.cursor-plugin/plugin.json` and `plugin.json` — versionless by an
existing decision. The `dely:begin`/`dely:end` region of `AGENTS.md` — generated
content; this plan edits only outside the markers.

## Execution envelope

Protected dirty paths: state the tree's condition at baseline; expected clean.

Branch `feat/ship-harness-mechanics`, based on `main` **after PR #28 merges**,
targeting `main` on `origin`, with its own pull request.

Resolved phase pins: `AGENTS.md` pins `implement` to Antigravity CLI
`claude-sonnet-4-6` `medium` and `review` to Grok Build `grok-4.6` `high`. Both
harnesses are quota-exhausted on this machine, an unavailability the human has
already ruled on for the preceding two deliveries. This plan runs `implement` on
Claude Code `claude-sonnet-5` `medium` and `review` on Claude Code
`claude-opus-5` `high`, each a fresh session. If either pinned harness recovers
before dispatch, the pin governs and this deviation lapses.

Authority: branch, commit only owned paths, run gates, push
`feat/ship-harness-mechanics`, open and update its pull request. Not merge,
force-push, stash, reset, clean, or edit outside owned scope.

## Tasks

### 1. The mechanics ship inside the skill and leave AGENTS.md

**Behaviour.** `skills/delivery/references/harnesses.md` exists and is the only
place in the repository that names a harness's permission default, its forbidden
headless forms, or its launch notes. `AGENTS.md` points at it and states none of
them. `skills/delivery/SKILL.md` names the reference path where it instructs
Control to compose a worker launch, and no longer claims the skill has no
compatibility matrix.

**Direction.** Move the substance of `AGENTS.md:53-67` into a table keyed by
harness with columns for permission default, forbidden headless forms, and launch
notes. Leave a trust column present and empty — the next delivery fills it; an
absent column would make that delivery a schema change. `AGENTS.md:52` becomes a
pointer sentence retaining its true half, that the pin table is this repository's
deployment selection. Rewrite `SKILL.md:134-136` so it states where the matrix
lives rather than denying one exists. This task is one unit because the negative
check, the positive check and the pointer are mutually dependent: any two without
the third leave the tree red or the contract unenforced.

**Files.** `skills/delivery/references/harnesses.md`, `AGENTS.md`,
`skills/delivery/SKILL.md`, `tests/contracts.sh`, both versioned manifests,
`docs/decisions.md`.

**Focused verification.** `bash tests/contracts.sh` with the retargeted checks,
plus the three counterexample fixtures in the acceptance table. It fails if the
mechanics are copied rather than moved, if nothing points at the reference, or if
the denial sentence survives.

**Document impact.** `docs/decisions.md` owns the decision. `AGENTS.md` owns the
project's dispatch prose. Both versioned manifests advance to `0.16.0` because
the shipped protocol changed.

### 2. AGENTS.md drops its dead restatements and the closed plan is removed

**Behaviour.** `AGENTS.md` no longer restates review independence, the
no-headless-fallback rule, or the design/release dispatch rule. It still states
the default branch and which shape invokes the skill. `docs/_plans/` holds only
this plan.

**Direction.** Remove `AGENTS.md:69-70`, `72-73` and `75-77` while keeping
`70-72`'s project-specific sandbox and Internet statements, which the protocol
delegates. Keep `23` and `24-25`: they are read before any skill is invoked.
Delete `docs/_plans/2026-08-27-cursor-agent-cli-harness.md`; its delivery merged
as `f9d1049`, the plan template calls a plan transient and deleted at closure,
its durable content is in that date's decision record, and no file outside
`docs/_plans/` references it. Confirm that last point rather than assuming it.

**Files.** `AGENTS.md`, `docs/_plans/2026-08-27-cursor-agent-cli-harness.md`.

**Focused verification.** For the deletion: `git grep -n
'2026-08-27-cursor-agent-cli-harness' -- . ':!docs/_plans'` must be empty before
removal, and `ls docs/_plans/` must afterwards list only this plan. For the
restatements: no executable instrument — a human reads the diff and confirms each
removed line has a counterpart in `skills/delivery/SKILL.md` and each kept line
does not.

**Document impact.** None beyond `AGENTS.md` itself.


### 3. The reference states each harness fact once

**Behaviour.** `skills/delivery/references/harnesses.md` contains the table and
no prose paragraph restating it. The verbatim dispatch pin in
`tests/contracts.sh` targets the table rows, so a falsified row fails a gate.

**Direction.** Task 1 satisfied two contract requirements that could not both be
met without stating every harness fact twice: a table, and a verbatim pin whose
`awk` reads the original contiguous prose paragraph. A task 1 review proved the
resulting shape unprotected — a falsified Cursor row claiming `--yolo` passed
`contracts.sh` with `rc 0`, because the table is checked only for the presence of
literal flag strings the paragraph already supplies. Delete the paragraph and
move the pin onto the rows. Deleting prose does not lengthen `contracts.sh`;
changing what the pin extracts should be close to line-neutral, and there is no
headroom, so measure before assuming.

**Files.** `skills/delivery/references/harnesses.md`, `tests/contracts.sh`.

**Focused verification.** The falsified-row fixture that passed at `2acb0c9` must
fail after this task. That is the whole point of the task and the only evidence
that distinguishes it from moving text around.

**Document impact.** `docs/decisions.md` owns the amended decision and is already
reconciled by Control; this task does not edit it.


### 4. The absence check gates the whole deleted block

**Behaviour.** Re-inserting any part of the prose block deleted at `766f0ba`
into `skills/delivery/references/harnesses.md` fails a gate. The plan's
`Observed red` cell for that row describes the instrument that actually exists.

**Direction.** `589d1bc` added an absence check anchored on the sentence
beginning "Load Orca's native skill", which is the block's seventh sentence.
Lines 9-14 — the half naming five permission defaults — are ungated: a scoped
re-review reproduced re-inserting them at `589d1bc` for `rc 0`, no FAIL. It also
showed the gap is not cosmetic: with those lines restored *and* the Cursor row
falsified, one of the three expected FAILs disappears, because the prose supplies
`--force` again and the presence checks stop being an independent signal about
the table.

`tests/contracts.sh` is at 250 against the `≤ 250` cap. Change the existing check
line; do not add one. Also correct the `Observed red` cell that calls the grepped
string "the paragraph's first sentence" — it is the seventh, and the wrong
description points a reader away from the gap.

**Files.** `tests/contracts.sh`, the acceptance table of this plan.

**Focused verification.** Three fixtures from `git archive HEAD`, each
re-inserting a different part of the deleted block above the table: the first
half alone, the second half alone, and both. All three must fail. At `589d1bc`
the first-half fixture passes, which is the discriminating observation.

**Document impact.** None. `docs/decisions.md` already records that the
reference states each fact once; this task makes the instrument match it.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| The mechanics ship inside the delivery skill | `contracts.sh`: `skills/delivery/references/harnesses.md` exists and names each harness's permission default | the reference is added and `AGENTS.md:53-67` is left in place — both files present, every pre-existing check green, drift doubled rather than removed | |
| `AGENTS.md` no longer carries them | `contracts.sh` negative: `AGENTS.md` must contain none of the four permission flags and none of the forbidden headless forms | the copy-not-move case above, which the positive check alone cannot see | |
| The reference is reachable from the protocol | `contracts.sh`: `SKILL.md` contains the literal path `references/harnesses.md` and that path exists | the reference exists but nothing names it — a dead file no Control ever reads, with every other check green | |
| The skill stops denying its own matrix | `contracts.sh`: `SKILL.md` must not contain the compatibility-matrix denial | mechanics moved into the skill while the denial survives — a self-contradictory shipped artifact | |
| Restatements removed, pre-invoke ones kept | none — a human reads the diff | none | n/a |
| A falsified table row fails a gate | `contracts.sh`: the verbatim pin extracts the table rows | the Cursor row rewritten to claim `--yolo` as its permission default and `cursor-agent --headless` as its forbidden form — the exact fixture that returned `rc 0` at `2acb0c9` | reproduced `rc 0` at `2acb0c9`; after `766f0ba` the same fixture returns `rc 1`, failing on the table-row verbatim mismatch |
| The reference states each fact once | `contracts.sh`: the reference must not contain any part of the deleted prose block. The block deleted at `766f0ba` was `harnesses.md:9-23`, which Markdown reads as **one** paragraph — line 14 ends "Cursor Agent CLI `--force`." and line 15 begins "Load Orca's native skill" with no blank line between. An anchor on one sentence gates only what follows it, so the instrument must be anchored such that neither half can return alone | the paragraph is left in place beside the table and the pin is duplicated onto both, which passes a presence check while restoring the drift | reproduced at `766f0ba`: re-inserting the deleted paragraph above the table returned `exit 0`, no FAIL — the row-only pin does not constrain prose. After adding a `grep -Fq` absence check on the paragraph's first sentence, the same mutation returns `exit 1` and the clean tree still returns `exit 0` |
| The closed delivery's plan is gone | `ls docs/_plans/` lists only this plan; `git grep` for its name outside `docs/_plans/` is empty | the plan is deleted while a document still links to it, leaving a dangling reference that no gate catches | `git grep -n '2026-08-27-cursor-agent-cli-harness' -- . ':!docs/_plans'` returned empty before removal; `ls docs/_plans/` now lists only `2026-08-28-ship-harness-mechanics.md` |

**Cannot be observed:** whether `npx skills add … --skill delivery` copies a
`references/` subdirectory. It resolves against the default branch on GitHub, so
it is unobservable until this lands on `main`. `skills/delivery/templates/` does
travel by that path today, which is an analogy and not an observation of
`references/`.

Also unobserved: whether any project other than this one benefits, since no
second consumer of the plugin is available to test against.

## Stop conditions

`tests/contracts.sh` cannot hold the retargeted and added checks within 250
lines: `NEEDS_REPLAN`. Do not raise the cap; it is a closure gate this repository
committed to, and raising it to fit a plan is the failure the gate exists to
catch.

The verbatim dispatch pin cannot be retargeted without also pinning prose that
belongs to the reference rather than to the project: `NEEDS_REPLAN`.

PR #28 has not merged and `main` does not carry `0.15.0`: `BLOCKED`. This plan's
version bump assumes it.

The moved text turns out to be wrong about a harness: `BLOCKED` rather than
shipping a faithful copy of a false statement. Evidence state at planning time —
every permission default in `AGENTS.md:55-58` was exercised at launch on this
machine on 2026-08-28 and each started its TUI: Claude Code and Antigravity CLI
`--dangerously-skip-permissions`, Codex CLI
`--dangerously-bypass-approvals-and-sandbox` (reported `permissions: YOLO mode`),
Grok `--permission-mode bypassPermissions`, Cursor Agent CLI `--force`. Kiro's
launch was exercised as `kiro-cli chat --tui`, but its in-TUI `/tools trust-all`
step was not. The forbidden headless forms were not exercised for any harness;
they are prohibitions, and confirming them would mean running the thing the
project forbids.

## Closure gates

```
git diff --check
bash -n tests/contracts.sh
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null
bash tests/contracts.sh
test "$(wc -l < tests/contracts.sh)" -le 250
agy plugin validate .
grok plugin validate .
claude plugin validate .
```

All run from the repository root.
