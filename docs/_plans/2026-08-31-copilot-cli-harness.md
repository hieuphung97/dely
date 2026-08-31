# Plan — GitHub Copilot CLI is a first-class seventh harness

Decision record: `docs/decisions.md`, 2026-08-31 — GitHub Copilot CLI is a
first-class seventh harness, and it needs no sidecar

**Baseline:** `77e80c5`, the commit carrying the decision record and this plan.

## Goal

A human can install Dely on GitHub Copilot CLI with native Copilot verbs, and
`dely:delivery` can dispatch a Copilot worker with the correct permission
default, the correct forbidden headless form, and launch mechanics that survive
both surfaces a real Copilot TUI opens with — folder trust and the interrupted
session picker. `setup` offers Copilot with live-discovered effort and no
invented model catalogue. Out of reach: any change to this repository's own
phase pins, any Copilot-specific manifest, any model pin path Copilot does not
expose non-interactively, and `AGENTS.md`, which is protected-dirty at baseline.

## Allowed scope

```
skills/delivery/references/harnesses.md
skills/setup/SKILL.md
README.md
.github/ISSUE_TEMPLATE/bug_report.yml
tests/contracts.sh
.claude-plugin/plugin.json
.codex-plugin/plugin.json
docs/decisions.md
docs/_plans/2026-08-31-copilot-cli-harness.md
```

Carried without being listed: none. `skills/delivery/SKILL.md` was checked and
yields nothing — the portable protocol names no harness and delegates launch
mechanics to `references/harnesses.md`. `skills/delivery/templates/` was checked
and yields nothing; the templates name no harness. `.github/workflows/contracts.yml`
was checked and yields nothing: no closure command changes, and the 250-line cap
it pins is being respected rather than moved. `.claude-plugin/marketplace.json`
was checked and yields nothing — Copilot consumes it unchanged.

## Forbidden scope

`AGENTS.md` — protected-dirty at baseline with an uncommitted managed-block
edit; Dely does not combine ownership. Its prose therefore keeps naming six
harnesses, and that is recorded as deferred, not fixed here.
`plugin.json` and `.cursor-plugin/plugin.json` — versionless by an existing
decision, and Copilot reads the root manifest as it already stands.
`.copilot-plugin/` — must not be created; its absence is the decision.
`.github/workflows/contracts.yml` — the 250-line cap stays where it is.

## Execution envelope

Protected dirty paths: `AGENTS.md`, carrying an uncommitted managed-block edit
that pins `implement` to Cursor Agent CLI and `review` to Kiro CLI. It must not
be staged, reverted, stashed, or edited by any task in this plan.

Branch, base, remote, and pull-request target: `feat/copilot-cli-harness`,
based on `main`, pushed to `origin`, pull request targeting `main`.

Resolved phase pins, from the managed block in `AGENTS.md`:

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | Cursor Agent CLI | `cursor-grok-4.6-medium` | `default` |
| `review` | Kiro CLI | `gpt-5.6-sol-medium` | `medium` |

Authority: this plan may branch, commit only its own owned paths, run gates,
push `feat/copilot-cli-harness`, and open or update its pull request. It may not
merge, force-push, stash, reset, clean, or edit anything outside owned scope.

## Tasks

### 1. Copilot is a dispatchable, installable, discoverable harness

**Behaviour.** `skills/delivery/references/harnesses.md` carries a seventh row
whose cells are true of live Copilot CLI 1.0.82. `skills/setup/SKILL.md` offers
Copilot with effort read from `copilot --help` and Model written as the literal
`default`, lists Copilot among native `AGENTS.md` readers, and refuses to write
`~/.copilot`. `README.md` documents a Copilot install using only verbs that were
run against the live CLI. `bug_report.yml` offers the exact label
`GitHub Copilot CLI`. `tests/contracts.sh` rejects a wrong Copilot row,
subsection, or README path, and stays at 250 lines or fewer.

**Direction.** The harness row's Permission default is `--allow-all`; its
Forbidden headless forms cell names `copilot -p`/`--prompt`. Launch notes state
an interactive `copilot` TUI with `--allow-all`, `--model` and `--effort` pinned
from the managed block and each omitted when its cell is `default`, that an
unavailable pinned model is reported as `Using "auto" instead` rather than
failing, and that a `Restore interrupted sessions` picker may follow trust and
is answered with Esc, never Enter. Trust handling states that `--allow-all` does
not suppress `Do you trust the files in this folder?`, that the preselected
`1. Yes` is what Control confirms, and that `2. Yes, and remember this folder
for future sessions` is not used because it writes persistent machine state.

The README section is `### GitHub Copilot CLI`, placed after
`### Cursor Agent CLI` and before `### Kiro CLI`, shaped like the Claude and
Codex sections: `copilot plugin marketplace add` of the git URL, `copilot plugin
install dely@dely`, then `copilot plugin list`, `copilot plugin update dely`,
`copilot plugin uninstall dely`, and `copilot plugin marketplace remove dely`
with a comment saying it removes the marketplace, not the plugin. Also update
the harness enumerations in the opening paragraph, the Quickstart paragraph, the
Install preamble, the `AGENTS.md`-reader paragraph, and the cache-refresh
paragraph — Copilot is a copy-on-install harness, so that family becomes six
against Kiro's shared store — and add `| GitHub Copilot CLI | 1.0.82 |` to
Checked versions. Do not document `npx skills` for Copilot and do not instruct
manual copying.

In `tests/contracts.sh`, share loops rather than pasting a third per-harness
block: fold the existing Kiro and Cursor verbatim subsection comparisons into
one helper that takes a heading and its approved string, then add Copilot as a
third call. Add `copilot -p` and `--allow-all` to the existing forbidden-flag
loop, `GitHub Copilot CLI` to the bug dropdown loop, and the Copilot row to
`expected_harness_table`. The 250-line cap is a gate, not a suggestion; if the
checks do not fit after the refactor, that is `NEEDS_REPLAN`, not a cap change.

**Files.** `skills/delivery/references/harnesses.md`, `skills/setup/SKILL.md`,
`README.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `tests/contracts.sh`.

**Focused verification.** `bash tests/contracts.sh` passes; then mutate one cell
of the new harness row in `skills/delivery/references/harnesses.md` — change
`--allow-all` to `--allow-all-tools` — and observe the run fail naming the
harness table; restore it. Separately run the documented install commands
against the live CLI and observe `Installed 2 skills` and `copilot skill list`
naming `delivery` and `setup`.

**Document impact.** `README.md` owns install and the checked-version table;
`docs/decisions.md` already owns the decision and is committed at baseline.
`AGENTS.md` owns the harness prose and is forbidden here by the envelope.

### 2. The package version advances so installed copies refresh

**Behaviour.** `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` both
read `0.17.0`, `tests/contracts.sh` requires that pair, and no `0.16.1` remains
anywhere outside `docs/_plans/`.

**Direction.** Bump both versioned manifests together. Update the version
equality check and its failure message in `tests/contracts.sh`. Update
`README.md`'s remaining `0.16.1` references, including the `npx skills` sentence
in the cache-refresh section and the pinned-ref examples in the Claude Code and
Codex CLI sections. Root `plugin.json` and `.cursor-plugin/plugin.json` stay
versionless.

**Files.** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
`tests/contracts.sh`, `README.md`.

**Focused verification.** `bash tests/contracts.sh` passes, and
`git grep -n '0\.16\.1' -- . ':!docs/_plans'` returns nothing. Then revert one
manifest to `0.16.1` and observe the run fail on the version pair; restore it.

**Document impact.** `README.md` owns the version strings it prints; no other
document names the version.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| The documented Copilot install works with native verbs | Run the README section's commands against live Copilot CLI 1.0.82, ending in `copilot skill list` | A README documenting `npx skills --agent copilot`, or a plausible-but-wrong verb such as `copilot plugin add dely`: present, runnable, and answered with `Invalid command format` | |
| The harness row is true of the live TUI, not copied from another harness | Launch `copilot --allow-all` in a fresh untrusted directory through a sized pty and read the first screen | A row reading `No workspace trust surface; the TUI opens at its composer` — Grok's true cell, present and plausible, refuted by the captured `Confirm folder trust` dialog | |
| The contract checks reject a wrong Copilot row, not merely a missing one | `bash tests/contracts.sh` with `--allow-all` mutated to `--allow-all-tools` in the harness row | A check that only greps for the word `Copilot` in `harnesses.md`: it passes with every flag wrong | |
| Copilot discovery states that no model listing exists | `bash tests/contracts.sh` against the `### GitHub Copilot CLI` discovery subsection, with the subsection mutated to name a model slug | A subsection listing `claude-sonnet-4.5` as an offerable model: present, readable, and wrong — that slug was refused on the probing account | |
| Contract checks stay inside the cap the seventh harness was promised | `test "$(wc -l < tests/contracts.sh)" -le 250` | A pasted third per-harness block: `bash tests/contracts.sh` passes green while the file reaches roughly 254 lines | |
| The protected dirty path is untouched | `git diff --stat <baseline>..HEAD -- AGENTS.md` is empty, and the forbidden-flag loop asserts `AGENTS.md` names no launch flag | An implementer that helpfully adds Copilot to the `AGENTS.md` harness sentence and commits it: every other gate stays green | |
| Every installed copy is forced to refresh | `bash tests/contracts.sh` version pair at `0.17.0`, plus `git grep -n '0\.16\.1' -- . ':!docs/_plans'` returning nothing | Bumping `.claude-plugin/plugin.json` alone, or bumping both manifests while the README still tells a Kiro user to compare against `0.16.1` | |

Design filled Counterexample; implement fills Observed red.

**Cannot be observed:** whether Orca's `--agent` launcher recognizes `copilot`
and can pin its model and effort — the first real dispatch settles that.
Whether Copilot exposes the two skills as slash commands rather than
description-matched skills. Behaviour on Linux or Windows, and on any account
with different model entitlement — every probe here ran on one macOS profile.
Whether the `Restore interrupted sessions` picker appears when no interrupted
session exists anywhere; it was observed only in the state this machine was in.

## Stop conditions

`NEEDS_REPLAN` if the Copilot checks cannot fit under 250 lines after folding
the existing subsection comparisons into one helper — the cap does not move in
this plan. `BLOCKED` if a live Copilot install stops resolving this repository
from root `plugin.json`, because the decision's no-sidecar premise would then be
false. `BLOCKED` if any required change lands in `AGENTS.md`. The trust and
restore-picker mechanics were observed on macOS with an already-configured
profile only; do not restate them as cross-platform facts.

## Closure gates

Run from the repository root:

```
git diff --check
bash -n tests/contracts.sh
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null
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
