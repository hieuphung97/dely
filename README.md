# dely

[![contracts](https://github.com/hieuphung97/dely/actions/workflows/contracts.yml/badge.svg)](https://github.com/hieuphung97/dely/actions/workflows/contracts.yml)

An automation-first delivery protocol for coding agents, packaged for Claude
Code, Codex CLI, Grok Build, Antigravity CLI, Kiro CLI, Cursor Agent CLI, and
GitHub Copilot CLI: it takes a request that may still be vague, brings it to
an approved design contract, then automates sequential implementation,
independent review, and pull-request preparation.

## Quickstart

Four steps, and nothing more:

1. Install `dely` in the harness.
2. Open a session in the project.
3. Invoke `dely:setup` (optional).
4. Ask for a change normally.

You need one of Claude Code, Codex CLI, Grok Build, Antigravity CLI, Cursor
Agent CLI, or GitHub Copilot CLI, each with plugin support, or Kiro CLI with
the `npx skills` installer; [Orca](https://www.onorca.dev/docs/install) as the
required,
constant execution plane that launches and supervises the per-phase worker
TUIs; and Git plus a GitHub remote for the project you run Dely against.
`dely:delivery` preflights Orca and stops when the CLI is missing, the runtime
cannot start, or a required capability is absent.

Preflight Orca before installing a harness plugin. Orca's orchestration
feature must be enabled:

```bash
orca open           # launches Orca and waits for the runtime to be reachable
orca status --json   # confirms the runtime is reachable
orca orchestration run-list --json  # confirms orchestration is enabled
```

Per-harness install commands live under [Install](#install). Project pins live
under [Project setup](#project-setup).

## How Dely works

Dely is a thin control protocol, not an orchestrator, an SDLC framework, or a
second source of Git state. The current interactive session is Control. Control
owns the approval boundary, task boundaries, exception handling, dispatch
supervision, and release. It never implements or reviews the candidate itself:
those roles run in fresh worker sessions that Control launches and watches.

There are two human gates and only two. The first is to approve the design
contract before any candidate mutation. The second is to merge or publish after
Dely has prepared the reviewed pull request. Between those gates Dely pauses
only for a scope or architecture change, a destructive action, new authority, a
replan, or an unavailable required runtime.

Work takes one of three shapes, and you pick the smallest contract that safely
holds the change. Risk may promote an otherwise small change; diff size never
demotes data-loss, security, permission, or public-compatibility risk.

A Spike is investigation only. It produces an approved probe and a
recommendation. No candidate is delivered and no delivery run starts, so it
gets no review.

A Bounded change is small, with clear behaviour and ownership. Its artifact is
an approved in-chat design plus a short execution envelope, and it gets one
independent whole-change review.

An Architectural change covers multiple behaviours, a public-contract change,
an architecture decision, or promoted risk. Its artifacts are an approved
decision record, a task plan, and an execution envelope. Each task gets its own
review, then a different fresh reviewer performs one integration review. Only
that final review is release-binding.

An approved design contract states intent and success criteria; scope and
authority; affected public contract or architecture; consequential risks and
material assumptions; and a plausible counterexample or failure mode that
distinguishes correct behaviour from a present-but-wrong implementation. If no
executable instrument can discriminate the requirement, the contract names the
manual inspection and its limit.

Acceptance is one table: each requirement, the instrument that proves it, the
plausible wrong implementation that instrument rejects, and where that
rejection was observed. A row is invalid until its instrument discriminates. An
instrument that passes both before and after the change proves nothing. Baseline
red is not enough on its own: an instrument that is red only because the
feature is absent says nothing about whether it can catch an implementation that
is present, runs, returns a pass, and is wrong. "The feature is absent" is not
a counterexample.

Before mutation, Control records the execution envelope: owned scope and paths,
protected pre-existing dirty paths, acceptance criteria, the feature branch,
and the resolved harness, model, and effort. The envelope never authorises
merge, force-push, stash, reset, cleanup, or an edit outside owned scope.

The run itself is sequential. After the design contract is approved and the
envelope is frozen, Control dispatches `implement`, then an independent
`review`, then performs `release` on exact HEAD — native Git and forge tools,
no LLM worker, no post-review candidate edit. Release pushes the feature
branch, opens or updates a draft pull request, requires the applicable review's
`ACCEPT` plus required checks green, then marks the pull request ready and
reports it for the human to merge. Dely never merges or force-pushes.

Each worker returns a structured handoff. `END OF HANDOFF` is the last line and
load-bearing: it is the only thing that distinguishes a complete handoff from
one cut off mid-write. The block names status, harness, session, baseline,
changed paths, contract coverage, verification, deviations, residue,
and git state.

If review returns in-contract `CHANGES_REQUESTED`, there is one remediation
pass per finding by the original implementer: verify the finding, fix the
root cause, rerun the affected instruments and closure gates, and write a
separate remediation commit. The reviewer that raised the finding checks
reproduction and the fix-only diff. If that scoped re-review does not accept,
Control routes to replan rather than starting another repair loop.

`BLOCKED` and `NEEDS_REPLAN` are distinct stop statuses, not synonyms for a
crash. `BLOCKED` preserves the candidate and escalates an unresolved
dependency or authority question to Control; it is not remediated by the
original implementer. `NEEDS_REPLAN` means the task no longer fits the
approved contract — the record contradicts the code, the contract is
ambiguous, work outside the task became necessary, or an existing test
disproves an assumption. A worker that *failed* — a non-zero exit with no
result, an exhausted quota, an authentication error — is not the same as one
that returned `BLOCKED`, and must not be treated as one.

Ownership is split and Dely duplicates none of it. Orca owns dispatch: it
launches and supervises the worker TUIs, and evidence is a property of a
dispatch, not a skill-owned journal. Git owns the candidate. CI and the forge
own release state. Durable facts come from those stores; Dely does not keep a
second copy.

The full workflow contract is
[`skills/delivery/SKILL.md`](skills/delivery/SKILL.md). Per-harness launch
mechanics — Orca agent id, permission defaults, forbidden headless forms, and
launch notes — live in
[`skills/delivery/references/harnesses.md`](skills/delivery/references/harnesses.md).
Rationale for the current design is in
[`docs/decisions.md`](docs/decisions.md).

## Install

The plugin is `dely`, served from the `dely` marketplace at
`https://github.com/hieuphung97/dely.git`. Install it in each of the six
plugin harnesses — Claude Code, Codex CLI, Grok Build, Antigravity CLI,
Cursor Agent CLI, and GitHub Copilot CLI — from that remote. The skill keeps
the name `delivery`; the intended namespaced name is `dely:delivery`. The
marketplace entry keeps `"source": "./"`, which is what makes the plugin
resolve inside its own repository whether the marketplace is added by path
or by git URL. Kiro CLI
has no plugin verb; see `### Kiro CLI` below for its `npx skills` install.

### Claude Code

```bash
claude plugin marketplace add https://github.com/hieuphung97/dely.git
claude plugin install dely@dely

claude plugin list                 # verify it is installed
claude plugin update dely          # update (restart required to apply)
claude plugin uninstall dely       # uninstall
```

`claude plugin marketplace add` and `claude plugin install` track whatever
the marketplace source currently points at; the checked command surface has
no ref option for Claude, so this README does not claim one.

### Codex CLI

```bash
codex plugin marketplace add https://github.com/hieuphung97/dely.git
codex plugin add dely@dely

codex plugin list                  # verify it is installed
codex plugin marketplace upgrade   # update: see below
codex plugin remove dely@dely      # uninstall
```

`codex plugin marketplace add --ref <ref>` targets the marketplace at an
explicit Git ref instead of the default branch — use a tag such as
`v0.17.0` or an exact full commit SHA for an
immutable pin; `main` is a mutable branch, not a pin. There is no
`codex plugin update`: `codex plugin marketplace upgrade` is the actual
update command. On the checked CLI, when the marketplace's Git root has
advanced, that command refreshes both the marketplace snapshot and the
already-installed plugin's cache, so a following `codex plugin add` is not
required to pick up the change. This is a separate concern from the
[self-update boundary](#cache-refresh-boundary): a delivery already running
keeps the plugin version that was frozen at its start regardless of any
refresh, and a refreshed cache is only picked up by the next session. `codex plugin
install` does not exist on the checked CLI (`codex plugin install --help`
exits non-zero with "unrecognized subcommand 'install'"); do not use it.

### Grok Build

```bash
grok plugin install hieuphung97/dely

grok plugin list                   # verify it is installed
grok plugin update dely            # update
grok plugin uninstall dely         # uninstall
```

`grok plugin install` takes a source (git URL, GitHub shorthand, or local
path), not a marketplace selector, and tracks the default branch unless you
append `@ref`. For an immutable pin, use a tag such as
`hieuphung97/dely@v0.17.0` or an exact full
commit SHA — a branch name such as `@main` is still mutable, not a pin.

`grok plugin install` refuses a local directory without `--trust`. Whether a
git-remote install prompts the same way is untested; if the prompt appears,
it is the install asking for trust, not a failure.

### Antigravity CLI

```bash
agy plugin install https://github.com/hieuphung97/dely.git

agy plugin list                    # verify it is installed
agy plugin install https://github.com/hieuphung97/dely.git  # refresh: no `plugin update` subcommand
agy plugin uninstall dely          # uninstall
```

`agy plugin install` takes a git URL or a local path. This README documents
the command, not a plugin cache directory.

### Cursor Agent CLI

```bash
cursor-agent plugin marketplace add https://github.com/hieuphung97/dely.git

# verify it is installed
cursor-agent plugin marketplace list

# update
cursor-agent plugin marketplace update dely

# removes the marketplace, not the plugin
cursor-agent plugin marketplace remove dely
```

Add the marketplace first with `cursor-agent plugin marketplace add`, then in
a Cursor Agent session type `/plugin` and press Enter. A panel opens headed
`Plugins`, with two selectable tabs, `Installed` and `Marketplace`, cycled
with the left and right arrows or Tab. Go to the `Marketplace` tab, type
`dely` in the search box, and press Enter on the `dely (dely)` result, then choose
`Install for you (user scope)` (the other offered action is `Install for all
collaborators on this repository (project scope)`).

To uninstall, go to the `Installed` tab instead, select `dely`, and choose
`Uninstall`. There is no non-interactive uninstall command;
`cursor-agent plugin marketplace remove` only removes the marketplace entry
and leaves the plugin installed. That `Uninstall` action only appears for a
`dely` installed through Cursor's own marketplace; a `dely` installed through
Claude Code shows as `dely (Claude Code)` in the same `Installed` tab with
only `Try in chat`, and is not uninstallable from Cursor.

Cursor does not namespace plugin skills the way Claude Code does with
`dely:setup`; with another plugin also installed, the palette can show more
than one bare `/setup` entry. Type `/dely` to filter the palette down to
exactly Dely's `/delivery` and `/setup`, then pick from that filtered list.

### GitHub Copilot CLI

```bash
copilot plugin marketplace add https://github.com/hieuphung97/dely.git
copilot plugin install dely@dely

copilot plugin list                 # verify it is installed
copilot plugin update dely          # update
copilot plugin uninstall dely       # uninstall
copilot plugin marketplace remove dely  # removes the marketplace, not the plugin
```

### Kiro CLI

```bash
npx skills add hieuphung97/dely --agent kiro-cli --global --skill delivery --skill setup

npx skills list --agent kiro-cli --global    # verify it is installed
npx skills update --global                   # update
npx skills remove --agent kiro-cli --global --skill delivery --skill setup  # uninstall
```

`npx skills add` installs the existing `delivery` and `setup` skills — no
Kiro Power, no duplicated skill tree — through the open `npx skills`
installer, targeting the `kiro-cli` agent (`--agent`) at global scope
(`--global`). Kiro's default agent discovers global skills from
`~/.kiro/skills/` automatically. Invoke them natively in a Kiro CLI session
as `/delivery` and `/setup`.

### Checked versions

These are the versions this README's commands were last locally checked
against — observations, not a promised minimum:

| Tool | Checked version |
| --- | --- |
| Claude Code | 2.1.245 |
| Codex CLI | 0.149.1 |
| Grok Build | 1.0.5 |
| Antigravity CLI | 1.1.19 |
| Kiro CLI | 2.16.2 |
| Cursor Agent CLI | 2026.08.25-3e8eec8 |
| GitHub Copilot CLI | 1.0.82 |
| Orca | 1.4.196 |

## Project setup

A consuming project supplies its own facts through `AGENTS.md`: closure gate
commands, artifact paths, the default branch. `dely:setup` writes the
per-phase harness, model, and effort for `implement` and `review` into one
managed block between `<!-- dely:begin -->` and `<!-- dely:end -->`,
discovered live from the installed harnesses rather than a stored catalogue.
A project with no managed block still works: `delivery` runs on the current
harness with harness defaults.

Orca is a required, constant execution plane, so the managed block has no
coordinator field, no `control` row, and no `release` row — release is
performed by the current interactive session with native Git and forge tools
and dispatches no worker.

**Claude Code does not read `AGENTS.md`.** Codex, Grok, Antigravity CLI,
Kiro CLI, Cursor Agent CLI, and GitHub Copilot CLI do. A consuming project
whose sessions run on Claude Code needs a `CLAUDE.md` containing `@AGENTS.md`
— one line — or the managed block never reaches it. Grok does not expand that
import. GitHub Copilot CLI loads both `AGENTS.md` and `CLAUDE.md`.

## Operating notes

### Cache refresh boundary

The six plugin harnesses — Claude Code, Codex CLI, Grok Build, Antigravity
CLI, Cursor Agent CLI, and GitHub Copilot CLI — each run a **copy** of this
package taken at install time, so editing the source changes nothing until
each cache is refreshed. Bump the
version and refresh every copy whenever a rule changes, or the harnesses
disagree about what the workflow says.

Kiro CLI instead reads from a shared store, usually a symlink into this
checkout. `npx skills update --global` refreshes it by comparing a folder
hash, not the `0.17.0` version string. `update` takes no `--agent`/`--skill`
because the store is shared.

A self-update's release phase runs through the frozen installed plugin
version already in use for that plan; candidate changes take effect starting
with the next delivery.

### Opt-in logging

Maintenance logging is machine-local and off by default. Dely never creates
`~/.dely/log`; a missing path is skipped silently, and deleting the file opts
back out. Opt in by creating it yourself with owner-only permissions:

```bash
mkdir -p ~/.dely
touch ~/.dely/log
chmod 600 ~/.dely/log
```

Once the file exists, Control appends exactly one line only after a delivery
is accepted and all required checks are green; aborted or incomplete
deliveries are not recorded. Dely never reads this file for routing,
recovery, or runtime decisions.

### Compatibility limitation

This README's install/verify/update/uninstall commands were checked against
the harness's normal, already-configured profile, not an isolated
clean-profile install: no supported harness offers a safe disposable
configuration boundary that avoids touching live caches, so no such
clean-install mutation was performed. Validation here is limited to public
remote access, manifest validation, and the verified command surface.

## Troubleshooting

- **`dely:delivery` stops immediately.** Orca is not running or a required
  capability is absent, including orchestration. Run `orca open` and
  `orca status --json`, then retry.
- **A harness still runs the old workflow after you edited this checkout.**
  You edited the source, not an installed copy. Bump the version and
  reinstall/update in the harness (see Cache refresh boundary above).
- **Codex still behaves the same after `codex plugin marketplace upgrade`.**
  That command only refreshes the installed cache when the marketplace's Git
  root has actually advanced — confirm the remote has new commits. A
  delivery already running mid-session keeps the plugin version frozen at
  its start regardless; only a new session picks up a refreshed cache.
- **`AGENTS.md` pins don't seem to apply in Claude Code.** Confirm
  `CLAUDE.md` contains `@AGENTS.md`; Claude Code does not read `AGENTS.md`
  directly.

## Contributing, security, and license

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — issue-first workflow, fork/branch/pull
  request flow, and review expectations. External contributors do not need
  Dely or Orca.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Contributor Covenant 2.1.
- [`SECURITY.md`](SECURITY.md) — how to report a vulnerability privately.
- [`docs/decisions.md`](docs/decisions.md) — settled, open, and rejected
  design decisions, with rationale.

[MIT](LICENSE)
