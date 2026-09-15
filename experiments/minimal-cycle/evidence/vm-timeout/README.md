# The deadline firing, with the evidence kept

One cycle on the machine backend, run with a fifteen-minute deadline. Every
phase up to the dispatch succeeded; the completion wait blocked for its whole
deadline because the worker's turn never began, and the deadline fired.

    status:    TIMEOUT
    identity:  ENVIRONMENT
    worker:    dispatch ctx_2ff0980c3787 in run run_569a123bb1f3
    export:    CONFIRMED
    cleanup:   DESTROYED

What this shows is the ordering the whole runner is built around, under a
terminal state rather than a happy path: the deadline fired, the project tree
was still fetched, every artifact was still written and re-read from the host,
and only then were the domain, overlay, seed, stack and per-run state removed.
The preserved base image was untouched and the host was left with no domain, no
per-run state and no stray process.

It also shows the deadline is the runner's, not the plane's. `check --wait`
was given the same deadline in milliseconds and would have gone on waiting;
the runner stopped it, classified the run, and kept what it had.

## What this does not show

A worker that ran. The turn never started — see `vm-two-sessions/` for what the
worker's terminal actually held — so nothing here says anything about a task
being done or a check passing.
