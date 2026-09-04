# Plan — Orca orchestration becomes the execution plane, and Dely stops hand-rolling dispatch

Decision record: `docs/decisions.md`, section `2026-09-04 — Orca orchestration is the
execution plane, and Dely stops hand-rolling dispatch`

**Baseline:** `d97cc90` — the commit carrying the decision record and this plan.

## Goal

Dely delegates worker readiness, completion, cleanup and bounded evidence to
`orca orchestration`, deletes the prose state machine it wrote for those jobs, and
lands sixteen recurring frictions in the same pass. `references/harnesses.md` keeps
only per-harness facts verified in this delivery. Out of reach: parallel task
execution, remote workers, nested workers, and any change to the in-chat approval
gate.

## Allowed scope

```
skills/delivery/SKILL.md
skills/delivery/references/harnesses.md
skills/delivery/templates/plan.md
AGENTS.md
README.md
tests/contracts.sh
docs/decisions.md
docs/_plans/2026-09-04-orchestration-execution-plane.md
```

Carried without being listed: no colocated tests exist for these paths, and there is
no registry test enumerating what this plan adds — checked with
`git ls-files 'tests/*'`, which returns `tests/contracts.sh` alone. The document that
owns `tests/contracts.sh` and the closure gates is `AGENTS.md`; it is in Forbidden
scope below because this plan changes neither the gate list nor the managed block.

## Forbidden scope

- `AGENTS.md` was forbidden while it carried a pre-existing uncommitted change. The
  human committed that change at `77423b0`, releasing the path, so Task 2 now owns
  it for one sentence only: the descriptor that names this reference's columns. No
  closure gate and no managed-block row may change.
- `.AGENTS.md.swp` — pre-existing untracked editor state. Never staged, never removed.
- `skills/setup/SKILL.md` — its Discovery subsections are pinned verbatim and concern
  model/effort discovery, not dispatch. Its filename suggests relevance; its contents
  have none here.
- `skills/delivery/templates/decision-record.md` — the template's shape is unchanged;
  only a new record is written, into `docs/decisions.md`.
- `.github/ISSUE_TEMPLATE/*` — Task 3 removes the checker that validates these files,
  not the files.

## Execution envelope

Protected dirty paths: `.AGENTS.md.swp` (untracked editor state), never staged,
reset or removed. `AGENTS.md` was protected until the human committed its
pre-existing change at `77423b0`; from that commit it is an owned path.

Branch, base, remote, and pull-request target: `feat/orchestration-execution-plane`,
based on `origin/main` at `86666a6`, remote `origin`, pull request into `main`.

Resolved phase pins, read from the working-tree `AGENTS.md` managed block:

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | Cursor Agent CLI | cursor-grok-4.6-high | default |
| `review` | Claude Code | opus | high |

Both pinned harnesses were measured reaching `ready` through
`orca orchestration worker-start` during the 2026-09-04 Spike, on a trusted and on a
never-trusted path. No phase-implied sandbox.

Authority: this plan may branch, commit only its own owned paths, run gates, push the
named branch, and open or update the named pull request. It may not merge,
force-push, stash, reset, clean, or edit anything outside owned scope.

## Tasks

### 1. Dispatch mechanics come from the execution plane

**Behaviour.** `SKILL.md` names the orchestration verbs as the way a worker is
started, awaited, reported and released, and no longer carries its own readiness or
submission procedure. A blocked or stalled launch is routed by the plane's typed
error rather than by an enumerated vendor dialog.

**Direction.** Replace the `Launching a worker` mechanics with: `worker-start`
proves readiness by exiting 0 with a receipt carrying `launch.requested` and
`launch.effective`; the completion wait is `check --wait` on
`worker_done,escalation,question` **repeated past heartbeats** until a settling
message arrives for that dispatch — a heartbeat ends one wait but settles
nothing; the worker reports once with `worker_done` and an `--outcome`;
`worker-release` returns the terminal; `worker-read` is the bounded evidence read.
Delete the obsolete mechanics of the `Keep waiting blocking` paragraph but **keep
its invariant**, reworded to name what is actually forbidden: completion comes
from the worker's own `worker_done`, and Control does not infer it from reading
the worker's terminal. Delete the `input_accepted is not submission` paragraph
with its 90-second allowance and single-Enter procedure, and the session-id
capture instruction — the dispatch id replaces it. Add the two recovery
routes: `agent_prompt_blocked` means a modal sits between launch and composer, so
read that terminal and clear what is actually there; `agent_prompt_stalled` is a
liveness inspection. Keep the existing rule that the prompt is a file in the
worktree, and state that the handoff is likewise a file whose path travels as
`payload.reportPath` while the message body stays short — `--spec` and `--body` are
shell arguments, which this skill already forbids for prompts. Name orchestration as
a required Orca capability; the existing "required capability is absent → stop" rule
already carries the failure.

**Files.** `skills/delivery/SKILL.md`, `tests/contracts.sh`.

**Focused verification.** `bash tests/contracts.sh` with new assertions: the three
deleted phrases are absent from `SKILL.md`, and `worker-start`, `worker_done`,
`agent_prompt_blocked`, `agent_prompt_stalled` and `payload.reportPath` are present.
It fails if either half is missing.

**Document impact.** None outside `SKILL.md`. `AGENTS.md` describes phase dispatch
and sandboxes, neither of which changes.

**Amended 2026-09-04 after Task 1 returned.** Control wrote two defects into this
task's Direction and the implementer executed them faithfully: the completion wait
was described as a single `check --wait`, which measurement contradicts because
heartbeats pass the type filter and end the wait; and deleting the whole
`Keep waiting blocking` paragraph discarded an invariant that should have been
reworded. Both are corrected above. The reviewer scope-checks this amendment.

### 2. `references/harnesses.md` carries only verified facts

**Behaviour.** The table names each harness's Orca agent id, its forbidden headless
forms, and the answers whose wrong choice destroys the worker. It no longer carries
a trust-dialog catalogue.

**Direction.** The 2026-09-04 Spike measured the agent ids: `claude`, `codex`,
`grok`, `antigravity`, `kiro`, `cursor`, `copilot` — not the binary names, which
return `agent_unconfigured`. The same Spike measured Claude Code launching on a
never-trusted path with `--dangerously-skip-permissions` and no trust dialog, and no
trust entry created, while the current cell asserts the flag "does not suppress it"
and instructs Control to select a dialog option that never appears. Delete that
cell's claim rather than reword it. Any per-harness fact this delivery does not
verify is deleted, not carried: a stale cell is worse than an empty one, because
`SKILL.md` tells Control to prefer this file over a harness's own `--help`. Update
the verbatim table pin in `tests/contracts.sh` to the new shape.

**Follow-up, after the first Task 2 commit `6a46072`.** Three defects, none of them
the implementer's: the rule was applied to facts this delivery *did* verify, which
decision 5 says to keep; `Launch notes` is now an empty column under an intro
sentence that still promises it; and both documents describing this reference —
`SKILL.md`'s "compatibility matrix of permission defaults, forbidden headless
forms, launch notes, and trust handling" and the matching sentence in `AGENTS.md` —
now describe a file that no longer exists in that shape. Control's plan asserted
that `AGENTS.md`'s wording would not need to change without reading it. Restore the
launch-note facts this delivery verified — that `worker-start --agent` with
`--model` pins Claude, Codex and Cursor launches, and that effort is omitted where
the managed block says `default` — reconcile both descriptor sentences to the
table's real columns, and either fill or drop the empty column.

**Files.** `skills/delivery/references/harnesses.md`, `tests/contracts.sh`,
`skills/delivery/SKILL.md`, `AGENTS.md`.

**Focused verification.** `bash tests/contracts.sh`: the updated verbatim table pin,
plus an assertion that each of the seven agent ids appears and that the string
`does not suppress it` does not.

**Document impact.** `AGENTS.md` points at this file for launch mechanics; the
pointer stays true and its wording does not change.

### 3. README documents the prerequisite, and the contract script pays for it

**Behaviour.** A reader enabling Dely learns once, in the shared prerequisites, that
Orca's orchestration feature must be enabled, and how to confirm it. The contract
script stays under its ceiling.

**Direction.** Orchestration is harness-independent, so the prerequisite is written
once in the shared prerequisites section, never repeated in the seven per-harness
sections. Confirmation command: `orca orchestration run-list --json`. To pay for the
new assertion, delete the Ruby block that validates the two issue-form YAML files —
GitHub validates issue forms itself, and this is the weakest-value check in the
script. Record in the decision record that this trades a fast signal for a slower
one.

**Files.** `README.md`, `tests/contracts.sh`.

**Focused verification.** `bash tests/contracts.sh` and
`test "$(wc -l < tests/contracts.sh)" -le 250`. The new README assertion is scoped to
the shared prerequisites section using the existing section-extractor idiom, not a
bare whole-file grep.

**Document impact.** `README.md` owns installation and onboarding; this is its
change. `AGENTS.md` names `README.md` as the owner and needs no edit.

### 4. Sequencing and the review contract

**Behaviour.** No worker runs while a review of the same working tree runs. A review
states what it did not verify. Control owns the plan and the decision record
throughout, including remediating findings inside them. `One pass` is unambiguous.

**Direction.** State the reason for sequencing, not only the rule: the working tree
and its gate surface are shared mutable state, and a review reproduces gates in that
tree, so a concurrent edit makes another task's work look like this one's result.
Add to the review's return a line naming what the reviewer did not reproduce or
read — the symmetric counterpart of the design side's existing "Record what the
available instruments cannot observe". Say that Control owns plan and record for the
whole run, that amending them is not "implementing the candidate", and that a
finding inside them is remediated by Control and re-checked by the same reviewer on
the fix-only diff. Disambiguate `One pass` as one remediation pass per finding.

**Files.** `skills/delivery/SKILL.md`, `tests/contracts.sh`.

**Focused verification.** `bash tests/contracts.sh`: assertions scoped to the
`## Review` section, not the whole file, so the same words appearing in the handoff
block do not satisfy them.

**Document impact.** None outside `SKILL.md`.

### 5. Extent claims, residue, closure ordering and log labels

**Behaviour.** Any claim about extent states the command that produced it. A worker's
residue is asked for rather than confessed. The plan's deletion happens before the
release-binding review, not after it. "Affected gates" has a definition. The
maintenance log's field labels are named.

**Direction.** One rule covers scope, counts and call-site sets: where a contract
states extent, it states the command that produced it, so the next reader reproduces
it instead of re-deriving it wrongly; and where the claim is a count or a scope, the
instrument enumerates rather than samples. Rename the handoff's
`Unresolved findings` to `Residue` and invert its burden: a "nothing left" claim is
the thing needing evidence. Move plan deletion into release step 2 so it is inside
the commit the release-binding review sees — today `SKILL.md` deletes the plan "at
closure" while also invalidating any verdict on a post-review candidate mutation,
which makes correct behaviour impossible. Define "affected gates" as those that can
observe the change class, and let a project name that subset. Name the maintenance
log's field labels; the current text says "labelled fields" without saying which, and
five different label spellings are already in service.

**Files.** `skills/delivery/SKILL.md`, `skills/delivery/templates/plan.md`,
`tests/contracts.sh`.

**Focused verification.** `bash tests/contracts.sh`: the existing acceptance-header
column check still passes, plus an assertion that the plan template's Allowed scope
section requires a command, and that the handoff block names `Residue`.

**Document impact.** None outside the two skill files.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| `SKILL.md` no longer carries a hand-rolled readiness or submission procedure | `bash tests/contracts.sh` absence assertions on `Keep waiting blocking`, `input_accepted` is not submission, `Allow 90 seconds` | An edit that adds `worker-start` and `worker_done` while leaving the 90-second single-Enter paragraph in place: both mechanisms present, file parses, every existing gate green, contract self-contradictory |Red on baseline `d97cc90`: `still carries a hand-rolled readiness or submission procedure`. Reproduced at review by running the candidate script against the baseline file, and each of the three phrases trips it in isolation. |
| Completion cannot be inferred from reading a worker's terminal | `bash tests/contracts.sh` presence assertion on `do not infer it from reading` | The deleted sentence restored verbatim — "Do not add a relay, poll, or state machine to manufacture completion" — which forbids the very repeated wait the mechanics now require: present, parses, reads as an invariant, contradicts the section above it |Red at `5507b86` before the fix, and red again with the deleted sentence restored verbatim, via the missing `do not infer it from reading` conjunct. Reproduced at review in a scratch fixture. |
| `SKILL.md` names the orchestration verbs and both typed recovery routes | `bash tests/contracts.sh` presence assertions on `worker-start`, `worker_done`, `agent_prompt_blocked`, `agent_prompt_stalled`, `payload.reportPath` | An edit that deletes the old apparatus and replaces it with prose that says "use Orca's orchestration skill" without naming a verb or a route: shorter, parses, absence assertions pass, leaves Control with no route for a blocked launch |Red on baseline `d97cc90`: `does not name the orchestration verbs and both typed recovery routes`. Reproduced at review; each of the six required tokens trips it alone. |
| `harnesses.md` carries the seven Orca agent ids and not the binary names | `bash tests/contracts.sh` presence of each id, and the updated verbatim table pin | A row edit that adds an `Orca agent id` column but fills the Kiro cell with `kiro-cli`: table shape correct, pin updated to match, every launch through it fails `agent_unconfigured` | |
| The stale Claude Code trust claim is gone rather than reworded | `bash tests/contracts.sh` absence assertion on `does not suppress it` | A rewording to "may not suppress it" that keeps the instruction to select a dialog option which never appears: hedged, plausible, still sends Control after a dialog that is not there | |
| The reference's descriptor sentences match its real columns | `bash tests/contracts.sh` assertion that neither `SKILL.md` nor `AGENTS.md` names a column the table does not have | Reconciling `SKILL.md` alone and leaving `AGENTS.md` naming trust handling: the skill reads correctly, the project document a contributor opens first still describes a deleted column | |
| Launch notes carry what this delivery verified | Human reads the diff against the 2026-09-04 measurements | An empty column kept under an intro sentence that promises it: the table parses, every pin passes, and the file promises guidance it does not give | |
| The orchestration prerequisite is documented once, in shared prerequisites | `bash tests/contracts.sh` assertion scoped to the shared prerequisites section via the existing section extractor | The prerequisite written inside the Kiro CLI section only: a whole-file grep passes, six of seven harness readers never see it |Red at `00d7cf0`: `README.md Quickstart does not give orca orchestration run-list --json as the confirmation command`. Still red at review with the command present only inside `### Kiro CLI`, where a whole-file grep passes. |
| The contract script stays under its ceiling | `test "$(wc -l < tests/contracts.sh)" -le 250` | New assertions added without removing the Ruby issue-form block: script grows past 250, gate fails loudly rather than silently |Red at review by re-applying the deleted Ruby hunk: the script reaches 254 lines and the ceiling gate fails on exit code. |
| Review-contract rules land in the review contract, not merely somewhere in the file | `bash tests/contracts.sh` assertions scoped to the `## Review` section | `Not verified` added to the handoff block instead of the review's return: the words exist, a whole-file grep passes, the reviewer contract is unchanged | |
| The handoff asks for residue rather than accepting a claim of none | `bash tests/contracts.sh` assertion on the burden sentence, not the label | `Unresolved findings` renamed to `Residue` with the surrounding text untouched: the label check passes, the field still reads as an exception path | |
| Plan deletion cannot invalidate the release-binding review | Human reads the diff of the Release section against the invalidation sentence | No executable instrument distinguishes a correct ordering sentence from an incorrect one. A human confirms that the step that deletes the plan precedes the step that runs the release-binding review | |
| The extent rule is stated where Bounded work can reach it | Human reads the diff | A rule placed only in `templates/plan.md`, which Bounded work never opens: the template check passes, half the shapes are uncovered. No grep distinguishes correct placement from plausible-but-wrong placement | |

Design fills Counterexample; implement fills Observed red.

**Cannot be observed:** `tests/contracts.sh` is a structural checker. It can prove a
phrase is present or absent and that a section contains it; it cannot prove that a
rule means what it says, that Control will follow it, or that the orchestration verbs
behave as described at runtime. Runtime behaviour was measured once, by the
2026-09-04 Spike, on one machine and one Orca build; it is not re-measured by any
gate here. Three acceptance rows above name a human reading the diff, and that escape
is only worth keeping if someone actually reads it.

A second boundary: this delivery's own dispatches run through the frozen installed
plugin version, so the mechanics being shipped do not govern the run that ships them.
Nothing in this plan is validated by its own execution.


### Deferred findings, recorded for Task 5 and the integration review

Raised in flight by Control or by the Task 1 review, accepted as not blocking that
task, and to be absorbed where they belong rather than forgotten:

- **Each delivery opens its own Run.** This delivery's dispatches landed in the
  Run opened for the 2026-09-04 Spike, so four stale probe reports had to be
  drained before the first real wait could settle. Control bookkeeping, but the
  contract should say it.
- **The wait acknowledges after handling.** A wait that exits on its settling
  message without acknowledging it leaves that message unacknowledged, and the
  plane redelivers it to the next wait. Observed twice in this delivery.
- **The repeated wait has no stated exit** (Task 1 review, Minor). `timeout`
  occurred once in the baseline and zero times in the candidate. Restating a
  Control-side stopwatch would re-hand-roll what the decision delegates, but the
  plane's own wait requires a per-call timeout, and the contract can say that
  without owning a deadline. Residual risk if the plane ever fails to surface a
  dead worker as an arriving message.
- **Split the invariant assertion from the verbs assertion** (Task 1 review,
  Minor). Folded as a sixth conjunct, it discriminates correctly but reports the
  wrong half on failure. Costs one line; deferred until Task 3 frees the budget.
- **The absence assertions are literal** (Task 1 review, Minor). A paraphrased
  restoration of the deleted procedure passes. Inside the limit already declared
  under **Cannot be observed**; recorded so the limit is not mistaken for
  coverage. No change requested.
- **A worker can end its turn without finishing or reporting, and no typed error
  covers it.** The Task 3 review stopped at an idle prompt having written no
  report; the plane reported `worker: ready`, `liveness: live`, because the
  terminal was alive. Neither `agent_prompt_blocked` nor `agent_prompt_stalled`
  describes this. Only Control's own wait deadline surfaced it, which is direct
  evidence for the "repeated wait has no stated exit" finding above rather than
  against it. One nudge recovered it with its context intact.
- **The prerequisite command is unverified against a disabled runtime** (Task 3
  review, limit). `README.md` tells a reader that `orca orchestration run-list
  --json` confirms orchestration is enabled, but nobody has observed it fail when
  orchestration is disabled. An instrument that has only ever been seen green is
  the exact defect this decision record is about.
- **The Ruby deletion's premise is unverified** (Task 3 review, limit). Nothing in
  the repository depended on the checker, but that the hosting platform rejects a
  malformed issue form — the argument that makes the deletion safe rather than
  merely cheap — was not observed.
- **Two README wording defects** (Task 3 review, Minor). The Troubleshooting bullet
  names orchestration as a possible missing capability but offers a retry line that
  cannot distinguish it; and the preflight fence's comment column is misaligned
  after the third line. `README.md` is owned by no remaining task, so absorbing
  these requires widening a later task's Files.

## Stop conditions

- A task finds it must edit `AGENTS.md` — ownership would combine with a protected
  dirty path. Return `NEEDS_REPLAN`.
- The verbatim harness-table pin cannot be updated without exceeding the 250-line
  ceiling. Return `NEEDS_REPLAN` rather than deleting an unrelated check to make room.
- An orchestration verb named in Task 1 does not exist in the installed Orca CLI, or
  its flags differ from the version-matched guide. Return `BLOCKED`; the guide is
  served by the binary and this plan must not pin argv it cannot confirm.
- Any per-harness fact retained in Task 2 cannot be verified in this delivery. Delete
  it rather than carry it; if deletion would empty the table, return `NEEDS_REPLAN`.
- The Spike's measurements were taken on one machine, one Orca build, and one version
  of each harness. Every agent id and launch fact in Task 2 inherits that limit and
  has not been verified on another platform.

## Closure gates

```
git diff --check
bash -n tests/contracts.sh
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null
bash tests/contracts.sh
test "$(wc -l < tests/contracts.sh)" -le 250
test ! -e git-hooks/pre-push
test ! -e docs/delivery-log.md
test ! -e docs/findings.md
test ! -e docs/harness-surface.md
test ! -e docs/options.md
test ! -e docs/_plans/2026-08-24-automation-first-dely-design.md
test ! -e bin/delivery-doctor
test ! -e bin/delivery-evidence
test ! -e hooks/hooks.json
test ! -e hooks/grok-hooks.json.template
test ! -e hooks/post-tool-journal.sh
test ! -e hooks/session-start-context.sh
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

All run from the repository root. Report every gate with the exact command, the
summary line verbatim, and the exit code. `$?` after a pipe reports the last command
in the pipe, not the gate.
