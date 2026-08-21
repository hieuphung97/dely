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

| Requirement | Instrument | Discriminates? |
| --- | --- | --- |
| | | |

Every row states whether its instrument can tell a pass from a failure, and how you
settled that. A row that cannot discriminate is not acceptance; either replace the
instrument or record that no instrument exists and that a human reads the diff.

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
