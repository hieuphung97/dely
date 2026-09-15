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

## The virtual display did not keep the application off the host's desktop

This run gave the box a display of its own — a virtual framebuffer on `:99`,
provisioned into the container — and pointed Orca at it. An earlier version of
this file claimed the host's desktop was therefore untouched. **That claim was
wrong, and a later session disproved it.**

Distrobox shares the host's Wayland socket as well as its X socket, and the
application chose Wayland: it ran with `--ozone-platform=wayland` against the
host's own compositor, ignoring the `DISPLAY` it was given. Its windows appeared
on the operator's screen. Worse, because a Distrobox container shares the host's
PID namespace, destroying the container did not end those processes: instances
from seven separate runs were found still alive on the host hours later, each
holding `--user-data-dir` under its own destroyed per-run directory.

Setting `DISPLAY` is not isolation from a desktop. Nothing in this run observed
where the application actually drew, which is why the claim survived as long as
it did.

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

## Where it stops, and what came after

This run reached a dispatch whose turn never began, and stopped there. The
deadline fired, the evidence was exported and confirmed, and the box and its
per-run home were removed. See `../vm-two-sessions/` for what the worker's
terminal held.

Two defects were behind that, and both were found later: the agent was stopped
at first-run questions nobody could answer, and the completion wait was read
from the wrong half of the reply. `../distrobox-settled-cycle/` is the first
run on this backend that got past both.
