# dely

An automation-first delivery protocol for coding agents, packaged for Claude
Code, Codex CLI, and Grok Build.

Dely accepts a request that may still be vague, brings it to an approved
design contract, then automates sequential implementation, independent
review, and pull-request preparation. It is a thin control protocol: Orca
supervises dispatch, Git owns the candidate, and CI plus the forge own
release state. Dely does not duplicate any of those stores.

The workflow is `skills/delivery/SKILL.md`. Project pins — per-phase harness,
model and effort for `implement` and `review` — are written into `AGENTS.md`
by a second core skill, `dely:setup`. Rationale for the current design is in
[`docs/decisions.md`](docs/decisions.md).

## Requirements

Orca is a required, constant execution plane. It launches and supervises the
per-phase worker TUIs. `dely:delivery` preflights Orca and stops, with no
headless fallback, when the CLI is missing, the runtime cannot start, or a
required capability is absent.

**Claude Code does not read `AGENTS.md`.** Codex and Grok do. A consuming
project whose sessions run on Claude Code needs a `CLAUDE.md` containing
`@AGENTS.md` — one line — or the managed block never reaches it. Grok does
not expand that import, so the file helps one harness and is invisible to the
others.

## Install

The plugin is `dely`, served from the `dely` marketplace at
`https://github.com/hieuphung97/dely.git`. Install it in each harness from that
remote. The skill keeps the name `delivery`; the intended namespaced name is
`dely:delivery`. The marketplace entry keeps `"source": "./"`, which is what
makes the plugin resolve inside its own repository whether the marketplace is
added by path or by git URL.

```bash
claude plugin marketplace add https://github.com/hieuphung97/dely.git
claude plugin install dely@dely

# Codex, from the same marketplace manifest
codex plugin marketplace add https://github.com/hieuphung97/dely.git
codex plugin add dely@dely

# Grok Build, natively — it does not inherit Claude Code's enabled set.
# grok plugin install takes a source (git URL, GitHub shorthand, or local
# path), not a marketplace selector; @ref is a git ref, so dely@dely would
# mean repository dely at ref dely. Tracking the default branch is the same
# revision the marketplace resolves for the other two.
grok plugin install hieuphung97/dely
```

`grok plugin install` refuses a local directory without `--trust`. Whether a
git-remote install prompts the same way is untested; if the prompt appears, it
is the install asking for trust, not a failure.

All three harnesses run a **copy** of this package taken at install time, so
editing the source changes nothing until each cache is refreshed. Bump the
version and refresh every copy whenever a rule changes, or the harnesses
disagree about what the workflow says.

## Optional setup

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

## Ordinary use

Four steps, and nothing more:

1. Install `dely` in the harness.
2. Open a session in the project.
3. Invoke `dely:setup` (optional).
4. Ask for a change normally.

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

## License

MIT.
