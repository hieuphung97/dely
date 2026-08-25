# Review disposition and taxonomy reconciliation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task inside the
> Orca-dispatched worker TUI. Do not launch in-harness subagents or create a
> worktree.

**Goal:** Align the shipped reviewer vocabulary and active project taxonomy with
the approved automation-first design, then return PR #15 to one accepted exact
HEAD.

**Architecture:** Keep reviewer observations separate from Control routing.
Strengthen the existing shell contract check first, then make the two smallest
owning-text corrections and record why the former green gates missed them. No
runtime component, new abstraction, dependency, compatibility path, or release
mechanism is added.

**Tech Stack:** Markdown contracts, POSIX shell fixtures, Git, Orca, and GitHub
CLI.

**Spec:** `docs/_plans/2026-08-24-automation-first-dely-design.md`, especially
“Review and remediation”; durable clarification in `docs/decisions.md`,
“2026-08-25 — Dely is an automation-first thin control protocol”.

## Global constraints

- Repository artifacts are English; conversation remains Vietnamese.
- Work only in the current checkout and branch `automation-first-dely`.
- Orca is mandatory. Do not use a headless harness fallback, worktree, or
  in-harness subagent.
- Preserve all unrelated user work and every historical occurrence of the old
  vocabulary outside active owning surfaces.
- Do not merge, force-push, rebase, stash, reset, clean, mutate installed plugin
  caches or hooks, or change any file outside Allowed scope.
- One implementation pass and at most one original-party remediation are
  permitted. A second non-accept returns to design.

## Execution envelope

- **Protected dirty paths:** none; Control verified a clean tree at
  `de85132e66ff0514e79c38ff5c589fe971c6a441` before writing this plan.
- **Baseline:** Control commits this plan and the durable decision clarification,
  resolves that commit with `git rev-parse HEAD`, and supplies the exact SHA to
  every worker. No worker copies a baseline from memory.
- **Branch/base/remote/PR target:** `automation-first-dely` against
  `origin/main`, published through draft PR
  `https://github.com/hieuphung97/dely/pull/15`.
- **Resolved phase pins:** implementation uses Claude Code `sonnet` at `medium`;
  review uses Codex CLI `gpt-5.6-sol` at `high`. The final integration reviewer
  is a different fresh Codex session.
- **Authority:** the implementer may edit and commit only Allowed scope. Control
  may push the named branch, update the existing draft PR, perform closure
  metadata edits, and mark the PR ready only after the final exact-HEAD review
  accepts. Human merge remains required.

## Allowed scope

```text
AGENTS.md
docs/_plans/2026-08-25-review-disposition-taxonomy-reconciliation-plan.md
docs/decisions.md
docs/delivery-log.md                 closure only
docs/findings.md
skills/delivery/SKILL.md
tests/delivery-contract.sh
```

`docs/delivery-log.md` is not implementation scope. At closure, Control updates
the existing `automation-first-dely` row with the observed final block and adds
one row for this accepted plan before deleting this transient plan.

## Forbidden scope

- The approved automation-first design: it is the contract being implemented,
  not an artifact to rewrite around the defect.
- `skills/setup/SKILL.md`, templates, manifests, README, harness evidence, and
  removed rails: final review found those coherent.
- Historical `Planned`, `REMEDIATE_ONCE`, and `REPLAN_OR_SPLIT` observations in
  decisions, findings, options, fixtures, and old delivery-log rows. History
  remains factual and explicitly historical.
- PR merge or publication outside PR #15.

## Task 1: Make the focused contract reject role/routing conflation and stale taxonomy

**Files:**

- Modify: `tests/delivery-contract.sh`
- Read: `skills/delivery/SKILL.md`, `AGENTS.md`, the approved design

**Interfaces:**

- Consumes: the active `## Review` section and the active repository closure
  paragraph.
- Produces: one focused script that rejects both exact present-but-wrong shapes
  while preserving all existing negative fixtures.

- [ ] **Step 1: Add a scoped reviewer-disposition checker.** Extract only the
  active `## Review` section through `### Remediation`; require the role values
  `ACCEPT`, `CHANGES_REQUESTED`, and `BLOCKED`, and reject a sentence that tells
  the reviewer to return `REMEDIATE_ONCE` or `REPLAN_OR_SPLIT`. Do not use a
  whole-file grep that can be satisfied by implementation stop statuses or
  Control routing elsewhere.

```sh
review_section() {
  awk '/^## Review$/ { p = 1 } p && /^## / && !/^## Review$/ { exit } p { print }' "$1"
}
```

- [ ] **Step 2: Add the degraded role fixture.** Start from the shipped skill so
  the rest of the automation-first contract remains complete, replace only the
  active reviewer disposition paragraph with
  `ACCEPT`, `REMEDIATE_ONCE`, or `REPLAN_OR_SPLIT`, and require the checker to
  reject it. This is the exact failure the previous green suite missed.
- [ ] **Step 3: Add an active-taxonomy checker.** Read the current `AGENTS.md`
  closure paragraph and require the focused-instrument rule to apply to
  `Bounded or Architectural` runtime-behaviour changes. Reject `A Planned
  change` only in that active paragraph; do not reject historical prose.
- [ ] **Step 4: Add a degraded AGENTS fixture.** Copy the otherwise-correct
  active instructions, replace only the focused-instrument subject with
  `Planned`, and require rejection.
- [ ] **Step 5: Run the strengthened script before changing production text.**

```bash
bash tests/delivery-contract.sh
```

Expected: non-zero with both the reviewer-disposition and active-taxonomy
diagnostics. A syntax error, missing fixture, or failure in an old check is not a
valid RED observation. Record the exact diagnostics in this plan's acceptance
table before proceeding.

## Task 2: Correct the two owning contracts and record the missed distinction

**Files:**

- Modify: `skills/delivery/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `docs/findings.md`
- Modify only if the committed clarification needs wording correction:
  `docs/decisions.md`
- Test: `tests/delivery-contract.sh`

**Interfaces:**

- Consumes: the two RED diagnostics from Task 1.
- Produces: reviewer role outputs that Control can route without conflation, and
  an active project rule attached to live work shapes.

- [ ] **Step 1: Correct reviewer output vocabulary.** The Review section must
  state exactly:

```text
Return exactly one role disposition: ACCEPT, CHANGES_REQUESTED, or BLOCKED.
```

Keep runtime completion separate. A first in-contract `CHANGES_REQUESTED` is
routed by Control to the single original-party remediation; a scoped re-review
that does not accept routes to `REPLAN_OR_SPLIT`. `BLOCKED` preserves the
candidate and escalates the unresolved dependency or authority question; a
failed worker process is not `BLOCKED`.

- [ ] **Step 2: Correct the active project taxonomy.** Replace only the closure
paragraph's `A Planned change` subject with `A Bounded or Architectural change`.
Do not rewrite historical records.
- [ ] **Step 3: Append one concise finding.** Add §37 to `docs/findings.md`:
  final exact-HEAD review found role dispositions replaced by Control routes and
  one active `Planned` residue; the focused suite stayed green because it checked
  only `REPLAN_OR_SPLIT` presence and did not inspect the active AGENTS subject.
  Record the standing distinction and the new counterexamples, without copying
  transient task history.
- [ ] **Step 4: Run focused verification green.**

```bash
bash tests/delivery-contract.sh
bash tests/managed-block-contract.sh
bash tests/plan-template-shape.sh
```

Expected: all three print their `: ok` line.

- [ ] **Step 5: Run every closure gate in `AGENTS.md`, inspect
  `git diff --name-only <baseline>...HEAD`, commit only the implementation paths,
  and verify a clean tree.**

Suggested commit message:

```text
fix: separate reviewer outcomes from control routing
```

## Task 3: Review, exact-HEAD closure, and PR convergence

**Files:**

- Closure update: `docs/delivery-log.md`
- Closure delete:
  `docs/_plans/2026-08-25-review-disposition-taxonomy-reconciliation-plan.md`
- External state: draft PR #15

**Interfaces:**

- Consumes: the implementation commit, focused RED/GREEN record, and PR #15.
- Produces: one accepted exact HEAD with no post-review repository mutation and
  an open PR ready for human merge.

- [ ] **Step 1: Dispatch a fresh task reviewer.** It independently reproduces
  both counterexamples and all closure gates. Its role disposition must be one
  of `ACCEPT`, `CHANGES_REQUESTED`, or `BLOCKED`. A first
  `CHANGES_REQUESTED` may use the single original-party remediation; another
  non-accept returns to design.
- [ ] **Step 2: After task-review acceptance, Control performs closure metadata.**
  Update the existing `automation-first-dely` log row so its historical sequence
  includes the observed final `RELEASE_BLOCKED`; add one five-column row for
  `review-disposition-taxonomy-reconciliation` using only dispositions already
  observed for this plan; delete this transient plan; commit those closure facts.
- [ ] **Step 3: Run every gate at the new exact HEAD, push normally, and update
  PR #15's body to name that HEAD without claiming final acceptance or CI.**
- [ ] **Step 4: Dispatch a different fresh integration reviewer on the pushed
  exact HEAD.** It reviews the whole PR range, the two closure edits, Git/PR
  identity, and the empty-CI boundary. No repository mutation follows its
  verdict.
- [ ] **Step 5: If and only if final review returns `ACCEPT`, verify local HEAD,
  upstream, remote head OID, PR head OID, clean tree, and absence of configured
  workflows/checks. Mark PR #15 ready and report it for human merge. Never merge.**

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Reviewer role output remains separate from Control routing | `bash tests/delivery-contract.sh`, scoped to active `## Review` | A complete automation-first skill tells the reviewer to return `REMEDIATE_ONCE` or `REPLAN_OR_SPLIT`, while `BLOCKED` appears elsewhere and a whole-file grep passes | Observed at baseline `1cc24eac8975b4d6c62005487325b553d2ab774e`, before production edits: `FAIL: shipped delivery skill failed the contract check`, `FAIL: reviewer disposition sentence omits CHANGES_REQUESTED`, `FAIL: reviewer disposition sentence omits BLOCKED`, `FAIL: reviewer disposition sentence tells the reviewer to return REMEDIATE_ONCE, a Control routing decision` |
| The repository-specific focused-instrument rule uses live work shapes | `bash tests/delivery-contract.sh`, scoped to the active AGENTS closure paragraph | An otherwise-current AGENTS block routes Bounded/Architectural work correctly but leaves the instrument rule attached only to nonexistent `Planned` work | Observed at baseline `1cc24eac8975b4d6c62005487325b553d2ab774e`, before production edits: `FAIL: active AGENTS.md closure paragraph failed the taxonomy check`, `FAIL: active focused-instrument rule is attached to nonexistent Planned work, not Bounded or Architectural`, `FAIL: active focused-instrument rule does not apply to Bounded or Architectural work`; overall `delivery-contract: 2 failure(s)` |
| Existing automation-first behavior is not weakened | all three focused scripts plus every `AGENTS.md` closure gate | Fixing vocabulary deletes an existing negative fixture, reintroduces a removed rail, or relaxes exact-HEAD/no-worker release | Existing scripts are green at the design baseline; implementation must keep every old fixture green while the two new fixtures turn from RED to GREEN |
| Closure and PR state bind to one final HEAD | Git identity, `gh pr view 15`, final independent review | The log/plan closure commit changes extra paths, PR #15 points elsewhere, or repository files change after final review | PR #15 currently points to clean release-blocked HEAD `de85132e`; final evidence is intentionally available only after Task 3 |

Static shell checks prove shipped text shape and selected malformed fixtures, not
future model compliance. The repository has no configured GitHub workflows, so
an empty check rollup is reported as no CI surface, never as a passing CI run.

## Stop conditions

- The approved design itself must change rather than be implemented.
- A required edit falls outside Allowed scope or overlaps new user work.
- Either new negative fixture cannot distinguish the present-but-wrong contract.
- Orca, a pinned harness/model/effort, GitHub authority, or exact-HEAD identity is
  unavailable.
- A scoped re-review after one remediation does not accept.
