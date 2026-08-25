# Plan — reconcile the remaining active documentation with automation-first Dely

Decision record: `docs/decisions.md`, "2026-08-25 — Dely is an automation-first thin control protocol"

**Baseline:** Control resolves the commit carrying this decision clarification and
plan with `git rev-parse HEAD` immediately before dispatch and supplies that exact
SHA to every worker; a commit cannot record its own SHA.

## Goal

The two remaining final-integration findings no longer present retired journal
guidance or a superseded read-only review deployment as current. The correction
records why both statements were wrong while adding no runtime mechanism, prose
parser, sandbox policy, compatibility rail, or broader historical cleanup.

## Allowed scope

```
git-hooks/pre-push
docs/harness-surface.md
docs/findings.md
docs/_plans/2026-08-25-final-integration-document-reconciliation-plan.md
```

The owning durable decision is amended in the baseline commit. No colocated source
test applies because neither correction changes executable behaviour; the existing
repository closure gates still apply. No registry or inventory test enumerates
these documentation statements. `docs/delivery-log.md` and deletion of this plan
are carried by release closure, not implementation.

## Forbidden scope

- `AGENTS.md`, `README.md`, `skills/`, and `tests/`: their current contract already
  states the intended policy; changing them would widen a documentation correction.
- The six retired journal, doctor, hook-adapter, and evidence-pipeline paths:
  restoring any of them contradicts the approved breaking migration.
- Historical research and superseded design artifacts: their retention or deletion
  needs a separate repository-hygiene decision rather than an incidental purge.
- Plugin versions, manifests, CI, branch protection, and sandbox configuration:
  neither finding changes runtime or release policy.

## Tasks

### 1. Supported pre-push guidance names only mechanisms that ship

**Behaviour.** `git-hooks/pre-push` still explains its accident-and-drift limit,
but no longer tells a reader to pair the hook with the removed PostToolUse journal.

**Direction.** Delete only the stale journal recommendation. Preserve the hook's
executable behaviour and its existing limitation text.

**Files.** `git-hooks/pre-push`, plus the observation and correction in
`docs/findings.md`.

**Focused verification.** From the repository root, run
`if rg -n 'PostToolUse journal|post-tool-journal\.sh' git-hooks/pre-push; then exit 1; fi`.
It fails while the active recommendation or a direct script reference remains.

**Document impact.** `docs/findings.md` records why a supported installation
surface contradicted the no-journal product contract and why deletion, not a
compatibility stub, is the correction.

### 2. The capability record separates historical deployment from current policy

**Behaviour.** `docs/harness-surface.md` retains the dated Codex
`--sandbox read-only` observation as history and explicitly identifies the current
project policy as no phase-implied review sandbox.

**Direction.** Remove the blanket claim that the old sandbox observation remains
current. Recast the prior Codex deployment sentence as dated and superseded by the
active `AGENTS.md` policy; retain the still-valid per-harness capability facts.

**Files.** `docs/harness-surface.md`, plus the observation and correction in
`docs/findings.md`.

**Focused verification.** From the repository root, run
`rg -n 'Historical deployment observation' docs/harness-surface.md`,
`rg -n 'no phase-implied sandbox' docs/harness-surface.md`, and
`if rg -n "This repository's current review dispatch stays" docs/harness-surface.md; then exit 1; fi`.
The first two commands fail if either half of the historical/current boundary is
absent; the last fails if the obsolete deployment is still asserted as current.

**Document impact.** `docs/findings.md` records the distinction between a harness
capability observation and a repository deployment decision.

### 3. The reconciliation stays documentary and owner-scoped

**Behaviour.** The implementation changes only the three allowed owner paths,
adds no mechanism or permanent prose test, and records both findings without
claiming that arbitrary future wording is mechanically understood.

**Direction.** Keep the two corrections in one same-shaped batch. Use exact
absence/presence checks and human diff review rather than adding a parser or a
test coupled to explanatory prose.

**Files.** The three owner paths plus this transient plan, whose `Observed red`
cells the implementer fills. The baseline decision is outside the implementation
diff; release owns its log row and plan deletion.

**Focused verification.** Compare the candidate to this plan's baseline with
`git diff --name-only <baseline>..HEAD`; before release closure it must list only
this plan, `docs/findings.md`, `docs/harness-surface.md`, and
`git-hooks/pre-push`.

**Document impact.** No further owning document is changed. `README.md` already
states that no journal or hook adapter ships, and `AGENTS.md` already states the
current unsandboxed review policy.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Active pre-push guidance contains no retired evidence rail | The scoped `rg` absence command in task 1 | The current supported hook keeps its working executable logic but tells readers to pair it with the removed PostToolUse journal | Reproduced pre-edit: `if rg -n -e 'PostToolUse journal' -e 'post-tool-journal\.sh' git-hooks/pre-push; then exit 1; fi` matched `git-hooks/pre-push:15:# determined agent. Pair it with the PostToolUse journal, which records the` and exited 1 (red), confirming the stale recommendation |
| Capability history does not masquerade as current deployment policy | Both scoped commands in task 2 | A document marks journal references historical yet leaves the sandbox carve-out current and says this repository still dispatches Codex review read-only | Reproduced pre-edit: `rg -n 'Historical deployment observation' docs/harness-surface.md` matched nothing (exit 1, required phrase absent); `rg -n 'no phase-implied sandbox' docs/harness-surface.md` matched nothing (exit 1, required phrase absent); `if rg -n "This repository's current review dispatch stays" docs/harness-surface.md; then exit 1; fi` matched `docs/harness-surface.md:576:install's web tool is enabled. This repository's current review dispatch stays` and exited 1 (red), confirming the obsolete sentence was present while both required positive phrases were absent |
| The implementation is the smallest owner-scoped reconciliation | Exact baseline-to-candidate changed-path list plus human diff review | A superficially complete fix also edits tests, README, AGENTS, manifests, runtime policy, or historical research | Implementer records the changed-path output; reviewer reads the complete diff |

**Cannot be observed:** these literal instruments do not interpret arbitrary future
paraphrases and do not prove model behaviour. They prove only the named current
contradictions are absent and the approved replacement boundary is present; the
independent reviewer must read the complete diff.

## Stop conditions

Return `NEEDS_REPLAN` if either correction requires changing runtime behaviour,
test semantics, sandbox configuration, plugin versions, or another current owner.
Return `BLOCKED` if the baseline no longer contains either reproduced finding, the
working tree contains unowned changes, or Orca cannot provide the required worker
and review surfaces. Do not restore a retired rail or broaden cleanup to work
around either condition.

## Closure gates

Run from `/Users/hieuphung/Projects/dely`:

```
git diff --check
bash -n git-hooks/pre-push tests/delivery-contract.sh tests/managed-block-contract.sh tests/plan-template-shape.sh
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json >/dev/null
bash tests/delivery-contract.sh
bash tests/managed-block-contract.sh
bash tests/plan-template-shape.sh
test ! -e bin/delivery-doctor
test ! -e bin/delivery-evidence
test ! -e hooks/hooks.json
test ! -e hooks/grok-hooks.json.template
test ! -e hooks/post-tool-journal.sh
test ! -e hooks/session-start-context.sh
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

Report each focused instrument and closure gate with its exact command, verbatim
summary/output, and exit status. Run every gate in the foreground.
