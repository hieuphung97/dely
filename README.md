# dely

An automation-first delivery protocol for coding agents, packaged for Claude
Code, Codex CLI, Grok Build, Antigravity CLI, Kiro CLI, and Cursor Agent CLI.

Dely accepts a request that may still be vague, brings it to an approved
design contract, then automates sequential implementation, independent
review, and pull-request preparation. It is a thin control protocol: Orca
supervises dispatch, Git owns the candidate, and CI plus the forge own
release state. Dely does not duplicate any of those stores, does not merge or
force-push, and stops with no headless fallback when a required capability is
unavailable.

The workflow is `skills/delivery/SKILL.md`. Project pins — per-phase harness,
model and effort for `implement` and `review` — are written into `AGENTS.md`
by a second core skill, `dely:setup`. Rationale for the current design is in
[`docs/decisions.md`](docs/decisions.md).

## Prerequisites

- One of Claude Code, Codex CLI, Grok Build, Antigravity CLI, or Cursor Agent
  CLI, each with plugin support, or Kiro CLI with the `npx skills` installer.
- [Orca](https://www.onorca.dev/docs/install) — a required, constant
  execution plane. It launches and supervises the per-phase worker TUIs.
  `dely:delivery` preflights Orca and stops when the CLI is missing, the
  runtime cannot start, or a required capability is absent.
- Git and a GitHub remote, for the project you run Dely against.

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
| Orca | 1.4.188 |

Preflight Orca before installing a harness plugin:

```bash
orca open           # launches Orca and waits for the runtime to be reachable
orca status --json   # confirms the runtime is reachable
```

## Install

The plugin is `dely`, served from the `dely` marketplace at
`https://github.com/hieuphung97/dely.git`. Install it in each of the five
plugin harnesses — Claude Code, Codex CLI, Grok Build, Antigravity CLI, and
Cursor Agent CLI — from that remote. The skill keeps the name `delivery`; the
intended namespaced name is `dely:delivery`. The marketplace entry keeps
`"source": "./"`, which is what makes the plugin resolve inside its own
repository whether the marketplace is added by path or by git URL. Kiro CLI
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
`v0.13.0` (once that release is tagged) or an exact full commit SHA for an
immutable pin; `main` is a mutable branch, not a pin. There is no
`codex plugin update`: `codex plugin marketplace upgrade` is the actual
update command. On the checked CLI, when the marketplace's Git root has
advanced, that command refreshes both the marketplace snapshot and the
already-installed plugin's cache, so a following `codex plugin add` is not
required to pick up the change. This is a separate concern from the
self-update boundary above: a delivery already running keeps the plugin
version that was frozen at its start regardless of any refresh, and a
refreshed cache is only picked up by the next session. `codex plugin
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
`hieuphung97/dely@v0.13.0` (once that release is tagged) or an exact full
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
# then in a Cursor Agent session:
/add-plugin dely

# verify it is installed
cursor-agent plugin marketplace list

# update
cursor-agent plugin marketplace update dely

# uninstall
cursor-agent plugin marketplace remove dely
```

Add the marketplace first with `cursor-agent plugin marketplace add`, then
open a Cursor Agent session and run `/add-plugin dely` to activate the plugin.
Invoke the skills natively in a Cursor Agent session as `/delivery` and
`/setup`.

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

### Cache refresh boundary

The five plugin harnesses — Claude Code, Codex CLI, Grok Build, Antigravity
CLI, and Cursor Agent CLI — each run a **copy** of this package taken at
install time, so editing the source changes nothing until each cache is
refreshed. Bump the
version and refresh every copy whenever a rule changes, or the harnesses
disagree about what the workflow says.

Kiro CLI instead reads from a shared store, usually a symlink into this
checkout. `npx skills update --global` refreshes it by comparing a folder
hash, not the `0.15.0` version string. `update` takes no `--agent`/`--skill`
because the store is shared.

A self-update's release phase runs through the frozen installed plugin
version already in use for that plan; candidate changes take effect starting
with the next delivery.

## Setup

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
Kiro CLI, and Cursor Agent CLI do. A consuming project whose sessions run on
Claude Code needs a `CLAUDE.md` containing `@AGENTS.md` — one line — or the
managed block never reaches it. Grok does not expand that import, so the file
helps one harness and is invisible to the others.

## Ordinary use

Four steps, and nothing more:

1. Install `dely` in the harness.
2. Open a session in the project.
3. Invoke `dely:setup` (optional).
4. Ask for a change normally.

## Troubleshooting

- **`dely:delivery` stops immediately.** Orca is not running or a required
  capability is absent. Run `orca open` and `orca status --json`, then retry.
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

## Compatibility limitation

This README's install/verify/update/uninstall commands were checked against
the harness's normal, already-configured profile, not an isolated
clean-profile install: no supported harness offers a safe disposable
configuration boundary that avoids touching live caches, so no such
clean-install mutation was performed. Validation here is limited to public
remote access, manifest validation, and the verified command surface.

## Opt-in logging

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

## Contributing and security

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — issue-first workflow, fork/branch/pull
  request flow, and review expectations. External contributors do not need
  Dely or Orca.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Contributor Covenant 2.1.
- [`SECURITY.md`](SECURITY.md) — how to report a vulnerability privately.
- [`docs/decisions.md`](docs/decisions.md) — settled, open, and rejected
  design decisions, with rationale.

[![contracts](https://github.com/hieuphung97/dely/actions/workflows/contracts.yml/badge.svg)](https://github.com/hieuphung97/dely/actions/workflows/contracts.yml)

## License

[MIT](LICENSE)
