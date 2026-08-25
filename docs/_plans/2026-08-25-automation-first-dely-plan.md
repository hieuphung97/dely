# Plan — Ship automation-first Dely as one breaking protocol migration

Decision record: `docs/decisions.md`, “2026-08-25 — Dely is an
automation-first thin control protocol”

Approved design: `docs/_plans/2026-08-24-automation-first-dely-design.md`

**Baseline:** Control resolves the commit carrying this decision and plan with
`git rev-parse HEAD` immediately before dispatch and supplies that exact SHA in
the execution envelope. It is not copied into this file from memory.

## Goal

Replace the current four-worker, journal-backed workflow with the approved thin
protocol: design approval before mutation, mandatory Orca, sequential task-sized
implementation, adaptive independent review, native evidence, and exact-HEAD
release without an LLM release worker. Remove the superseded rails and ship no
compatibility path. Automatic merge and plugin-cache mutation remain out of
reach.

## Execution envelope

- Work only on branch `automation-first-dely` in the current checkout.
- Preserve the pre-existing changes to `AGENTS.md`, `docs/decisions.md`, and
  `docs/_plans/`; the owner assigned those paths to this migration.
- One implementer owns the coherent migration. It may commit only allowed paths.
- Control creates no worktree and launches no in-harness subagent.
- Orca dispatches implementation to Claude Code `sonnet` at `medium` effort and
  review to a fresh Codex CLI `gpt-5.6-sol` at `high` effort. Because this is a
  self-update, the frozen `0.10.0` contract still dispatches its Grok Build
  `grok-4.6` `medium` release worker; the candidate contract removes that worker
  for later deliveries.
- Do not merge, force-push, stash, reset, clean, delete user-owned files, or edit
  installed plugin caches and user-level hook configuration.
- The active Grok adapter was verified before the baseline commit to point at the
  frozen installed `0.10.0` plugin, not this checkout. The candidate may therefore
  delete its hook scripts without changing the harness under a live worker.

## Allowed scope

```
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.codex-plugin/plugin.json
AGENTS.md
README.md
bin/delivery-doctor                         delete
bin/delivery-evidence                       delete
docs/_plans/2026-08-24-automation-first-dely-design.md
docs/_plans/2026-08-25-automation-first-dely-plan.md
docs/decisions.md
docs/delivery-log.md
docs/findings.md
docs/harness-surface.md
docs/options.md
hooks/grok-hooks.json.template              delete
hooks/hooks.json                            delete
hooks/post-tool-journal.sh                  delete
hooks/session-start-context.sh              delete
skills/delivery/SKILL.md
skills/delivery/templates/decision-record.md
skills/delivery/templates/plan.md
skills/setup/SKILL.md
tests/delivery-doctor-grok-hook.sh           delete
tests/delivery-evidence-pipeline.sh          delete
tests/dispatch-submission-contract.sh        replace with tests/delivery-contract.sh
tests/journal-path-shape.sh                  delete
tests/managed-block-contract.sh
tests/plan-template-shape.sh
```

Colocated and inventory tests apply and are named above. `README.md`,
`docs/decisions.md`, `docs/findings.md`, `docs/harness-surface.md`, and
`docs/options.md` own claims changed by the removed paths. No other registry or
owning document was found.

## Forbidden scope

- `CLAUDE.md`: its one-line import remains necessary for Claude Code.
- `.gitignore`: it contains only the retained local worktree exclusion.
- `git-hooks/pre-push`: this safety rail is independent of the removed evidence
  product and remains optional project protection.
- Installed plugin caches and `~/.grok/hooks/`: refresh only between plans, after
  this plan closes.
- Historical reasoning in `docs/findings.md`, `docs/options.md`, and earlier
  decisions: append or mark supersession; do not rewrite observations as though
  they never happened.
- The three superseded design explorations in `docs/_plans/`: leave them as
  research provenance; only the active implementation plan is deleted at closure.

## Tasks

### 1. Make focused contract checks fail against the old protocol

**Behaviour.** Three small shell checks distinguish the approved contract from
present-but-wrong alternatives before the skills are rewritten.

**Direction.** Replace rather than extend the large legacy fixtures. Create
`tests/delivery-contract.sh` from the useful submission-recovery check and cover
the approval boundary, Spike/Bounded/Architectural routing, mandatory Orca with no
headless fallback, task-sized freshness, adaptive review, original-party bounded
remediation, native evidence, and exact-HEAD no-worker release. Rewrite
`tests/managed-block-contract.sh` for exactly two non-empty `implement` and
`review` rows with live discovery and no coordinator/control/release fields.
Keep `tests/plan-template-shape.sh` only for the minimal contract fields and a
real counterexample column. Each check must include at least one degraded fixture
that still looks implemented but is rejected.

**Files.** `tests/delivery-contract.sh`, `tests/managed-block-contract.sh`,
`tests/plan-template-shape.sh`; delete the replaced dispatch test only after the
new test exists.

**Focused verification.** Before skill mutation, run `tests/delivery-contract.sh`
and `tests/managed-block-contract.sh` directly against the pre-migration skills
and record their non-zero result for the intended old-contract reason. A syntax
error, missing fixture dependency, or failure caused only by a renamed heading is
not a valid RED observation. `tests/plan-template-shape.sh` carries no new
automation-first-specific requirement in this task — the template does not change
here — so it is truthfully observed green (`0`) at this point; it gains a real
counterexample, and is observed RED for it, only once task 2 adds the
execution-envelope requirement to the template.

**Document impact.** None yet; these are the discriminating instruments for the
next tasks.

### 2. Rewrite the two skills and templates around native ownership

**Behaviour.** `dely:delivery` enforces the approved thin protocol while leaving
design method, orchestration state, evidence storage, Git state, and release state
to their native owners. `dely:setup` writes only optional implement/review
preferences discovered live. The templates carry only durable decisions and
task-ready execution facts.

**Direction.** Rewrite instead of layering exceptions onto the old skill. Keep
both entrypoints concise and under 500 lines. Preserve the proven 90-second TUI
read plus one-Enter recovery. State positive output/routing contracts where shape
matters; reserve prohibitions for authority and safety boundaries. Reuse
compatible Superpowers methods by name only when already active; do not compose or
emulate their executor, subagents, worktrees, review, or branch completion.

**Files.** `skills/delivery/SKILL.md`, `skills/setup/SKILL.md`,
`skills/delivery/templates/decision-record.md`,
`skills/delivery/templates/plan.md`, `AGENTS.md`.

**Focused verification.** Run `tests/delivery-contract.sh` and
`tests/managed-block-contract.sh` after each owning skill is rewritten; they must
turn green without weakening their negative fixtures. `templates/plan.md` gains
an execution-envelope section here (protected dirty paths, branch/base/remote/PR
target, resolved phase pins, mutation/release authority); `tests/plan-template-shape.sh`
must be strengthened to require it and observed RED against the template as it
stood before this task's fix, then green after. Run the bundled Codex skill
validator on both skill directories if it accepts this plugin layout; otherwise
record the validator's exact incompatibility and verify frontmatter directly.
Observed both implementation and remediation: `python3 -c "import yaml"` raises
`ModuleNotFoundError: No module named 'yaml'` in this environment, so the
Codex validator cannot start; no dependency was added to work around it.
`claude --plugin-dir . plugin details dely` was used instead — it accepted the
plugin layout, reported both skills with 0 hooks, and confirmed manifest
version `0.11.0` — and both skill frontmatters were checked directly (name
syntax/length, description syntax/length, allowed keys).

**Document impact.** `AGENTS.md` must describe the new source of truth, two-row
managed block, frozen self-update boundary, native Orca TUI requirement, and the
new closure commands without copying portable protocol prose.

### 3. Remove duplicated rails and reconcile the package surface

**Behaviour.** The package contains no evidence journal, doctor, plugin hook,
Grok hook adapter, release worker, or compatibility stub. Users install two skills
and rely on Orca/Git/CI/forge evidence.

**Direction.** Delete all rail binaries, hooks, adapters, and their three tests in
one change. Rewrite README present tense. Append the three-harness Orca probe
observation to findings and harness surface, including that pass and failure
commands, output, and outcome remained bound to the dispatch and readable after
release. Mark older options and decisions as historical or superseded only where
needed for an accurate current reader. Bump both plugin manifests together to
`0.11.0`, remove hook/evidence marketing, and keep marketplace metadata aligned.

**Files.** Every delete-marked path in Allowed scope, `README.md`,
`docs/findings.md`, `docs/harness-surface.md`, `docs/options.md`,
`docs/decisions.md`, and the three plugin manifests.

**Focused verification.** `git ls-files` and `rg` must find no shipped journal,
doctor, hook adapter, headless fallback, coordinator/control/release setup field,
or release-worker instruction outside explicitly historical sections. JSON and
remaining shell files must parse. Manifest versions and descriptions must agree.

**Document impact.** This task is the documentation reconciliation; historical
evidence remains identifiable as history rather than present behavior.

### 4. Close the self-update through the frozen contract and one exact final HEAD

**Behaviour.** The frozen contract performs this migration's release phase, then
all focused instruments, project gates, final review, CI, and pull-request state
converge on one clean exact HEAD. No mutation follows that final verdict and no
model merges.

**Direction.** The implementer creates one task commit for the coherent migration.
Any accepted remediation is a separate commit by that same implementer. Control
dispatches the frozen contract's fresh independent reviewer. After acceptance, a
fresh Grok release worker appends the delivery-log row, removes this transient
plan, commits the closure metadata, runs the gates, and prepares the draft pull
request. Because those required release edits change HEAD after the first review,
Control then dispatches a different fresh Codex reviewer against the released
exact HEAD while CI runs. Only that verdict is release-binding. No plugin cache or
user hook is refreshed until the plan is closed.

**Files.** `docs/delivery-log.md` at closure; this plan is deleted only after its
durable content is reconciled.

**Focused verification.** Resolve candidate HEAD immediately before every gate
and review handoff. Re-resolve it afterward; any mismatch requires rerunning the
affected gates and final review. The draft pull request and CI must name the same
commit before Control may mark it ready.

**Document impact.** One five-column delivery-log row. Do not add a second state
ledger or retain test history in the decision record.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Candidate mutation requires an approved design contract; active design skills and Plan Mode do not own or bypass that invariant | `bash tests/delivery-contract.sh` | A complete-looking flow lets Plan Mode approval or a brainstorming result start edits without explicit contract approval | Task 1: run against the pre-migration `skills/delivery/SKILL.md` (commit `1339715`), `check_approval_invariant` failed with "no explicit approval invariant before candidate mutation" and "does not name Plan Mode as unable to bypass approval" — the old skill named phases but never an approval gate or Plan Mode at all. Remediation added a dedicated `check_frontmatter_routing`/bypass fixture (a Plan Mode text that "can bypass" Dely's own approval) and confirmed it is rejected. |
| Spike, Bounded, and Architectural work have different artifact and review depth | `bash tests/delivery-contract.sh` and `bash tests/plan-template-shape.sh` | A renamed four-phase workflow sends every request through the same decision, plan, task review, and integration review | Task 1: against the pre-migration skill, `check_shapes` failed — no Spike, Bounded, or Architectural word at all, only Routine/Planned/Critical. The bundled negative fixture (a renamed `design -> implement -> review -> release` flow with one review depth for everything) is rejected by the shipped check. |
| Orca is mandatory, preflighted, and has no direct or headless fallback; submission recovery reads the TUI before one Enter | `bash tests/delivery-contract.sh` | The skill says Orca is preferred but retains a headless fallback, or sends Enter immediately or repeatedly | Task 1: against the pre-migration skill, `check_orca_mandatory` failed with "still permits a headless fallback" — the old skill's own text read "A direct headless harness call is a fallback only when no coordinator is selected." The bundled fixture reproducing that exact sentence is rejected by the shipped check, and the repeated-Enter fixture is rejected by `check_launch_wait`. |
| Setup manages only discovered implement/review preferences and treats defaults as preferences | `bash tests/managed-block-contract.sh` | A well-formed block still contains Coordinator, control, or release, or presents a bundled model catalogue | Task 1: against the pre-migration setup skill, `check_two_rows` and `check_no_coordinator_control_release_fields` both failed — the old template carried `control`, `release`, and a `Coordinator:` line, and stated none of the new preference language. Remediation's `check_table_shape` was additionally proven to catch what the original two checks missed: replaying the reviewer's counterexample (an `implement` row with empty Harness/Model/Effort cells, plus an extra `investigate` phase row) through the pre-remediation `check_two_rows` passes it — reproduced directly by sourcing that commit's function and running it against the fixture — while the strengthened `check_table_shape` rejects it. |
| Freshness follows independently testable/reviewable tasks; review is adaptive and independent | `bash tests/delivery-contract.sh` | Every file gets a fresh implementer, Bounded work gets duplicate review, or a reviewer is allowed to edit | Task 1: against the pre-migration skill, `check_freshness_review` failed — no "fresh implementer," "batched," or "adaptive" language; review was a fixed four-phase sequence. The bundled fixture (fresh implementer per file, fixed task-plus-integration review for all shapes) is rejected. |
| One remediation returns to the original implementer and original reviewer, then stops at `REPLAN_OR_SPLIT` | `bash tests/delivery-contract.sh` | Remediation starts a fresh implementer or reviewer, or loops until green | Task 1: against the pre-migration skill, `check_remediation` failed with "remediation still routes to a fresh implementation session instead of the original implementer" — the old skill's routing table sent `REMEDIATE_ONCE` to "a fresh implementation session," a present-but-wrong implementation this row exists to catch. The bundled fixture reproducing that loop is rejected by the shipped check. |
| Native Orca evidence replaces universal rails on all three supported harnesses | probe record in `docs/harness-surface.md`; absence check in closure gates | Documentation claims native evidence while any journal binary, doctor, hook wiring, Grok adapter, or compatibility stub still ships | Orca Run `run_51da9fff2301`: Claude Code (`task_ca819e990524`), Codex CLI (`task_5e925cc48391`), and Grok Build (`task_7604a1cf6b98`) each ran a passing and a failing marker command; all three pass markers exited 0 with their marker visible, all three fail markers exited 23 with their marker still visible, and the dispatch transcript was readable after release for all three (Grok's low-level release call returned `retained`/`no_owned_resource` while its transcript stayed readable immediately after — recorded as a time-bounded adapter detail, not a guarantee). Full table in `docs/harness-surface.md`, "Three-harness native evidence probe (2026-08-25)"; narrative in §36, `docs/findings.md`. The six `test ! -e` absence gates in `AGENTS.md` are green on the shipped candidate, confirming no journal, doctor, hook, or adapter file remains. |
| Release binds gates, final review, CI, and draft PR to exact HEAD without an LLM release worker or merge | `bash tests/delivery-contract.sh` | A release worker may edit after review, or completion can be claimed with one missing state or a changed HEAD | Task 1: against the pre-migration skill, `check_release` failed on all three sub-checks — no "no LLM worker," no "exact HEAD," no "draft pull request" language; release was one of four dispatched phases with its own model/effort row. The bundled fixture (a dispatched fresh release worker with no exact-HEAD or draft-PR binding) is rejected. |
| Protected dirty paths and commit ownership remain explicit | review of `git diff --name-status <baseline>...HEAD` plus `git status --short` | The candidate stages a path outside Allowed scope or silently overwrites a protected baseline change | No automated instrument exists for this row; a human reads the diff. Verified by inspection at both the original implementation commit (`b0fc078`, parent `1339715`, clean tree, all 22 changed paths inside Allowed scope) and this remediation commit (parent `b0fc078`, clean tree at start, no forbidden-scope path touched). |

**Cannot be observed:** Static shell fixtures prove the shipped instruction shape,
not that every future model obeys it. The Orca probes prove evidence retrieval for
the current supported versions, not a permanent API guarantee. Live CI and forge
convergence require a pushed draft pull request; if publication authority is not
available, closure stops before claiming that state.

## Stop conditions

- A new requirement changes the approved design, public contract, architecture,
  authority, or removal decision.
- Any supported harness no longer exposes dispatch-bound command, output, and
  outcome through Orca.
- A required change falls outside Allowed scope or overlaps a newly changed
  protected path.
- Orca, the selected harness/model/effort, or an exact-HEAD gate is unavailable.
- A scoped re-review after one remediation does not accept.
- The migration cannot be reviewed as one coherent candidate in one implementer
  session.

## Closure gates

Run from `/Users/hieuphung/Projects/dely`:

```bash
git diff --check
bash -n git-hooks/pre-push tests/delivery-contract.sh tests/managed-block-contract.sh tests/plan-template-shape.sh
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json >/dev/null
bash tests/delivery-contract.sh
bash tests/managed-block-contract.sh
bash tests/plan-template-shape.sh
test ! -e bin/delivery-doctor
test ! -e bin/delivery-evidence
test ! -e hooks/hooks.json
test ! -e hooks/grok-hooks.json.template
test ! -e hooks/post-tool-journal.sh
test ! -e hooks/session-start-context.sh
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

The focused checks must be observed RED for the intended reason before the skill
rewrite and green afterward. The absence commands distinguish a deleted rail from
documentation that merely says it is deleted. The disclosure greps remain lexical,
not proof of ownership.
