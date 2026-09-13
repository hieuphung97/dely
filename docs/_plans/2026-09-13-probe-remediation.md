# Probe remediation for 0.18.0

Transient plan. Deleted in the release commit. The durable record is item 9 of
the 2026-09-11 decision in `docs/decisions.md`.

## Baseline

Branch `feat/verify-event-driven-dispatch`, pull request #55. Integration review
accepted `8062f35`; this plan invalidates that verdict. Version stays `0.18.0`,
which is unreleased.

## Scope

One task, because the runtime command shape and the skills that name it change
together.

Owned paths: `skills/delivery/scripts/dely.js`, `skills/delivery/scripts/dely`,
`skills/delivery/scripts/dely.cmd`, `skills/delivery/SKILL.md`,
`skills/delivery/references/harnesses.md`, `skills/verify/SKILL.md`,
`skills/setup/SKILL.md`, `README.md`, `tests/scripts.test.js`,
`tests/fixtures/fake-orca.js`, `tests/contracts.sh`. Control owns this plan and
`docs/decisions.md`.

Out of scope: the nudge's quoted `check` command, Copilot skipping the
maintenance log, nudges reaching a background-mode Control, Orca defects, pins in
`AGENTS.md`.

## Contract

1. `dely open --repo <path> --objective <text>` runs `run-create` and `run-use` for
   the caller and prints `RUN <runId>`.
2. `dely dispatch` refuses, exit 3, when `--run` is not the Run bound to the
   caller, printing `REFUSED run <id> is not the Run bound to Control; fix: dely open`.
   The verdict refusal is unchanged.
3. `dely status` prints `PASS` with no run id.
4. One `dely verify --repo <path> --control <agent>` replaces `verify run` and
   `verify start`. It behaves as the former `run` for a `background` Control and as
   the former `start` for a `nudge` Control. `verify collect` stays.
5. `dely wait` requires `--control`. For a Control whose wake is not `background`
   it prints `REFUSED <agent> wakes by nudge; use dely collect` and exits 3.
6. `dely wait` exits 0 printing `NOTHING_OPEN` when the Run has no open dispatch,
   including one already reported.
7. `wait` and `collect` release a dispatch after reporting its `worker_done`, and
   close its terminal when it was adopted. A batch holding only `question` or
   `escalation` releases nothing.
8. `classify()` reads Antigravity logs only when the worker is Antigravity, and only
   the newest log modified at or after launch. It recognises `not authenticated`.
9. Kiro's adopted argv is `kiro-cli chat …`.
10. A verify group not launched because another group is BLOCKED reads `SKIPPED`.
11. `selector_not_found` from `worker-start` is reported with
    `fix: register the repository with orca repo add --path <repo>`.
12. Verify creates no Orca Run when every group is BLOCKED at preflight.
13. `references/harnesses.md`: GitHub Copilot CLI's Control wake is `background`.
14. `skills/delivery/SKILL.md` and `skills/verify/SKILL.md` name `dely open`, the
    single `dely verify`, `wait --control`, `NOTHING_OPEN` and release after
    `worker_done`; the delivery skill opens the Run with `dely open` before the first
    dispatch and never passes the verify Run.
15. `README.md`'s update and uninstall guidance covers `~/.agents/skills` and
    `~/.kiro/skills` for installs made with `npx skills add`, and says to compare
    `skills/delivery/SKILL.md` by hash.

## Acceptance

| # | Requirement | Instrument | Plausible wrong implementation it rejects | Observed |
| --- | --- | --- | --- | --- |
| 1 | open creates and binds | `node --test`: fake records `run-create` then `run-use --id <same>`; stdout `RUN <id>` | prints the created id without `run-use` | implementer |
| 2 | dispatch refuses an unbound Run | test: Run exists in `run-list` but `run-current` differs → exit 3 and the fix line; no `worker-start` recorded | checks only that the Run exists | implementer |
| 3 | status hides the run id | test: stdout exactly `PASS` | `PASS <runId>` | implementer |
| 4 | verify picks form by wake | test: `--control codex` with no `worker_done` returns `SLEEP` without a consuming `check --wait`; `--control claude` consumes to a verdict | always the blocking form | implementer |
| 5 | wait refuses nudge Control | test: `wait --control codex` exit 3, no `check` recorded; `wait` without `--control` exits 2 | accepts `--control` and ignores it | implementer |
| 6 | wait with nothing open exits | test with a timeout: reported dead dispatch only → `NOTHING_OPEN` exit 0 within one poll | loops until DEADLINE | implementer |
| 7 | release after worker_done only | test: `worker_done` batch → `worker-release` for that id (and `terminal close` when adopted); `question` batch → no release | releases on any settling message | implementer |
| 8 | classify scoped to Antigravity | test with fake HOME: an old agy log holding `RESOURCE_EXHAUSTED`, a Kiro NO_ACK → reason does not name Antigravity; an agy NO_ACK with a newer log → names quota | sorts newest but still scans for every harness | implementer |
| 9 | Kiro argv | test: Kiro pin with a model → `kiro-cli chat` precedes `--model` | `chat` appended after the flags | implementer |
| 10 | SKIPPED label | test: one BLOCKED, one healthy group under the nudge form → healthy reads `SKIPPED` | `FAIL not launched` | implementer |
| 11 | unregistered repo fix | test: fake `worker-start` fails `selector_not_found` → line names `orca repo add` | raw Orca code only | implementer |
| 12 | no orphan Run | test: all groups BLOCKED → no `run-create` recorded | creates then abandons it | implementer |
| 13 | Copilot background | `bash tests/contracts.sh` pin on the Copilot row's wake cell | table left `nudge` | implementer |
| 14 | skills name the new shape | contracts pins for `dely open`, `dely verify --repo`, `wait --run <runId> --control`; absence pins for `verify run` and `verify start` in `skills/` | skill still says `verify run` | implementer |
| 15 | README shadow guidance | contracts pin for `~/.agents/skills` in README | mentions only `~/.kiro/skills` | implementer |
| — | live behaviour | Control re-probe: five rotated deliveries in fresh repositories after release; only the trust step needs a human, no worker terminal remains, the Copilot Control waits in background | a runtime that passes tests but still stalls a live Control | Control, after integration review |

`tests/contracts.sh` is at 279 of 280 lines; new pins must fit by consolidation.

## Not observable by these instruments

Whether a live model follows the skill; the re-probe observes that, for these five
harness models only. Orca nudge delivery. Windows and Linux.
