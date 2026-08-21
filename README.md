# delivery-evidence

A delivery workflow and the rails that make its guarantees mechanical, packaged for
Claude Code, Codex CLI and Grok Build.

The workflow is `skills/delivery/SKILL.md`. Every rule in it is one that a
real delivery lost a round without, across 41 recorded plans. Rules that could not
show that were dropped, and rules a mechanism can enforce were replaced by the
mechanism. Project pins — coordinator and per-phase harness, model and effort —
are written into `AGENTS.md` by a second core skill, `dely:setup`.

## Why

Across 41 delivered plans in the reference consumer's workflow, the failures that cost
rounds were not failures of model judgement. They happened where an identifier
or a piece of evidence travelled from where it was produced to where it was
used: fabricated SHAs in handoff prose, a summary line nobody downstream could
check, a payload whose encoding broke in transit.

Two rails follow from that:

- **Identifiers are resolved, never recalled.** `SessionStart` injects HEAD,
  branch, tree state, default ref, and merge base, read from `git` at the
  moment the session opens.
- **Evidence is recorded by the tool layer, not claimed by the model.**
  `PostToolUse` journals shell activity so a gate result can be checked instead
  of trusted.

Full reasoning in [`docs/findings.md`](docs/findings.md): findings about this
package, any harness, the protocol and the rails. Project-specific evidence
lives with the project. Decisions and open questions in
[`docs/decisions.md`](docs/decisions.md). Every option considered per layer,
ranked for testing, in [`docs/options.md`](docs/options.md). The verified CLI,
hook and session surface of each harness is in
[`docs/harness-surface.md`](docs/harness-surface.md).

Note that both rails above have native equivalents that were found late and are
still being compared against these hooks: Claude Code and Codex both ship
OpenTelemetry instrumentation, and Claude Code ships checkpointing with
`/rewind`. See `docs/options.md`, layers B and D.

## State

Both rails work, verified by observation on 2026-08-20 against a real repository
under `--permission-mode bypassPermissions`.

**Identifiers.** `SessionStart` injects HEAD, branch, tree state, upstream,
default ref, merge base and position. Values drawn from a remote-tracking ref
carry an inline `[STALE: Nh since fetch]` marker, because a resolved identifier
can still be an old one. The hook performs no network I/O.

**Evidence.** `PostToolUse` and `PostToolUseFailure` together give the command,
the verbatim output, pass or fail, the exit code, the duration and a correlation
id. No OpenTelemetry collector is needed, no wrapping of gate commands, no
`PreToolUse` rewriting. `bin/delivery-evidence` reads it back.

`cc-safety-net` is settled as of 2026-08-20: the secret-scanning plan is
dropped, and `git-hooks/pre-push` is retained because
`git push --dry-run origin HEAD:main` was not blocked. It is an optional
recommended rail — recommended on Claude Code, recommended on Codex only with
explicit hook trust, and not claimed functional on Grok, which discovers plugin
hooks and dispatches none of them.

Still open: whether `intellectronica/ruler` retires per-harness manifests,
ranked first in [`docs/options.md`](docs/options.md) because it can delete
code that exists here.

Two of the three defects found so far were in this repository's own hooks, and
one was in its reader. All three were the same mistake — a shape inferred from one
observation — and all three are recorded in
[`docs/findings.md`](docs/findings.md) §7 to §9 rather than quietly fixed.

## Layout

```
CLAUDE.md                           one line: @AGENTS.md, so Claude Code reads it
.claude-plugin/plugin.json          Claude Code manifest
.codex-plugin/plugin.json           Codex manifest
skills/delivery/SKILL.md            the workflow
skills/setup/SKILL.md               writes one managed block into AGENTS.md
skills/delivery/templates/          decision-record.md, plan.md
hooks/hooks.json                    SessionStart + PostToolUse + PostToolUseFailure
hooks/session-start-context.sh      resolve identifiers via git
hooks/post-tool-journal.sh          record the hook payload verbatim
bin/delivery-evidence               read the journal back as gate evidence
bin/delivery-doctor                 check that every rail is wired, not merely present
git-hooks/pre-push                  refuse pushes that skip review
docs/                               findings, decisions, options, harness surface
```

**Claude Code does not read `AGENTS.md`.** Codex and Grok do. A consuming project
whose sessions run on Claude Code needs a `CLAUDE.md` containing `@AGENTS.md` —
one line — or the managed block never reaches it. Measured, not assumed: without
that file a Claude Code session asked what the project pins its implement phase to
answers `UNKNOWN`, and with it answers correctly. Grok does not expand that import,
so the file helps one harness and is invisible to the others.

A consuming project supplies its own facts through `AGENTS.md`: closure gate
commands, artifact paths, the default branch, where its delivery log lives, and
its current phase mapping. `dely:setup` writes the coordinator and the
per-phase harness, model and effort into one managed block between
`<!-- dely:begin -->` and `<!-- dely:end -->`. A project with no managed block
still works: `delivery` runs on the current harness with harness defaults.
Record any extra dispatch choices — worker surface, a review sandbox pin —
as prose outside the block rather than treating them as a package default.
There is no configuration file, because `AGENTS.md` is read by every harness
here and already holds project facts.

This repository's combination is Orca, interactive TUIs, and Grok Build review
pinned to `--always-approve`. Another project may choose none
of those values. The skill loads the selected coordinator's native skill; it does
not ship a coordinator adapter.

The skill owns the delivery log's **shape** — five columns, and the rule that
instructions change only on recurrence. The project owns the **file**, because the
data is about that project.

## Reading the journal

```bash
bin/delivery-evidence                      # newest session, every Bash call
bin/delivery-evidence -g 'npm test|pytest' # only the gate commands
bin/delivery-evidence --json               # shaped records for scripts
```

Output carries the command, the status, the duration, and the trailing non-blank
lines of `stdout` and `stderr` verbatim. Exit codes are absent from the hook
payload, so status is derived from which event fired; the output says so rather
than implying a number it does not have. A conservative `pipeline_present` marker
is set when the command text contains a standalone `|`; it is lexical detection,
not a judgement of `pipefail` or whether the command is a gate.

`git-hooks/pre-push` is separate from the Claude Code plugin and installs into
a target repository on its own:

```bash
chmod +x /path/to/project-delivery-procedure/git-hooks/pre-push
cd /path/to/your/repo
git config core.hooksPath /path/to/project-delivery-procedure/git-hooks
```

**The `chmod` is required.** Git execs its hooks directly, unlike the plugin
hooks in `hooks/`, which are invoked as `bash "…"` and need no execute bit. An
earlier version of this README asserted the opposite and the rail was silently
ignored — git prints one hint line and pushes anyway. `bin/delivery-doctor`
checks for exactly this.

It refuses pushes to `main` or `master`, their deletion, and any
non-fast-forward push. It exists because git invokes it whatever the push was
spelled like, which a command-pattern permission rule cannot manage — and because
it sits in git rather than in a harness, one `git config` covers Claude Code,
Codex and Grok at once. It is skippable with `--no-verify`, so treat it as a guard
against accident rather than a security boundary.

## Checking the wiring

```bash
bin/delivery-doctor /path/to/your/repo
```

Verifies the execute bit, `core.hooksPath`, that `hooks.json` parses, that the
hook scripts parse, that something has been captured, and that a managed block
in `AGENTS.md` is absent (the supported fallback), well formed, or broken. It
also prints what it cannot verify, because several checks in this project looked
conclusive and were not.

Both scripts are invoked through `bash`, so no execute bit is needed. Both exit
0 on every error path — a broken hook must not break a session.

## Install

The plugin is `dely`, served from the `dely` marketplace at
`git@github.com:hieuphung97/dely.git`. Install it in each harness from that
remote. The skill keeps the name `delivery`; the intended namespaced name is
`dely:delivery`. Whether a session actually loads it is established by the
forward smoke after migration, not by installing. The marketplace entry keeps
`"source": "./"`, which is what makes the plugin resolve inside its own
repository whether the marketplace is added by path or by git URL.

```bash
claude plugin marketplace add git@github.com:hieuphung97/dely.git
claude plugin install dely@dely

# Codex, from the same marketplace manifest
codex plugin marketplace add git@github.com:hieuphung97/dely.git
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

**The hooks still do not reach Grok through plugin install, and that is the
step most easily missed.** Grok discovers the plugin, reports that it has
hooks, and dispatches none of them. Register them where Grok does look, against
the root of Grok's own installed copy. Derive that root; do not type it.
The block captures the `path:` line `grok plugin details dely` reports and
feeds it to `sed`.

```bash
plugin_root=$(grok plugin details dely | sed -n 's/^[[:space:]]*path: //p')
mkdir -p ~/.grok/hooks
sed "s#__PACKAGE_ROOT__#${plugin_root}#g" \
  "${plugin_root}/hooks/grok-hooks.json.template" \
  > ~/.grok/hooks/delivery.json
```

`bin/delivery-doctor` fails if this file is missing while `grok` is on `PATH`,
because without it a Grok worker records no evidence at all and nothing says so.

All three harnesses run a **copy** of this package taken at install time, so
editing the source changes nothing until each cache is refreshed. The remaining
hazard is two copies drifting when only one is refreshed: Claude Code's cache
and Grok's. Bump the version and refresh every copy — and regenerate the Grok
adapter from the installed root — whenever a rule or a script changes, or the
harnesses disagree about what the workflow says.

**Codex needs its hooks trusted, and trust is keyed to their content.** Open
`/hooks`, select the `dely` entries, press `t`. Any later change to a hook
script changes its hash and revokes that trust silently, so re-trust after every
package update.

`--plugin-dir` still works for one invocation and touches nothing. A permanent
install in each harness is intended to keep the skills available across
sessions; the forward smoke after migration is what establishes that they loaded.

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
claude --plugin-dir /path/to/project-delivery-procedure -p 'Two things, nothing else.

1. Run exactly one command: git status --porcelain
2. Quote back the "Repository identifiers" block you were given at session
   start. If there is no such block, say so plainly.'
```

Then:

```bash
ls -la ~/.delivery-journal/                                   # PostToolUse fired?
jq -r '.payload | keys[]' ~/.delivery-journal/*.raw.jsonl | sort -u
jq '.payload.tool_response' ~/.delivery-journal/*.raw.jsonl   # exit code present?
```

A journal file means `PostToolUse` fired. The session quoting the identifiers
block means `SessionStart` fired and injection worked.

Journal location overrides with `DELIVERY_JOURNAL_DIR`.

## License

MIT.
