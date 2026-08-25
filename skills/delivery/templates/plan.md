# Plan template

Transient. Deleted at closure, after anything durable has moved into the decision
record or the documents that own the changed paths.

Three to five tightly related tasks. One coherent contract. One acceptance table.
No status duplicated anywhere else.

---

# Plan — <the contract this delivers>

Decision record: `<path>`

**Baseline:** the SHA of the commit carrying the decision record and this plan.
Leave empty until that commit exists rather than guessing it.

## Goal

One paragraph. What is true when this is done, and what is out of reach.

## Allowed scope

```
<paths that may change>
```

Carried without being listed: the colocated test of any allowed source file, any
registry test enumerating what this plan adds, and any document owning an allowed
path. State here which of those apply and which yielded nothing — checked, not
assumed.

## Forbidden scope

Paths a reader might expect to be included, with why they are not. Name anything
whose filename suggests relevance but whose contents do not.

## Execution envelope

Protected dirty paths: pre-existing uncommitted changes this plan must not stage,
overwrite, stash, or reset — name them, or say the tree was clean at baseline.

Branch, base, remote, and pull-request target: the feature branch this plan
commits to, the branch and remote it targets, and where its pull request goes.

Resolved phase pins: the harness, model, and effort each dispatched role runs
under, taken from `AGENTS.md` — not a default left implicit.

Authority: this plan may branch, commit only its own owned paths, run gates,
push the named branch, and open or update the named pull request. It may not
merge, force-push, stash, reset, clean, or edit anything outside owned scope.

## Tasks

### 1. <behaviour, not activity>

**Behaviour.** What becomes true. Observable, not internal.

**Direction.** Enough for an implementer to start without re-deciding the contract.
Not a pasted implementation.

**Files.** Expected owners. If a task needs a file outside allowed scope, the plan
is wrong — fix it now, not at review.

**Focused verification.** The command or check that proves this task, and how it
fails if the task is not done.

**Document impact.** Which owning documents this task obliges you to reconcile, and
why each one — ownership, not habit.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| | | | |

Design fills Counterexample; implement fills Observed red. An empty cell is an
unfinished row. "The feature is absent" does not satisfy Counterexample. A row
with no counterexample must say so and say a human reads the diff — that escape
stays legal and is worth keeping only when someone actually reads it.

Every row's instrument must tell a pass from a failure. A row that cannot
discriminate is not acceptance; either replace the instrument or record that no
instrument exists and that a human reads the diff.

**Cannot be observed:** what the available instruments do not cover. A green suite
that never exercises a surface is not evidence about that surface.

## Stop conditions

What makes this `BLOCKED` or `NEEDS_REPLAN` rather than something to work around.
Include any assumption that holds for one tool, harness or environment and has not
been verified for the others this plan touches.

## Closure gates

```
<exact commands, with the directory each runs from>
```

If a gate is skipped, record the boundary and why the change cannot be observed by
it. Report every gate with the exact command, the summary line verbatim, and the
exit code. `$?` after a pipe reports the last command in the pipe, not the gate.
