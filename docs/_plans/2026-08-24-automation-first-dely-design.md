# Automation-first Dely

| Field | Value |
| --- | --- |
| Status | Approved design contract. Implementation authorized 2026-08-25. |
| Date | 2026-08-25 |
| Product | `dely` |
| Supersedes | `2026-08-23-composition-kernel-design.md`, `2026-08-23-sequential-identity-design.md`, and `2026-08-23-design-continuity.md` as design direction |

This is a design contract, not an implementation plan or durable decision record.
The owner approved this artifact and authorized implementation on 2026-08-25.
Repository artifacts are written in English.

## Product contract

Dely accepts a request that may still be vague, brings it to an approved design
contract, then automates sequential implementation, independent review, and
pull-request preparation.

The normal flow has two human gates:

1. Approve the design contract before candidate mutation.
2. Merge or publish after Dely has prepared the reviewed pull request.

Dely pauses outside those gates only for a scope or architecture change, a
destructive action, new authority, replan, or an unavailable required runtime.

Dely is a thin control protocol. It is not an orchestrator, SDLC framework, skill
composition engine, evidence database, or second source of Git state.

## Architecture and ownership

```text
Vague request
  -> active design method under Dely's invariant
  -> human contract approval
  -> Orca-supervised sequential implementation and independent review
  -> exact-HEAD local gates
  -> draft pull request, applicable final review, and CI on the same HEAD
  -> human merge
```

### Control session

The current interactive session is Control. It owns Dely's approval invariant,
task boundaries, exception handling, dispatch supervision, and release. It does
not implement or review the candidate.

Control does not prescribe question count, order, format, or skill-selection
precedence. The active design method comes from the current session's user,
project, and native harness behavior.

Before candidate mutation, Control must obtain explicit approval of a design
contract. It surfaces unresolved uncertainty that could materially change intent,
acceptance, authority, public contract, architecture, or consequential risk. The
active design method may resolve other details from repository evidence and
conventions, but material assumptions must be explicit.

### Design methods and Plan Mode

The active design skill owns how to explore, ask questions, compare approaches,
and present the design. Harness Plan Mode independently owns tool gating and plan
approval UX. They may be used together.

Dely does not select, configure, emulate, or silently activate either one. Plan
Mode is defense in depth, not proof that requirements are clear or that no
mutation is possible. Dely's approval invariant remains authoritative in every
harness and mode.

### Orca

Orca is the required execution plane for `dely:delivery`. It launches and
supervises fresh native harness TUIs with the resolved harness, model, and effort.
Dely does not wrap a headless CLI in a shell tab and has no direct or headless
fallback. A second orchestrator is not designed until a second implementation has
been proven in a real Dely delivery.

### Native state owners

Orca owns Run, Task, Dispatch, transcript, and terminal provenance. Git owns the
candidate and its history. CI and the forge own checks, pull-request state, and
publication state. Dely reads those systems rather than duplicating them.

## Compatible skill reuse

Dely reuses compatible methods from skills already active in the selected harness.
Examples include:

- brainstorming during design;
- test-driven development where changed behavior has a deterministic executable
  test;
- systematic debugging before a bug fix;
- disciplined receipt of code-review feedback during remediation; and
- verification before completion claims.

Dely retains ownership of dispatch, task isolation, review independence, and
release. Its Architectural task plan is shaped for Dely and Orca execution. Dely
does not claim native compliance with a skill chain whose required terminal path
owns worktrees, subagents, a competing executor, review dispatch, or branch
completion.

Dely does not catalogue skills, define their precedence, configure them in setup,
or emulate an unavailable skill.

## Adaptive design contract

Control uses the smallest contract that safely holds the change.

| Shape | Use | Artifact |
| --- | --- | --- |
| Spike | Investigation only; no candidate is delivered | Approved probe and recommendation; no Dely delivery run |
| Bounded | Small change with clear behavior and ownership | Approved in-chat design and short execution envelope |
| Architectural | Multiple behaviors, public-contract change, architecture decision, or promoted risk | Approved design artifact, Dely task plan, and short execution envelope |

Risk may promote an otherwise small change to Architectural. Diff or artifact size
alone never demotes data-loss, security, permission, or public-compatibility risk.

An approved design contract states:

- intent and success criteria;
- scope and authority;
- affected public contract or architecture;
- consequential risks and material assumptions; and
- a plausible counterexample or failure mode that distinguishes correct behavior
  from a present-but-wrong implementation.

Counterexample is one lightweight clause plus a focused instrument where one
exists. It does not create a mutation-testing subsystem. If no executable
instrument can discriminate the requirement, the contract names the manual
inspection and its limit.

### Execution envelope

The execution envelope freezes only facts that workers and release automation
need:

- owned scope and paths;
- protected pre-existing dirty paths;
- acceptance criteria, counterexample, and focused instruments;
- branch, base, remote, and pull-request target;
- resolved harness, model, and effort for dispatched roles;
- authority to create a feature branch, commit owned paths, run gates, push, and
  create or update a pull request; and
- prohibited operations, including merge, force-push, stash, reset, cleanup, and
  edits outside owned scope.

The envelope references the approved design and task plan. It does not copy them
into a second Dely schema.

## Execution model

Implementation is sequential in the current checkout. Dely creates no worktrees
and launches no in-harness subagents. A checkout created by a human is a separate
Dely run with no shared run state.

Before mutation, Control:

1. resolves deployment preferences against the live harness surface;
2. starts Orca when needed and verifies its required capabilities;
3. records the dirty baseline and checks exact-path ownership; and
4. creates a feature branch when starting on the default branch.

Control creates a separate task only when that unit has its own test cycle and a
reviewer could accept it while rejecting its neighbor. Same-shaped mechanical
changes are batched. Tightly coupled work remains one task and one implementer.
Each independent task receives a fresh implementer TUI.

An implementer owns only its task, runs a focused acceptance instrument, and
creates a task-scoped commit. For behavior with a deterministic executable test,
it uses TDD. The portable invariant is smaller: observe a discriminating failure
for the intended reason before changing behavior. A shell probe, parser fixture,
or diff inspection may be the correct instrument for configuration,
documentation, generated files, or environment-bound integration.

## Dirty baseline and commit discipline

Dely stages and commits only contract-owned paths. It never stashes, resets,
cleans, or silently absorbs the user's existing changes.

If a path contains protected baseline changes and Dely must also modify that path,
Control pauses rather than combining ownership. Unrelated dirty paths remain
untouched.

Each implementation task has a task commit. A correction after a review finding
has a separate remediation commit. Dely does not squash automatically.

## Review and remediation

Review independence is role independence: a fresh reviewer did not implement and
does not edit the candidate. Control checks candidate HEAD and worktree state at
the review boundary. Dely adds no phase-implied sandbox or worktree.

Review depth is adaptive:

- A Bounded change receives one independent whole-change review.
- Each Architectural task receives an independent task review.
- After all Architectural tasks are accepted, a different fresh reviewer performs
  one integration review of task interactions, complete-contract coverage,
  deferred findings, candidate identity, and release readiness.

A reviewer returns `ACCEPT`, `CHANGES_REQUESTED`, or `BLOCKED`. Orca's native
runtime outcome remains separate from that role disposition: a completed dispatch
does not imply an accepted candidate.

For an in-contract finding:

1. The original implementer verifies the finding, fixes the root cause, runs the
   affected instruments, and writes a remediation commit.
2. The reviewer that raised the finding checks its reproduction and the fix-only
   diff.
3. If that scoped re-review does not accept, Control returns
   `REPLAN_OR_SPLIT`; it does not start another repair loop.

A fresh replacement reviewer is used only when the original reviewer is
unavailable or contested, and for the Architectural integration review.

## Debugging and investigation

The implementer owns systematic debugging: reproduce, isolate the root cause,
observe a discriminating failure, then propose and verify a fix.

When a blocker can be expressed as a concrete independent diagnostic question,
Control may dispatch one read-only investigation. It may reproduce, inspect, and
report a diagnosis packet, but it does not edit the candidate, commit, launch
workers, or expand scope. It inherits the `implement` deployment preference.
Investigation is an exception, not a phase, setup row, or mandatory round trip.

## Evidence and health checks

Evidence is a property of a dispatch, not a Dely-owned journal. Dely asks Orca for
the dispatch-bound command, output, and outcome. Transcript-versus-terminal
selection and cursor mechanics remain Orca concerns. Git, CI, and pull-request
state provide the durable candidate and release evidence.

`input_accepted` is a transport receipt, not proof of an agent turn. Control
allows 90 seconds for observable agent progress. If none appears, it reads the
worker TUI. Only when the task is still pending in the input box does Control send
Enter, exactly once, then resume the normal blocking wait.

Before removing the current universal evidence rails, run one non-mutating Orca
capability probe for Claude Code, Codex CLI, and Grok Build. Each probe must:

- bind the evidence to the intended dispatch;
- run deterministic passing and failing marker commands;
- recover their command, output, and outcome;
- consume the complete available cursor; and
- remain readable after worker release.

If all three harnesses pass, remove the evidence journal and doctor as product
components in the same change: binaries, hooks, adapters, tests, wiring, and
present-tense documentation. Keep no compatibility stubs.

If exactly one harness fails, remove the universal rails and retain only the
smallest adapter and setup check required by that harness. Before candidate hook
changes, point any live Grok adapter at a frozen installed plugin copy. Refresh
plugin caches and live hook wiring only between plans.

If two or more harnesses fail, stop and return the evidence design to the owner.
The assumption that Orca can replace the universal rails would not have held.

## State and learning

Dely has no task ledger, event store, workflow database, generic retry engine,
ownership engine, or evidence schema. Recovery is reconstructed from native state.

The project-configured delivery log retains one minimal row for an accepted
delivery so a later maintenance session can establish recurrence. It records only
facts closure already knows and never drives runtime routing or recovery.

Learning may propose an instruction or workflow change only when the same failure
reaches its third occurrence under the current contract. A human decides whether
to promote the proposal. Dely never mutates a live skill,
`AGENTS.md`, or project instructions from telemetry.

## Setup and deployment resolution

`dely:setup` is optional and manages deployment preferences only:

```markdown
## Dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | ... | ... | ... |
| `review` | ... | ... | ... |
```

There is no coordinator or orchestrator field because Orca is constant. There is
no `control` row because the current session already exists, and no `release`
row because release has no LLM worker. Setup does not configure Plan Mode or
design skills.

Setup discovers valid harness, model, and effort values from the current harness
surface. Dely stores no model catalogue.

Without a managed block, implement and review use the current harness and its
default model and effort. With a block, values are deployment preferences resolved
again at dispatch. Literal `default` is not a reproducible pin. The execution
envelope records the configured value and, where the harness exposes it, the
actual observed model and effort.

`dely:delivery` starts and preflights Orca before execution. It stops only when
the CLI is missing, the runtime cannot start, or a required capability is absent.
There is no headless fallback.

## Release

Control performs release with native Git and forge tools. Release has no LLM
worker and makes no post-review candidate edit.

The default flow is:

1. Complete implementation and, for Architectural work, its task reviews.
2. Reconcile owning documentation and commit the complete candidate.
3. Run the focused instruments and project closure gates on exact HEAD.
4. Push the feature branch and create or update a draft pull request.
5. Run the applicable final review while remote CI runs on that same HEAD: the
   single whole-change review for Bounded work or the fresh integration review for
   Architectural work.
6. Require both that review's `ACCEPT` and required checks green.
7. Mark the pull request ready and report it for human merge.

Bounded work therefore has no earlier task review and no duplicate integration
review. Architectural task reviews establish task acceptance; only the final
integration review is release-binding.

If project policy cannot publish work in progress, Dely delays the push and pull
request until the applicable review accepts. Draft pull requests are a latency
default, not additional publication authority.

Any candidate mutation after the applicable final review invalidates that verdict.
Control must run the affected gates and review again on the new exact HEAD. Dely
never merges, force-pushes, or publishes outside the approved target and authority.

Repository-specific closure commands remain owned by `AGENTS.md`; the portable
skill does not copy them.

## Failure and recovery

Recovery uses Orca records, Git, CI, and pull-request state.

| Failure | Disposition |
| --- | --- |
| In-contract implementation defect | Original implementer remediates |
| Scoped remediation re-review does not accept | `REPLAN_OR_SPLIT` |
| Scope or architecture must change | Return to the design gate |
| New authority or destructive action is required | Ask the human |
| Orca or a required capability is unavailable | Stop; no headless fallback |
| Harness fails or evidence is insufficient | Preserve the candidate and report the native outcome plus role disposition |
| Idempotent release step is interrupted | Verify Git and pull-request state, then resume |

Success is never inferred from an ambiguous, missing, or merely transport-level
outcome.

## Breaking migration

This design intentionally has no compatibility period:

- rewrite managed blocks to contain only `implement` and `review`;
- remove coordinator selection, `orchestrator = none`, direct dispatch, and
  headless fallback;
- make Orca startup and capability preflight an execution boundary;
- replace fixed artifact depth with Bounded and Architectural delivery shapes,
  while Spike exits delivery;
- document the compatible skill seam without adding a composition layer;
- implement conditional task freshness, adaptive review, original-reviewer
  remediation re-review, and bounded repair;
- remove journal and doctor infrastructure after the three harness probes;
- move release to exact-HEAD draft-PR, CI, and review convergence; and
- reconcile README, workflow contract, decisions, harness surface, and focused
  contract tests to one present-tense design.

No dual parser, deprecated field, compatibility binary, or old journal path is
shipped. Release documentation names the breaking change.

## Behavioral acceptance

Implementation planning must provide focused instruments that distinguish these
behaviors from their failure modes:

1. A vague request reaches an approved design contract before candidate mutation.
2. Bounded and Architectural work produce different artifact and review depth;
   Spike starts no delivery run.
3. An active design skill or Plan Mode cannot bypass Dely's approval invariant,
   and Dely does not select either one.
4. Delivery starts and preflights Orca when possible, then stops without required
   capabilities and never invokes a headless fallback.
5. Setup emits only `implement` and `review`, discovers the live deployment
   surface, and treats defaults as preferences rather than reproducible pins.
6. Only independently testable and reviewable tasks receive fresh implementers;
   same-shaped mechanical work is batched.
7. Reviewers do not implement or edit the candidate. Bounded work receives one
   whole-change review; Architectural work receives task review plus one fresh
   integration review.
8. Remediation returns to the original implementer and original reviewer; a
   non-accepting scoped re-review returns `REPLAN_OR_SPLIT`.
9. Protected dirty paths are neither staged nor overwritten, and commits contain
   only owned paths.
10. Supported-harness probes recover passing and failing marker evidence after
    worker release without universal journal and doctor rails.
11. Release binds local gates, applicable final review, CI, and pull-request state
    to exact HEAD; it pushes only an authorized feature branch and never merges.
12. Missing gate, evidence, capability, disposition, or pull-request state cannot
    produce a completion claim.

Each row names a plausible present-but-wrong counterexample. Repository-specific
gate commands remain in `AGENTS.md`.

## Non-goals

- Parallel workers, Dely-created worktrees, or coordination across checkouts.
- In-harness subagents or nested review agents.
- A generic orchestrator interface before a second implementation exists.
- A skill catalogue, selector, precedence table, fork, wrapper, or reimplementation.
- A Dely-owned model catalogue or closure-gate registry.
- A task ledger, event store, evidence schema, retry scheduler, or CI service.
- A release LLM phase.
- Automatic merge, force-push, stash, reset, squash, or cleanup of user changes.
- Automatic promotion of telemetry into instructions.

## Next step

Record the durable decision and committed implementation plan, then execute that
plan through the frozen installed Dely contract.
