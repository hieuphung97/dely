# Plan — First-class Kiro CLI harness

Decision record: `docs/decisions.md` (settled 2026-08-26 — Kiro CLI is a
first-class fifth harness)

**Baseline:** `279f9f425022393cbd3faf2fab7b827fe4baf319`

## Goal

A consuming project can install Dely's two existing skills for Kiro CLI, invoke
them with Kiro's native skill commands, select Kiro from live setup discovery,
and pin it for Orca-supervised implementation or review. Out of reach: Kiro
Powers, custom agents, hooks, MCP, non-CLI Kiro surfaces, headless dispatch,
Orca changes, and live user-profile mutation.

## Allowed scope

```
AGENTS.md
README.md
.claude-plugin/plugin.json
.codex-plugin/plugin.json
.github/ISSUE_TEMPLATE/bug_report.yml
docs/decisions.md
docs/_plans/2026-08-26-kiro-cli-support.md
skills/setup/SKILL.md
tests/contracts.sh
```

`tests/contracts.sh` is the colocated registry test for the package and setup
contracts and is listed explicitly. `README.md`, `AGENTS.md`,
`docs/decisions.md`, and the bug form own the affected public, deployment,
decision, and contribution surfaces. No other colocated test, registry, or
owning document was found.

## Forbidden scope

`plugin.json` stays the checked Antigravity manifest. `.claude-plugin/marketplace.json`
has no version and needs no change. `skills/delivery/SKILL.md` remains portable
and harness-neutral. No `.kiro/`, `~/.kiro`, custom agent, Kiro Power, Orca
source, hook, MCP, `CLAUDE.md`, or workflow file changes. Do not install Dely
into the maintainer's live Kiro profile.

## Replan (Kiro Discovery subsection)

Opened after Task 2's scoped re-review did not accept `73be896`. Headless
polarity is already an exact normalized sentence match in `AGENTS.md` and stays
closed. The remaining finding is that Setup's stored-catalogue counterexample
still passes: `tests/contracts.sh` exact-matches only the Kiro models bullet, so
a contradictory "use stored catalogue" paragraph elsewhere in Discovery is
invisible (`old=0`, `new=0`).

Split one new task with a fresh implementer and a fresh reviewer. Create
`### Kiro CLI` under Setup Discovery and match that whole subsection verbatim,
so any contradictory paragraph in it is rejected. Do not change live-discovery
behaviour, omit-if-unavailable, authority, package architecture, or owned
scope. Do not start a second Task 2 repair loop. Task 3 waits until this new
task accepts.

The managed block in `AGENTS.md` is unchanged. Remaining reviews in this
delivery use Claude Code `opus` at `high` (the live `/model` alias for Opus 5)
instead of Codex CLI, per the 2026-08-26 Control-session override.

## Execution envelope

Protected dirty paths: none; the tree was clean at baseline
`b79ea56aab734d0363557ed710bf4e8177b76e48`.

Branch, base, remote, and pull-request target: `feat/kiro-cli-support`, based on
`main` at `b79ea56aab734d0363557ed710bf4e8177b76e48`, pushes to `origin`, and opens a
pull request into `main`.

Resolved phase pins: `implement` runs Claude Code `sonnet` at `medium`. Task 1
and Task 2 reviews used Codex CLI `gpt-5.6-sol` at `high`. Remaining reviews in
this delivery (Task 2b, Task 3, and integration review) run Claude Code `opus`
at `high`. The project pins no phase sandbox. This delivery does not rewrite
the managed block.

Authority: this plan may branch, commit only its owned paths, run focused checks
and closure gates, push `feat/kiro-cli-support`, and open or update its pull
request into `main`. It may not merge, force-push, stash, reset, clean, install
skills into a live harness profile, or edit anything outside owned scope.

## Tasks

### 1. Native Kiro skill installation and release packaging

**Behaviour.** README users can install, verify, update, remove, and invoke the
two Dely skills in Kiro through `npx skills`; both versioned manifests are
`0.14.0`.

**Direction.** Add one Kiro CLI install section using global scope, explicit
`kiro-cli`, and explicit `delivery` and `setup` skills. Name `/delivery` and
`/setup`. Extend the existing version and README structural checks compactly;
`tests/contracts.sh` must remain at most 250 lines. Do not change root
`plugin.json` or introduce a Kiro package.

**Files.** `README.md`, `.claude-plugin/plugin.json`,
`.codex-plugin/plugin.json`, `tests/contracts.sh`.

**Focused verification.** A section-bounded shell predicate rejects a Kiro
section that says support exists but instructs manual copying; it accepts only
the documented `npx skills` add/update/remove surface and native invocation.
`bash tests/contracts.sh` rejects split or stale manifest versions.

**Document impact.** README owns installation and cache-refresh guidance. The
decision record owns why Kiro uses skills rather than a Power.

### 2. Live Kiro setup discovery and interactive dispatch policy

**Behaviour.** Customize offers installed Kiro CLI models from live JSON and
effort from CLI help; unavailable or unusable Kiro discovery is omitted. Kiro
receives pins through native `AGENTS.md`, and Dely forbids headless Kiro workers.

**Direction.** Add the exact model command to Setup's Discovery section, offer
`model_id`, read effort from help, and forbid writes to `~/.kiro` or custom
agents. Update project support prose and the headless-forbidden list without
changing this repository's phase pins. Extend the existing section-bounded
discovery check rather than adding a parser abstraction.

**Files.** `skills/setup/SKILL.md`, `AGENTS.md`, `tests/contracts.sh`.

**Focused verification.** `kiro-cli chat --list-models --format json | jq -e
'(.models | length > 0 and all(has("model_id"))) and (.default_model | type ==
"string")'` succeeds on the live CLI. `kiro-cli chat --help` contains
`--effort`. The structural test rejects Kiro prose backed by a stored catalogue
or the wrong model field, and rejects a dispatch policy that omits the headless
Kiro command.

**Document impact.** `AGENTS.md` owns repository deployment policy;
`skills/setup/SKILL.md` owns discovery and configuration boundaries.

### 2b. Bound Setup's Kiro Discovery subsection

**Behaviour.** Setup's Kiro live-discovery contract is the entire `### Kiro CLI`
subsection under Discovery. A subsection that keeps the live command and
`model_id` but tells setup to use a stored catalogue is rejected.

**Direction.** Add `### Kiro CLI` under Setup Discovery. Move Kiro-specific
model and effort discovery prose into that subsection. Match the whole
subsection verbatim in `tests/contracts.sh`. Do not change live JSON discovery,
`model_id`, help-derived effort, omit-if-unavailable, or the no-`~/.kiro` /
no-custom-agent refusals. Do not edit `AGENTS.md`, README, manifests, or
delivery. Keep `tests/contracts.sh` at most 250 lines; compact existing checks
if needed, and do not drop a gate.

**Files.** `skills/setup/SKILL.md`, `tests/contracts.sh`.

**Focused verification.** Observe the Task 2 false pass first: on `73be896`, a
Discovery section that keeps the current Kiro models bullet and adds a
"use stored catalogue" paragraph must still exit 0. After the change, the same
present-but-wrong subsection must exit non-zero, and the correct package must
exit 0. `test "$(wc -l < tests/contracts.sh)" -le 250` remains true.

**Document impact.** `skills/setup/SKILL.md` owns the Kiro discovery subsection;
the contract test owns the whole-subsection match.

### 3. Five-harness onboarding and contribution surface

**Behaviour.** The README consistently describes five supported harnesses and
the bug form lets reporters choose each one, including both Antigravity CLI and
Kiro CLI.

**Direction.** Reconcile the introduction, prerequisites, checked versions,
cache wording, setup context, and ordinary-use count. Add both missing harness
options to the bug form. Extend the existing issue-form validation with the
smallest check that rejects a list containing Kiro but omitting Antigravity.

**Files.** `README.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`,
`tests/contracts.sh`.

**Focused verification.** `bash tests/contracts.sh` rejects a present
four-option bug form that includes Kiro but omits Antigravity, and accepts the
five exact harness names. A README section check rejects a support claim without
the Kiro install path.

**Document impact.** README owns the supported-harness claim; the bug form owns
the human harness vocabulary.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Kiro has native install, update, removal, and `/delivery` invocation | Section-bounded README predicate plus `bash tests/contracts.sh` | A Kiro section says it is supported but tells users to copy the skills manually | 2026-08-26 in-memory probe: `wrong install rc=1`; correct shape `rc=0` |
| Setup uses live Kiro model ids and help-derived effort | Whole `### Kiro CLI` subsection under Setup Discovery matched verbatim; live model JSON checked with `jq`; help checked for `--effort` | A Kiro subsection that keeps the live command and `model_id` but tells setup to use a stored catalogue, or that offers `model_name` instead of `model_id` | Task 2 re-review 2026-08-26: bullet-only check passed a stored-catalogue paragraph (`old=0`, `new=0`). Task 2b must observe that false pass on `73be896`, then reject it. Live model JSON and `--effort` help remain `rc=0`. |
| Dely dispatches an interactive Kiro TUI only | AGENTS policy check names `kiro-cli chat --no-interactive` as forbidden headless dispatch | Kiro is listed as supported but a headless chat is allowed in a shell tab | 2026-08-26 in-memory probe: wrong dispatch policy `rc=1`; correct shape `rc=0` |
| Human reports can identify all five harnesses | Issue-form option check requires the five exact harness names | The form adds Kiro but still omits Antigravity | 2026-08-26 in-memory probe: wrong options `rc=1`; correct shape `rc=0` |
| Versioned manifests stay aligned at `0.14.0` | `bash tests/contracts.sh` reads both manifest versions | Only the Claude manifest is `0.14.0`; Codex remains `0.13.0` | 2026-08-26 in-memory predicate with split values: `rc=1` |

**Cannot be observed:** actual global installation and skill activation without
mutating `~/.kiro`; a custom agent that disables default skill resources; Orca
passing a selected Kiro model and effort in a consumer project; future behaviour
of the external `npx skills` installer. Local checks prove the checked command
surface and package contract, not those profile- and runtime-bound effects.

## Stop conditions

- Kiro's live model result lacks usable `model_id` values or its help lacks
  model or effort flags — do not store a fallback catalogue.
- `npx skills` no longer supports Kiro global installs or cannot select both
  existing skills — do not replace it with manual copies without replan.
- Supporting Kiro requires changing root `plugin.json`, duplicating `skills/`,
  editing `skills/delivery/SKILL.md`, changing Orca, or writing `~/.kiro` — return
  `NEEDS_REPLAN`.
- The focused contract cannot fit while preserving the 250-line test limit —
  simplify the check or return `NEEDS_REPLAN`; do not remove an existing gate.
- A task needs any path outside allowed scope, or an existing contract disproves
  the design — stop rather than absorb the change.

## Closure gates

Run from `/Users/hieuphung/Projects/dely`:

```bash
git diff --check
bash -n tests/contracts.sh
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json >/dev/null
bash tests/contracts.sh
test "$(wc -l < tests/contracts.sh)" -le 250
test ! -e git-hooks/pre-push
test ! -e docs/delivery-log.md
test ! -e docs/findings.md
test ! -e docs/harness-surface.md
test ! -e docs/options.md
test ! -e docs/_plans/2026-08-24-automation-first-dely-design.md
test ! -e bin/delivery-doctor
test ! -e bin/delivery-evidence
test ! -e hooks/hooks.json
test ! -e hooks/grok-hooks.json.template
test ! -e hooks/post-tool-journal.sh
test ! -e hooks/session-start-context.sh
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```
