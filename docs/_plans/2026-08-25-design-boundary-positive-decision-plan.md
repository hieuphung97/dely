# Positive Design Boundary Clause Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` and `superpowers:test-driven-development` for
> implementation. Dely's Orca phase dispatch remains authoritative; do not
> create in-harness subagents or worktrees.

**Goal:** Make the focused contract reject the four reviewed reverse-semantic
owners while retaining every approved skill, design, and durable-decision
formulation.

**Architecture:** Keep the existing active-section extractors, shared core, and
plain `grep -E` implementation. Replace four permissive token expressions with
literal clause-level alternatives and add four complete-copy decision fixtures;
do not add a parser, helper layer, dependency, or synonym catalogue.

**Tech Stack:** Bash, `awk`, `grep`, Git, and the existing shell contract tests.

**Spec:** `docs/decisions.md`, “2026-08-25 — Dely is an automation-first thin
control protocol”, including the positive-core semantic clarification.

## Global Constraints

- Preserve exact candidate history through
  `b1fc0399a58d4d3940e7c3d0d598779ab2fac0f1`; do not amend, squash, rebase,
  force-push, reset, stash, or clean.
- Implementation may modify only `tests/delivery-contract.sh` and
  `docs/findings.md`; this decision and plan commit is the immutable design
  baseline.
- Use the current checkout, one fresh implementation session, and one fresh
  independent review session. No worktree or in-harness subagent.
- The two separate integration findings in `git-hooks/pre-push` and
  `docs/harness-surface.md` remain forbidden.
- Keep `check_design_boundary_core`; add no parser, helper abstraction,
  dependency, or general paraphrase support.

---

Decision record: `docs/decisions.md`, “2026-08-25 — Dely is an
automation-first thin control protocol”

Prior review:
`/tmp/dely-design-boundary-positive-decision-rereview-b1fc039-result.md`

**Baseline:** Control resolves the commit carrying this decision amendment and
plan immediately before dispatch and supplies that exact SHA to every worker; a
commit cannot record its own SHA.

## Goal

Close the semantic discrimination gap found after the first plan's bounded
remediation. The checker must reject clauses that use the expected nouns while
asserting the opposite relationship. The owner prose, workflow behaviour,
phase/setup/deployment design, and the two separate integration findings are out
of reach.

## Allowed scope

```text
docs/decisions.md                                           design baseline only
docs/_plans/2026-08-25-design-boundary-positive-decision-plan.md
docs/_plans/2026-08-25-design-skill-plan-mode-boundary-plan.md closure only
docs/delivery-log.md                                        closure only
docs/findings.md
tests/delivery-contract.sh
```

The existing shell script is the colocated owner of this prose contract. No
registry or inventory enumerates these clauses.

## Forbidden scope

- `skills/delivery/SKILL.md` and
  `docs/_plans/2026-08-24-automation-first-dely-design.md`: their approved prose
  stays byte-identical; fixtures may copy and mutate it only outside the
  repository.
- `git-hooks/pre-push` and `docs/harness-surface.md`: separate final-integration
  findings with separate owner decisions.
- Setup, manifests, README, harness configuration, installed plugin caches,
  hook wiring, pull-request merge state, and any new parser/test framework.

## Execution envelope

- **Protected dirty paths:** none; Control verifies a clean tree immediately
  before dispatch.
- **Branch/base/PR:** `automation-first-dely` against `origin/main`, draft PR
  `https://github.com/hieuphung97/dely/pull/15`.
- **Pins:** implementation uses Claude Code `sonnet` at `medium`; review uses
  Codex CLI `gpt-5.6-sol` at `high`. This self-update retains the frozen
  installed release contract after review accepts.
- Workers may commit only their phase-owned paths. Release may push the named
  branch but may not merge or force-push.

## Tasks

### 1. Reject the four reverse-semantic owners

**Behaviour.** The focused script rejects complete current decision copies that
say refinement occurs outside Plan Mode constraints, permit Dely to
emulate/compose, permit approval bypass, or replace `design-outcome` with
`designXoutcome`. The real skill, approved design, full durable decision, and
compact-only durable decision all pass.

**Direction.** First add four complete-copy fixtures beside fixtures 2i–2m. Each
must mutate both live durable-decision formulations where both exist, call
`assert_decision_mutated`, and fail through `expect_check_fail` only after the
checker is corrected. Observe the current checker accepting each direct owner
before changing it.

Then change only these four positive-core expressions:

```text
design[- ]outcome and approval boundary

refine (exploration and design )?methodology within (those|its) constraints
|native constraints and question/plan/artifact/transition surfaces,
 compatible-skill refinement under normal precedence

does not select,? activate,?( configure,?)? emulate,? or compose
 (either mechanism|them)
|no Dely selection or composition

neither one owns or can bypass the approval invariant
|approval invariant remains authoritative in every harness and mode
|neither can bypass approval
|no approval bypass
```

Keep the separate no-select/no-activate and precedence assertions. Whitespace
may be represented with normal ERE spaces after the section has been flattened;
do not broaden the alternatives beyond the four approved owners.

Update finding 38 so it says the core matches approved clauses and the four
reverse-semantic fixtures, not that disconnected keyword checks enforce those
relationships.

**Files.** Modify `tests/delivery-contract.sh` and `docs/findings.md` only.

**Interfaces.** Consume `decision_section`, `assert_decision_mutated`,
`expect_check_fail`, and `check_design_boundary_core`. Preserve their names and
call shape; produce no new shared helper.

- [ ] Add the four complete-copy mutations and invoke the direct decision-core
      checker for each.
- [ ] Run each mutated copy against the unchanged core; record four status-zero
      outcomes as RED evidence because the wrong owners are accepted.
- [ ] Replace only the four permissive expressions above.
- [ ] Run `bash tests/delivery-contract.sh`; expect `delivery-contract: ok`.
- [ ] Re-run the four direct owner checks; expect non-zero with the matching
      diagnostic, while the three real owners and compact-only decision pass.
- [ ] Reconcile finding 38, run every closure gate, inspect the baseline-only
      diff, and create one implementation commit without pushing.

**Focused verification.** `bash tests/delivery-contract.sh`. Before the regex
change, the four executable reverse-semantic owners return success; after it,
their in-script negative fixtures are rejected and the script prints
`delivery-contract: ok`.

**Document impact.** `docs/findings.md` owns the checker's observed history and
must describe its actual clause-level limit.

### 2. Independently review the clause-level contract

**Behaviour.** A fresh reviewer proves that the four reviewed counterexamples
are rejected, all approved owner formulations remain accepted, and no unrelated
path or behaviour changed.

**Direction.** Review the whole candidate from the new design baseline. Rebuild
the four complete-copy counterexamples outside the repository instead of merely
trusting the fixtures. Run the focused script and every closure gate. Review and
report only; do not edit the candidate.

**Files.** Read-only review of the baseline-to-candidate diff and owning
artifacts; result outside the repository.

**Interfaces.** Consume Task 1's exact commit and counterexamples. Produce one
role disposition and exact-HEAD evidence for Control.

- [ ] Verify exact candidate HEAD and clean tree.
- [ ] Reproduce all four reverse-semantic complete-copy counterexamples.
- [ ] Verify the shipped skill, approved design, full decision, and compact-only
      decision pass their direct owner checks.
- [ ] Run all closure gates and inspect finding 38 against the implementation.
- [ ] Return exactly one disposition without editing the candidate.

**Focused verification.** Each degraded copy exits non-zero for its named
diagnostic; the untouched repository prints `delivery-contract: ok`.

**Document impact.** None; review is read-only.

### 3. Close only the accepted replan

**Behaviour.** Release records the accepted unit, removes both transient plans,
runs gates on one exact HEAD, and updates the draft pull request without merging
or force-pushing.

**Direction.** Only after review accepts, append one five-column delivery-log row
covering the failed prior unit and this replan's actual rounds. Delete this plan
and `docs/_plans/2026-08-25-design-skill-plan-mode-boundary-plan.md`; preserve the
durable decision and finding. Follow the frozen installed self-update release
contract, run every gate, commit only closure paths, push normally, and verify
local/upstream/remote/PR identity. Do not claim whole-PR acceptance or passing CI
without current forge evidence.

**Files.** Modify `docs/delivery-log.md`; delete the two named transient plans.

**Interfaces.** Consume Task 2's `ACCEPT` and exact candidate HEAD. Produce the
closure commit and exact-HEAD release evidence.

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
| Constraints and refinement remain affirmatively coupled | `bash tests/delivery-contract.sh` plus a direct decision-core check over a complete copy | Both live decision formulations retain the expected nouns but say compatible-skill refinement occurs **outside** Plan Mode constraints | Independent re-review of `b1fc0399a58d4d3940e7c3d0d598779ab2fac0f1` returned `owner_core_status=0`; report path above |
| Emulation and composition remain explicitly prohibited | The same focused script and direct complete-copy check | Both live formulations say Dely **may emulate or compose** and that composition is permitted | The same re-review returned `owner_core_status=0` |
| Approval bypass remains explicitly prohibited | The same focused script and direct complete-copy check | The full formulation says neither rule prevents bypassing approval and the compact form leaves approval unspecified | The same re-review returned `owner_core_status=0` |
| `design outcome` permits only the approved space/hyphen spelling | The same focused script and direct complete-copy check | Both live formulations replace the separator with `X`, producing `designXoutcome` | The same re-review returned `owner_core_status=0` |
| Approved owner variants remain accepted | Direct section checks for the shipped skill, approved design, full decision, and compact-only decision | A checker that recognizes only the full durable paragraph rejects the compact approved clarification | The prior remediation's compact-only direct check returned `owner_core_status=0`; Task 1 must preserve it after tightening |
| Scope stays minimal and finding 38 stays accurate | `git diff --check <baseline>..HEAD`, reviewer diff inspection, and finding 38 against the final checker | A parser/helper/synonym catalogue is added, or finding 38 still claims token presence proves semantic relationships | No deterministic instrument can prove prose minimality; the reviewer reads the complete diff and finding |

**Cannot be observed:** literal clause checks do not interpret arbitrary future
paraphrases or prove model behaviour. They protect the four current approved
owner formulations and named reverse-semantic counterexamples only.

## Stop conditions

- An approved owner cannot pass without broadening beyond its existing clause.
- A reverse-semantic fixture does not change the extracted `decision_section` or
  fails for a diagnostic unrelated to its mutation.
- A required edit falls outside implementation scope or overlaps new user work.
- Orca or a required pinned harness/model/effort is unavailable.
- Independent review does not accept; this new unit receives one in-contract
  remediation allowance, then returns to design on another non-accept.

## Closure gates

Run every command in the active `AGENTS.md` “Closure gates” section from
`/Users/hieuphung/Projects/dely`. The focused behaviour instrument is:

```bash
bash tests/delivery-contract.sh
```

The load-bearing counterexamples are the four complete-copy reverse-semantic
decision owners named in the acceptance table.
