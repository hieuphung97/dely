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
- **nudge:** run `dely verify start --repo <path> --control <agent>`, end the
  turn, and on every Orca nudge run only the printed `verify collect` command,
  never the `orca orchestration check` command quoted in the nudge text.
- **unsupported:** cannot be Control.

## Results

On FAIL or BLOCKED, relay the printed fix to the human. A PASS is an Orca
verdict for this repository, these pins and this Control harness; it lapses
when that key changes.
