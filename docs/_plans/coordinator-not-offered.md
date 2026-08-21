# Plan — setup states the coordinator choice it could not offer

Decision record: `docs/decisions.md`, "2026-08-21 — Setup states the coordinator
choice it could not offer, and the skill keeps the name `setup`"

**Baseline:** the SHA of the commit carrying that decision record and this plan.

## Goal

`skills/setup/SKILL.md` carries a rule for the case it currently has none for:
setup cannot offer the coordinator choice, because there is no human to answer.
It writes `Coordinator: none` as before and reports that a coordinator was
available and was not offered, naming it and saying how to set it.
`tests/managed-block-contract.sh` — which already owns that file — refuses a skill
document that has lost the rule. `findings.md` §32's collision prediction is
corrected in place. The package moves to `0.8.0`.

Out of reach: renaming the skill, the managed-block schema, anything about Claude
Code and `AGENTS.md`, and any change to `delivery`.

## Allowed scope

```
skills/setup/SKILL.md              the non-offerable-choice rule
tests/managed-block-contract.sh    assertion for that rule
docs/findings.md                   correct the §32 collision paragraph
.claude-plugin/plugin.json         version
.codex-plugin/plugin.json          version
```

Carried without being listed, checked rather than assumed:

- **Colocated tests of allowed source.** `skills/setup/SKILL.md` has no colocated
  test; `tests/managed-block-contract.sh` already asserts its existence and
  frontmatter, so it is the owning test and is inside scope for editing.
- **Registry or inventory tests.** Checked: none enumerate skills. Yielded nothing.
- **Documents owning an allowed path.** `README.md` describes `dely:setup` and the
  onboarding sequence but not the coordinator rule — verified by grep. `AGENTS.md`
  needs no new gate, since the assertion lands in a test the gate list already
  runs. Both confirmed by reading, not assumed.

## Forbidden scope

- `hooks/session-start-context.sh`, `hooks/post-tool-journal.sh` — `AGENTS.md`
  forbids editing either while a plan runs.
- `skills/delivery/SKILL.md`, `skills/delivery/templates/` — this unit is about
  `setup`. The four-column acceptance contract landed in the previous unit and is
  used here, not modified.
- `bin/delivery-doctor` — the doctor validates the block a project ends up with. It
  has no view of whether a choice was offered, and giving it one would mean
  recording the offer in the block, which the decision record rejects.
- `docs/harness-surface.md`, `docs/delivery-log.md`, `AGENTS.md` — no harness
  observation, no gate change; release owns the log row.

## Tasks

### 1. The skill states what to do with a choice it cannot offer

**Behaviour.** A worker reading `skills/setup/SKILL.md` is told that where a
selection does not exist and setup cannot ask, it writes the conservative value and
reports the choice it could not offer — naming what was available and how to set it.

**Direction.** Extend the existing `## Coordinator` section rather than adding a
new one; the skill is short. Keep the current sentences — an existing selection is
kept, Orca is offered only when actually available — and add the missing branch.

Write it as one general line plus the coordinator instance, so it reads as a rule
about non-offerable choices rather than a special case bolted on. The report goes
in setup's own output to the human, not into the managed block: the block is
configuration and a comment there would be read as contract by the next session and
by `delivery-doctor`.

**Files.** `skills/setup/SKILL.md`.

**Focused verification.** `tests/managed-block-contract.sh`, new skill-document
case.

**Document impact.** None. Verified by grep that `README.md` describes the
onboarding sequence but not the coordinator rule.

### 2. The owning test refuses a skill document that has lost the rule

**Behaviour.** `bash tests/managed-block-contract.sh` fails when
`skills/setup/SKILL.md` no longer states the non-offerable-choice rule, and passes
on the repository's own.

**Direction.** Extend the existing setup-skill section of that file — it already
locates the document and asserts its frontmatter. Drive the negative case the way
the file's other cases are driven, against a copy in the scratch directory, so the
repository's own document is never edited to test it.

Assert on the rule's substance rather than on one word. A document that says
`coordinator` and `available` somewhere in unrelated prose must not pass.

**Files.** `tests/managed-block-contract.sh`.

**Focused verification.** The test is its own instrument; observe the new case red
against the unmodified skill document before task 1 lands, and record that this is
baseline-red rather than the discrimination proof.

**Document impact.** None — `AGENTS.md` already runs this test.

### 3. §32's collision prediction is corrected in place

**Behaviour.** A reader of `findings.md` §32 learns that the predicted `setup`
collision does not exist, why the prediction was wrong, and what a collision would
actually cost.

**Direction.** Correct the paragraph in place, in this file's established manner —
the reasoning was sound and only the premise was wrong, so keep it and say what
changed. The facts: `codex:setup` is a command, not a skill; the Codex plugin ships
three skills and none is named `setup`; on Claude Code the two are separately
namespaced; a collision on a flattening harness resolves by qualification, per §11;
and `dely:setup` is already the canonical invocation.

Do not delete the recurrence marker. Restate it accurately: the trigger is an
observed collision that qualification does not resolve.

**Files.** `docs/findings.md`.

**Focused verification.** None mechanical. A human reads it at review — recorded
here deliberately, since this repository's log says a row with no instrument is
worth keeping only when someone actually reads it, and review is where that happens.

**Document impact.** This task is the reconciliation.

### 4. Version

**Behaviour.** Both manifests declare `0.8.0`.

**Direction.** `0.7.0` to `0.8.0` in both. A skill behaviour change is a minor bump,
stated so release does not infer it.

**Files.** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`.

**Focused verification.** `tests/managed-block-contract.sh` already asserts both
manifests parse and agree; extend its version assertion to reject `0.7.0`.

**Document impact.** None.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| The skill states the non-offerable-choice rule | `bash tests/managed-block-contract.sh`, skill-document case | A `SKILL.md` whose Coordinator section is unchanged but which mentions "not offered" in its Refusals section — it contains the words, reads as compliant, and still leaves the coordinator branch undefined | journal `01a024a7-433a-7381-86b1-32fbff6d0ada`, `tool_use_id` `call-c3d38ba1-4969-4969-bfa5-659238ee4269-44`, FAILED exit 1: copy with unchanged Coordinator and "not offered" only in Refusals |
| The assertion is about substance, not a word | same test | A check grepping for `coordinator` and `available` anywhere in the file, which the current unmodified `0.7.0` document already passes because both words appear in the existing Coordinator section | journal `01a024a7-433a-7381-86b1-32fbff6d0ada`, `tool_use_id` `call-c3d38ba1-4969-4969-bfa5-659238ee4269-45`, FAILED exit 1: naive `coordinator`+`available` passed on unmodified 0.7.0; real Coordinator-section check failed. Baseline-red of the new test against that same document is `call-9ddaba9a-a2da-447b-9c70-8b5649831429-43` (stdout `managed-block-contract: 1 failure(s)`), not the discrimination proof |
| Both manifests declare `0.8.0` | same test, version case | A check asserting only that the two manifests agree, which passes when both are left at `0.7.0` | journal `01a024a7-433a-7381-86b1-32fbff6d0ada`, `tool_use_id` `call-e82f3717-86a0-49ff-b402-b8fad4051368-50`, FAILED exit 1: naive agree passed at 0.7.0; reject-0.7.0 failed. Same session `call-e82f3717-86a0-49ff-b402-b8fad4051368-51` ran the owning test against those manifests (`managed-block-contract: 1 failure(s)`) |
| Existing managed-block behaviour is unchanged | same test, all pre-existing cases | Not applicable — regression guard. These discriminate for their own contract, proven in the unit that introduced them | n/a |
| Existing rails still pass | `bash tests/delivery-doctor-grok-hook.sh`, `bash tests/delivery-evidence-pipeline.sh`, `bash tests/plan-template-shape.sh` | Not applicable — regression guards | n/a |
| §32 no longer predicts a collision that does not exist | a human reads the diff at review | No instrument. The claim is semantic, between a corrected paragraph and the evidence behind it; a grep for `collision` passes any rewording | n/a |

**Cannot be observed:** whether a real non-interactive run actually emits the
report. Every check here is static and proves the skill document states the rule.
The behavioural check is the post-release smoke below.

**Post-release smoke,** after the caches are refreshed. Record in `docs/findings.md`:
in a scratch repository with no `AGENTS.md`, on a machine where Orca is available,
invoke `dely:setup` non-interactively with instructions to ask nothing, and record
whether the written block says `Coordinator: none` **and** whether the run's output
names the coordinator it could not offer. The `0.6.0` run that produced this defect
is the control: it wrote `none` and said nothing.

## Stop conditions

- Stating the rule generally forces a change to setup's Refusals section. The
  decision record separates the two: refusals are for states setup must not guess
  at, and a missing coordinator is not one.
- The assertion cannot be made substantive without pinning an exact sentence, so
  that any rewording of the skill turns the gate red. A gate that forbids editing
  prose is worse than the silence it replaces.
- `tests/managed-block-contract.sh` cannot drive the negative case without editing
  the repository's own skill document.

Assumption not verified for other environments: the test inspects files only and
must not require `claude`, `codex`, `grok` or `orca` on `PATH`, matching the rest
of that file.

## Closure gates

All from the repository root. Unchanged from `AGENTS.md`; no gate is added.

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
