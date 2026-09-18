---
name: delivery
description: Deliver a change through an approved design contract, sequential implementation, independent review and exact-HEAD release. Use for any Bounded or Architectural change — including a small, one-line behavioral fix, which is the canonical Bounded case — so it gets design approval and independent review. Not for a Spike, which investigates and recommends without starting a delivery run.
---

# Delivery

Dely accepts a request that may still be vague, brings it to an approved
design contract, then automates sequential implementation, independent
review, and pull-request preparation. It is a thin control protocol, not an
orchestrator, SDLC framework, or second source of Git state.

Read `AGENTS.md` in the repository for this project's gate commands, artifact
paths, default branch, and per-phase harness/model/effort pins. This skill
never names them.

## Two human gates

1. Approve the design contract before candidate mutation.
2. Merge or publish after Dely has prepared the reviewed pull request.

Dely pauses outside those gates only for a scope or architecture change, a
destructive action, new authority, replan, or an unavailable required runtime.

## The control session

The current interactive session is Control. It owns the approval invariant,
task boundaries, exception handling, dispatch supervision, and release. It
does not implement or review the candidate, and does not prescribe question
count, order, format, or skill-selection precedence. Native Plan Mode and
active design skills govern their own surfaces under the harness's
precedence; neither bypasses approval. Before mutation, Control obtains
explicit human approval of a design contract. One approval covers that
scope; a material change needs a new one. Control surfaces uncertainty that
could materially change intent, acceptance, authority, public contract,
architecture, or consequential risk. Material assumptions must be explicit.

## Shape

Use the smallest contract that safely holds the change. Risk may promote an
otherwise small change; diff size never demotes data-loss, security,
permission, or public-compatibility risk.

| Shape | Use | Artifact | Review |
| --- | --- | --- | --- |
| Spike | Investigation only; no candidate is delivered | Approved probe and recommendation; no delivery run | none |
| Bounded | Small change, clear behaviour and ownership | Approved in-chat design and short execution envelope | one whole-change review |
| Architectural | Multiple behaviours, public-contract change, architecture decision, or promoted risk | Approved decision record, task plan, execution envelope | task review per task, then one integration review |

An approved design contract states intent and success criteria; scope and
authority; affected public contract or architecture; consequential risks and
material assumptions; and a plausible counterexample that distinguishes
correct behaviour from a present-but-wrong implementation. If no executable
instrument can discriminate, the contract names the manual inspection and
its limit.

Architectural work uses `templates/decision-record.md` (durable) and
`templates/plan.md` (transient, deleted in the release commit, before the
release-binding review). Commit both before implementation begins — that
commit is the review baseline.

### Acceptance

One table: each requirement, the instrument that proves it, the plausible
wrong implementation that instrument rejects, and where that rejection was
observed.

**An acceptance row is invalid until its instrument discriminates.** A row
that passes both before and after the change proves nothing and will be
found at review. Baseline-red is not enough: red only because the feature
is absent says nothing about catching an implementation that is present,
runs, returns a pass, and is wrong. Each row names such a wrong
implementation. "The feature is absent" does not satisfy Counterexample.
Where none exists, the row says so and a human reads the diff.

Record what the instruments cannot observe. Prefer the simplest instrument
that proves the contract. Any claim about extent — a scope, a count, a set
of call sites — names the command that produced it, reports its output, and
enumerates rather than samples. Naming the command is not the measurement;
the command must have been run.

## Execution envelope

Before mutation, Control resolves deployment preferences against the live
harness surface, starts Orca and verifies its required capabilities,
records the dirty baseline and exact-path ownership, and creates a feature
branch when starting on the default branch. The envelope freezes owned
scope and paths; protected pre-existing dirty paths; acceptance criteria,
counterexample, and focused instruments; branch, base, remote, and
pull-request target; resolved harness, model, and effort for dispatched
roles; and authority to branch, commit owned paths, run gates, push, and
open or update a pull request. It never authorises merge, force-push,
stash, reset, cleanup, or an edit outside owned scope. Dely stages and
commits only contract-owned paths. It never stashes, resets, cleans, or
silently absorbs the user's existing changes. If a path carries protected
baseline changes and Dely must also modify it, Control pauses rather than
combining ownership.

## Orca and the helper

Orca is the required execution plane. It launches and supervises fresh
native harness TUIs with the resolved harness, model, and effort.
Orchestration is a required Orca capability. `dely:delivery` starts Orca,
then Control loads `orca skills get orchestration` and follows its
supervised loop. It stops only when the CLI is missing, the runtime cannot
start, or a required capability is absent — there is no direct dispatch and
no headless fallback of any kind. The launcher is `scripts/dely` relative
to this skill. Control learns the helper's interface by running
`scripts/dely` with no arguments, which prints its identity and usage,
and does not read `scripts/dely.js`. Control's wake mode is that harness's
`controlWake` in `../../harnesses.json`. The preflight step runs in setup
and again after a `NO_ACK`; a delivery does not preflight before its first
dispatch.

Write the prompt to an untracked file **inside the worktree**. Never inline
it in a shell argument: prompts carry backticks, quotes and newlines, and a
shell argument mangles them. A path outside the workspace can trigger a
second permission surface some harnesses still prompt for even when tool
approval is skipped. Do not stage that file. After the worker returns,
delete it: Control owns that dispatch artifact, not `git clean`. The handoff
is a file in the worktree; its path travels as `payload.reportPath` and the
message body stays short. `--spec` and `--body` are shell arguments, which
this skill already forbids for prompts.

The dispatch prompt carries the task, its scope, and the evidence required.
It does not define role dispositions or the conditions for reaching one —
those belong to this skill, and a prompt that restates them narrows or
contradicts them. Where the design contract states an acceptance row, the
prompt carries that row as written. Every dispatch goes through
`dely dispatch`. Control does not compose a worker launch or call
`worker-start` by hand. The helper reads the pins from `AGENTS.md` and
appends the acknowledgement instruction and a sentence that the Orca
preamble and the spec file are everything the worker needs and that it
should read no other skill. The `worker-start` receipt records
`launch.requested` and `launch.effective`; it does not establish that the
worker can serve the request or that it cannot. Orca applies the execution
plane's configured permission default and does not add a sandbox the project
did not pin.

**Name the model and effort on every dispatch.** The helper passes
`--model`/`--effort` when `../../harnesses.json` says that harness takes
them, and omits a flag whose value is `default`. On a harness that takes
neither, a Model written there is silently not applied: write `default` and
set the model in Orca's agent default arguments. A worker left on a harness
default is an unpinned environment: it lives in the harness's own config,
it changes without announcing itself, and the dispatch that relies on it
looks identical to one that pinned the same value deliberately.

**Never act on an Orca nudge.** After `DISPATCHED`, wait by the wake mode
of **this Control's own harness** — not the harness of the worker being
waited on. `--control` is this session's harness id, the same id whatever
worker is in flight. **background** runs
`dely wait --run <run> --control <self>` as a background command and ends
the turn; **waker** runs `dely wait-bg --run <run> --control <self>` as its
last command, then ends the turn (a waker Control never runs `dely wait`);
**unsupported** cannot be Control. The helper reads the harness of the Orca
terminal it runs in and refuses a waker even when `--control` names another
one, so `REFUSED … (called with --control …)` means use `wait-bg`.

**Result handling.** `SETTLED`: process the batch, do the guide's completion
accounting, and acknowledge. `ATTENTION` has two routes, and the difference
is whether the plane can still see the worker. With `nextAction.kind` other
than `none`, run the argv Orca printed and skip that id next time. With
`nextAction: none` and `attention.requiresAction`, the plane has lost sight
of the worker rather than asked for something: read it with `worker-read`
and `worker-show`, and if the process is gone, `worker-stop`, then
`worker-abandon` when the stop reports `stop_unknown`, then
`worker-release`, then one fresh `dely dispatch` with the same prompt file.
A second time on the same input goes to the human. An absent `nextAction` is
absent, not `none` with attention — that row is not `ATTENTION` and the wait
continues. `STALLED`: read the output, then wait again or recover.
`NO_ACK`: run setup's `dely preflight` in the same Run. If every pin passes,
one fresh `dely dispatch` with the same prompt file; never retry into the same
terminal, and never reuse a settled terminal; a second failure on the same
input goes to the human. Any `PREFLIGHT … FAIL`: do not dispatch to any
pin — a failed pin's cause is already known and another dispatch only
repeats it.
Stop and relay the printed reason: the harness, the path, and that the human
opens that harness there once to answer its own dialog; Dely never answers
it. The failed worker is already stopped and released. When the human says
it is done, rerun `dely preflight` in the same Run and continue from there.
`FAILED`: one fresh `dely dispatch` with the same prompt file and the same
retry limits. `DEADLINE`: a checkpoint — check `worker-list` and the last
output; if the worker is progressing, wait again; a second `DEADLINE` with
no progress goes to the human. `ERROR`: go to the human. The worker reports
once with `worker_done` and an `--outcome`; completion comes from that
`worker_done` — do not infer it from reading the worker's terminal. Each
delivery opens its own Run with an objective
(`orca orchestration run-create --objective`) rather than reusing another's,
so a stale report cannot settle a new wait.

Investigation is one read-only diagnostic dispatch inheriting the
`implement` pin; it may reproduce, inspect, and report, but does not edit,
commit, launch workers, or expand scope.

Stop and ask the human when: a result maps to no route or more than one; the
worker **failed** rather than returned a stop status — a non-zero exit with
no result, an exhausted quota, an authentication error — which is not
`BLOCKED` and must not be treated as one; Orca is unavailable or a required
capability is absent; an action needs authority policy reserves to the
human; or the same worker fails twice on the same input. Say what you know,
what you tried, and what the options are. Do not pick one.

## Implementation

Control creates a separate task only when that unit has its own test cycle
and a reviewer could accept it while rejecting its neighbor. Same-shaped
mechanical changes are batched. Tightly coupled work stays one task and one
implementer. Each independent task gets a fresh implementer TUI.

An implementer reads the decision record, the plan, and the baseline — not
the design session's transcript. It owns only its task, runs a focused
acceptance instrument, and creates one task-scoped commit. For behaviour
with a deterministic executable test it uses TDD; the portable invariant is
smaller: observe a discriminating failure for the intended reason before
changing behaviour. A shell probe, parser fixture, or diff inspection may
be the correct instrument for configuration, documentation, generated
files, or environment-bound integration.

The counterexample named in each acceptance row is observed red and cited.
That observation is not the behaviour's own absence: one is the feature
absent, the other is an implementation that is present, runs, returns a
pass, and is wrong.

Implement the whole task before handing back. Stop and return `BLOCKED` or
`NEEDS_REPLAN` instead of a partial solution when the record contradicts
the code, the contract is ambiguous, work outside the task becomes
necessary, an existing test disproves an assumption, or the task no longer
fits one session. A task needing continuation is a decomposition failure.

### Handoff

```text
Status: DONE | BLOCKED | NEEDS_REPLAN
Harness:            name, model, effort, sandbox
Session:            the dispatch id
Baseline:
Changed paths:
Contract coverage:
Verification:
Deviations from plan:
Residue:
Git state:
END OF HANDOFF
```

`END OF HANDOFF` is the last line and load-bearing: the only thing that
distinguishes a handoff from one cut off mid-write. Under `Residue`, a claim
of nothing left needs evidence: name the check that returned empty. Under
`Verification`, cite the dispatch-bound command, output, and outcome that
Orca recovers for that task — the transcript or terminal it selects, and
any cursor mechanics, are Orca's concern, not this skill's. Do not
transcribe output by hand. Where Orca cannot recover a dispatch item, treat
the worker's own account as the thing under check rather than as the check,
and say so.

## Review

Review independence is role independence: a fresh session that did not
implement and does not edit the candidate. It gets the decision record (or
Bounded design), the baseline, and the diff. The phase adds no sandbox by
default; `AGENTS.md` may pin one for a concrete risk. Review depth is
adaptive: Bounded work gets one independent whole-change review. Each
Architectural task gets an independent task review. After all tasks are
accepted, a different fresh reviewer performs one integration review of
task interactions, complete-contract coverage, deferred findings, candidate
identity, and release readiness. Only that final review is release-binding
for Architectural work; Bounded work has no earlier task review and no
duplicate integration review. No worker runs while a review of the same
working tree runs. The working tree and its gate surface are shared mutable
state, and a review reproduces gates in that tree, so a concurrent edit
makes another task's work look like this one's result.

**Reproduce, do not accept.** Run the gates yourself. A claim you did not
reproduce is not evidence. The reviewer observes the counterexample
discriminate for itself — an implementation that is present, runs, returns
a pass, and is wrong. An instrument red only because the behaviour was
absent is not that observation.

Classify findings: **Blocking** — contract failure, regression, data or
security risk. **Important** — missing required behaviour, test, or
reconciliation. **Minor** — useful, does not block. **Out of scope** —
recorded, not absorbed. Return exactly one role disposition: `ACCEPT`,
`CHANGES_REQUESTED`, or `BLOCKED`. State what the review did not verify —
what it did not reproduce or read. A contradiction you cannot resolve is
`CHANGES_REQUESTED`. Do not open remediation over wording when
deterministic checks already prove the contract.

### Remediation

One pass is one remediation pass per finding, not per review. For an
in-contract `CHANGES_REQUESTED` finding, the **original implementer**
verifies it, fixes the root cause, reruns the affected instruments and
closure gates, and writes a separate remediation commit — this is the
single original-party remediation. Control owns the plan and the decision
record for the whole run, including remediating findings inside them.
Amending them is not implementing the candidate. The **reviewer that raised
the finding** checks its reproduction and the fix-only diff, and
scope-checks a Control amendment the same way. If that scoped re-review
does not accept, Control routes to `REPLAN_OR_SPLIT` — it does not start
another repair loop. `BLOCKED` preserves the candidate and escalates the
unresolved dependency or authority question to Control separately from a
failed worker process; it is not remediated by the original implementer. A
fresh replacement reviewer is used only when the original reviewer is
unavailable or contested, and for the Architectural integration review.

## Release

Control performs release with native Git and forge tools; release dispatches
no LLM worker and makes no post-review candidate edit.

1. Complete implementation and, for Architectural work, its task reviews.
2. Reconcile owning documentation, delete the plan, and commit the
   complete candidate.
3. Run the focused instruments and project closure gates on exact HEAD.
4. Push the feature branch and create or update a draft pull request.
5. Run the applicable final review while remote CI runs on that same HEAD.
6. Require both that review's `ACCEPT` and required checks green.
7. Mark the pull request ready and report it for human merge.

Any candidate mutation after the applicable final review invalidates that
verdict; Control reruns the affected gates and review on the new exact HEAD.
Affected gates are those that can observe the change class; a project may
name that subset. Dely never merges, force-pushes, or publishes outside the
approved target and authority. If project policy cannot publish work in
progress, Dely delays the push and pull request until the applicable review
accepts.

Maintenance logging is machine-local and opt-in at `~/.dely/log.jsonl`. It
stays opt-in on the presence of `~/.dely/` and is never created by Dely.
Control closes a delivery with `dely log --run <run> --json '<object>'`,
after release or when it stops early, rather than assembling a line by hand.
`dely` with no arguments prints which copy is running, and its usage.

## Failure and recovery

Recovery uses Orca records, Git, CI, and pull-request state — never inferred
from an ambiguous, missing, or merely transport-level outcome.

| Failure | Disposition |
| --- | --- |
| In-contract implementation defect | Original implementer remediates |
| Scoped remediation re-review does not accept | `REPLAN_OR_SPLIT` |
| Scope or architecture must change | Return to the design gate |
| New authority or destructive action is required | Ask the human |
| Orca or a required capability is unavailable | Stop; no headless fallback |
| any `PREFLIGHT … FAIL` | Dispatch to no pin; relay harness, path and dialog to the human; rerun preflight in the same Run when told |
| Harness fails or evidence is insufficient | Preserve the candidate, report the native outcome and role disposition |
| Idempotent release step is interrupted | Verify Git and pull-request state, then resume |
