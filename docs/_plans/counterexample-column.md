# Plan — an acceptance row names the wrong implementation it rejects

Decision record: `docs/decisions.md`, "2026-08-21 — Baseline-red is not
discrimination; an acceptance row names the wrong implementation it rejects"

**Baseline:** the SHA of the commit carrying that decision record and this plan.

## Goal

`skills/delivery/SKILL.md` names baseline-red as insufficient and requires each
acceptance row to name a plausible wrong implementation its instrument rejects.
`skills/delivery/templates/plan.md` carries the four-column acceptance table.
`tests/plan-template-shape.sh` refuses a template that has lost either column, and
the closure gate list runs it. The package moves to `0.7.0`.

Out of reach: any change to the four phases, their dispositions, the handoff shape,
the delivery log, the hooks, `bin/delivery-doctor`, or `bin/delivery-evidence`.
Nothing here lints a live plan.

## Allowed scope

```
skills/delivery/SKILL.md               Acceptance and implement sections
skills/delivery/templates/plan.md      four-column table
tests/plan-template-shape.sh           new focused instrument
AGENTS.md                              gate list
.claude-plugin/plugin.json             version
.codex-plugin/plugin.json              version
```

Carried without being listed, checked rather than assumed:

- **Colocated tests of allowed source.** `skills/` has no colocated tests; the
  focused instrument for the template goes in `tests/`, matching
  `tests/managed-block-contract.sh` and `tests/delivery-doctor-grok-hook.sh`.
- **Registry or inventory tests.** Checked: none enumerate skill files or template
  files. This yielded nothing.
- **Documents owning an allowed path.** `README.md` names
  `skills/delivery/templates/` in its layout listing but does not describe the
  acceptance table's shape, so it needs no change — verified by grep, not assumed.
  `AGENTS.md` owns the gate list and does need one.

## Forbidden scope

- `hooks/session-start-context.sh`, `hooks/post-tool-journal.sh` — `AGENTS.md`
  forbids editing either while a plan runs; Grok executes them by absolute path.
- `bin/delivery-doctor`, `bin/delivery-evidence`, `tests/managed-block-contract.sh`,
  `tests/delivery-doctor-grok-hook.sh` — this unit adds an obligation to a
  document, not a capability to a program. `tests/managed-block-contract.sh` is
  name-adjacent and unrelated.
- `docs/findings.md`, `docs/harness-surface.md` — no new observation here.
- `docs/delivery-log.md` — release appends its row; implement does not.
- `skills/setup/SKILL.md` — the acceptance contract is `delivery`'s.

## Tasks

### 1. The skill names baseline-red as insufficient and requires a counterexample

**Behaviour.** A worker reading `SKILL.md`'s Acceptance section is told that an
instrument going red because the feature is absent proves nothing about
discrimination, and that each row must name a plausible wrong implementation the
instrument rejects.

**Direction.** Edit the existing Acceptance section rather than appending a new
one; `SKILL.md` is short on purpose and this replaces a weaker sentence with a
stronger one. Keep the recorded count and update it to nine, since the count is the
evidence the rule exists at all.

State the distinction in the skill's own register — the failure, not the advice.
The ninth occurrence is concrete and belongs in one clause: an instrument was
observed red at baseline for the right reason, and still could not tell a doctor
that reads the whole file from one bounded by the markers.

Add the matching half to the implement section: the counterexample named in the
plan is observed red and cited, alongside the existing rule about observing the
behaviour's own failure. Do not merge the two rules — they are about different
things, and the decision record says so.

**Files.** `skills/delivery/SKILL.md`.

**Focused verification.** `tests/plan-template-shape.sh` asserts the Acceptance
section names baseline-red as insufficient. Counterexample it must reject: a
`SKILL.md` that mentions the word `counterexample` only in the implement section,
leaving Acceptance unchanged.

**Document impact.** None beyond the template — verified by grep that no document
describes the acceptance table's shape except `templates/plan.md`.

### 2. The plan template carries the four-column table

**Behaviour.** A plan copied from the template has a four-column acceptance table:
`Requirement | Instrument | Counterexample | Observed red`, with instructions
saying which phase fills which column and that an empty cell is an unfinished row.

**Direction.** Replace the three-column table and the paragraph under it. Say
plainly that "the feature is absent" does not satisfy Counterexample, and that a
row with no counterexample must say so and say a human reads the diff — that
escape stays legal and is recorded as worth keeping only when someone actually
reads it.

**Files.** `skills/delivery/templates/plan.md`.

**Focused verification.** `tests/plan-template-shape.sh`, header-row assertion.

**Document impact.** None. `README.md` lists the file but not its shape.

### 3. A focused instrument that refuses a degraded template

**Behaviour.** `bash tests/plan-template-shape.sh` passes on the repository's own
template and skill, and fails on each degradation below.

**Direction.** Fixture-driven, in the style of `tests/delivery-doctor-grok-hook.sh`:
copy the template and the skill into a scratch directory, degrade one thing, run
the check against the copy, assert failure. The check must take the directory to
inspect as an argument or read from an environment variable, or the negative cases
cannot be driven without editing the repository — decide which and state it.

Cases, each of which must be distinguishable:

1. the repository's own template and skill — pass
2. acceptance table reduced to the three old columns — fail
3. four columns present but `Counterexample` renamed — fail
4. four columns present but `Observed red` renamed — fail
5. the word `Counterexample` appears only in prose under the table, header row
   still three columns — fail
6. `SKILL.md` mentions counterexamples only in its implement section, Acceptance
   section unchanged — fail
7. template header has the four correct names plus a fifth column — pass, because
   the contract is that those four exist, not that nothing else may

Case 5 is the one that stops this from being a grep for the word. Case 7 states
which way the check is permissive on purpose.

**Files.** `tests/plan-template-shape.sh`.

**Focused verification.** The test is its own instrument. It must be observed
failing against the unmodified `0.6.0` template before task 2 lands — record which
case failed and why, and note that case 1 failing at that point is the expected
baseline-red, not the discrimination proof.

**Document impact.** `AGENTS.md` owns the gate list and must run it.

### 4. Version and gates

**Behaviour.** Both manifests declare `0.7.0`, and `AGENTS.md`'s gate list runs the
new instrument and parses it under `bash -n`.

**Direction.** `0.6.0` to `0.7.0` in `.claude-plugin/plugin.json` and
`.codex-plugin/plugin.json`. Add `bash tests/plan-template-shape.sh` as a gate and
add the file to the `bash -n` gate, or the gate exists and nothing runs it — the
failure mode the previous unit hit.

**Files.** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `AGENTS.md`.

**Focused verification.** `tests/plan-template-shape.sh` asserts both manifests
parse, agree on the version, and are not `0.6.0`.

**Document impact.** This task is the reconciliation for tasks 1 to 3.

## Acceptance

This plan's own table uses the shape it introduces. That is deliberate: if the
shape is unusable, this is where it shows.

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| The skill names baseline-red as insufficient | `bash tests/plan-template-shape.sh`, skill case | A `SKILL.md` that adds the counterexample rule only to its implement section and leaves Acceptance untouched — it contains the word, reads as compliant, and still lets a designer write `Yes` | to be filled by implement |
| The template carries the four named columns | same test, header-row case | A template whose header row is the three old columns while a paragraph beneath it describes counterexamples in prose — a word-grep passes it | to be filled by implement |
| The check refuses a renamed column | same test, cases 3 and 4 | A check that counts four pipe-separated cells without reading their names, so `Requirement \| Instrument \| Notes \| Evidence` passes | to be filled by implement |
| The check is permissive about extra columns | same test, case 7 | A check asserting the header equals exactly four columns, which would break any project adding an owner column | to be filled by implement |
| Both manifests declare the bumped version | same test, manifest case | Bumping one manifest and not the other, which a single-file assertion passes | to be filled by implement |
| The gate list runs the new instrument | `AGENTS.md` gate list, read by review | A test file added to the repository and never named in `AGENTS.md`, which every existing gate passes because nothing runs it | to be filled by implement |
| Existing rails still pass | `bash tests/managed-block-contract.sh`, `bash tests/delivery-doctor-grok-hook.sh`, `bash tests/delivery-evidence-pipeline.sh` | Not applicable — these are regression guards, not new contract. They discriminate for their own contracts, proven in earlier units | n/a |

**Cannot be observed:** whether a future designer writes a *good* counterexample.
The column makes an empty cell visible; it cannot make a lazy sentence red. Nothing
here proves the rule changes behaviour in a real delivery — the first plan written
against `0.7.0` is that evidence, and it is not this one.

Also unobserved: this plan is written by the session that wrote the rule, so it is
the least likely plan ever to violate it. That is not evidence the shape works for
someone else.

## Stop conditions

- Rewriting the Acceptance section forces a change to the implement section's
  existing observe-a-real-failure rule. The decision record says the two obligations
  stay separate; merging them is a contract change this plan did not decide.
- The focused check cannot be driven against a degraded copy without editing the
  repository's own template. Then the check is untestable and its own acceptance
  rows are the very thing this unit exists to forbid.
- The four-column table cannot be expressed without breaking the template's
  readability at a normal terminal width, such that a worker would reformat it back.

Assumption not verified for every environment: the test must pass on a machine with
no harness CLI installed. It inspects files only, so it must not call `claude`,
`codex`, `grok`, `orca`, or require a git repository.

## Closure gates

All from the repository root.

```
git diff --check

bash -n bin/delivery-doctor bin/delivery-evidence git-hooks/pre-push \
  hooks/post-tool-journal.sh hooks/session-start-context.sh \
  tests/managed-block-contract.sh tests/plan-template-shape.sh

jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json \
  .codex-plugin/plugin.json hooks/hooks.json hooks/grok-hooks.json.template >/dev/null

bash tests/delivery-evidence-pipeline.sh

bash tests/delivery-doctor-grok-hook.sh

bash tests/managed-block-contract.sh

bash tests/plan-template-shape.sh

git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

Report every gate with the exact command, the summary line verbatim, and the exit
code. `$?` after a pipe reports the last command in the pipe, not the gate. Never
background a gate.
