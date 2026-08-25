# Dely Design Deep Review

| Field | Value |
| --- | --- |
| Status | Research review for owner decision. Do not implement from this document. |
| Date | 2026-08-24 |
| Scope | Proposed automation-first design, shipped workflow, durable decisions, observed deliveries, Orca, Superpowers, Git/GitHub, and relevant empirical research |
| Reviewed design | [`2026-08-24-automation-first-dely-design.md`](2026-08-24-automation-first-dely-design.md) |

## Executive conclusion

The design direction is sound, but the proposed contract remains larger than the
product needs. Preserve this core:

```text
vague request
  -> Control-led design
  -> human contract approval
  -> Orca-supervised implementation and independent review
  -> exact-HEAD release checks and pull-request preparation
  -> human merge
```

Seven proposed mechanisms should be simplified or removed before implementation:

1. Spike is an exit from delivery, not a third delivery shape.
2. Fresh implementers are used only for genuinely independent review surfaces.
3. The original task reviewer re-checks its own finding; a fresh reviewer is
   reserved for final integration review or a contested/unavailable reviewer.
4. A diagnostician is not a phase. Control dispatches a read-only investigation
   only for a concrete independent diagnostic question.
5. Release has no worker and no post-review candidate edit.
6. Setup selects only `implement` and `review`; `control` already exists and
   release is deterministic tool work.
7. Dely reuses only compatible Superpowers skills. It does not claim native
   `writing-plans` compliance while overriding that skill's mandatory executor
   handoff, worktree, ledger, subagent, and branch-finishing contracts.

The evidence journal and doctor should still be deleted after one discriminating
Orca evidence probe per supported harness. Orca, Git, CI, and the forge already
own the required evidence and state. Do not replace the removed rails with a
smaller journal, OpenTelemetry, or another Dely subsystem.

## Recommended minimal contract

### Control and human authority

Control asks only questions that can change acceptance, authority, risk, or
architecture. The normal human gates remain:

1. approve the design contract before candidate mutation; and
2. merge or publish after Dely prepares the reviewed pull request.

Additional pauses are exceptions for destructive action, new authority, replan,
or a required runtime that cannot be recovered. This matches risk-based human
intervention guidance rather than inserting manual inspection into every
automatable step ([OpenAI](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/),
[DORA](https://dora.dev/capabilities/streamlining-change-approval/),
[NIST AI RMF](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)).

### Adaptive delivery

| Shape | Artifact | Execution and review |
| --- | --- | --- |
| Spike | Approved probe, then a recommendation | No candidate and no Dely delivery run |
| Bounded | Approved in-chat design plus a short envelope | One implementer and one independent whole-change reviewer |
| Architectural | Approved design plus a task plan and envelope | Sequential task implementation/review, then one fresh integration reviewer |

A task boundary exists only where the unit owns a test cycle and a reviewer could
accept it while rejecting its neighbor. Same-shaped mechanical edits are batched;
tightly coupled work remains one task and one implementer. This is narrower than
creating a new session for every heading in a plan. Small, self-contained changes
help review, but a controlled decomposition experiment did not show that arbitrary
decomposition increases defect detection
([Google Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html),
[controlled experiment](https://arxiv.org/abs/1805.10978)).

### Review and remediation

Review independence means the reviewer did not implement and does not edit the
candidate. It does not require reviewer amnesia.

- The original implementer fixes an in-contract finding.
- The reviewer that raised it checks the reproduction and fix-only diff.
- A second failed scoped review returns to Control for replan or split.
- A fresh reviewer performs the Architectural whole-branch review, focused on
  interactions, complete-contract coverage, deferred findings, candidate identity,
  and release readiness.
- A Bounded change receives one whole-change review rather than a task review plus
  a duplicate final review.

Independent review is well supported and repeatedly caught plausible-but-wrong
claims in Dely's own delivery record. No direct evidence was found that a new
reviewer is better at confirming a finding raised by the original reviewer.
Reviewer experience affects comprehension, while a new reviewer pays that cost
again ([reviewer-experience experiment](https://doi.org/10.11309/jssst.29.4_74),
[Microsoft review study](https://www.microsoft.com/en-us/research/publication/characteristics-of-useful-code-reviews-an-empirical-study-at-microsoft/)).
The fresh final reviewer provides branch-level independence without multiplying
scoped reviewers.

### Debugging

The implementer applies systematic debugging and returns a diagnosis packet when
blocked. Control may dispatch one read-only investigation when the blocker can be
expressed as a specific independent question. That dispatch is an exception, not
a phase, setup row, status machine, or mandatory round trip.

Hypothesis-driven debugging is supported; a permanent diagnosis-only role is not
([Alaboudi and LaToza](https://arxiv.org/abs/2005.13652),
[Delta Debugging](https://www.st.cs.uni-saarland.de/papers/tse2002/)). Superpowers
already supplies the debugging method, so Dely needs no second protocol for it.

### Acceptance and TDD

Keep Counterexample. Nine observed Dely failures came from acceptance instruments
that could not reject a present-but-wrong implementation
([local findings](../findings.md)). The rail remains deliberately small: one clause
naming the plausible wrong behavior and a focused instrument where one exists.
It does not become a mutation-testing subsystem; mutation-testing research itself
devotes substantial work to reducing its cost
([cost-reduction review](https://doi.org/10.1016/j.jss.2019.07.100)).

Use Superpowers TDD for changed behavior that can be expressed by a deterministic
executable test. Dely's portable invariant is smaller: observe a discriminating
failure before changing behavior. Configuration, documentation, generated files,
and environment-bound integration may need a shell probe, parser fixture, or diff
review instead of a unit-test ritual. External TDD findings are context-dependent
and sometimes contradictory
([research review](https://arxiv.org/abs/2007.09863),
[family of 12 experiments](https://arxiv.org/abs/2011.11942)).

### Orca and evidence

Orca remains mandatory. One execution-plane implementation does not justify a
selector or a degraded headless fallback. Preflight may start Orca automatically;
the hard stop is a missing CLI, an unstartable runtime, or missing required
capabilities—not merely a closed app.

`input_accepted` is a transport receipt, not proof of an agent turn. Control must
confirm observable progress or apply the bounded one-Enter recovery already
justified by local recurrence and upstream reports
([issue 13488](https://github.com/stablyai/orca/issues/13488),
[issue 15581](https://github.com/stablyai/orca/issues/15581)).

The runtime evidence contract is only: read the dispatch through Orca and bind its
command, output, and outcome to that dispatch. Orca already provides attested
transcript retrieval, typed terminal fallback, and preserved released-worker output
([Orca orchestration guide](https://github.com/stablyai/orca/blob/main/skill-guides/orchestration.md)).
Transcript-versus-terminal selection is not a Dely concern.

Before deleting the journal and doctor, run one passing/failing marker probe on
Claude Code, Codex CLI, and Grok Build. Each probe must verify dispatch identity,
command, output, outcome, full cursor consumption, and readability after release.
Record the observations in `harness-surface.md`. Keep no compatibility stubs; if
one harness fails, retain only its smallest adapter.

### State, checkout, and setup

Git is the durable candidate and history; Orca owns Run/Task/Dispatch provenance;
the forge owns PR and CI state. Dely needs no task ledger, workflow database, retry
engine, or ownership engine.

Keep sequential execution in the current checkout. Fresh agent sessions do not
require fresh worktrees. Use native Git porcelain and exact-path commits to protect
the dirty baseline; never stash, reset, clean, or absorb unrelated changes
([Git status](https://git-scm.com/docs/git-status.html),
[Git commit](https://git-scm.com/docs/git-commit)).

The optional managed block becomes deployment preferences for dispatched LLM roles:

```markdown
## Dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | ... | ... | ... |
| `review` | ... | ... | ... |
```

There is no coordinator field because Orca is constant, no `control` row because
the current session already exists, and no `release` row because release has no
LLM worker. A diagnostic investigation inherits `implement` deployment.

Literal `default` values are preferences, not immutable pins. The execution
envelope records the configured token and, where the harness exposes it, the actual
observed worker model and effort. Defaults must not be described as reproducible.
Keeping the managed block mechanical also avoids the success and inference-cost
penalty observed when repository context files accumulate unnecessary requirements
([repository-context study](https://arxiv.org/abs/2602.11988),
[AGENTS.md specification](https://agents.md/)).

### Release

All code and owning documentation are reconciled and committed before final review.
The final verdict and required checks bind to an exact HEAD. Any later candidate
mutation invalidates that verdict; there is no release-only commit after `ACCEPT`.

The latency-optimized default is:

1. complete task reviews;
2. reconcile owning documentation;
3. run local gates on exact HEAD;
4. push the feature branch and open or update a draft PR;
5. run final integration review while remote CI runs on the same HEAD;
6. require both final `ACCEPT` and required checks green; and
7. mark ready and report the PR for human merge.

GitHub draft PRs cannot merge and expose native Checks. `gh pr checks --required
--watch` already supplies the wait operation; no Dely scheduler is needed
([GitHub pull requests](https://docs.github.com/en/pull-requests/reference/pull-requests),
[GitHub CLI checks](https://cli.github.com/manual/gh_pr_checks)). A project that
cannot publish work in progress retains delayed push. Control performs Git and
forge operations directly; a release TUI would add cost without judgment.

## Superpowers compatibility finding

The proposed design currently claims native Superpowers reuse while taking over
the skills' mandatory terminal branches:

- Brainstorming requires Writing Plans after an Architectural design.
- Writing Plans requires a handoff to Subagent-Driven Development or Executing
  Plans.
- Those executors own worktrees, subagents or inline execution, ledgers and
  checkpoints, review loops, and branch completion.
- Dely simultaneously assigns those concerns to Orca and Control, forbids
  in-harness subagents and Dely worktrees, and rejects a Dely ledger.

These contracts cannot all be native at once
([Brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md?plain=1),
[Writing Plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md?plain=1),
[SDD](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md?plain=1),
[Executing Plans](https://github.com/obra/superpowers/blob/main/skills/executing-plans/SKILL.md?plain=1)).

The minimal honest choice is:

- reuse compatible skills and methods (`brainstorming`, conditional TDD,
  `systematic-debugging`, `receiving-code-review`, and
  `verification-before-completion`);
- use a Dely task plan for Architectural work, borrowing Superpowers' task-shape
  discipline without claiming native `writing-plans` execution compliance; and
- document one explicit integration seam rather than copying or wrapping the
  Superpowers executors.

If Superpowers later exposes an external-orchestrator handoff, Dely can remove the
seam. Full native Superpowers execution today would mean changing Dely's product
identity to its worktree/subagent/ledger model, not a small integration tweak.

## Decision audit

| Area | Verdict | Minimal decision |
| --- | --- | --- |
| Thin protocol and vague-input design | KEEP | Control leads design and obtains approval before mutation. |
| Two normal human gates | KEEP | Design approval and merge/publish only. |
| Spike / Bounded / Architectural | SIMPLIFY | Spike exits delivery; two execution shapes remain. |
| Orca mandatory, no headless fallback | KEEP | Auto-open, capability preflight, then fail closed. |
| Current checkout, sequential execution | KEEP | No worktree or parallel implementation without a concrete conflict. |
| Fresh implementer per task | NARROW | Only independently testable/reviewable tasks. |
| Review independence | KEEP | Reviewer never implements or edits the candidate. |
| Fresh remediation reviewer | DROP | Original reviewer performs scoped re-review. |
| Task plus final review | ADAPT | Bounded gets one review; Architectural final review is integration-only. |
| Dedicated diagnostician | DROP | Ad hoc read-only investigation only when a blocker warrants it. |
| Universal TDD | NARROW | Require a discriminating failure; use TDD where executable behavior permits. |
| Counterexample rail | KEEP | A clause and focused instrument, not mutation infrastructure. |
| Journal and doctor | DROP AFTER PROBE | Orca, Git, CI, and forge evidence replace them. |
| Dely ledger/state database | DROP | Native owners already exist. |
| Setup optional | KEEP | Deployment preferences; defaults are not pins. |
| Setup `control`/`release` rows | DROP | Neither role is dispatched. |
| Release worker | DROP | Control performs deterministic native operations. |
| No push until final `ACCEPT` | CHANGE DEFAULT | Draft PR lets CI overlap final review; delayed push remains for confidentiality. |
| Human merge | KEEP | Native branch protection and required checks enforce it. |
| Dirty baseline and exact-path commits | KEEP | Native Git, no ownership engine. |
| Status vocabulary | SIMPLIFY | Separate Orca outcome from role dispositions. |
| Full-chain Superpowers claim | DROP | Reuse the compatible subset and name the integration seam. |

## Evidence-weighted rationale

### Why the core remains

Clarification improves function-level code generation, and ambiguity reduces model
performance; this supports Control-led design, not exhaustive specification
([ClarifyGPT](https://doi.org/10.1145/3660810),
[TiCoder](https://www.microsoft.com/en-us/research/publication/llm-based-test-driven-interactive-code-generation-user-study-and-empirical-evaluation/)).
Simple pipelines can compete with elaborate agent systems at lower cost, while
agentic exploration helps when localization clues are weak
([Agentless](https://arxiv.org/abs/2407.01489),
[Anthropic](https://www.anthropic.com/engineering/building-effective-agents)).
This supports a thin adaptive protocol rather than a general framework.

### Why freshness is conditional

Long contexts can lose relevant information, supporting clean task briefs and fresh
contexts for independent units ([Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/)).
However, multi-agent variants can underperform on sequential reasoning, and real
software-evolution tasks contain cross-task spillover
([agent-systems study](https://arxiv.org/abs/2512.08296),
[SWE-STEPS](https://arxiv.org/abs/2604.03035)). Freshness is therefore a tool for
isolation, not a quota.

### Why automation does not replace acceptance quality

Dely's 41-plan record runs at roughly 2.8 rounds per plan. Transport accounts for
only about four percent of rounds; the largest failure class is non-discriminating
acceptance, followed by unpinned environment/configuration. One oversized plan failed
three rounds before splitting succeeded. Orca removes manual toil, but plan boundaries
and discriminating instruments still control correctness
([local findings](../findings.md), [local decisions](../decisions.md)).

### Why human gates remain

Current agents perform best on clean, well-specified, algorithmically scored work;
real work is messier and autonomy is uneven
([METR time horizons](https://metr.org/time-horizons/),
[METR holistic evaluation](https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/)).
The design and merge gates preserve intent and authority while automation handles
reversible execution.

## Limits

- Fresh-session and multi-agent research is not a controlled A/B test of Dely.
  Validate the conditional rule in later deliveries; do not build a scoring engine.
- No direct software-engineering study was found comparing original versus new AI
  reviewer for scoped re-review. The recommendation is an inference from
  comprehension cost, standard review practice, and preserved independence.
- Orca orchestration evolves quickly. Capability-based preflight and live probes are
  stronger than version assumptions.
- Draft PR before final review is a latency optimization, not a universal
  publication policy.
- The Superpowers conflict cannot be removed by wording. Full native execution and
  Dely-owned Orca execution are different product choices.

## Recommended owner decision

Approve a revision of the design, not implementation. The revised design should
make the seven changes in the Executive conclusion and reduce its behavioral
acceptance accordingly. Only after that revised document is reviewed and approved
should an implementation plan be written.
