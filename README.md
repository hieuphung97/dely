# dely

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
  <img src="assets/logo-light.svg" alt="dely" width="72" height="72">
</picture>

[![contracts](https://github.com/hieuphung97/dely/actions/workflows/contracts.yml/badge.svg)](https://github.com/hieuphung97/dely/actions/workflows/contracts.yml)

Ask for a change; Dely takes it through design approval, implementation,
independent review, and a pull request you merge.

https://github.com/user-attachments/assets/83ec539a-6551-4807-8517-0c73e5d171d7

[YouTube](https://www.youtube.com/watch?v=6pRWkhlQSAc)

## Contents

- [Quickstart](#quickstart)
- [Project setup](#project-setup)
- [Install](#install)
- [How Dely works](#how-dely-works)
- [Troubleshooting](#troubleshooting)

## Quickstart

Install Orca, then Dely.

1. Install the [desktop app](https://www.onorca.dev/docs/install).
2. Register the CLI (it ships with the app): Settings → General → Orca CLI.
   See the [CLI overview](https://www.onorca.dev/docs/cli/overview).
3. Enable orchestration: Settings → Experimental. See
   [orchestration](https://www.onorca.dev/docs/cli/orchestration).
4. Preflight:

```bash
orca open
orca status --json
orca orchestration run-list --json
```

`dely:delivery` stops if this preflight fails. On Linux the binary is
`orca-ide` (see the [install docs](https://www.onorca.dev/docs/install)).

Optional agent skills `orca-cli` and `orchestration`:
https://www.onorca.dev/docs/cli/skills

Then:

1. Install `dely` in the harness ([Install](#install)).
2. Open a session in the project.
3. Invoke `dely:setup` (optional).
4. Ask for a change.

## Project setup

In the project, invoke `dely:setup`.

It asks Quick (this harness for both phases) or Customize (pick harness,
model, and effort for `implement` and `review`), then writes one managed
block into `AGENTS.md`. Skip it and `dely:delivery` uses the current
harness and that harness's defaults.

## Install

The plugin is `dely`, from the `dely` marketplace at
`https://github.com/hieuphung97/dely.git`. The skill name is `delivery`;
invoke it as `dely:delivery`. Kiro CLI has no plugin verb; use
`### Kiro CLI` below.

### Claude Code

```bash
claude plugin marketplace add https://github.com/hieuphung97/dely.git
claude plugin install dely@dely

claude plugin list                 # verify it is installed
claude plugin update dely          # update (restart required to apply)
claude plugin uninstall dely       # uninstall
```

### Codex CLI

```bash
codex plugin marketplace add https://github.com/hieuphung97/dely.git
codex plugin add dely@dely

codex plugin list                  # verify it is installed
codex plugin marketplace upgrade   # update: see below
codex plugin remove dely@dely      # uninstall
```

`codex plugin marketplace add --ref <ref>` pins the marketplace to a tag
such as `v0.17.0` or an exact full commit SHA. There is no
`codex plugin update`: use `codex plugin marketplace upgrade`. Do not use
`codex plugin install`.

### Grok Build

```bash
grok plugin install hieuphung97/dely

grok plugin list                   # verify it is installed
grok plugin update dely            # update
grok plugin uninstall dely         # uninstall
```

`grok plugin install` takes a git URL, GitHub shorthand, or local path.
Pin with `@tag`, for example `hieuphung97/dely@v0.17.0`. A local directory
needs `--trust`.

### Antigravity CLI

```bash
agy plugin install https://github.com/hieuphung97/dely.git

agy plugin list                    # verify it is installed
agy plugin install https://github.com/hieuphung97/dely.git  # refresh: no `plugin update` subcommand
agy plugin uninstall dely          # uninstall
```

`agy plugin install` takes a git URL or a local path.

### Cursor Agent CLI

```bash
cursor-agent plugin marketplace add https://github.com/hieuphung97/dely.git

# verify it is installed
cursor-agent plugin marketplace list

# re-index, no fetch
cursor-agent plugin marketplace update dely

# refresh: remove and re-add (remove drops the marketplace, not the plugin)
cursor-agent plugin marketplace remove dely
cursor-agent plugin marketplace add https://github.com/hieuphung97/dely.git
```

The snapshot is addressed by commit, so `marketplace update` only re-indexes
and does not fetch. Remove and re-add the marketplace to pick up new commits,
then choose `Uninstall` from the `Installed` tab and install again from the
`Marketplace` tab of the `/plugin` panel.

Add the marketplace first with `cursor-agent plugin marketplace add`, then in
a Cursor Agent session type `/plugin` and press Enter. Open the `Marketplace`
tab, type `dely` in the search box, press Enter on `dely (dely)`, and choose
`Install for you (user scope)` (or `Install for all collaborators on this
repository (project scope)`).

To uninstall, open the `Installed` tab, select `dely`, and choose
`Uninstall`. `cursor-agent plugin marketplace remove` removes the marketplace
entry and leaves the plugin installed.

Type `/dely` to filter the palette to Dely's `/delivery` and `/setup`.

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

Invoke the skills in a Kiro CLI session as `/delivery` and `/setup`.

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

## How Dely works

Ask for a change. Approve the design when asked. Dely implements, a
different session reviews, then opens a PR. You merge. A Spike investigates
only — no delivery run.

The workflow contract is [`skills/delivery/SKILL.md`](skills/delivery/SKILL.md).

## Troubleshooting

- **`dely:delivery` stops immediately.** Orca is not running or a required
  capability is absent, including orchestration. Run the Quickstart
  preflight, then retry.
- **A harness still runs the old workflow after you edited this checkout.**
  You edited the source, not an installed copy. Reinstall or update the
  plugin in the harness.
- **Codex still behaves the same after `codex plugin marketplace upgrade`.**
  Confirm the remote has new commits. A delivery already running keeps the
  plugin version from its start; open a new session after the upgrade.
- **`AGENTS.md` pins don't seem to apply in Claude Code.** Put
  `@AGENTS.md` in `CLAUDE.md`; Claude Code does not read `AGENTS.md`
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
