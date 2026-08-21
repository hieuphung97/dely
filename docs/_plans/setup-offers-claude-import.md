# Plan — setup offers the `CLAUDE.md` import, and the doctor warns when it is missing

Decision record: `docs/decisions.md`, "2026-08-21 — Setup offers the `CLAUDE.md`
import, and the doctor warns when it is missing"

**Baseline:** the SHA of the commit carrying that decision record and this plan.

## Goal

`skills/setup/SKILL.md` stops saying *"Do not write `CLAUDE.md`"* and instead offers
to create a one-line `CLAUDE.md` containing `@AGENTS.md`, where the current harness
is Claude Code and no such import exists. `bin/delivery-doctor` warns when a project
has a well-formed managed block and no such import.
`tests/managed-block-contract.sh` drives both. The package moves to `0.9.0`.

Out of reach: writing the file unasked, offering it on other harnesses, validating
anything else in `CLAUDE.md`, and any change to `delivery` or the managed-block
schema.

## Allowed scope

```
skills/setup/SKILL.md              offer instead of refuse
bin/delivery-doctor                warn on a block Claude Code cannot read
tests/managed-block-contract.sh    fixtures for both
.claude-plugin/plugin.json         version
.codex-plugin/plugin.json          version
README.md                          the Checking the wiring list
```

Carried without being listed, checked rather than assumed:

- **Colocated tests of allowed source.** `tests/managed-block-contract.sh` already
  owns both `skills/setup/SKILL.md` and the doctor's managed-block section, so it
  is the owning test for both changed behaviours and is inside scope for editing.
  `tests/delivery-doctor-grok-hook.sh` also drives `bin/delivery-doctor`; it is
  inside scope for **running** and outside scope for editing, and it must stay
  green.
- **Registry or inventory tests.** Checked: none. Yielded nothing.
- **Documents owning an allowed path.** `README.md` enumerates what
  `delivery-doctor` verifies, so it gains the new check. Its `CLAUDE.md` paragraph,
  added in the previous unit, already tells a consumer the file is needed and needs
  no change beyond that — verified by reading.

## Forbidden scope

- `CLAUDE.md` — this repository already has one. The unit must not touch it, and a
  passing test must not depend on this repository being the fixture.
- `hooks/session-start-context.sh`, `hooks/post-tool-journal.sh` — `AGENTS.md`
  forbids editing either while a plan runs.
- `skills/delivery/`, `bin/delivery-evidence`, `tests/plan-template-shape.sh`,
  `tests/delivery-doctor-grok-hook.sh`, `AGENTS.md`, `docs/findings.md`,
  `docs/harness-surface.md`, `docs/delivery-log.md`.
- `docs/decisions.md` — carries the baseline; release reconciles it.

## Tasks

### 1. Setup offers the import instead of refusing to write it

**Behaviour.** A worker reading `skills/setup/SKILL.md` is told: where the current
harness is Claude Code and the project has no `CLAUDE.md` importing `AGENTS.md`,
offer to create a one-line `CLAUDE.md` containing `@AGENTS.md`. The human accepts or
declines. Never write it unasked.

**Direction.** Replace the `Do not write CLAUDE.md` sentence in the
`## Claude Code and AGENTS.md` section. Keep the explanation of why the file is
needed — it is the reason the offer exists.

Say explicitly that this is not a second managed block: no markers, no
configuration, a pointer at the block rather than a copy of it. Say that the offer
is Claude-Code-only, and why — the file is inert on Codex, and Grok does not expand
the import at all.

Do not add a rule for the non-interactive path. The general rule shipped in `0.8.0`
already covers it: a choice that cannot be offered is reported rather than made.
Whether that rule reads as covering this case without amendment is a deliberate
test of how generally it was written; if it does not, that is a stop condition, not
something to patch here.

**Files.** `skills/setup/SKILL.md`.

**Focused verification.** `tests/managed-block-contract.sh`, skill-document case.

**Document impact.** None — `README.md`'s `CLAUDE.md` paragraph already states the
need, verified by reading.

### 2. The doctor warns on a block Claude Code cannot read

**Behaviour.** `delivery-doctor <repo>` prints a `warn` when the repository has a
well-formed managed block and no `CLAUDE.md` importing `AGENTS.md`, saying Claude
Code will not read the block. It prints nothing on that subject when the import is
present, and nothing when there is no managed block at all.

**Direction.** Extend the existing managed-block section. `warn`, never `bad` — a
Codex-or-Grok-only project is correctly configured without the file, exactly as a
project with no block is correctly configured.

Check that the import is present, not merely that `CLAUDE.md` exists. A `CLAUDE.md`
holding unrelated project prose does not make the block reachable.

Do not parse or validate anything else in the file.

**Files.** `bin/delivery-doctor`.

**Focused verification.** `tests/managed-block-contract.sh`, fixture-driven, in the
style the file already uses: build throwaway repositories and assert on the
managed-block lines. New cases, each distinguishable:

1. block present, `CLAUDE.md` with `@AGENTS.md` — no warn on this subject
2. block present, no `CLAUDE.md` — warn
3. block present, `CLAUDE.md` present but holding unrelated prose and no import —
   warn
4. no managed block, no `CLAUDE.md` — no warn on this subject, because there is no
   block to be unreachable
5. block malformed — still the existing failure, not replaced by this warn

Case 3 is the one that stops the check being an existence test. Case 4 is the one
that stops it firing on the supported no-block fallback.

**Document impact.** `README.md` owns the list of what `delivery-doctor` verifies.

### 3. Version and README

**Behaviour.** Both manifests declare `0.9.0`, and `README.md`'s "Checking the
wiring" list names the new check.

**Direction.** `0.8.0` to `0.9.0` in both manifests. One clause in the README list.

**Files.** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `README.md`.

**Focused verification.** `tests/managed-block-contract.sh` version case.

**Document impact.** This task is the reconciliation for tasks 1 and 2.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| The skill offers the import rather than refusing to write it | `bash tests/managed-block-contract.sh`, skill-document case | The unmodified `0.8.0` document. It already contains `CLAUDE.md`, `AGENTS.md` and a paragraph about Claude Code not reading it, so any check grepping for those terms passes a document whose actual rule is `Do not write CLAUDE.md` — the opposite of the contract | to be filled by implement |
| The doctor warns when the import is missing | same test, case 2 | A doctor that prints the warn unconditionally whenever `CLAUDE.md` is absent, which also fires on a project with no managed block — the supported fallback | to be filled by implement |
| The warn is about the import, not the file | same test, case 3 | A doctor testing only that `CLAUDE.md` exists, which a file of unrelated prose satisfies while the block stays unreachable | to be filled by implement |
| The warn does not fire without a block | same test, case 4 | A doctor whose warn is emitted before the block is parsed, so a bare repository with neither block nor import is told Claude Code cannot read a block it does not have | to be filled by implement |
| A malformed block still fails | same test, case 5 | A doctor whose new warn replaces the existing failure path, so a broken block reports as a Claude Code reachability warning instead of an error | to be filled by implement |
| Both manifests declare `0.9.0` | same test, version case | Both left at `0.8.0`, which a check asserting only that the two agree accepts | to be filled by implement |
| The existing doctor rails still pass | `bash tests/delivery-doctor-grok-hook.sh` | Not applicable — regression guard over the same program this unit edits, with ten adapter shapes proven in earlier units | n/a |
| Other rails still pass | `bash tests/delivery-evidence-pipeline.sh`, `bash tests/plan-template-shape.sh` | Not applicable — regression guards | n/a |

**Cannot be observed:** whether setup actually makes the offer to a human. Every
check here is static or fixture-driven and proves the document states the rule and
the doctor implements the warn. It cannot prove an agent offers rather than writes,
and it cannot prove a human is asked.

Also unobserved: whether the `0.8.0` non-interactive rule genuinely covers this new
offer without amendment. Task 1 deliberately adds no rule for that path. A
non-interactive run that writes `CLAUDE.md` unasked, or that says nothing about the
offer it skipped, would disprove it — and no static check here detects either.

**Post-release smoke,** after the caches are refreshed. Record in `docs/findings.md`:

1. In a scratch repository with an `AGENTS.md` managed block and no `CLAUDE.md`,
   run `delivery-doctor` and confirm the warn appears; add the import and confirm
   it disappears.
2. Invoke `dely:setup` interactively there on Claude Code and record whether the
   offer is made and whether declining leaves the file absent.
3. Invoke it non-interactively and record whether it writes `CLAUDE.md` unasked —
   it must not — and whether it reports the offer it could not make. This is the
   test of the `0.8.0` general rule.

## Stop conditions

- The `0.8.0` non-interactive rule turns out not to cover an offer to create a
  file, only an offer to choose a value, so task 1 cannot be written without
  amending it. That is a contract change this plan did not decide.
- The doctor cannot distinguish "no managed block" from "block present, import
  missing" without parsing more of `CLAUDE.md` than the decision allows.
- Making the warn fire correctly requires this repository's own `CLAUDE.md` to be
  the fixture, which would make the test pass only here.

Assumption not verified for other environments: the test inspects files only and
must not require `claude`, `codex`, `grok` or `orca` on `PATH`, matching the rest
of that file. `jq` and `git` are already required by the doctor itself.

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
