# Plan — recover an accepted dispatch whose prompt was not submitted

Decision record: `docs/decisions.md`, "2026-08-22 — A coordinator verifies
prompt submission before the long wait"

**Baseline:** `5b0978284b05d409e38d03df174f502a5e3635e1`

## Goal

The portable `delivery` contract distinguishes Orca accepting task input from a
harness submitting it. After 90 seconds without a heartbeat or visible progress,
Control reads the TUI and sends Enter exactly once only when the prompt is still
pending. The package version becomes `0.10.0`, and the historical record no longer
scopes the race to a freshly launched terminal.

Out of reach: changing Orca or a harness, parsing TUI state mechanically, adding a
wrapper or retry loop, changing timeout policy, and changing hook behaviour.

## Allowed scope

```
skills/delivery/SKILL.md                 portable coordinator contract
tests/dispatch-submission-contract.sh   focused contract fixture
tests/managed-block-contract.sh         exact package-version assertion
.claude-plugin/plugin.json              package version
.codex-plugin/plugin.json               package version
AGENTS.md                                closure-gate registry
docs/decisions.md                       durable decision and prior-scope correction
docs/findings.md                        observation cross-reference only if needed
```

Carried without being listed, checked rather than assumed:

- **Colocated tests.** No test owns prose in `skills/delivery/SKILL.md`; the new
  focused fixture is therefore in scope. `tests/plan-template-shape.sh` reads the
  same skill but owns only its Acceptance section and stays run-only.
- **Registry or inventory tests.** `AGENTS.md` enumerates every shell test used as
  a closure gate, so it gains the focused test in the syntax and execution lists.
- **Owning documents.** `docs/decisions.md` owns both the new rule and the stale
  "freshly launched" scope. `docs/findings.md` already records every recurrence;
  change it only if a cross-reference is needed, not to duplicate evidence.

## Forbidden scope

- `hooks/session-start-context.sh`, `hooks/post-tool-journal.sh` and
  `hooks/hooks.json` — the failure is after Orca input delivery and before harness
  submission; no hook caused it.
- `skills/setup/SKILL.md`, `bin/`, `git-hooks/` and Grok adapter files — none owns
  coordinator dispatch.
- `README.md` — installation and trust guidance was reconciled before this plan;
  it does not document the four-phase coordinator loop.
- Any user config under `~/.grok`, `~/.claude` or `~/.codex`.
- `docs/delivery-log.md` — release owns the one closure row.

## Tasks

### 1. The coordinator recovers only a visibly pending prompt

**Behaviour.** `delivery` states that `input_accepted` is not submission proof,
allows 90 seconds for a heartbeat or visible progress, reads the TUI on the
no-signal path, and sends Enter exactly once only when that read shows the task is
still pending. Healthy workers receive no extra input, and a second missing signal
does not authorize a second Enter.

**Direction.** Put the rule beside worker launch and blocking-wait guidance. Keep
it harness-neutral and describe the observed boundary, not Orca internals. Do not
add a loop, helper script or pseudo-parser.

**Files.** `skills/delivery/SKILL.md`.

**Focused verification.** `bash tests/dispatch-submission-contract.sh`. The driver
must also run the same check against fixtures that omit the TUI read and that send
Enter unconditionally or more than once; each fixture must be rejected.

**Document impact.** The new decision owns why the rule exists. The old Orca
decision paragraph must lose its now-false "fresh terminal only" scope.

### 2. The contract check rejects the two dangerous shortcuts

**Behaviour.** One small shell test reports `ok` for the shipped contract and
non-zero for a contract that trusts `input_accepted`, skips the TUI read, sends
Enter immediately, or permits repeated Enter presses.

**Direction.** Inspect only the worker-launch/wait portion of the skill. Fixture
copies must run through the same checker as the repository, and a negative fixture
passing is a test failure. Use shell tools already required by the repository; add
no dependency.

**Files.** `tests/dispatch-submission-contract.sh`, `AGENTS.md`.

**Focused verification.** `bash tests/dispatch-submission-contract.sh`; its final
line is `dispatch-submission-contract: ok` only after every negative fixture was
observed red.

**Document impact.** `AGENTS.md` gains the test in both `bash -n` and executable
closure-gate lists because omission there would let the contract test rot unused.

### 3. Installed copies identify the changed workflow as `0.10.0`

**Behaviour.** Claude Code and Codex manifests agree on `0.10.0`, and the existing
managed-block contract expects that exact version. No hook or adapter is changed.

**Direction.** Change only the two manifest values, the owning test expectation and
its version comment. Do not tag, refresh caches or regenerate the Grok adapter
inside the live plan.

**Files.** `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
`tests/managed-block-contract.sh`.

**Focused verification.** `bash tests/managed-block-contract.sh` plus
`jq -e '.version == "0.10.0"'` on each manifest.

**Document impact.** None beyond the decision: cache refresh and the behavioural
smoke occur after release, between plans.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Recovery is conditional, read-first and one-shot | `bash tests/dispatch-submission-contract.sh` | A syntactically valid skill says to send Enter immediately after every `input_accepted` receipt, without reading the TUI | Implement fills |
| The read cannot be replaced by a rendered-prompt guess | `bash tests/dispatch-submission-contract.sh` | A syntactically valid skill waits 90 seconds, treats a rendered prompt as proof, and sends Enter without confirming it remains in the input box | Implement fills |
| Both install surfaces identify the changed contract | `bash tests/managed-block-contract.sh` and two direct `jq -e` checks | A complete copied package keeps the Codex manifest at `0.9.1` while Claude reports `0.10.0` | Implement fills |
| Historical scope no longer says the race is fresh-terminal-only | Human reads the exact `docs/decisions.md` diff; no mechanical instrument exists | The new rule is added while the earlier decision still says the race did not recur on an existing terminal | Human reads the diff; implement records the location |

**Cannot be observed:** a static contract fixture cannot make Orca leave a prompt
unsubmitted, cannot prove an agent follows the rule and cannot prove 90 seconds is
universally optimal. The recurrence supplies the design evidence; the first real
post-release recurrence supplies behavioural evidence.

## Stop conditions

- The focused test cannot reject both unconditional Enter and no-read fixtures
  without parsing general Markdown or shell syntax.
- Implementing the rule requires an Orca or harness change, a helper process, or a
  hook edit.
- The candidate needs more than one bounded Enter or changes the ordinary blocking
  wait.
- A current Orca native receipt already distinguishes `input_submitted`; return
  `NEEDS_REPLAN` rather than preserving a manual recovery around a native fact.

## Closure gates

Run from `/Users/hieuphung/Projects/project-delivery-procedure`:

```
git diff --check
bash -n bin/delivery-doctor bin/delivery-evidence git-hooks/pre-push hooks/post-tool-journal.sh hooks/session-start-context.sh tests/dispatch-submission-contract.sh tests/managed-block-contract.sh tests/plan-template-shape.sh
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json hooks/hooks.json hooks/grok-hooks.json.template >/dev/null
bash tests/delivery-evidence-pipeline.sh
bash tests/delivery-doctor-grok-hook.sh
bash tests/journal-path-shape.sh
bash tests/dispatch-submission-contract.sh
bash tests/managed-block-contract.sh
bash tests/plan-template-shape.sh
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

Report each gate separately. Do not combine gates into a chain or pipeline whose
status can hide an earlier failure.
