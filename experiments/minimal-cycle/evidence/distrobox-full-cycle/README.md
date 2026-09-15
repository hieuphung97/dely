# One full cycle on the container backend

A fresh Distrobox box from `docker.io/library/ubuntu:24.04`, provisioned with
the pinned Orca package, the pinned Claude Code and a display of its own, then
driven through the same lifecycle the machine backend uses.

    status:    TIMEOUT
    identity:  ENVIRONMENT   markers: container-marker:containerenv, distinct-hostname, reported-virtualisation:docker
    orca:      present, and not the host's installation
    runtime:   ready, application running, window available
    runtime id da12c0a0-3b88-4c6d-b416-c54e0cb06609
    run:       run_cf3d25716c29
    dispatch:  ctx_230b27b63cc9  (claude-opus-5 at high)
    auth:      existing_login, copied and removed again, verified
    export:    CONFIRMED
    cleanup:   DESTROYED

## Nothing rendered on the host's desktop

Distrobox shares the host's display, so an application started in a box appears
on the host's own screen. This run gave the box a display of its own instead —
a virtual framebuffer on `:99`, provisioned into the container — and pointed
Orca at it. The host's desktop was untouched.

## Two things this run found

The container inherits the host's environment, and this runner is itself
launched from inside an Orca terminal. The box's own Orca therefore attested as
the *host's* terminal and refused with
`consumer_fenced: This terminal is attested as … and cannot act as …`. The
runner now removes the host's session variables before any command runs inside
an environment. The machine backend never showed this, because its transport
does not forward the environment — which is luck, not a property worth relying
on.

Provisioning also has to come before anything that needs what it installs: the
repository initialisation ran first and failed with
`executable file not found`, because git arrives with the provisioning steps.

## Where it stops

Exactly where the machine backend stops: the dispatch exists, the worker has a
terminal of its own, and its turn never begins. The deadline fired, the
evidence was exported and confirmed, and the box and its per-run home were
removed. See `../vm-two-sessions/` for what the worker's terminal holds.
