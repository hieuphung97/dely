# Plan — coordinator-first interactive workers and unsandboxed review

Decision record: `docs/decisions.md#interactive-workers-are-coordinator-first-review-independence-does-not-imply-a-sandbox`

**Baseline:** `a39796064dbe3c576e3d7d9a651529fb1b6f2bdc`

## Goal

When a project selects Orca, every delivery worker runs in a real harness TUI under
Orca observation; direct headless execution is an explicit fallback rather than the
default. Review starts fresh with ordinary project permissions and no phase-implied
sandbox, so it can run gates, use Internet access and report completion. This plan adds
no wrapper, adapter, polling loop, candidate fingerprint or review worktree.

## Global constraints

- Use the frozen installed `delivery` v0.4.2 until review accepts this candidate.
- Repository artifacts are English.
- The coordinator owns transport; the harness owns model execution and permissions.
- Do not edit `hooks/` or `bin/` while this plan runs.
- The current Control Session remains paused before the rename unit.

## Allowed scope

```
skills/delivery/SKILL.md
docs/decisions.md
docs/findings.md
README.md
AGENTS.md
.claude-plugin/plugin.json
.codex-plugin/plugin.json
docs/_plans/interactive-workers-and-unsandboxed-review.md
docs/delivery-log.md
```

No colocated source test applies because the runtime change is the skill's agent
behaviour. No registry test enumerates these paths. The plugin manifests are included
only for the release-time `0.4.3` version bump; `docs/delivery-log.md` is included only
for closure.

## Forbidden scope

- `hooks/`, `bin/`, `git-hooks/` and `tests/`: dispatch and review permissions need no
  new runtime mechanism.
- `docs/harness-surface.md`: the recorded CLI capabilities are not changing.
- installed plugin caches and user configuration: refresh happens after this plan closes,
  between plans.
- the paused rename unit, plugin identity and marketplace identity: those remain the next
  unit and must not be folded into this correction.

## Tasks

### 1. Make selected coordinators the primary worker path

**Behaviour.** If `AGENTS.md` selects a coordinator, Control uses that coordinator's
native skill to launch a real interactive harness TUI and supervise the phase. Headless
CLI remains available only when no coordinator exists or a human accepts fallback after
the selected coordinator is unavailable.

**Direction.** Replace the unconditional non-interactive recipe in `SKILL.md` with the
capability rule. Do not copy Orca's command reference into the portable skill; load the
selected coordinator's native skill instead. Keep prompt files for transport safety where
the coordinator accepts file input, but do not confuse a visible shell with a TUI.

**Files.** `skills/delivery/SKILL.md`, `README.md`, `AGENTS.md`.

**Focused verification.** The existing self-update is the RED observation: Orca was
available, yet Control chose headless entrypoints and later wrapped them in shell tabs.
After release and cache refresh, a fresh Control smoke must create a real worker TUI,
produce an Orca Task and Dispatch, and show no `codex exec`, `claude -p` or
`grok --prompt-file` process for that worker. Terminal inspection distinguishes a harness
TUI from a shell command with redirected output.

**Document impact.** The skill owns routing; README owns the consuming project's
coordinator and worker-surface wiring; `AGENTS.md` selects Orca and interactive TUI here.

### 2. Remove the phase-implied Codex sandbox

**Behaviour.** Review is fresh and independent, but uses ordinary project permissions.
It can run every closure gate, access the network when the task requires it, write its
result and send coordinator completion. It is instructed not to implement or edit the
candidate; no protection is added for a mutation that has not occurred.

**Direction.** Replace `cannot modify` and read-only trade-off language with role
ownership. Remove `--sandbox read-only` from this project's review mapping. Preserve the
historical observations in the decision record and add the current recurrence to
`findings.md`; do not rewrite them as if the sandbox never worked. Pin this repository's
Codex review invocation explicitly to `--dangerously-bypass-approvals-and-sandbox` so
"no sandbox" does not depend on a hidden Codex default.

**Files.** `skills/delivery/SKILL.md`, `AGENTS.md`, `docs/decisions.md`,
`docs/findings.md`, `README.md`.

**Focused verification.** The Codex review worker for this plan runs in an interactive
TUI without `--sandbox read-only`, reproduces every closure gate, runs
`git ls-remote origin HEAD` successfully as the bounded network check, and sends
`worker_done` before the coordinator wait expires. The pre-change review could do none of
the writable gate/result/completion operations, so the instrument discriminates.

**Document impact.** The decision record owns the supersession; findings owns the observed
failure; README and `AGENTS.md` own deployment choices.

### 3. Wire and record the corrected contract

**Behaviour.** This repository selects Orca with interactive workers and an unsandboxed
Codex review explicitly, while the portable installation guidance exposes those choices
without making Orca or Codex universal requirements.

**Direction.** Reconcile `AGENTS.md`, README and findings with Tasks 1 and 2. Keep the
deployment surface to the existing project-local table and prose; add no configuration
schema, wrapper or compatibility matrix.

**Files.** `AGENTS.md`, `README.md`, `docs/findings.md`.

**Focused verification.** The repository table selects `Coordinator: Orca`, interactive
worker surfaces and the explicit full-access Codex review invocation. README tells another
project where to make the same three choices without prescribing this repository's
combination.

**Document impact.** `AGENTS.md` owns this repository's choices, README owns portable
installation guidance and findings owns the observed failure.

## Post-accept release

After independent review accepts the candidate, release bumps both plugin manifests to
`0.4.3`, deletes this plan, appends one delivery-log row and commits. Cache refresh and
user configuration changes happen only after that plan boundary. A fresh Control TUI then
forward-tests the installed contract by dispatching one bounded worker through Orca; only
after that smoke succeeds may the paused rename unit resume.

## Acceptance

| Requirement | Instrument | Discriminates? |
| --- | --- | --- |
| A selected coordinator launches a real harness TUI | Fresh-Control Orca smoke plus terminal/process inspection | Yes — the RED session created headless processes and shell-only tabs; the expected process is the interactive harness and the terminal shows its TUI. |
| Coordinator lifecycle carries the worker | `orca orchestration task-list`, `dispatch-show` and receipt of `worker_done` | Yes — the RED session created no Run or Task, and its sentinel was outside Orca lifecycle. |
| Review has no phase-implied sandbox | Review launch command and worker handoff | Yes — `--dangerously-bypass-approvals-and-sandbox` is explicit and the handoff records the actual profile. |
| Review can use gates, network and completion | All closure gates, `git ls-remote origin HEAD`, and `worker_done` from the Codex TUI | Yes — each operation was blocked or unavailable under the recorded read-only review. |
| No speculative mechanism is added | `git diff --name-only` plus human diff | Yes — any executable, adapter, fingerprint or review worktree change is outside allowed scope. |
| Installed copies use the corrected contract | Manifest versions plus one fresh skill-load probe per harness | Yes — source text alone previously differed from cached execution; each installed copy must report `0.4.3`. |
| Repository remains valid | Closure gates below | Partly — they detect syntax and disclosure damage, not agent routing behaviour. |

**Cannot be observed:** One successful forward test does not prove every future
coordinator/harness combination. A second coordinator is still required before extracting
a generic adapter. The absence of reviewer mutation is historical evidence, not a
guarantee; enforcement is reconsidered only after a real incident.

## Stop conditions

- Orca cannot launch the configured Grok or Codex interactive TUI with model and effort
  pinned.
- The unsandboxed Codex TUI cannot run a closure gate, reach the bounded remote check or
  send `worker_done`.
- Correct behaviour requires changing `hooks/`, `bin/`, a consuming repository or the
  paused rename unit.
- The change needs a package-owned coordinator adapter rather than the coordinator's
  installed native skill.

## Closure gates

From the repository root:

```
git diff --check
```

```
bash -n bin/delivery-doctor bin/delivery-evidence git-hooks/pre-push hooks/post-tool-journal.sh hooks/session-start-context.sh
```

```
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json hooks/hooks.json hooks/grok-hooks.json.template >/dev/null
```

```
bash tests/delivery-evidence-pipeline.sh
```

```
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-c]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```
