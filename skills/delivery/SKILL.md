---
name: delivery
description: Deliver a change through design, implementation, independent review and closure. Use when a change needs a decision record, when a plan spans more than one behaviour, or when review must not be done by whoever implemented it. Not for a one-line fix with an obvious test.
---

# Delivery

Every rule here exists because a delivery lost a round without it, across 41
recorded plans. Nothing is here for symmetry. If a rule stops earning its place,
delete it.

Read `AGENTS.md` in the repository for this project's gate commands, artifact
paths, and default branch. This skill never names them.

## Classify first

**Routine** — expected behaviour is already unambiguous in current documentation,
tests, or a reproducible defect; no new decision; no schema, API, permission or
dependency change; one owner; a focused test can prove it; one session finishes it.
Fix it. No decision record, no plan.

**Planned** — anything that adds or changes behaviour, presents real alternatives,
spans owners, risks removing behaviour, or lacks a clear acceptance strategy.

**Critical** — irreversible data work, migrations, auth, permissions, secrets,
security boundaries, concurrency, production availability. Critical does not
authorise a bigger plan. Decompose it into Planned units and apply stronger review
only at the actual risk boundary.

## Phases

`design` → `implement` → `review` → `release`. Each runs in its own session. The
session that designed a change keeps the decisions and receives handoffs; it does
not implement, and it does not replace review.

Routing is short enough to state plainly. Implementation returning `DONE` goes to
review. Implementation returning `BLOCKED` or `NEEDS_REPLAN` goes back to design.
Review returning `ACCEPT` goes to release. `REMEDIATE_ONCE` goes to a fresh
implementation session, then back to the same reviewer. `REPLAN_OR_SPLIT` goes to
design. Release goes back to design for the next unit.

A worker selects the phase it was sent to and does only that phase.

## The control session drives

One interactive session holds the approved contract and runs the rest. The human
talks to it, steers it, and is interrupted only when it cannot decide.

It does not implement, and it does not review. It launches workers, reads their
results, and routes.

### Launching a worker

Write the prompt to a file. Never inline it in a shell argument: prompts carry
backticks, quotes and newlines, and a shell argument mangles them. Keep that
file for transport safety wherever the launch path accepts file input.

If `AGENTS.md` selects a coordinator, load that coordinator's native skill and
use it to launch a real interactive harness TUI for the phase. Pin the selected
model and effort. The coordinator carries the prompt, questions and completion.
A visible shell running a headless harness is not a TUI.

A direct headless harness call is a fallback only when no coordinator is
selected, or when the selected coordinator is unavailable and the human accepts
the loss of its capabilities. Do not invent a wrapper, adapter, polling loop or
compatibility matrix around that fallback.

Any harness can be the control session and any can be a worker. The role is a
choice per phase, not a property of a tool.

```bash
# Fallback only — not the primary path when a coordinator is selected
claude -p --permission-mode bypassPermissions --model <id> --effort <level> < prompt.md > result.md
codex exec -m <id> -c model_reasoning_effort="<level>" -o result.md < prompt.md
grok --prompt-file prompt.md -m <id> --reasoning-effort <level> --always-approve --output-format json > result.json
```

Check flags against `--help` before relying on them. These CLIs drift between
releases, and an unknown flag fails the whole invocation rather than being ignored.

**Name the model and the effort on every dispatch.** A worker left on a harness
default is an unpinned environment, and that is the second-largest recorded cause of
lost rounds. The default is also invisible: it lives in the harness's own config, it
changes without announcing itself, and the dispatch that relies on it looks
identical to one that pinned the same value deliberately. Which model to use is the
human's choice and belongs in `AGENTS.md` per phase; naming it on the command line
is not that choice, it is the record of it.

**Give the call a timeout with headroom, and make truncation visible.** Measure
before trusting a default — one real implement dispatch took 9m49s against a
ten-minute tool default. It finished, and a slightly larger task would not have. A
worker killed at a timeout can leave a handoff already on disk that looks complete,
so the handoff ends with its terminal line and a missing terminal line is a failed
worker rather than a stop status.

**The prompt and the result both live outside the repository.** Ownership gates and
diffs count untracked files as part of the candidate, so a result file written into
the working tree becomes an unowned change that a reviewer sees and a gate may
refuse. Use the session's scratch directory.

**Review is independent by role, not by a phase-implied sandbox.** The reviewer
starts fresh, reviews and reports, and does not implement or edit the candidate.
Ordinary project permissions keep gates, native Internet access, result writes and
coordinator completion available. `AGENTS.md` may pin a sandbox for a concrete
risk; assigning a harness to review is not such a risk by itself. If a reviewer
edits the candidate, that review is invalid and Control escalates.

Internet research uses the harness's native web or search tool and cites the
source. Shell network follows ordinary project permissions; do not disable it
merely because the phase is review.

Keep waiting blocking. A coordinator-selected worker is observed through that
coordinator until it completes or the timeout fires. A headless fallback is a
blocking process plus a timeout with headroom: the process exits on its own, so
polling would be a state machine. Do not add a relay to manufacture completion.

**`input_accepted` is not submission.** After a coordinator-selected dispatch,
`input_accepted` is a transport receipt, not proof that the harness submitted
the prompt. Allow 90 seconds for a dispatch heartbeat or visible agent
progress. If neither appears, read the worker TUI. Only when that read shows
the task still pending in the input box does Control send Enter, exactly once,
then return to the normal blocking wait.

Do not send Enter when the worker is already reasoning, using a tool, asking a
question or reporting completion. Do not infer submission from a rendered copy
of the prompt alone. A second missing signal is a liveness problem to inspect,
not permission to keep pressing Enter. This bounded recovery adds no wrapper,
polling loop, relay, background process or harness-specific adapter.

**Capture the worker's session id from its output and put it in the handoff.** It is
how the human opens that session to inspect or steer it, and a harness need not list
a dispatched session in its own picker: Codex filters its picker to interactive
sessions, so a session started by `codex exec` is reachable only by id. It is
persisted and resumable either way.

**Watch through the coordinator when one is selected.** Its task, dispatch and
terminal are the live view. For a headless fallback, the redirected log file is
the live view — model and sandbox in the header, then each command with its
output and duration. Tell the human that path when a fallback dispatch starts.

### Model and effort per phase

Phases differ in what they buy. Control and review buy judgement. Implement buys
throughput against a task that is already specified. Release is mechanical.

| Phase | Capability | Effort |
| --- | --- | --- |
| control | strongest available | high |
| implement | best coding model | medium |
| review | strongest available | medium to high |
| release | modest | low |

Concrete model names belong in `AGENTS.md`. They are environment facts, they differ
per harness, and they change. This table is the reason behind a choice and not the
choice itself — which is why it can live here while the names cannot.

### Escalate rather than guess

Stop and ask the human when:

- a result maps to no route, or to more than one
- the worker **failed** rather than returned a stop status — a non-zero exit with no
  result file, an exhausted quota, an authentication error. A failed worker is not
  a `BLOCKED` worker, and treating one as the other loses the work
- the selected coordinator is unavailable, before any headless fallback
- an action needs authorization that policy reserves to the human
- the same worker fails twice on the same input

Say what you know, what you tried, and what the options are. Do not pick one.

## design

Inspect the code before asking anything. Ask one question at a time, with options,
your reasoning, and a recommendation.

Produce two artifacts and nothing else:

A **decision record** — dated, durable. Problem, current behaviour with evidence,
the accepted contract, alternatives and why they lost, non-goals, acceptance
strategy, rollout and rollback. It never tracks task status and never accumulates
test history. See `templates/decision-record.md`.

A **plan** — transient, deleted at closure. Three to five tightly related tasks,
one coherent contract, one acceptance table. See `templates/plan.md`.

Commit both before implementation begins. That commit is the review baseline.

### Plan sizing

One plan is what one implementation session can finish, verify, and hand back as
one complete diff. File count is not the limit.

Split before starting when the plan holds independent owners, needs an intermediate
checkpoint, or cannot be reviewed as one behaviourally coherent unit.

This is the single strongest lever in the record. One plan holding a shared
primitive and its eighty call sites failed three times, each round discarding the
last. Split in two, both halves were accepted, one on the first round.

### Allowed scope

List what may change. Scope always carries, without being named:

- the colocated test of any allowed source file
- any registry or inventory test that enumerates what the plan adds
- any document that owns an allowed path

A file the plan's own tasks require is inside scope, not a stop. Three plans lost a
round to that omission before this was written down.

### Acceptance

One table: each requirement, the instrument that proves it, the plausible wrong
implementation that instrument rejects, and where that rejection was observed.

**An acceptance row is invalid until you have settled that its instrument
discriminates.** A row whose instrument passes both before and after the change
proves nothing and will be found at review. This is the largest single cause of
lost rounds in the record — nine plans. Baseline-red is insufficient: the ninth
was an instrument observed red at baseline for the right reason, and still
unable to tell a doctor that reads the whole file from one bounded by the
markers.

Each row names a plausible wrong implementation its instrument rejects — one
that exists, runs, and returns a pass. "The feature is absent" does not satisfy
Counterexample. Where no counterexample exists, the row says so and says a
human reads the diff.

Record what the available instruments cannot observe. A green suite that never
exercises a surface is not evidence about that surface.

Prefer the simplest instrument that proves the contract. Browser automation,
performance thresholds and retained evidence packages need a stated risk; they are
not default ceremony.

## implement

Read the decision record, the plan, and the baseline. Do not read the design
session's transcript.

For each behaviour: find its owning test, observe a real failure for the intended
reason, make the smallest change, run focused verification. Keep unrelated findings
out.

The counterexample named in each acceptance row is observed red and cited — the
journal record, or the pasted summary line where the harness journals nothing.
That observation is not the behaviour's own failure: one is the feature absent,
the other is an implementation that is present, runs, returns a pass, and is
wrong.

For replacement work, enumerate every accepted behaviour that could be lost and map
each to an owning test. That mapping belongs in the plan's one acceptance table,
not in a second document.

Implement the whole plan before handing back. Stop and return `BLOCKED` or
`NEEDS_REPLAN` instead of producing a partial solution when the record contradicts
the code, the contract is ambiguous, work outside the plan becomes necessary, an
existing test disproves an assumption, or the plan no longer fits one session.

A plan needing continuation is a decomposition failure, not normal delivery.

### Handoff

```text
Status: DONE | BLOCKED | NEEDS_REPLAN
Harness:            name, model, effort, sandbox
Session:            the worker's own session id
Baseline:
Changed paths:
Contract coverage:
Verification:
Deviations from plan:
Unresolved findings:
Git state:
END OF HANDOFF
```

`END OF HANDOFF` is the last line and it is load-bearing. It is the only thing that
distinguishes a handoff from a handoff that was cut off mid-write.

Under `Verification`, cite the recorded evidence for each gate — the command and
where its output is recorded. Do not transcribe output. If the harness records
nothing, say so and paste the summary line.

**Gate evidence is journaled wherever the hooks are wired, and the wiring differs
per harness.** Claude Code and Codex load them from this plugin. Grok discovers the
plugin, reports that it has hooks, and dispatches none of them — verified in its own
debug log, where the only hook sources it executed were `~/.grok/hooks/*.json` and
`~/.claude/settings.json` while every plugin-bundled hook was discovered and skipped.
So Grok needs the same three events registered under `~/.grok/hooks/`, with absolute
paths, and then it journals like the others.

Run `delivery-doctor` before trusting any of this. A harness that reports a plugin as
loaded is not a harness that runs it, and that gap has now cost this project a false
conclusion twice.

Where a harness genuinely cannot journal, say the evidence is the worker's own
account and treat it as the thing under check rather than as the check. A fabricated
summary line has already been observed in exactly that position.

Be exact about what the journal proves. It holds the command and the output
verbatim, and whether the call succeeded. A passing command's exit code is implied
by that and is not stored in a field, so cite the journal for output and the
command's own echoed status for an exit code. Claiming a tool-captured exit code for
a gate that passed overstates the evidence, and a review has already caught that.

**Never background a gate.** A backgrounded call returns as soon as it is handed off,
so the journal records it as finished in a few hundred milliseconds with no output at
all. That is indistinguishable from a gate that passed silently, which makes it worse
than no record. Observed: `sleep 900 && echo …` journaled at 414ms with empty stdout
and a `backgroundTaskId`. Gates run in the foreground and the wait is the point.

## review

Start fresh. Review and report; do not implement or edit the candidate. You get
the decision record, the plan, the baseline, the diff, and the evidence. You do
not get the implementer's reasoning. The phase adds no sandbox by default.

**Reproduce, do not accept.** Run the gates yourself. A claim you did not
reproduce is not evidence. Re-review has caught defects by making a test red itself
after accepting the implementer's word would have passed them.

Requirements and behaviour before style.

Classify findings: **Blocking** — contract failure, regression, data or security
risk. **Important** — missing required behaviour, test, or reconciliation.
**Minor** — useful, does not block. **Out of scope** — recorded, not absorbed.

Return exactly one disposition: `ACCEPT`, `REMEDIATE_ONCE`, or `REPLAN_OR_SPLIT`.
Do not use implementation stop statuses. A contradiction you cannot resolve is
`REPLAN_OR_SPLIT`.

Do not open remediation over wording when deterministic checks already prove the
contract.

### Remediation

One pass. The implementer fixes only the accepted findings, reruns the affected
checks and all closure gates, and returns to the same reviewer.

A second new architecture or contract finding means the unit is wrong. It does not
authorise a third attempt.

## release

Commit the implementation. Reconcile the documents that own changed paths. Delete
the plan, having moved anything durable into the decision record or those
documents. Run the closure gates. Append one row to the project's delivery log.

Then prepare the pull request. Merging is the product owner's act.

### Delivery log

The project owns the file; `AGENTS.md` names its path. This skill owns the shape.

One row per accepted plan, five columns: the plan, its pull request, how many
implementation rounds it took to reach `DONE`, the review dispositions in order,
and one clause naming the drift cause.

Record only what closure already knows. Do not add a column that restates a human
choice or a value Git already holds.

The drift cause column is the reason the log exists. Write it long enough that a
later plan can prove a recurrence. Anything discovered during the plan that the
plan file was the only home for goes here, because the plan is deleted.

### Changing this skill

**Only when the same failure recurs.** One incident is not policy. Two of seven
recorded corrections were made under this rule, each after a third occurrence, and
that is why this file is short.

Before adding a rule, check whether a mechanism can enforce the fact instead. A
rule asking a worker to be careful with a value is weaker than a program that
supplies the value.

## What the harness supplies

Where hooks are installed, repository identifiers arrive resolved at session start
and gate results are recorded as they run. Then:

- Cite identifiers from the injected context. Never restate a SHA, branch or
  baseline from memory.
- A value marked stale is stale. Fetch before using it as a baseline.
- Cite recorded evidence rather than retyping output.

Where they are not installed, resolve identifiers with a command in the same turn
you use them, and paste summary lines verbatim.

## Language

Repository artifacts are English. Conversation follows the user. Enum values,
paths, commands, branch names and SHAs are never translated.
