# Orca running inside the virtual machine

Captured from a guest booted from `tool-image.qcow2`, with the display server
running on a virtio video device and openbox as the window manager.

## `orca-status.json`

`orca status --json`, run inside the guest over the per-run transport:

    app.running            true
    app.pid                1786
    app.desktopWindowStatus available
    runtime.state          ready
    runtime.reachable      true
    runtime.connectionState connected
    runtime.runtimeId      9386612e-bf79-44a0-9232-173c653dcba8
    runtime.appVersion     1.4.201
    runtime.capabilities   include orchestration.contract.v1

This is a runtime the guest owns. The host's own Orca has a different runtime
identifier, and the guest reached this state with no host process involved.

## The window

A framebuffer capture taken from the host with
`virsh --connect qemu:///system screenshot <domain>` showed the Orca window
rendered inside the guest: the first-run wizard, titled "Pick your default
agent", listing what it had detected **on that guest** — `claude` and
`orca-ide claude-teams`. That is the application's own window on the guest's
display, observed from outside the guest, independently of any layout or focus
claim made inside it.

The capture is a binary file and is deliberately not committed: this
repository's disclosure gate greps every tracked file, and arbitrary binary
content trips it. Reproduce it with the command above against a live domain.

## `terminals.json` and `worker-list.json`

After `orca repo add` and `orca terminal create`, a coordinator terminal
existed, and a dispatch created a **second** terminal for the worker:

    term_50c4a5b6-5060-4cab-ba85-609b60a69f45   the coordinator
    term_c862c124-5808-407a-9ef3-8a3f53eff7c7   the worker's own terminal

`worker-list.json` ties them together: one dispatch (`ctx_098ec148783c`), one
task (`task_0e636c920592`), one run (`run_a52fcdd366b4`), and a worktree
resource owned by that dispatch. Control and the worker are separate sessions
by process and dispatch identity, not by where a panel happens to be drawn.

The worker settled as `start_unknown` / `turn_start_unobserved`: the image
carries no credential, so Claude Code had nothing to authenticate with and its
turn never began. Orca reported that honestly rather than claiming a result.

## What this does not show

A worker that actually ran a turn, a task completed, or a check passed. Those
need a credential reaching the guest, which is the one thing this image is built
never to carry.
