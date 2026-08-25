# Durable Decision Positive Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to execute the implementation task and
> `superpowers:test-driven-development` for its RED/GREEN cycle. Dely's Orca
> phase dispatch remains authoritative; do not create in-harness subagents or
> worktrees.

**Goal:** Make the focused contract fail when the active durable decision omits
the design-skill/Plan Mode capability boundary, without duplicating the fuller
skill/design wording.

**Architecture:** Reuse the existing active-section extractors and reject
checks. Factor the current positive assertions into a minimal shared core plus
the existing skill/design-only assertions; run the durable Decision subsection
through the core rather than reject-only mode.

**Tech Stack:** POSIX-style Bash, `awk`, `grep`, Git, and the repository's
existing shell contract tests; no new dependency or framework.

**Spec:** `docs/decisions.md`, “2026-08-25 — Dely is an automation-first thin
control protocol”, including the scoped re-review clarification.

## Global Constraints

- Preserve exact candidate history through
  `2c7eb3e3fbcaf1089297dc12416abfa078c521f9`; do not amend, squash, rebase,
  force-push, reset, stash, or clean.
- Implementation may modify only `tests/delivery-contract.sh` and
  `docs/findings.md`; design and decision artifacts are immutable baseline.
- Use the current checkout, one fresh implementation session, one fresh
  independent review session, and the frozen release session. No worktree or
  in-harness subagent.
- The two known integration findings in `git-hooks/pre-push` and
  `docs/harness-surface.md` remain separate and forbidden.
- Keep the checker dependency-free and add no synonym catalogue or prose parser.

---

Decision record: `docs/decisions.md`, “2026-08-25 — Dely is an
automation-first thin control protocol”

Approved design: `docs/_plans/2026-08-24-automation-first-dely-design.md`,
“Design methods and Plan Mode”

Prior non-accept:
`/tmp/dely-design-skill-plan-mode-rereview-2c7eb3e-result.md`

**Baseline:** Control resolves the commit carrying the decision amendment and
this plan immediately before dispatch and supplies that exact SHA to every
worker; a commit cannot record its own SHA.

## Goal

Close the one remaining acceptance gap from the scoped re-review: the active
durable Decision subsection must contain its minimum positive capability
boundary, not merely avoid three forbidden formulations. The already-correct
skill, approved design, ownership contract, phase model, and two separate final
integration findings are out of reach.

## Allowed scope

```text
docs/decisions.md                                           design baseline only
docs/_plans/2026-08-25-design-boundary-positive-decision-plan.md
docs/_plans/2026-08-25-design-skill-plan-mode-boundary-plan.md closure only
docs/delivery-log.md                                        closure only
docs/findings.md
tests/delivery-contract.sh
```

`tests/delivery-contract.sh` is the existing owning instrument. No registry or
inventory enumerates this prose contract. `docs/findings.md` owns the observed
checker history and its current description must match the final instrument.

## Forbidden scope

- `skills/delivery/SKILL.md` and
  `docs/_plans/2026-08-24-automation-first-dely-design.md`: both active
  boundaries are already correct and positively checked.
- `git-hooks/pre-push` and `docs/harness-surface.md`: separate final-integration
  findings with separate owner decisions.
- Setup, manifests, README, harness configuration, installed plugin caches,
  hook wiring, pull-request merge state, and any new parser/test framework.

## Execution envelope

- **Protected dirty paths:** none; Control verifies a clean tree immediately
  before dispatch.
- **Branch/base/PR:** `automation-first-dely` against `origin/main`, draft PR
  `https://github.com/hieuphung97/dely/pull/15`.
- **Pins:** implementation uses Claude Code `sonnet` at `medium`; review uses a
  fresh Codex CLI `gpt-5.6-sol` at `high`; release uses Grok Build `grok-4.6`
  at `medium` under the frozen installed self-update contract.
- Workers may commit only their phase-owned paths. Release may push the named
  branch but may not merge or force-push.

## Tasks

### 1. Require a positive core in the active durable Decision subsection

**Behaviour.** The focused script rejects a complete current repository copy
whose active durable Decision replaces its capability paragraph with neutral
prose, even when harmless matching tokens remain outside that active subsection.
The untouched skill, approved design, and durable decision remain green.

**Direction.** First add a complete-copy decision fixture which replaces the
active capability paragraph with: “The design-method capability boundary is
intentionally unspecified here; another artifact owns it.” Keep the fixture's
historical tokens outside `decision_section` so whole-file presence cannot help.
Run the script and observe `expect_check_fail` report that this negative fixture
passed. Then extract the smallest positive core already common to the three
owners into one checker that also invokes the existing rejects. Keep the current
full skill/design checker as core plus its stricter, owner-specific assertions;
change the durable decision path and fixture wrapper from reject-only to core.

The durable core must require these executed claims, allowing the current prose
variants rather than a synonym catalogue:

- Dely owns the design outcome and approval boundary;
- user, project, and harness determine active skills/modes;
- Plan Mode names question/plan surfaces, artifact representation, and mode
  transitions under its constraints;
- compatible active skills refine methodology under normal instruction/tool
  precedence;
- Dely does not select or activate and does not emulate or compose; and
- neither mechanism bypasses approval.

Update finding 38's final paragraph to describe all three active-section
extractors, positive core, fuller skill/design assertions, and the neutral
decision fixture. Preserve its chronology and general lesson.

**Files.** Modify `tests/delivery-contract.sh` and `docs/findings.md` only.

**Interfaces.** Consume `control_section`, `design_methods_section`,
`decision_section`, `check_design_boundary_rejects`, and
`check_design_boundary_section`. Produce one small positive-core checker used by
all three active owners; retain the full checker for skill/design-only clauses.

- [ ] Add the complete-copy neutral-decision fixture using the existing
      decision wrapper.
- [ ] Run `bash tests/delivery-contract.sh`; expect non-zero with a diagnostic
      that the negative neutral-decision fixture passed, not a syntax failure.
- [ ] Add the shared core and route the decision path/wrapper through it.
- [ ] Run `bash tests/delivery-contract.sh`; expect `delivery-contract: ok`.
- [ ] Reproduce outside the repository that removing the decision boundary now
      fails for missing positive capabilities while the untouched copy passes.
- [ ] Reconcile finding 38, run every closure gate, inspect the fix-only diff,
      and create one implementation commit without pushing.

**Focused verification.** `bash tests/delivery-contract.sh`. RED is the named
negative fixture being accepted; GREEN is `delivery-contract: ok`, with an
out-of-repository neutral-decision copy rejected for missing positive claims.

**Document impact.** `docs/findings.md` must stop describing the decision owner
as reject-only and record why positive owner assertions are required.

### 2. Independently review the complete positive-owner contract

**Behaviour.** A fresh reviewer proves all three active owners reject their
named complete-copy regressions and that no unrelated behavior or path changed.

**Direction.** Review the full candidate from the new design baseline, not only
the last function. Reproduce: strict split in approved design, sole skill
ownership with historical tokens elsewhere, and neutral/absent durable decision
boundary. Run all closure gates. Do not edit the candidate.

**Files.** Read-only review of the baseline-to-candidate diff and owning
artifacts; result outside the repository.

**Interfaces.** Consume Task 1's exact commit and counterexamples. Produce one
role disposition and exact-HEAD evidence for release.

- [ ] Verify exact candidate HEAD and clean tree.
- [ ] Run the three complete-copy counterexamples outside the repository.
- [ ] Run all closure gates and inspect finding 38 against Git history.
- [ ] Return exactly one disposition without editing the candidate.

**Focused verification.** All three degraded copies exit non-zero for their
own active owner; the untouched repository prints `delivery-contract: ok`.

**Document impact.** None; review is read-only.

### 3. Close the accepted bounded replan

**Behaviour.** Release records the accepted unit, removes both transient plans,
runs gates on one exact HEAD, pushes normally to PR #15, and leaves the PR draft
because the two known integration findings remain.

**Direction.** Only after review accepts, append one five-column delivery-log
row covering this replan and the prior failed unit's actual review sequence.
Delete this plan and
`docs/_plans/2026-08-25-design-skill-plan-mode-boundary-plan.md`; preserve the
durable decision and finding. Run all gates, commit only closure paths, push the
exact branch normally, and verify local/upstream/remote/PR identity. Do not claim
whole-PR acceptance or passing CI.

**Files.** Modify `docs/delivery-log.md`; delete the two named transient plans.

**Interfaces.** Consume Task 2's `ACCEPT` and exact candidate HEAD. Produce the
closure commit and pushed exact-HEAD evidence.

- [ ] Append the five-column delivery-log row from observed facts only.
- [ ] Delete exactly the two transient plans.
- [ ] Run every closure gate and commit only closure paths.
- [ ] Push normally and verify exact local/upstream/remote/PR state.

**Focused verification.** The two plan paths are absent, the delivery-log row
has five columns, all closure gates pass, and the pushed remote branch equals
the local release HEAD.

**Document impact.** Durable learning remains in `docs/decisions.md` and finding
38; the transient plans leave no unique fact behind.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Every active owner contains the minimum capability boundary | `bash tests/delivery-contract.sh`, with the durable Decision routed through the shared positive core | A complete current copy replaces only the active durable capability paragraph with neutral “boundary unspecified” prose while matching historical tokens remain outside the extracted subsection | Scoped re-review at `2c7eb3e` proved this complete copy incorrectly printed `delivery-contract: ok`; Task 1 must add it as an in-script fixture and observe that fixture turn the script red before changing the checker |
| Owner-specific regressions remain rejected | The same focused script plus three out-of-repository complete-copy runs | Approved design gains the strict split; skill gives sole ownership to the skill with positives only in historical text; durable decision omits its boundary | Review at `2c7eb3e` proved the first two are rejected and the third is accepted; Task 1 changes only the third result, then Task 2 reproduces all three |
| The checker remains minimal and its finding is accurate | `git diff --check <baseline>..HEAD`, reviewer inspection, and finding 38 against Git history | A new synonym catalogue/parser is added, or finding 38 still describes the decision check as reject-only | No semantic oracle can prove prose minimality; reviewer reads the complete fix-only diff and exact historical commits |
| Existing automation-first behavior remains intact | All focused scripts and every closure gate in `AGENTS.md` | The fix weakens an existing fixture, changes phase/setup/deployment behavior, or touches either separate integration finding | Current gates are green at the design baseline; implementation must preserve them while the new fixture turns RED then GREEN |

**Cannot be observed:** static phrase checks cannot prove future model behavior or
all semantically equivalent prose. They deliberately protect the named active
owner claims and counterexamples, not arbitrary paraphrases.

## Stop conditions

- The durable decision cannot express the positive core without changing the
  approved capability contract.
- The neutral-decision fixture is not red for the named accepted-negative reason,
  or remains green after the checker change.
- A required edit falls outside implementation scope or overlaps new user work.
- Orca or a required pinned harness/model/effort is unavailable.
- Independent review does not accept; this new unit gets its own one-pass
  remediation allowance, but another non-accept after that returns to design.

## Closure gates

Run every command in the active `AGENTS.md` “Closure gates” section from
`/Users/hieuphung/Projects/dely`. The focused behavior instrument is:

```bash
bash tests/delivery-contract.sh
```

The load-bearing counterexample is the complete-copy active durable Decision
with neutral/absent boundary prose and harmless historical tokens elsewhere.
