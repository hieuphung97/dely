---
name: verify
description: Prove the dispatch path for this repository, these pins and this Control harness before the first delivery worker, and whenever a human asks after an account, harness or quota change.
---

# Verify

The launcher is `../delivery/scripts/dely`. Control never answers a harness
trust dialog and never writes a harness store.

## When it runs

Automatically when `dely dispatch` prints `REFUSED`; at the end of
`dely:setup`; and whenever a human asks, for example after switching an
account, a harness update or a quota reset.

## How Control runs it

Read the Control harness's `Control wake` column in
`../delivery/references/harnesses.md`. Open the delivery Run with
`dely open --repo <path> --objective <text>` before the first dispatch — it
prints `RUN <runId>` — and never pass the verify Run. After dispatch, a
background Control runs `dely wait --run <runId> --control <agent>`; `wait`
exits 3 `REFUSED` for a non-background Control. `NOTHING_OPEN exits 0` when
nothing is still open, including a dispatch already reported. After a
`worker_done`, `wait` and `collect` release that dispatch; a batch holding
only `question` or `escalation` releases nothing.

One `dely verify --repo <path> --control <agent>` picks the form from that
wake cell.

- **background:** run `dely verify --repo <path> --control <agent>` as a
  background command and end the turn.
- **nudge:** run `dely verify --repo <path> --control <agent>` and end
  the turn. If it prints `COLLECT_NOW`, run that collect at once. On every
  Orca nudge, and when collect prints `WAITING` and exits 2, run only the
  printed `verify collect` command and end the turn again; never the
  `orca orchestration check` command quoted in the nudge text. While verify
  has printed `SLEEP`, Control stays bound to the verify Run and cannot
  dispatch delivery work until collect finishes. A worker that neither
  sends a message nor exits wakes nobody, so a Control that has heard
  nothing for a long time asks the human.
- **unsupported:** cannot be Control.

## Results

On FAIL or BLOCKED, relay the printed fix to the human. A PASS is an Orca
verdict for this repository, these pins and this Control harness; it lapses
when that key changes.
