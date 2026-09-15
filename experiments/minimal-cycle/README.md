# Minimal cycle runner

One Python runner drives one minimal proof cycle on a disposable environment,
through one of two backends, and answers a single narrow question:

> Can a fresh environment be created, driven through Orca to one Claude Code
> worker on a clean copy of a project, checked independently, exported to the
> host, and destroyed — without losing the evidence and without quietly falling
> back onto the host?

It is not a benchmark, not an evaluation of a model or of a tester, and not a
task matrix. It measures plumbing.

## What is here

```
run-cycle                     the command line
schema.json                   the required shape of a run manifest
config.distrobox.example.yaml an example configuration for the container backend
config.vm.example.yaml        an example configuration for the machine backend
cycle_runner/                 the runner
cycle_runner/adapters/        one adapter per backend, behind one interface
fixtures/evidence-task/       the one small task the worker is given
tests/                        the suite, including the counterexamples
evidence/                     what the runner actually did on one host
```

The runner uses the Python standard library at runtime. A configuration may be
written as JSON always, or as YAML when a parser is importable; the error names
the alternative rather than parsing half a document.

## Running it

```bash
cd experiments/minimal-cycle
./run-cycle preflight --config /path/to/config.yaml
./run-cycle run --config /path/to/config.yaml
```

`preflight` reports, fact by fact, whether this host can run the configured
backend, and exits non-zero when it cannot. `run` mints a run identifier,
performs the whole cycle, and exits with the code its status maps to. Pass
`--run-id` to pin the identifier, and `--json` to get the machine-readable form
of either command.

The suite needs nothing installed:

```bash
python3 -m unittest discover -s tests -t . -v
```

## The cycle

```
prepare -> create -> bootstrap -> identity -> task -> check
        -> collect -> export -> cleanup -> close
```

Two orderings are the point of the whole runner.

**Evidence is exported before anything is destroyed.** `collect` brings the
project tree back to the host, `export` writes every artifact and then re-reads
each one from its host path and recomputes its digest. Only an export where
every required artifact matches releases the run to stop and destroy anything.
An unconfirmed export, or an unconfirmed stop, leaves the environment standing
and records residue with the reason.

**The task runs only after the identity gate.** The same shell probe runs on the
host and inside the environment. A result that carries no environment marker and
repeats the host's own name, machine identity and home is a host fallback, and a
host fallback stops the run. So does finding no Orca inside the environment: the
run is blocked, never redirected to the host's installation.

## Statuses

| Status | Exit | Meaning |
| --- | --- | --- |
| `SETTLED` | 0 | every phase ran, the check observed the marker, the export was confirmed and the per-run resources are gone |
| `ERROR` | 1 | the run completed but something it promised did not hold — usually the check |
| `TIMEOUT` | 2 | the task reached the configured deadline; the artifacts were still exported |
| `CANCELLED` | 3 | the run was stopped deliberately |
| `BLOCKED` | 4 | a gate refused: preflight, auth, the identity verdict, or a missing Orca |
| `CLEANUP_FAILED` | 5 | everything else held, but a per-run resource survived |
| `UNKNOWN` | 6 | the export was not confirmed, so nothing about the run rests on complete evidence |

A status name is a classification of the manifest, never a substitute for it.

## Artifacts

```
$artifact_root/<run_id>/
  manifest.json              the whole run, validated against schema.json
  preflight.json             what the host could and could not do
  backend-status.json        the environment and its declared resources
  auth-receipt.json          the method and its status, never its material
  host-before.json           the host before the run
  host-after.json            the host after it, and what changed
  identity/host-probe.txt    the probe as the host answered it
  identity/environment-probe.txt  the probe as the environment answered it
  identity/orca-status.json  what Orca reported inside the environment
  check.stdout / check.stderr  the independent check, as a process
  diff.patch                 what the task changed, computed on the host
  task-artifact/             the file the task was asked to produce
  logs/runner.log            the runner's own narration
  logs/commands.jsonl        every command, with timings and exit codes
  run-before-cleanup.json    the result as it stood when the export was taken
  export-receipt.json        each artifact re-read from the host, with its digest
  cleanup.json               what was removed, what was kept, and how that was checked
```

`manifest.json`, `cleanup.json` and `host-after.json` are written after cleanup,
so they are deliberately outside the export receipt: the receipt proves what the
host held *before* anything was destroyed, which is the only moment at which
that proof is worth anything.

Every stream is redacted on the way out. Redaction matches shapes — bearer
headers, key prefixes, compact web tokens, private-key blocks, absolute paths to
credential files, and any assignment whose key names a secret — so a credential
this run has never seen is still removed.

## The two backends

### Distrobox

A fresh box from a declared Distrobox Assemble manifest, with its own home and
its own copy of the project, created and destroyed through Assemble rather than
through a container manager this runner would have to become.

**What Distrobox does not give you.** Distrobox exists to integrate with the
host, and it mounts the invoking user's home directory into every box at its own
path. There is no flag that suppresses it. A separate per-run home limits which
state the run writes; it does not make the host's credentials unreachable from
inside the box.

The runner does not assert this either way. Preflight asks Distrobox what it
would actually mount, with `distrobox assemble create --dry-run`, and reads the
rendered container command. If the host home is mounted, the run is blocked
until `distrobox.accept_host_home_mount` records that the compromise is
deliberate — and the manifest then carries that acknowledgement.

Extra mounts are checked separately: a mount naming the host home, a directory
above it, or any known credential directory under it is refused outright.

`--unshare-all` is not written for you. It exists, it may conflict with the
graphical and message-bus access Orca needs, and choosing it is a decision to
make against a real Orca launch rather than a default to inherit.

### Virtual machine

A per-run libvirt domain declared with Pulumi in Python, over a qcow2 overlay
whose backing volume is a preserved tool image, with a cloud-init NoCloud seed
and an ssh transport. The guest is Ubuntu Server 24.04 LTS from Canonical's
cloud image, verified against the published checksum — a disk image for qemu,
never a container image.

Run `host/prepare-host` once. It installs the pinned Pulumi, points it at a
local file state backend, builds the python environment carrying the pinned
software development kit and libvirt provider, downloads and verifies the base
image, and declares a storage pool over the image directory. `--check` verifies
all of that and changes nothing.

`host/packer/build-tool-image` then builds the one tool image: it boots the
verified base under packer's qemu builder, installs the pinned Orca package, the
pinned Claude Code, a graphical session for the Orca window, and the guest
agent, then records a metadata file naming every version and digest that went
in. The build key is generated per build and removed from the image before
shutdown.

**Nothing about the provider is assumed.** The rendered program is parsed, every
provider class and keyword it names is collected, and each is checked against
the provider actually importable from the pinned environment. Preflight blocks
when a field does not exist and also when the check cannot be run at all. That
check has already earned its place: it caught a class name the program had
wrong before a single domain was created.

Preflight reads host facts rather than trusting configuration: that the Pulumi
state backend is a local file backend and not the hosted service, that the
storage pool and network are active, that the base image digest matches, and
that this emulator actually offers the configured graphics type. On the machine
this was built on, qemu has no spice at all — it offers sdl, vnc and dbus — so
the graphics finding is a refusal, not a formality.

Two facts about the guest's network are worth stating, because both were found
by running it. The domain takes a bridged interface for the runner's transport,
and a second, user-mode interface for the guest's own outbound traffic: a
bridged guest cannot reach the internet when the host routes through a virtual
private network or its firewall declines to forward, and a user-mode interface
is served by qemu itself and does not use that path. And an address is not
readiness — libvirt hands out the lease while the guest is still booting, so
creation is not finished until the guest answers a command and its first-boot
configuration has settled.

The base image is a shared resource, opened only as a backing volume, so it can
never appear in a destroy plan. The per-run overlay, seed, domain, stack and
state are all per-run and go together.

## Auth

Exactly one declared method runs, and none of them writes a credential value, a
length, or a prefix into any artifact.

- `existing_login` copies only the relative allowlist entries from the host home
  into the per-run home with owner-only permissions, and removes them before
  cleanup. An entry that is absent blocks the run. On Distrobox this buys less
  than it looks like, for the reason above.
- `short_lived_token` passes the value of one named variable to the worker
  process for the duration of the run. On Distrobox the name alone is forwarded
  to the container manager, so the value never appears in a command line. It is
  never written to a file, an image, a seed, stack state, or a log.
- `api_key_helper` declares a helper command in the per-run settings and passes
  no value at all.

An absolute path to a credential file is refused in the configuration outright,
and a configuration key whose name means "secret" is refused with it.

One limit is worth stating rather than glossing. On Distrobox a forwarded value
never appears in a command line: the container manager is given the variable's
*name* and reads the value from the runner's own environment. On the machine
backend the transport is ssh, and the value is placed on the guest command line,
so it is visible in the guest's process table for the life of that command. It
is redacted from everything the runner captures, and the guest is destroyed
after the run, but that is a bounded exposure and not an absence of one.

## Acceptance

Each rail below is proved by an instrument that rejects an implementation which
is present, runs, and returns a pass — not one that is merely absent.
`python3 counterexamples.py` applies each wrong implementation in turn and
checks that its instrument goes red; `python3 counterexamples.py --list` prints
the table with the tests each row runs. The recorded sweep is in
`evidence/counterexamples.txt`.

| Requirement | Instrument | Evidence |
| --- | --- | --- |
| A probe result equal to the host's own snapshot is rejected | `counterexamples.py` case `no-host-fallback` | `evidence/counterexamples.txt` |
| An orca resolving to the host's installation does not count as present | case `orca-is-the-environments-own` | `evidence/run-blocked-on-host-orca/` |
| Cleanup runs only after a confirmed export | case `export-before-destroy` | `evidence/counterexamples.txt` |
| Cleanup runs only after a confirmed stop | case `stop-must-be-confirmed` | `evidence/counterexamples.txt` |
| Evidence is collected and exported before anything is destroyed | case `destroy-after-export` | `evidence/counterexamples.txt` |
| The receipt proves bytes on the host, not bytes in memory | case `receipt-is-a-re-read` | `evidence/run-blocked-on-host-orca/export-receipt.json` |
| A per-run path containing a shared resource is refused | case `cleanup-only-per-run` | `evidence/counterexamples.txt` |
| Redaction catches a credential this run has never seen | case `redaction-by-shape` | `evidence/counterexamples.txt` |
| The manifest carries every required field on every path | case `manifest-required-fields` | `evidence/run-blocked-on-host-orca/manifest.json` |
| The run identifier discloses neither the host name nor the auth reference | case `run-id-carries-no-name` | `evidence/counterexamples.txt` |
| A secret-shaped value under a dull key is refused in the configuration | case `config-refuses-a-secret` | `evidence/counterexamples.txt` |
| No credential value, length or prefix reaches a receipt | case `auth-leaves-no-material` | `evidence/run-blocked-on-host-orca/auth-receipt.json` |
| An unacknowledged host-home mount blocks the run | case `host-home-mount-acknowledged` | `evidence/preflight-distrobox.txt` |
| Preflight inspects without creating the run's state | case `preflight-leaves-no-residue` | `evidence/counterexamples.txt` |
| The preserved base image is never the overlay's output path | case `base-is-only-a-backing-file`, and a real `qemu-img` backing-chain test | `tests/test_adapter_vm.py` |
| A create that fails partway records what it may have left behind | case `failed-create-names-its-residue` | `evidence/counterexamples.txt` |
| A value forwarded into the guest is redacted from captured output | case `forwarded-value-is-redacted` | `evidence/counterexamples.txt` |
| An unverified provider schema blocks the machine backend | case `provider-schema-verified` | `evidence/preflight-vm.txt` |
| Preflight blocks rather than inventing a path | `./run-cycle preflight` on a host with no `pulumi` and no tool image | `evidence/preflight-vm.txt` |
| A real cycle stops at the identity gate rather than using the host | `./run-cycle run` on this host | `evidence/run-blocked-on-host-orca/manifest.json` |
| The rendered program names only classes and fields the pinned provider has | `tests/test_adapter_vm.py::ProviderSchemaIntegrationTest` against the real provider | `evidence/preflight-vm.txt` |
| A hosted state backend blocks the machine backend | case `state-backend-is-local` | `evidence/counterexamples.txt` |
| A graphics type this emulator lacks blocks the run | case `graphics-type-is-supported` | `evidence/preflight-vm.txt` |
| An argument vector survives the transport intact | case `remote-command-is-quoted` | `evidence/counterexamples.txt` |
| Creation waits for the guest to answer, not just to take an address | case `an-address-is-not-readiness` | `evidence/counterexamples.txt` |
| A real machine cycle creates a domain, proves a distinct kernel, and destroys it | `./run-cycle run` on this host | `evidence/vm-blocked-on-absent-orca/manifest.json` |

## What no instrument here observes

Orca starting inside either backend, a window bound to that instance, a Claude
Code worker driven through it, or a login surviving a run. Both backends reach
their identity gate and stop there, for the same honest reason: the image they run does not carry Orca. `evidence/README.md` says
exactly where this host stopped and what it did prove on the way.
