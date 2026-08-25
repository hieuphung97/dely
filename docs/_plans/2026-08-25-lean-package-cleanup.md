# Plan — Dely ships only its current plugin surface and uses an opt-in machine-local maintenance log

Decision record: `docs/decisions.md#2026-08-25--dely-is-a-lean-automation-first-plugin-with-an-opt-in-machine-local-maintenance-log`

**Baseline:**

## Goal

Release Dely `0.12.0` with the approved `~/.dely/log` contract and a lean
current tree containing only runtime, onboarding, repository-maintainer guidance,
one current decision, and one focused structural contract test. Git history keeps
completed research and superseded product material; this delivery does not build an
archive, log reader, compatibility layer, or package builder.

## Allowed scope

```
.claude-plugin/plugin.json
.codex-plugin/plugin.json
.gitignore
AGENTS.md
README.md
docs/_plans/2026-08-24-automation-first-dely-design.md
docs/_plans/2026-08-25-lean-package-cleanup.md
docs/decisions.md
docs/delivery-log.md
docs/findings.md
docs/harness-surface.md
docs/options.md
git-hooks/pre-push
skills/delivery/SKILL.md
tests/contracts.sh
tests/delivery-contract.sh
tests/managed-block-contract.sh
tests/plan-template-shape.sh
```

The new `tests/contracts.sh` is listed explicitly rather than carried as a
colocated or registry test. All documents that own changed public paths are also
listed explicitly. The repository has no colocated source tests or registry test
outside this list, and checking the manifests, skills, and templates yielded no
generated files.

## Forbidden scope

- `.claude-plugin/marketplace.json` has no version field and its current source and
  description remain valid.
- `CLAUDE.md`, `skills/setup/SKILL.md`, and
  `skills/delivery/templates/{decision-record,plan}.md` are current surfaces read by
  the focused contract test but require no product change.
- The ignored, empty `.worktrees/` directory is pre-existing user state. Delete only
  the tracked `.gitignore`; do not remove or populate the directory.
- Local Git configuration, including the external `core.hooksPath`, installed Claude,
  Codex, and Grok plugin caches, Orca state outside ordinary task records, tags, other
  branches, and every external hook path are not owned.
- No merge, force-push, cache refresh, plugin publication, compatibility file, archive,
  log reader, rotation, lock, telemetry upload, or schema is in scope.

## Execution envelope

Protected dirty paths: the tracked tree was clean at baseline. The ignored
`.worktrees/` directory existed and was empty. Local `core.hooksPath` was
`/Users/hieuphung/Projects/project-delivery-procedure/git-hooks`; both are protected
and must remain untouched.

Branch, base, remote, and pull-request target: commit to
`lean-package-cleanup`, based on `origin/main` at
`552acd9f19abda6fcc4ef0f52f349171c93c8738`, push to `origin`, and open a draft
pull request targeting `main`.

Resolved phase pins: every `implement` dispatch uses Claude Code `sonnet` at
`medium`; every task and integration `review` dispatch uses Codex CLI
`gpt-5.6-sol` at `high`.

Authority: this plan may commit only the owned paths above, run focused instruments
and repository gates, push `lean-package-cleanup`, and open or update its draft pull
request. It may not merge, force-push, stash, reset, clean, delete ignored state,
edit local Git configuration, refresh plugin caches, or mutate any external path.

## Tasks

### 1. The portable workflow owns one opt-in machine-local maintenance record

**Behaviour.** Both manifests identify version `0.12.0`. After release acceptance,
Control appends one labelled, tab-separated physical line to `~/.dely/log` only when
that path already exists. The line records UTC timestamp, Git-root basename, plan,
pull request or `none`, implementation rounds, ordered review dispositions, and one
short drift sentence. Missing log state is silent; append failure warns without
blocking; Dely never reads the log as runtime state.

**Direction.** Replace the five-column project-owned log section in the delivery
skill with the approved machine-local contract. Use native Git and shell facts already
available to Control; add no binary, helper, schema, lock, rotation, or configuration
field. Rewrite `docs/decisions.md` to retain only the approved lean automation-first
decision already recorded above, byte-for-byte in substance, and remove the superseded
chronology beneath it. Create the first focused checks in `tests/contracts.sh`, with an
optional root argument so a temporary degraded copy can prove that auto-creation,
blocking-on-append, and manifest-version mismatch are rejected.

**Files.** `skills/delivery/SKILL.md`, `docs/decisions.md`,
`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, and
`tests/contracts.sh`.

**Focused verification.** Run `bash -n tests/contracts.sh`, then
`bash tests/contracts.sh`. Copy the owned contract files to a temporary root and
degrade the log section once to require file creation and once to make append failure
fatal; both copies must return non-zero. Change only one copied manifest back to
`0.11.0`; that copy must also return non-zero. The shipped tree must return zero.

**Document impact.** `docs/decisions.md` is the durable owner of the changed product
and logging decisions. README owns opt-in instructions in Task 3, so this task does
not edit or duplicate onboarding prose there.

### 2. One small structural test replaces the prose interpretation suite

**Behaviour.** `tests/contracts.sh` is the only tracked test program, is at most 250
lines, and checks only discriminating structural invariants: matching `0.12.0`
manifest versions, the machine-local log contract, setup's exact two-row managed
block, and the plan template's four required acceptance columns. It accepts an
optional repository root for fixture copies and has no general prose parser or matrix
of historical wording mutations.

**Direction.** Extend the Task 1 script rather than adding another test. Reuse `jq`,
POSIX shell, `awk`, and `grep`; add no dependency or reusable framework. Demonstrate
one present-but-wrong fixture for each parsed shape: an extra setup phase and an
acceptance header missing `Counterexample`. Delete all three previous test programs
after the replacement rejects those fixtures and passes the shipped tree.

**Files.** `tests/contracts.sh`, `tests/delivery-contract.sh`,
`tests/managed-block-contract.sh`, and `tests/plan-template-shape.sh`.

**Focused verification.** Run `bash -n tests/contracts.sh`,
`test "$(wc -l < tests/contracts.sh)" -le 250`, and
`bash tests/contracts.sh`. Run the same script against the two degraded temporary
roots; each must return non-zero with a diagnostic naming the malformed subject.

**Document impact.** No document changes. Task 3 rewires the repository closure gates
only after this replacement exists and passes.

### 3. Installed copies contain only current product and maintainer surfaces

**Behaviour.** README describes only current requirements, installation, optional
setup, ordinary use, and opt-in logging. AGENTS names only surviving sources and gates.
Completed research, the tracked project log, transient completed design, standalone
push guard, worktree ignore rule, and their current-tree references are gone. The final
tracked inventory is exactly the twelve approved files.

**Direction.** Delete the approved historical and ancillary paths rather than moving,
archiving, or replacing them. Shorten README from current product facts: Orca is a
requirement; the three verified harness install commands remain; setup is optional;
the user opts into logging by creating `~/.dely/log` with owner-only permissions.
Remove internal migration narratives, research links, repository layout, standalone
hook wiring, and the headless smoke. Reconcile AGENTS source-of-truth bullets and gates
to the remaining files and `tests/contracts.sh`. Do not alter phase pins, disclosure
checks, external Git config, the ignored directory itself, or plugin caches.

**Files.** `README.md`, `AGENTS.md`, `.gitignore`, `git-hooks/pre-push`,
`docs/_plans/2026-08-24-automation-first-dely-design.md`,
`docs/delivery-log.md`, `docs/findings.md`, `docs/harness-surface.md`, and
`docs/options.md`.

**Focused verification.** Compare `git ls-files` excluding this transient plan with
the approved twelve-file inventory. Run a tracked-tree grep for the retired component
paths and old project-owned five-column log language; it must return no match outside
this plan. Confirm `git config --local --get core.hooksPath` still returns the protected
external path and `test -d .worktrees` still passes.

**Document impact.** README becomes the sole user-facing installation and opt-in guide.
AGENTS remains this repository's maintainer instruction owner. The compact
`docs/decisions.md` from Task 1 remains the sole durable rationale.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Logging is opt-in, machine-local, accepted-only, labelled, and non-blocking | `bash tests/contracts.sh` plus root-scoped degraded copies | A complete-looking log section names `~/.dely/log` but tells Control to create it, records incomplete deliveries, or makes append failure fail release | |
| Both versioned manifests publish `0.12.0` together | `bash tests/contracts.sh` and `jq -e` | One manifest is `0.12.0` while the other remains `0.11.0` | |
| Setup and plan structural contracts survive consolidation | `bash tests/contracts.sh` against shipped and degraded roots | Setup carries an extra `release` row, or the plan acceptance header omits `Counterexample` while retaining the other columns | |
| The replacement test is actually smaller rather than concatenated | `test "$(find tests -maxdepth 1 -type f | wc -l | tr -d ' ')" = 1` and `test "$(wc -l < tests/contracts.sh)" -le 250` | The old three scripts are retained, or their bodies are concatenated into one large script | |
| Installed source contains only the approved current surface | Exact `git ls-files` inventory after transient-plan deletion | README is shortened but any completed research, tracked project log, standalone hook, old test, or completed transient design still ships | |
| Current guidance contains no retired component or project-owned five-column log contract | Focused `git grep` over the final tracked tree | A file is deleted but README, AGENTS, skill, test, or decision still advertises its path or ownership rule | |
| External and ignored local state remain untouched | Compare `core.hooksPath`, `test -d .worktrees`, and the dirty baseline | The bundled hook is removed by also unsetting local Git config or deleting the ignored directory | |

**Cannot be observed:** static checks cannot prove that every harness follows the
English logging instruction, that simultaneous short appends never interleave, that a
user has not wired the removed standalone hook elsewhere, or that installed caches
change before a post-merge refresh. Those limits are reviewed manually and do not
authorize a runtime helper or external mutation.

## Stop conditions

- Any required change reaches a path outside Allowed scope or needs an external cache,
  hook, Git-config, Orca-runtime, branch-protection, or publication mutation.
- A protected baseline path changes, `.worktrees/` is removed or populated, or
  `core.hooksPath` differs from its recorded value.
- A correct structural test cannot fit under 250 lines without dropping an approved
  invariant; return `NEEDS_REPLAN` instead of hiding complexity or adding a second test.
- The logging contract requires a helper, parser, schema, lock, rotation policy, project
  registry, or automatic file creation.
- Manifest validation shows the approved two-manifest version change is insufficient for
  any supported harness.
- Orca or a required worker, evidence, result-write, task-completion, or native Internet
  capability becomes unavailable. There is no headless fallback.

## Closure gates

Run from `/Users/hieuphung/Projects/dely` after deleting this transient plan:

```bash
git diff --check
```

```bash
bash -n tests/contracts.sh
```

```bash
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json >/dev/null
```

```bash
bash tests/contracts.sh
```

```bash
test "$(wc -l < tests/contracts.sh)" -le 250
```

```bash
test "$(git ls-files)" = ".claude-plugin/marketplace.json
.claude-plugin/plugin.json
.codex-plugin/plugin.json
AGENTS.md
CLAUDE.md
README.md
docs/decisions.md
skills/delivery/SKILL.md
skills/delivery/templates/decision-record.md
skills/delivery/templates/plan.md
skills/setup/SKILL.md
tests/contracts.sh"
```

```bash
git grep -Ei 'delivery-doctor|delivery-evidence|post-tool-journal|session-start-context|grok-hooks|docs/delivery-log\.md|git-hooks/pre-push|evidence journal|skill-owned journal|five columns|project owns the file' -- . && exit 1 || true
```

```bash
git grep -Ei 'pace.?id' -- . && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . && exit 1 || true
```

```bash
claude plugin validate .
```

```bash
grok plugin validate .
```

```bash
test "$(git config --local --get core.hooksPath)" = "/Users/hieuphung/Projects/project-delivery-procedure/git-hooks"
test -d .worktrees
```
