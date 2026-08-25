# dely

An automation-first delivery protocol for coding agents, packaged for Claude
Code, Codex CLI, and Grok Build.

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

- One of Claude Code, Codex CLI, or Grok Build, each with plugin support.
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
| Orca | 1.4.188 |

Preflight Orca before installing a harness plugin:

```bash
orca open           # launches Orca and waits for the runtime to be reachable
orca status --json   # confirms the runtime is reachable
```

## Install

The plugin is `dely`, served from the `dely` marketplace at
`https://github.com/hieuphung97/dely.git`. Install it in each harness from
that remote. The skill keeps the name `delivery`; the intended namespaced
name is `dely:delivery`. The marketplace entry keeps `"source": "./"`, which
is what makes the plugin resolve inside its own repository whether the
marketplace is added by path or by git URL.

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
codex plugin marketplace upgrade   # refresh the marketplace snapshot only
codex plugin add dely@dely         # reinstall from the refreshed snapshot
codex plugin remove dely@dely      # uninstall
```

`codex plugin marketplace add --ref <ref>` pins the marketplace to an
explicit Git ref instead of the default branch. There is no
`codex plugin update`: `codex plugin marketplace upgrade` only refreshes the
marketplace's own Git snapshot, it does not by itself change an already
installed plugin's cached copy. Re-run `codex plugin add` afterward to
install from the refreshed snapshot. `codex plugin install` does not exist on
the checked CLI (`codex plugin install --help` exits non-zero with
"unrecognized subcommand 'install'"); do not use it.

### Grok Build

```bash
grok plugin install hieuphung97/dely
# grok plugin install takes a source (git URL, GitHub shorthand, or local
# path), not a marketplace selector. Append @ref (e.g. hieuphung97/dely@main)
# to pin an explicit ref instead of tracking the default branch.

grok plugin list                   # verify it is installed
grok plugin update dely            # update
grok plugin uninstall dely         # uninstall
```

`grok plugin install` refuses a local directory without `--trust`. Whether a
git-remote install prompts the same way is untested; if the prompt appears,
it is the install asking for trust, not a failure.

### Cache refresh boundary

All three harnesses run a **copy** of this package taken at install time, so
editing the source changes nothing until each cache is refreshed. Bump the
version and refresh every copy whenever a rule changes, or the harnesses
disagree about what the workflow says. A self-update's release phase runs
through the frozen installed plugin version already in use for that plan;
candidate changes take effect starting with the next delivery.

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

**Claude Code does not read `AGENTS.md`.** Codex and Grok do. A consuming
project whose sessions run on Claude Code needs a `CLAUDE.md` containing
`@AGENTS.md` — one line — or the managed block never reaches it. Grok does
not expand that import, so the file helps one harness and is invisible to the
others.

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
  That command only refreshes the marketplace's Git snapshot; it does not
  change an already-installed plugin. Reinstall with `codex plugin add
  dely@dely` afterward.
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
