# Dely closes only the terminals it created

Transient plan, deleted in the release commit. Durable record: item 9 of the
2026-09-11 decision in `docs/decisions.md` (settled-workers bullet). Baseline: the
commit that adds this plan, on top of `a702e66`. Version stays `0.18.0`.

## Why

Integration review found the runtime inferred adoption from Orca's row shape. The top-level
read never matched real Orca, and the `terminalState: retained` fallback also matched a
`user_owned`/`user_takeover` terminal, which `wait`/`collect` then closed.

## Scope

One task. Owned paths: `skills/delivery/scripts/dely.js`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`, `tests/contracts.sh`, `skills/delivery/SKILL.md`.
Control owns this plan and `docs/decisions.md`.

## Contract

1. When the adopt path launches a worker, Dely records the dispatch id and the terminal
   handle it created in the run memory (`<git-dir>/dely/runs/<run>.json`).
2. After reporting a `worker_done`, `wait` and `collect` run `worker-release` for that
   dispatch. They run `terminal close` only for a handle recorded in item 1 for that
   dispatch, and not when the worker row reports `resource.ownershipState` (or a
   top-level `ownershipState`) of `user_owned`.
3. `checkDeadDispatch` follows the same rule for a dead dispatch.
4. No decision reads `terminalState` or `retainedReason` to decide a close; the
   inference helper is deleted.
5. A missing or unreadable memory closes nothing.
6. A batch holding only `question` or `escalation` still releases and closes nothing.
7. `skills/delivery/SKILL.md` says Dely closes only terminals it created for an adopted
   launch, never one a human took over.

## Acceptance

| # | Requirement | Instrument | Plausible wrong implementation it rejects | Observed |
| --- | --- | --- | --- | --- |
| 1 | memory records the created handle | `node --test`: adopt-path dispatch → memory file holds that dispatch id and handle | records the handle Orca returns for a `worker-start` launch too | implementer |
| 2 | close only a Dely-created handle | test: `worker_done` from a row `terminalState: retained`, `resource: {ownershipState: user_owned, retainedReason: user_takeover}` with no memory entry → `worker-release`, no `terminal close` | any retained row is closed (the `a702e66` fallback) | implementer |
| 2 | close a Dely-created adopted terminal | test: memory entry + live `resource: {ownershipState: external, retainedReason: external_terminal}` → `terminal close` for that handle | reads only top-level `ownershipState` (the `19f26e5` defect) | implementer |
| 2 | respect takeover of a Dely-created terminal | test: memory entry + `resource.ownershipState: user_owned` → no close | closes every handle in memory | implementer |
| 3 | dead dispatch same rule | test: dead adopted dispatch with memory entry → close; dead `user_takeover` row without entry → no close | dead path keeps the old inference | implementer |
| 5 | missing memory closes nothing | test: memory absent (different cwd git dir) + external row → no close | falls back to row shape when memory is absent | implementer |
| 6 | question batch | existing test stays green | releases on any settling message | implementer |
| 7 | skill wording | `bash tests/contracts.sh` pin, within 280 lines | skill still says "close its terminal when it was adopted" unqualified | implementer |
| — | live | Control re-probe after integration review: agy worker terminals closed after `worker_done`; no worker terminal left; a human-owned terminal untouched | passes tests, still leaks or closes wrongly live | Control |

## Not observable

Whether `terminal close` ends the harness process; whether a live user-takeover row reads
`user_owned` at the moment `wait` sees the `worker_done`.
