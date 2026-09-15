# What this runner actually did on one host

Everything here was produced by the committed code on one Fedora host with
rootless Podman, Distrobox, `qemu-img`, `virsh` on `qemu:///system`, `/dev/kvm`,
Pulumi 3.262.0 with a local `file://` backend, and a Packer-built tool image.
Nothing here was written by hand.

## What was scrubbed, and what was not

Three substitutions were applied to the files in this directory, and only
these: the host's home directory became `<host-home>`, the host user name
became `<host-user>`, and the raw `machine_id` and `boot_id` lines in the probe
captures became `<scrubbed>`. Digests, sizes, timings, exit codes, statuses and
reasons are untouched. The manifests already store host identifiers as digests
rather than as names.

## Read these first

### `distrobox-settled-cycle/`

The one complete run. A worker read the prompt, wrote the marker byte for byte,
reported `worker_done` with outcome `succeeded`, and an independent check run
outside that session agreed. `SETTLED`, exported, destroyed.
`dispatch-completion-wait.json` carries the worker's own message.

### `vm-unobserved-turn/`

The machine backend, at the same commit, on the same host, not completing.
Domain created, distinct kernel proved, Orca ready, coordinator terminal open,
dispatch made — and the worker's turn never observed.
`dispatch-worker-terminal.txt` is what the agent's terminal actually held.
This is where the work currently stops, and it is not a green run.

## Earlier runs, kept because each one moved a rail

### `preflight-distrobox.txt`, `preflight-vm.txt`

Both backends refusing on a host that could not yet run them. The container
finding that matters: Distrobox mounts the host home into every box and has no
flag to suppress it, so a run is blocked until the configuration records that
compromise deliberately.

### `run-blocked-on-host-orca/`

The first real cycle, stopped at the identity gate because the box resolved
`orca` to the *host's* launcher through the mounted host home. Presence of a
command is not presence of an installation. Counterexample
`orca-is-the-environments-own` shows the old rule letting a host-driven run
settle `SETTLED`.

### `vm-blocked-on-absent-orca/`

The first real machine cycle: Pulumi declared the overlay, seed and domain, the
guest booted, answered and settled, and the run stopped because the image
carried no Orca. Three defects came out of running it — the guest agent broke
domain creation, `ssh` flattened the probe's argument vector, and a DHCP lease
is not readiness.

### `orca-in-vm/`, `distrobox-own-orca/`

Orca installed and reporting `ready` inside each backend, with its own runtime
identity rather than the host's.

### `vm-two-sessions/`, `vm-dispatch-unverifiable/`, `vm-timeout/`

Control and a separate coder session proved by identity rather than by layout;
a dispatch the plane could not verify; a deadline firing with every artifact
kept and the environment destroyed.

### `distrobox-full-cycle/`

One container cycle on a display of its own. Its own README corrects a claim it
originally made: the virtual display did **not** keep the application off the
host's desktop.

### `counterexamples.txt`

`python3 counterexamples.py`. Each line replaces one rail with an
implementation that is present, runs and returns a pass, then runs the tests
that are supposed to reject it. `RED` means the instrument rejected the wrong
implementation. A row reporting `GREEN` would be a row proving nothing.

## What none of this shows

A second, different task. A run on any host but this one. A completed cycle on
the machine backend. Isolation on the container backend: it mounts the host
home, shares the host's PID namespace and the host's Wayland socket, and the
runner records that rather than claiming otherwise.
