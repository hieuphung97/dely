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
does not implement or review the candidate.

Control does not prescribe question count, order, format, or skill-selection
precedence. Dely owns the design outcome and approval boundary, not a
universal interview or planning method. The user, project, and harness
determine which design skills and native modes are active.

Native Plan Mode governs its enforced action constraints, question and plan
surfaces, artifact representation, and mode transitions. Compatible active
design skills may refine exploration and design methodology within those
constraints. When more than one applies, normal harness instruction and tool
precedence governs. One explicit approval satisfies Dely's boundary for the
same design scope; a material scope change requires renewed approval. Dely
does not select, activate, configure, emulate, or compose either mechanism.

Neither one owns or can bypass the approval invariant: before candidate
mutation, Control must obtain explicit human approval of a design contract.
Plan Mode is defense in depth, not proof that requirements are clear or that
no mutation is possible.

Control surfaces unresolved uncertainty that could materially change intent,
acceptance, authority, public contract, architecture, or consequential risk.
The active design method may resolve other details from repository evidence
and convention, but material assumptions must be explicit.

## Shape: Spike, Bounded, Architectural

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
material assumptions; and a plausible counterexample or failure mode that
distinguishes correct behaviour from a present-but-wrong implementation. If no
executable instrument can discriminate the requirement, the contract names the
manual inspection and its limit.

Architectural work uses `templates/decision-record.md` (durable) and
`templates/plan.md` (transient, deleted at closure). Commit both before
implementation begins — that commit is the review baseline.

### Acceptance

One table: each requirement, the instrument that proves it, the plausible
wrong implementation that instrument rejects, and where that rejection was
observed.

**An acceptance row is invalid until you have settled that its instrument
discriminates.** A row whose instrument passes both before and after the
change proves nothing and will be found at review. Baseline-red is
insufficient by itself: an instrument observed red only because the feature
is absent says nothing about whether it can catch an implementation that is
present, runs, returns a pass, and is wrong.

Each row names a plausible wrong implementation its instrument rejects — one
that exists, runs, and returns a pass. "The feature is absent" does not
satisfy Counterexample. Where no counterexample exists, the row says so and
says a human reads the diff.

Record what the available instruments cannot observe. Prefer the simplest
instrument that proves the contract.

## Execution envelope

Before mutation, Control resolves deployment preferences against the live
harness surface, starts Orca and verifies its required capabilities, records
the dirty baseline and exact-path ownership, and creates a feature branch when
starting on the default branch.

The envelope freezes owned scope and paths; protected pre-existing dirty
paths; acceptance criteria, counterexample, and focused instruments; branch,
base, remote, and pull-request target; resolved harness, model, and effort for
dispatched roles; and authority to branch, commit owned paths, run gates,
push, and open or update a pull request. It never authorises merge,
force-push, stash, reset, cleanup, or an edit outside owned scope.

Dely stages and commits only contract-owned paths. It never stashes, resets,
cleans, or silently absorbs the user's existing changes. If a path carries
protected baseline changes and Dely must also modify it, Control pauses
rather than combining ownership.

## Orca is mandatory

Orca is the required execution plane. It launches and supervises fresh native
harness TUIs with the resolved harness, model, and effort. Orchestration is a
required Orca capability. `dely:delivery` starts and preflights Orca before
execution. It stops only when the CLI is missing, the runtime cannot start, or a
required capability is absent — there is no direct dispatch and no headless
fallback of any kind.

### Launching a worker

Write the prompt to an untracked file **inside the worktree**. Never inline
it in a shell argument: prompts carry backticks, quotes and newlines, and a
shell argument mangles them. A path outside the workspace can trigger a
second permission surface some harnesses still prompt for even when tool
approval is skipped. Do not stage that file. After the worker returns,
delete it: Control owns that dispatch artifact, not `git clean`. The handoff
is likewise a file in the worktree; its path travels as `payload.reportPath`
and the message body stays short. `--spec` and `--body` are shell arguments,
which this skill already forbids for prompts.

`worker-start` proves readiness by exiting 0 with a receipt carrying
`launch.requested` and `launch.effective`. Launch a real interactive harness
TUI for the phase, with the model and effort pinned from `AGENTS.md`. A
visible shell running a headless harness is not a TUI; compose that TUI's
launch using `references/harnesses.md`, this skill's compatibility matrix of
Orca agent id, permission defaults, forbidden headless forms, and launch
notes.

**Name the model and effort on every dispatch.** A worker left on a harness
default is an unpinned environment: it lives in the harness's own config, it
changes without announcing itself, and the dispatch that relies on it looks
identical to one that pinned the same value deliberately.

When composing the TUI launch argv yourself, carry the execution plane's
configured permission default for that agent onto the composed argv;
composing argv is not a request for a different permission posture. Do not
add a sandbox the project did not pin.

`check --wait` on `worker_done,escalation,question` is the completion wait,
repeated past heartbeats until a settling message arrives for that dispatch —
a heartbeat ends one wait but settles nothing.
The worker reports once with `worker_done` and an `--outcome`.
Completion comes from the worker's own `worker_done`;
do not infer it from reading the worker's terminal.
`worker-release` returns the terminal. `worker-read` is the bounded evidence
read.

A blocked or stalled launch is routed by the plane's typed error, not by an
enumerated vendor dialog. `agent_prompt_blocked` means a modal sits between
launch and composer, so read that terminal and clear what is actually there.
`agent_prompt_stalled` is a liveness inspection.

### Investigation

When a blocker can be expressed as a concrete independent diagnostic question,
Control may dispatch one read-only investigation, inheriting the `implement`
deployment preference. It may reproduce, inspect, and report a diagnosis
packet, but it does not edit the candidate, commit, launch workers, or expand
scope. This is an exception, not a phase or mandatory round trip.

### Escalate rather than guess

Stop and ask the human when: a result maps to no route or more than one; the
worker **failed** rather than returned a stop status — a non-zero exit with no
result, an exhausted quota, an authentication error — which is not `BLOCKED`
and must not be treated as one; Orca is unavailable or a required capability
is absent; an action needs authority policy reserves to the human; or the
same worker fails twice on the same input. Say what you know, what you tried,
and what the options are. Do not pick one.

## Implementation

Control creates a separate task only when that unit has its own test cycle
and a reviewer could accept it while rejecting its neighbor. Same-shaped
mechanical changes are batched. Tightly coupled work stays one task and one
implementer. Each independent task gets a fresh implementer TUI.

An implementer reads the decision record, the plan, and the baseline — not
the design session's transcript. It owns only its task, runs a focused
acceptance instrument, and creates one task-scoped commit. For behaviour with
a deterministic executable test it uses TDD; the portable invariant is
smaller: observe a discriminating failure for the intended reason before
changing behaviour. A shell probe, parser fixture, or diff inspection may be
the correct instrument for configuration, documentation, generated files, or
environment-bound integration.

The counterexample named in each acceptance row is observed red and cited.
That observation is not the behaviour's own absence: one is the feature
absent, the other is an implementation that is present, runs, returns a pass,
and is wrong.

Implement the whole task before handing back. Stop and return `BLOCKED` or
`NEEDS_REPLAN` instead of a partial solution when the record contradicts the
code, the contract is ambiguous, work outside the task becomes necessary, an
existing test disproves an assumption, or the task no longer fits one
session. A task needing continuation is a decomposition failure.

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
Unresolved findings:
Git state:
END OF HANDOFF
```

`END OF HANDOFF` is the last line and load-bearing: the only thing that
distinguishes a handoff from one cut off mid-write. Under `Verification`, cite
the dispatch-bound command, output, and outcome that Orca recovers for that
task — the transcript or terminal it selects, and any cursor mechanics, are
Orca's concern, not this skill's. Do not transcribe output by hand. Where
Orca cannot recover a dispatch item, treat the worker's own account as the
thing under check rather than as the check, and say so.

## Review

Review independence is role independence: a fresh session that did not
implement and does not edit the candidate. It gets the decision record (or
Bounded design), the baseline, the diff, and the dispatch evidence — not the
implementer's reasoning. The phase adds no sandbox by default; `AGENTS.md` may
pin one for a concrete risk.

Review depth is adaptive: Bounded work gets one independent whole-change
review. Each Architectural task gets an independent task review. After all
tasks are accepted, a different fresh reviewer performs one integration
review of task interactions, complete-contract coverage, deferred findings,
candidate identity, and release readiness. Only that final review is
release-binding for Architectural work; Bounded work has no earlier task
review and no duplicate integration review.

No worker runs while a review of the same working tree runs. The working
tree and its gate surface are shared mutable state, and a review reproduces
gates in that tree, so a concurrent edit makes another task's work look
like this one's result.

**Reproduce, do not accept.** Run the gates yourself. A claim you did not
reproduce is not evidence.

Classify findings: **Blocking** — contract failure, regression, data or
security risk. **Important** — missing required behaviour, test, or
reconciliation. **Minor** — useful, does not block. **Out of scope** —
recorded, not absorbed.

Return exactly one role disposition: `ACCEPT`, `CHANGES_REQUESTED`, or
`BLOCKED`. State what it did not verify — what the review did not
reproduce or read. A contradiction you cannot resolve is `CHANGES_REQUESTED`.
Do not open remediation over wording when deterministic checks already prove
the contract.

### Remediation

One pass is one remediation pass per finding, not per review. For an
in-contract `CHANGES_REQUESTED` finding, the **original implementer**
verifies it, fixes the root cause, reruns the affected instruments and
closure gates, and writes a separate remediation commit — this is the
single original-party remediation. The **reviewer that raised the
finding** checks its reproduction and the fix-only diff. If that scoped
re-review does not accept, Control routes to `REPLAN_OR_SPLIT` — it does
not start another repair loop. Control owns the plan and the decision
record for the whole run, including remediating findings inside them.
Amending them is not implementing the candidate. The reviewer that raised
such a finding scope-checks the amendment on the fix-only diff. `BLOCKED`
preserves the candidate and escalates the unresolved dependency or
authority question to Control separately from a failed worker process; it
is not remediated by the original implementer. A fresh replacement
reviewer is used only when the original reviewer is unavailable or
contested, and for the Architectural integration review.

## Release

Control performs release with native Git and forge tools; release dispatches
no LLM worker and makes no post-review candidate edit.

1. Complete implementation and, for Architectural work, its task reviews.
2. Reconcile owning documentation and commit the complete candidate.
3. Run the focused instruments and project closure gates on exact HEAD.
4. Push the feature branch and create or update a draft pull request.
5. Run the applicable final review while remote CI runs on that same HEAD.
6. Require both that review's `ACCEPT` and required checks green.
7. Mark the pull request ready and report it for human merge.

Any candidate mutation after the applicable final review invalidates that
verdict; Control reruns the affected gates and review on the new exact HEAD.
Dely never merges, force-pushes, or publishes outside the approved target and
authority. If project policy cannot publish work in progress, Dely delays the
push and pull request until the applicable review accepts.

### Maintenance log

Maintenance logging is machine-local and opt-in at `~/.dely/log`. Dely never
creates the directory or file: a missing path is skipped silently, and
deleting the file opts out. Only after a delivery is accepted and all
required checks are green does Control append exactly one physical line;
aborted or incomplete deliveries are not recorded. The line carries an
ISO-8601 UTC timestamp and labelled fields for the Git-root basename, plan,
pull request or `none`, implementation-round count, ordered review
dispositions, and one short drift-cause sentence. Tabs separate fields;
embedded tabs and newlines become spaces. Dely never reads this file for
routing, recovery, or runtime decisions, and its text layout is not a public
parsing schema. An append failure produces a visible warning but does not
invalidate or block an otherwise accepted release.

## Evidence

Evidence is a property of a dispatch, not a skill-owned journal. Control asks
Orca for the dispatch-bound command, output, and outcome; durable candidate
and release facts come from Git, CI, and the pull-request state. This skill
duplicates none of those stores.

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
| Harness fails or evidence is insufficient | Preserve the candidate, report the native outcome and role disposition |
| Idempotent release step is interrupted | Verify Git and pull-request state, then resume |

## Changing this skill

Only when the same failure recurs under the current contract — one incident
is not policy. Before adding a rule, check whether a mechanism can enforce
the fact instead. A human decides whether to promote a proposal; this skill
never mutates itself, `AGENTS.md`, or project instructions from telemetry.

## Language

Repository artifacts are English. Conversation follows the user. Enum values,
paths, commands, branch names and SHAs are never translated.
