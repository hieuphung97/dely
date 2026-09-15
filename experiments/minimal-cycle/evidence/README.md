# What this runner actually did on one host

Everything here was produced by the committed code on a Fedora host with
rootless Podman, Distrobox 1.8.2.5, `qemu-img`, `virsh` answering
`qemu:///session`, `/dev/kvm` present, no `pulumi`, and no prepared tool image.
Nothing here was written by hand.

## What was scrubbed, and what was not

Three substitutions were applied to the files in this directory, and only
these: the host's home directory became `<host-home>`, the host user name
became `<host-user>`, and the raw `machine_id` and `boot_id` lines in the probe
captures became `<scrubbed>`. Digests, sizes, timings, exit codes, statuses and
reasons are untouched. The manifests already store host identifiers as digests
rather than as names, so nothing there needed scrubbing.

## `preflight-distrobox.txt`

The container backend on this host, usable. The last finding is the one that
matters: Distrobox mounts the host home into every box and has no flag to
suppress it, so the run is blocked until the configuration records that
compromise deliberately. That finding is not a claim — it is the result of
reading what `distrobox assemble create --dry-run` actually renders.

## `preflight-vm.txt`

The machine backend on this host, blocked, exit code 4. Three findings refuse:
`pulumi` is not installed, the provider schema has not been checked against a
pinned version, and there is no prepared tool image. The backend reports what is
missing rather than inventing a path around it.

## `run-blocked-on-host-orca/`

One real cycle, `20260915T001500Z-aaaaaa-00000003`, produced by the committed code. A fresh box was created from `docker.io/library/ubuntu:24.04`
with its own home, the project was exported at a pinned revision and copied in,
the identity probe ran on both sides, and the run stopped at the identity gate.
Every artifact was exported and confirmed, and the box and its per-run state
were then destroyed while the image was kept.

    status:    BLOCKED
    identity:  ENVIRONMENT
    export:    CONFIRMED
    cleanup:   DESTROYED
    why:       the environment resolved orca to the host's own installation at
               <host-home>/.config/orca/linux-orca-cli-shim/orca; the run stops
               rather than driving the host from inside a disposable environment

Compare the two probe captures. The box answered with its own host name, its own
container marker and the per-run home — a real environment. It also answered
with the *host's* `orca_path` and an empty `orca_version`: Distrobox mounts the
host home and preserves `PATH`, so the host's launcher resolves inside the box
and cannot run there.

**This is a defect the first run found.** Before it, the gate asked only whether
`command -v orca` resolved. It did, so the run proceeded and failed later at
`worker-start` with `/opt/Orca/resources/bin/orca-ide: No such file or
directory`. Had the container carried a working launcher pointing back at the
host, that run would have produced a complete green manifest for work the host
did. The gate now requires an Orca that is not the host's binary and that
reports a version inside the environment; `counterexamples.py` case
`orca-is-the-environments-own` shows the old rule letting a host-driven run
settle `SETTLED`.

## `vm-blocked-on-absent-orca/`

One real machine cycle. Pulumi declared a per-run overlay over the preserved
Ubuntu base, a cloud-init seed and a domain; the guest booted, took an address,
answered, and settled; the project was copied in at a pinned revision; the probe
ran on both sides; and the run stopped at the identity gate. Everything was
exported and confirmed, and the domain, overlay, seed, stack and per-run state
were then destroyed while the base image stayed byte-identical.

    status:    BLOCKED
    identity:  ENVIRONMENT
    markers:   distinct-machine-identity, distinct-boot-identity,
               distinct-hostname, reported-virtualisation:kvm
    export:    CONFIRMED
    cleanup:   DESTROYED
    why:       orca is not present inside the environment; the run stops rather
               than using the host's installation

Compare the probe captures. The guest reported an Ubuntu kernel and `virt=kvm`;
the host reported a Fedora kernel and `virt=none`. The guest resolved the
project to `/home/cycle/project`, its own copy. That is a separate kernel, which
is what this backend buys and the container backend does not.

Three defects were found by running this, not by reading it. The provider reads
interface addresses through the guest agent when the agent is declared, and the
base image does not run one, so declaring it failed the create. `ssh`
concatenates everything after the destination into one string that the guest's
shell re-parses, so the probe's positional argument was lost and the guest
resolved an empty project path. And libvirt hands out the lease while the guest
is still booting, so the first command hit a refused connection five
milliseconds after the address appeared. Each is now a rail with a
counterexample.

## `counterexamples.txt`

`python3 counterexamples.py`. Each line replaces one rail with an
implementation that is present, runs and returns a pass, then runs the tests
that are supposed to reject it. `RED` means the instrument rejected the wrong
implementation. A row that reported `GREEN` would be a row proving nothing.

## What none of this shows

No Orca has started inside either backend on this host, no window has been bound
to such an instance, no Claude Code worker has been driven through one, and no
login has survived a run. The machine backend has never created a domain here.
Those need a host carrying Orca in the chosen image, a built tool image and a
pinned libvirt provider, and they are the separate acceptance test this work
does not claim to have passed.
