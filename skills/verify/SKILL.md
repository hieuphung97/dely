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
`../delivery/references/harnesses.md`.

- **background:** run `dely verify run --repo <path> --control <agent>` as a
  background command and end the turn.
- **nudge:** run `dely verify start --repo <path> --control <agent>` and end
  the turn. If it prints `COLLECT_NOW`, run that collect at once. On every
  Orca nudge, and when collect prints `WAITING` and exits 2, run only the
  printed `verify collect` command and end the turn again; never the
  `orca orchestration check` command quoted in the nudge text. While start
  has printed `SLEEP`, Control stays bound to the verify Run and cannot
  dispatch delivery work until collect finishes.
- **unsupported:** cannot be Control.

## Results

On FAIL or BLOCKED, relay the printed fix to the human. A PASS is an Orca
verdict for this repository, these pins and this Control harness; it lapses
when that key changes.
