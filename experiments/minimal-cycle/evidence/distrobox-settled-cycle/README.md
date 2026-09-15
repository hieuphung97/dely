# One cycle that settled, with the check passing

The first complete run: a fresh box, an agent that did the task, and an
independent check that read the result and agreed.

    status:    SETTLED
    identity:  ENVIRONMENT
    run:       run_5a5f2688c661
    dispatch:  ctx_68f16395149d  (claude-opus-5 at high)
    worker:    worker_done, outcome succeeded
    check:     OK (exit 0)
    export:    CONFIRMED
    cleanup:   DESTROYED

## What the worker did, in its own words

`dispatch-completion-wait.json` is the reply that settled the run. It carries
the worker's own message:

> Created …/project/evidence.txt containing exactly 'dely-cycle-marker' with no
> trailing newline, using printf. Verified with od -c and wc -c: 17 bytes, final
> byte is 'r', no 0x0a present.

with `"outcome":"succeeded"` in its payload. `check.stdout` is the independent
check run afterwards, outside that session: `marker matched`. `diff.patch` and
`task-artifact-evidence.txt` are the file itself, 17 bytes, no trailing byte.

## The two things that had to change first

Every earlier run stopped with the launch line standing unexecuted in the
worker's terminal, and the plane reporting `turn_start_unobserved`.

Claude Code asks a home it has never run in four questions, and each is a modal
nobody in a disposable environment can answer: finish onboarding, which offers
a theme and an interactive sign-in; trust this folder; allow the external
imports this project's instructions declare; accept the permission mode it was
launched with. A copied token answers none of them. `first-run-state.json`
records the two small files the runner now writes, and names the four questions
in words — these are pre-approvals, and a reader should be able to see them and
disagree.

Under that sat a second defect the first was hiding. The completion wait was
read from the reply's top level, which is the request envelope; the delivery is
under `result`. So a worker that had finished and reported was recorded as one
that never answered, on a run whose artifact was already correct on disk. The
three replies are now exported — `dispatch-*.json` — because a verdict with no
reply behind it cannot be checked by the next reader, and this one could not be.

## What this does not show

The machine backend: see `../vm-settled-cycle/`. It does not show isolation —
Distrobox mounts the host home, and `preflight.json` records that as a declared
compromise rather than a claim. It does not show that a second, different task
would pass.

Paths and the host user are scrubbed; the identifiers are the run's own.
