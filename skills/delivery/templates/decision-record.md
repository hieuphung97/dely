# Decision record template

Durable. It records what was decided and why, and changes only when the decision
changes. It is not a task tracker and not a test log.

If the project has a frontmatter convention for decision documents, follow it —
`AGENTS.md` names it. Where a field asks for a commit SHA, resolve it with `git`;
never write the SHA of the commit that will carry the field, because a commit
cannot record its own SHA before it exists.

---

# <Decision, stated as an outcome rather than a task>

## Context

The problem, and the current behaviour it applies to, with evidence. Numbers and
observations rather than impressions. If a rule or a limit is being changed, name
what it was and why it is no longer right.

## Decision

What is now true. Written so a reader can tell whether an implementation complies.

Where the decision replaces an earlier one, say which and how — amend the earlier
record in place rather than deleting its reasoning.

## Alternatives considered

Each one that was genuinely considered, and the reason it lost. An alternative
listed without a reason is decoration.

## Consequences

What follows, including what gets worse or stays unsolved. State what this decision
is **not** expected to improve, so a later reader does not judge it against a
promise it never made.

## Non-goals

Things a reader might reasonably assume are included and are not.

## Deferred

Work this decision deliberately leaves out, with what would trigger it. Anything
deferred without a trigger is abandoned; say so instead.
