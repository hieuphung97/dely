# Control and a separate coder session, inside the virtual machine

Captured from a live guest during one cycle, over the run's own transport, while
the completion wait was still blocking.

## Two sessions, by identity rather than by layout

`terminals.json` holds two terminals in the same worktree:

    term_388f8f62-dfea-4469-8aa7-1240fead6d28   the coordinator, opened by the runner
    term_977b5b45-c86b-4e16-a32b-9669801c43f9   the worker's own, created by the dispatch

`worker-list.json` ties them together: one Dispatch, one Task, one Run, and a
worktree resource owned by that Dispatch. Neither claim depends on where a panel
was drawn, which one had focus, or whether anything was visible at all — the
capture was taken through the command line, not from a screen.

## What the worker's terminal actually shows

`worker-terminal-screen.txt`:

    cycle@dely-cycle-…:~/project$ claude '--dangerously-skip-permissions' \
      '--model' 'claude-opus-5' '--effort' 'high'

That is the command Orca composed for this dispatch: the pinned model and the
pinned effort, and the permission default this execution plane configures for
the `claude` agent. The runner did not write that line; it named the agent, the
model and the effort, and the plane turned them into this.

## Where it stops, and what that means

The line is present and the turn never began. Orca reports it as
`start_unknown` / `turn_start_unobserved`, with liveness `unverifiable` and
reason `missing_status`, and says so in those words rather than calling the
worker dead. The runner classifies the run `UNKNOWN` for the same reason: the
dispatch exists, the evidence is durable, and nothing here knows whether the
worker ran.

This is the honest boundary of what has been shown. The dispatch path works end
to end — a Run, a Task, a Dispatch, a second session with the right launch —
and the agent's first turn has not been observed to start inside this guest.

## What this does not show

A turn that ran, a file the worker wrote, or a check that passed. The evidence
above is what was true at the moment it was taken, and it does not become more
than that by being detailed.
