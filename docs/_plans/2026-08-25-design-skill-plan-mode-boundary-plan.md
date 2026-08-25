# Plan — Define the design-skill and native Plan Mode boundary by capability

Decision record: `docs/decisions.md`, “2026-08-25 — Dely is an
automation-first thin control protocol”

Approved design: `docs/_plans/2026-08-24-automation-first-dely-design.md`,
“Design methods and Plan Mode”

**Baseline:** Control resolves the commit carrying the corrected decision,
approved design, research addendum, and this plan with `git rev-parse HEAD`
immediately before dispatch and supplies that exact SHA to every worker. It is
not copied into this file from memory.

## Goal

Replace the false strict split between design skills and native Plan Mode with a
portable capability boundary: Dely owns the approved-design outcome, Plan Mode
governs its native constraints and surfaces, and compatible active skills refine
methodology within those constraints. Dely still does not select or compose
either mechanism. The two other findings from the final integration review are
outside this unit.

## Allowed scope

```text
docs/_plans/2026-08-24-automation-first-dely-design.md       design baseline only
docs/_plans/2026-08-24-design-method-ownership-research.md  design baseline only
docs/_plans/2026-08-25-design-skill-plan-mode-boundary-plan.md
docs/decisions.md                                            design baseline only
docs/delivery-log.md                                         closure only
docs/findings.md
skills/delivery/SKILL.md
tests/delivery-contract.sh
```

The focused contract test is the colocated owning test for the delivery skill.
No separate registry or inventory enumerates this prose contract. The approved
design, research record, and durable decision own claims changed by this unit and
are included explicitly rather than through carried scope.

## Forbidden scope

- `git-hooks/pre-push` and `docs/harness-surface.md`: they own the other two
  integration-review findings and require separate owner decisions.
- `skills/setup/SKILL.md`: its absence of Plan Mode and design-skill setup fields
  remains correct under the new boundary.
- Harness configuration, installed plugin caches, hooks, manifests, README, and
  PR merge state: this unit changes no deployment or compatibility surface.
- Historical reasoning below the explicit superseding addendum in
  `docs/_plans/2026-08-24-design-method-ownership-research.md`.

## Execution envelope

- **Protected dirty paths:** none; Control verified a clean tree at
  `7e13c0c1f9fb64cc6696d044f63726f29575f463` before writing the design
  correction.
- **Branch/base/remote/PR target:** `automation-first-dely` against
  `origin/main`, published through draft PR
  `https://github.com/hieuphung97/dely/pull/15`.
- **Resolved phase pins:** implementation uses Claude Code `sonnet` at `medium`;
  review uses a fresh Codex CLI `gpt-5.6-sol` at `high`; release uses Grok Build
  `grok-4.6` at `medium` under the frozen installed self-update contract.
- **Authority:** workers use the current checkout and may commit only their phase's
  owned paths. No worktree or in-harness subagent is permitted. The unit may run
  gates and push the named branch; it may not merge, force-push, rebase, stash,
  reset, clean, edit installed plugin caches, or absorb the two forbidden
  findings.

## Tasks

### 1. Make the focused contract reject the strict ownership split

**Behaviour.** `tests/delivery-contract.sh` validates the capability boundary in
the active delivery skill and the owning design/decision surfaces, and rejects a
complete-looking contract that assigns design methodology exclusively to a skill
while reducing Plan Mode to gating and approval UI.

**Direction.** Add a checker scoped to the active control/design paragraphs. It
must require Dely's outcome/approval boundary, Plan Mode's native constraints and
question/plan surfaces, compatible skill methodology, normal harness precedence,
and no Dely selection or composition. Reject the old “design ownership is split”
and “active skill or native Plan Mode owns the design method” shapes. Add at least
one degraded copy of an otherwise-current owning artifact. Run the strengthened
test before editing `skills/delivery/SKILL.md`; a valid RED is the boundary
diagnostic, not syntax or fixture failure.

**Files.** `tests/delivery-contract.sh`; read the three corrected owning design
artifacts and `skills/delivery/SKILL.md`.

**Focused verification.** `bash tests/delivery-contract.sh` first exits non-zero
because the shipped skill retains the strict split, then prints
`delivery-contract: ok` after Task 2. The degraded fixture remains rejected after
GREEN.

**Document impact.** The test protects the approved design and durable decision
already corrected in the baseline; no new test framework or dependency is added.

### 2. Align the portable delivery skill and record why the old green check missed it

**Behaviour.** The active Control section states the approved capability boundary
without claiming exclusive ownership for either a design skill or Plan Mode.

**Direction.** Replace only the strict-split paragraph in
`skills/delivery/SKILL.md`. Preserve the approval invariant, material-uncertainty
rule, no-selection rule, and Plan Mode defense-in-depth limit. Append one concise
finding to `docs/findings.md`: the final review found a real contradiction, deeper
primary-source research disproved its suggested strict-split repair, and the old
test stayed green because it checked only Plan Mode approval bypass rather than
ownership capabilities across active surfaces.

**Files.** `skills/delivery/SKILL.md`, `docs/findings.md`, and
`tests/delivery-contract.sh`.

**Focused verification.** Run `bash tests/delivery-contract.sh`, then the other
two focused scripts and every closure gate in `AGENTS.md`. Commit only Task 1–2
implementation paths and return the exact commit and clean Git state.

**Document impact.** `docs/findings.md` owns the observed correction. The approved
design, durable decision, and prior research record were reconciled in the design
baseline and must not be rewritten by the implementer.

### 3. Independently review and close the bounded correction

**Behaviour.** A fresh reviewer reproduces the strengthened counterexample and
all closure gates without editing the candidate. The frozen release worker then
records only observed closure facts, deletes this transient plan, pushes the exact
HEAD, and leaves PR #15 draft because two known integration findings remain.

**Direction.** Review requirements and behavior before wording. A first
in-contract change request may use the single bounded remediation; another
non-accept returns to design. Release appends one five-column delivery-log row,
deletes only this plan, runs all gates, commits those closure paths, pushes
normally, and does not claim whole-PR acceptance or passing CI.

**Files.** Review is read-only. Release may modify only `docs/delivery-log.md` and
delete `docs/_plans/2026-08-25-design-skill-plan-mode-boundary-plan.md`.

**Focused verification.** Reviewer runs `bash tests/delivery-contract.sh` and its
degraded fixture through the script, all `AGENTS.md` closure gates, and
`git diff --check <baseline>..HEAD`. Release re-runs the gates at its exact HEAD
and confirms local/upstream/remote/PR identity after push.

**Document impact.** The delivery-log row records only the observed rounds,
review dispositions, and drift cause. The remaining integration findings stay
open and explicit.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| The portable skill uses capability boundaries rather than a strict ownership split | `bash tests/delivery-contract.sh`, scoped to the active Control/design contract | A complete automation-first skill retains approval and Plan Mode language but says the skill exclusively owns exploration/questions/design while Plan Mode owns only gating and approval UI | Not yet observed: Task 1 must add the checker and run it against the unmodified shipped skill before Task 2 |
| Approved design, durable decision, and portable skill describe one boundary | The same focused script checks the active owning paragraphs and a degraded current-decision fixture | The skill is corrected, but the current durable decision says the active skill or Plan Mode owns the whole design method, so whole-file token checks still pass | Final integration review at `7e13c0c` observed this contradiction; Task 1 must additionally prove the degraded fixture is rejected |
| Dely does not become a composition engine or duplicate approval ceremony | Focused script plus reviewer diff inspection | The correction selects or activates a design mechanism, promises universal composition, or requires two approvals for an unchanged scope | No executable semantic oracle covers all future prose interpretations; the focused checker rejects the named shapes and the reviewer reads the complete owning paragraphs |
| Existing automation-first behavior remains intact | All three focused scripts and every closure gate in `AGENTS.md` | The new checker weakens an existing fixture, changes setup/deployment, or reintroduces a removed rail | Existing gates are green at the design baseline; implementation must preserve them while turning the new checker from RED to GREEN |

**Cannot be observed:** static shell checks cannot prove future model compliance or
that every future harness Plan Mode preserves the same instruction shape. The
contract deliberately relies on each harness's native precedence instead of
claiming a portable composition implementation.

## Stop conditions

- The capability boundary cannot be expressed without selecting or composing a
  design mechanism in Dely.
- The focused checker passes before the skill correction, fails for an unrelated
  reason, or cannot reject a present-but-wrong degraded owning artifact.
- A required edit falls outside Allowed scope or overlaps new user work.
- Orca, a pinned harness/model/effort, or exact-HEAD Git/PR identity is
  unavailable.
- A scoped re-review after one remediation does not accept.

## Closure gates

Run every command in the `AGENTS.md` “Closure gates” section from
`/Users/hieuphung/Projects/dely`. The changed behavior's focused instrument is:

```bash
bash tests/delivery-contract.sh
```

Its named failure mode is the complete-looking strict-split contract described
in the acceptance table. Do not treat the disclosure greps as proof that the
semantic boundary is correct.
