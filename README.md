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
by a second core skill, `dely:setup`.

## Why

Across 41 delivered plans in the reference consumer's workflow, the failures
that cost rounds were not failures of model judgement. They happened where an
identifier or a piece of evidence travelled from where it was produced to
where it was used: fabricated SHAs in handoff prose, a summary line nobody
downstream could check, a payload whose encoding broke in transit.

An earlier version of this package answered that with its own evidence
journal and session-identifier hooks. Before removing them, one non-mutating
Orca probe on each supported harness recovered the exact passing and failing
marker commands, their output, and their outcomes from the intended dispatch
after worker release. Claude Code, Codex CLI, and Grok Build all passed, so
the rail was redundant with Orca's own dispatch record and was removed rather
than kept as defense in depth.

Full reasoning in [`docs/findings.md`](docs/findings.md): findings about this
package, any harness, the protocol, and the retired rails. Decisions and open
questions in [`docs/decisions.md`](docs/decisions.md), including the
2026-08-25 automation-first decision and its three-harness probe. Every
option considered per layer, ranked for testing, in
[`docs/options.md`](docs/options.md). The verified CLI, hook, and session
surface of each harness is in
[`docs/harness-surface.md`](docs/harness-surface.md).

## Layout

```
CLAUDE.md                           one line: @AGENTS.md, so Claude Code reads it
.claude-plugin/plugin.json          Claude Code manifest
.codex-plugin/plugin.json           Codex manifest
skills/delivery/SKILL.md            the workflow
skills/setup/SKILL.md               writes one managed block into AGENTS.md
skills/delivery/templates/          decision-record.md, plan.md
git-hooks/pre-push                  refuse pushes that skip review
docs/                                findings, decisions, options, harness surface
```

**Claude Code does not read `AGENTS.md`.** Codex and Grok do. A consuming project
whose sessions run on Claude Code needs a `CLAUDE.md` containing `@AGENTS.md` —
one line — or the managed block never reaches it. Measured, not assumed: without
that file a Claude Code session asked what the project pins its implement phase to
answers `UNKNOWN`, and with it answers correctly. Grok does not expand that import,
so the file helps one harness and is invisible to the others.

A consuming project supplies its own facts through `AGENTS.md`: closure gate
commands, artifact paths, the default branch, where its delivery log lives.
`dely:setup` writes the per-phase harness, model, and effort for `implement`
and `review` into one managed block between `<!-- dely:begin -->` and
`<!-- dely:end -->`, discovered live from the installed harnesses rather than
a stored catalogue. A project with no managed block still works: `delivery`
runs on the current harness with harness defaults. There is no configuration
file, because `AGENTS.md` is read by every harness here and already holds
project facts.

Orca is a required, constant execution plane, so the managed block has no
coordinator field, no `control` row, and no `release` row — release is
performed by the current interactive session with native Git and forge tools
and dispatches no worker.

The skill owns the delivery log's **shape** — five columns, and the rule that
instructions change only on recurrence. The project owns the **file**, because
the data is about that project.

## Evidence

Dely asks Orca for the dispatch-bound command, output, and outcome of a
worker's turn; durable candidate and release facts come from Git, CI, and the
pull-request state. There is no evidence journal, doctor, or hook adapter to
install, wire, or keep in sync with a plugin cache.

`git-hooks/pre-push` is separate from the harness plugins and installs into a
target repository on its own:

```bash
chmod +x /path/to/dely/git-hooks/pre-push
cd /path/to/your/repo
git config core.hooksPath /path/to/dely/git-hooks
```

**The `chmod` is required.** Git execs its hooks directly. It refuses pushes
to `main` or `master`, their deletion, and any non-fast-forward push. It
exists because git invokes it whatever the push was spelled like, which a
command-pattern permission rule cannot manage — and because it sits in git
rather than in a harness, one `git config` covers Claude Code, Codex and Grok
at once. It is skippable with `--no-verify`, so treat it as a guard against
accident rather than a security boundary.

## Install

The plugin is `dely`, served from the `dely` marketplace at
`https://github.com/hieuphung97/dely.git`. Install it in each harness from that
remote. The skill keeps the name `delivery`; the intended namespaced name is
`dely:delivery`. Whether a session actually loads it is established by the
forward smoke after migration, not by installing. The marketplace entry keeps
`"source": "./"`, which is what makes the plugin resolve inside its own
repository whether the marketplace is added by path or by git URL.

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

`--plugin-dir` still works for one invocation and touches nothing. A permanent
install in each harness is intended to keep the skills available across
sessions; the forward smoke after migration is what establishes that they loaded.

Orca is required to execute `dely:delivery` — it launches and supervises the
per-phase worker TUIs. Delivery preflights Orca and stops, without a headless
fallback, when the CLI is missing, the runtime cannot start, or a required
capability is absent.

## Onboarding

Four steps, and nothing more:

1. Install `dely` in the harness.
2. Open a session in the project.
3. Invoke `dely:setup`.
4. Ask for a change normally.

## Try it

Loads for one invocation only. Touches nothing in the target repository.

```bash
cd /path/to/your/repo
claude --plugin-dir /path/to/dely -p 'Two things, nothing else.

1. Run exactly one command: git status --porcelain
2. State which phase you were dispatched as, and the model and effort you
   are running with.'
```

## License

MIT.
