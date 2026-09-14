# Plan — one shared Python runner drives one minimal proof cycle on two backends

Decision record: `docs/decisions.md` — "One shared cycle runner, two backend
adapters, export before cleanup".

**Baseline:** `6688d475413f80c862e131f1ebc93cf27a5fc830`.

**Spec:** `/home/paczos/Documents/Warsztat/myDely/docs/projekt-srodowiska-testowego.md`
with `projekt-wspolnej-petli.md`, `projekt-lokalnej-petli-distrobox.md`,
`projekt-lokalnej-petli-vm.md`, and `plan-srodowiska-testowego.md`. Those files
live outside this repository and are not copied into it.

## Goal

`experiments/minimal-cycle/run-cycle` accepts one configuration naming
`backend: distrobox|vm`, mints a `run_id`, creates a fresh identifiable
environment, proves that Orca runs inside that environment rather than on the
host, runs exactly one Claude Code worker through Orca on a clean copy of the
project at a pinned revision, runs exactly one independent check, exports
status, elapsed time, diff, logs and result to a host directory, confirms that
export by re-reading every required artifact, and only then destroys per-run
resources while leaving shared images and bases intact. Timeout, cancellation
and error keep the artifacts and classify the run; they never fabricate
success.

Out of reach in this plan: the separate acceptance test the spec reserves —
a full green cycle on either backend on a host that actually carries Orca,
Claude Code and a built tool image. This host has neither `pulumi` nor an Orca
package inside any container image, so the plan delivers the runner and proves
its rails, not a green backend run.

## Allowed scope

```
experiments/minimal-cycle/**
docs/decisions.md
docs/_plans/2026-09-14-shared-cycle-runner.md
.gitignore
```

Command that produced the list: `git ls-files` at baseline showed no
`experiments/` path and no `.gitignore`, so every path under
`experiments/minimal-cycle/` is created by this plan. `docs/decisions.md` is
the repository's durable decision store named by `AGENTS.md`. No colocated
test of an existing source file applies: the repository carries no Python
before this plan (`git ls-files '*.py'` is empty). `tests/contracts.sh` owns
repository shape, not this runner, and yields nothing here.

## Forbidden scope

`skills/**` — the delivery contract does not change, so neither plugin
manifest version nor the pin in `tests/contracts.sh` moves.
`tests/contracts.sh` — it checks the dely package's structural contract; this
runner is not part of that contract and adding it would couple the two.
`README.md` — the repository README is the newcomer install path for the dely
plugin; an experiment directory is not an install step.
`.github/workflows/contracts.yml` — the runner's own suite needs a Python
step and a decision about running it in CI that this plan does not take.

## Execution envelope

Protected dirty paths: none. `git status --short` was empty at baseline.

Branch, base, remote, and pull-request target: branch
`kacperpaczos/shared-python-runner-distrobox`, base `main`, remote `origin`,
pull request to `origin/main`. No merge.

Resolved phase pins: `AGENTS.md` pins `implement` to Cursor Agent CLI
(`cursor-grok-4.6-high`, default effort) and `review` to Codex CLI
(`gpt-5.6-sol`, high). `command -v cursor-agent` is empty on this host, so the
pinned implement harness cannot be launched and the delivery run cannot
dispatch as pinned. This is recorded as the reason the phases were not
dispatched, not worked around by substituting a harness.

Authority: this plan may branch, commit only its own owned paths, run gates,
push the named branch, and open or update the named pull request. It may not
merge, force-push, stash, reset, clean, or edit anything outside owned scope.

## Global constraints

- Python standard library only at runtime. `yaml` is used when importable and
  a `.json` configuration is always accepted, so the runner never requires a
  package install.
- Repository artifacts are English.
- No file the repository tracks may contain a capital letter immediately
  followed by digits at a token boundary, or the string `pace` followed by at
  most one character and then `id`. Both are repository closure gates and both
  are lexical, so identifiers such as `namespace_id` are forbidden.
- No secret value, and no absolute path to a credential file, is written to a
  manifest, receipt, log, image, seed, stack state, or this repository.

## Tasks

### 1. The run contract is a typed, validated, secret-free artifact

**Behaviour.** A configuration file loads into a validated `RunConfig`, a
`run_id` is minted that carries no secret, statuses are a closed set, log text
passes through a pattern redactor, and a manifest is emitted that satisfies
`schema.json`. A configuration naming an absolute allowlist path, an unknown
backend, a non-positive timeout, or an artifact root inside the per-run state
is rejected before anything is created.

**Direction.** `config.py` holds frozen dataclasses and one `load` that
accepts `.json` always and `.yaml`/`.yml` when `yaml` imports; a missing
`yaml` for a `.yaml` file is a clear error naming the `.json` alternative, not
a silent partial parse. `ids.py` mints
`YYYYMMDDTHHMMSSZ-<host-short>-<random>` where `<host-short>` is a truncated
hash of the host name rather than the host name itself, and `<random>` comes
from `secrets.token_hex`. `status.py` holds `RunStatus`, `CleanupStatus`,
`ExportStatus`, `PhaseStatus` and the process exit code mapping.
`redact.py` matches by pattern — bearer headers, `sk-`-style keys, `ghp_`,
`xox` Slack forms, compact web-token triples, private-key blocks, and any
`key=value`/`"key": "value"` whose key names a token, secret, password, api
key, cookie, or authorization header — plus any absolute path ending in a
known credential file name. `manifest.py` builds the document and validates it
against `schema.json` with a small in-repo required-field checker, because
`jsonschema` is not in the standard library.

**Files.** Create `experiments/minimal-cycle/cycle_runner/{__init__,config,
ids,status,redact,hashing,manifest}.py`, `experiments/minimal-cycle/schema.json`,
and their tests under `experiments/minimal-cycle/tests/`.

**Focused verification.**
`cd experiments/minimal-cycle && python3 -m unittest discover -s tests -t . -v`
fails with the redaction, allowlist and manifest tests red before the module
exists and green after.

**Document impact.** `experiments/minimal-cycle/README.md` owns the
configuration reference; it is written in task 6 and must match the fields this
task validates.

### 2. The shared lifecycle exports before it destroys, and classifies rather than fabricates

**Behaviour.** `run_cycle(config, adapter)` walks prepare, create, bootstrap,
identity, task, check, collect, export, cleanup, close and returns a
`RunResult` carrying the same fields for every backend. Export is confirmed by
re-reading each required artifact from the host path and recomputing its
digest. Cleanup runs only after that confirmation; when export is not
confirmed, no destroy is attempted and `cleanup_status` is `RESIDUE` with the
reason. A task that exceeds `timeout_seconds` collects status and logs,
requests a confirmed stop, verifies it, and settles `TIMEOUT` with every
artifact already exported. An identity verdict that matches the host settles
`BLOCKED` and never runs the task.

**Direction.** `proc.py` runs argv with a deadline, captures stdout and stderr
separately, and returns a `CommandResult` that records argv, exit code,
timings and whether the deadline fired; every captured stream is redacted
before it reaches disk. `hostinfo.py` snapshots the host before and after.
`probe.py` carries one POSIX-shell probe emitting `key=value` lines, a parser,
and `verdict(host, env, expectations)` which rejects a snapshot that carries
no environment marker and repeats the host's own name, machine identity and
home. `project.py` exports the pinned revision with `git archive`, keeps a
pristine baseline, and computes the patch on the host with `difflib` over the
fetched tree, so no diff tool is required inside the environment.
`export.py` writes, then verifies, then writes the receipt. `cleanup.py`
refuses any target that is not a declared per-run resource and asserts the
declared shared resources still exist afterwards. `lifecycle.py` sequences the
phases and owns the classification.

**Files.** Create `experiments/minimal-cycle/cycle_runner/{proc,hostinfo,probe,
project,export,cleanup,lifecycle,result}.py` and
`experiments/minimal-cycle/tests/{fakes.py,test_probe.py,test_project.py,
test_export.py,test_cleanup.py,test_lifecycle.py}`.

**Focused verification.** The suite above, with `test_lifecycle.py` driving a
fake adapter through the settled, blocked, timeout and export-unconfirmed
paths and asserting the order of adapter calls.

**Document impact.** The README's lifecycle section and `schema.json`'s
`cleanup` and `export` blocks must name exactly the states this task returns.

### 3. The Distrobox adapter creates a fresh box with its own home and never mounts the host home

**Behaviour.** `DistroboxAdapter` writes a Distrobox Assemble manifest into the
per-run directory, creates the box from it, executes commands inside it,
moves trees in and out, stops it, removes it, and reports which resources were
per-run. The generated manifest names a per-run home and only the mounts the
configuration lists; it never names the host home directory, and a
configuration that asks for one is rejected.

**Direction.** Use `distrobox assemble create --file <manifest>` and
`distrobox assemble rm --file <manifest>`, with `distrobox enter <name> --`
for execution and `distrobox list` for existence proof, as those are the
documented general interfaces. Because the per-run home is a host directory,
`put_tree` and `fetch_tree` are host copies and need no transport. Do not emit
`--unshare-all`; record in the README that desktop integration is a deliberate
prototype trade-off rather than a sandbox.

**Files.** Create `experiments/minimal-cycle/cycle_runner/adapters/{__init__,
base,distrobox}.py` and `experiments/minimal-cycle/tests/test_adapter_distrobox.py`.

**Focused verification.** Tests assert the rendered manifest text, that a
configuration naming the host home is rejected, and that the destroy plan lists
only per-run paths. A dry-run integration test runs
`distrobox assemble create --dry-run --file <manifest>` when `distrobox` is on
`PATH` and skips otherwise.

**Document impact.** README backend section for Distrobox.

### 4. The VM adapter builds per-run domain, overlay and seed over an unmodified base

**Behaviour.** `VmAdapter` renders a Pulumi Python program and stack settings
into a per-run directory, records the pinned provider and version, renders a
cloud-init NoCloud seed that carries no credential, creates the overlay as a
qcow2 image backed by the preserved base, brings the stack up, executes
commands inside the guest over the configured transport, moves trees, destroys
the stack, and reports per-run versus shared resources. The base image is
never opened for writing and never appears in a destroy plan.

**Direction.** The adapter refuses to run when `pulumi` is absent, when the
base image digest does not match the pinned value, or when the provider
version is unpinned — each as a preflight failure naming the missing fact, not
a guess. Overlay creation uses `qemu-img create -f qcow2 -b <base> -F qcow2`,
which the tool documents, and is never run against an image an active domain
holds. The seed is `user-data` plus `meta-data` on a `cidata` volume.

**Files.** Create `experiments/minimal-cycle/cycle_runner/adapters/{vm.py,
vm_program.py,vm_seed.py}` and `experiments/minimal-cycle/tests/test_adapter_vm.py`.

**Focused verification.** Tests assert the seed carries none of the auth
values, that the destroy plan excludes the base image, that a wrong base digest
blocks, and that the overlay command names the base as a backing file rather
than as the output.

**Document impact.** README backend section for the virtual machine, including
that the tool image is built separately and the runner only consumes it.

### 5. Auth reaches the environment by one declared method and leaves no secret behind

**Behaviour.** `bootstrap_auth(config, adapter)` implements exactly the
configured mode, writes an `auth-receipt.json` naming the method, the
non-secret reference, the transfer target and the observed status, and never
records a secret value, length, prefix or absolute source path. `existing_login`
copies only relative allowlist entries into the per-run configuration
directory with owner-only permissions; `short_lived_token` passes a value
through the process environment for the run and never writes it; `api_key_helper`
records the helper contract and passes no value at all. The worker launcher
builds the Orca argv from pinned values, records it, and waits for the
worker's own settling message.

**Direction.** Auth material is removed from the per-run configuration
directory before cleanup, and the removal is verified. The launcher composes
`orca orchestration run-create`, `worker-start` with `--agent`, `--model`,
`--effort` and `--json`, and `check --wait --types worker_done,escalation,question`,
which are the flags this host's Orca reports. It writes the worker prompt to a
file inside the environment rather than inlining it as a shell argument.

**Files.** Create `experiments/minimal-cycle/cycle_runner/{auth,worker}.py`,
`experiments/minimal-cycle/fixtures/evidence-task/prompt.md`, and
`experiments/minimal-cycle/tests/{test_auth.py,test_worker.py}`.

**Focused verification.** Tests feed a known token through every mode and
assert it appears in no receipt, manifest, rendered seed or log, and that the
launcher's argv carries the pinned model and effort.

**Document impact.** README auth section, stating that the runner verifies the
method and status and never reads a secret into an artifact.

### 6. One command runs, reports, and proves the rails on this host

**Behaviour.** `run-cycle preflight` and `run-cycle run` are usable from the
experiment directory, exit with the mapped code, and write the artifact tree
the spec names. A real preflight on this host reports the Distrobox backend
usable and the virtual-machine backend blocked on the absent `pulumi`, and a
real Distrobox cycle creates a fresh box, proves it is not the host, stops at
the Orca identity gate because the image carries no Orca, exports every
artifact, and destroys only the per-run box and home.

**Direction.** The command-line interface is `argparse` with subcommands
`preflight`, `run`, and `selftest`. Evidence from the real runs is committed
under `experiments/minimal-cycle/evidence/` with digests redacted where
required; the artifact root itself stays untracked through `.gitignore`.

**Files.** Create `experiments/minimal-cycle/{run-cycle,README.md,
config.distrobox.example.yaml,config.vm.example.yaml}`,
`experiments/minimal-cycle/cycle_runner/cli.py`,
`experiments/minimal-cycle/evidence/**`, and `.gitignore`.

**Focused verification.** The real runs above, with their exported manifests
quoted in the handoff.

**Document impact.** `docs/decisions.md` gains the settled record; this plan is
deleted in the release commit.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| No silent host fallback: a probe result equal to the host's own snapshot is rejected | `tests/test_probe.py::test_host_snapshot_is_rejected` | A verdict that only asserts `command -v orca` returned zero and an exit status of zero — present, runs, returns a pass, and passes identically when the probe ran on the host | |
| Export is confirmed before any destroy | `tests/test_lifecycle.py::test_no_destroy_when_export_unconfirmed` | A lifecycle that destroys in a `finally` block and then reports the export status — it runs, returns a pass on the happy path, and still deletes evidence when export fails | |
| The receipt proves bytes on the host, not bytes in memory | `tests/test_export.py::test_receipt_fails_when_artifact_changes_after_write` | A receipt built from the buffer that was written, which passes every happy-path test while never re-reading the file | |
| Cleanup removes per-run resources only | `tests/test_cleanup.py::test_shared_base_survives_cleanup` | A cleanup that removes the overlay's parent directory, which passes when the base lives elsewhere and destroys it when it does not | |
| Redaction is by pattern, not by known literal | `tests/test_redact.py::test_token_never_seen_before_is_redacted` | A redactor seeded with the tokens the run knows about, which passes every test that reuses those tokens | |
| Timeout keeps the artifacts and classifies the run | `tests/test_lifecycle.py::test_timeout_exports_before_stop_and_settles_timeout` | A lifecycle that raises on the deadline and lets the caller clean up, which passes a test asserting only the returned status | |
| `run_id` carries no secret and stays unique and sortable | `tests/test_ids.py::test_run_id_excludes_auth_reference_and_host_name` | An id that appends `auth.reference` for traceability, which is unique, sortable, and leaks | |
| The manifest carries every required field on every path, including failures | `tests/test_manifest.py::test_required_fields_present_on_blocked_run` | A manifest writer that fills `cleanup` and `check` only when they ran, which validates on the settled path | |
| Both adapters satisfy one result contract | `tests/test_adapter_contract.py::test_every_adapter_implements_the_interface` | An adapter that returns a plain dictionary with the same keys, which reads the same in a manifest and drops the declared per-run resource list | |
| The Distrobox manifest never mounts the host home | `tests/test_adapter_distrobox.py::test_host_home_mount_is_refused` | An adapter that passes the configured mounts through unchanged, which is correct for every configuration that does not ask for the host home | |
| The virtual-machine base image is never written and never destroyed | `tests/test_adapter_vm.py::test_base_image_is_backing_file_and_not_in_destroy_plan` | An overlay command that names the base as the output path, which produces a working disk and silently consumes the shared base | |
| No credential reaches the seed, the stack settings, or the receipt | `tests/test_auth.py::test_no_auth_material_in_any_rendered_artifact` | A receipt that records the token's length and first four characters for debugging, which contains no full secret and still discloses one | |
| Preflight blocks instead of inventing a path | `experiments/minimal-cycle/run-cycle preflight --config config.vm.example.yaml` on this host | A preflight that reports the backend usable because the adapter module imported, which passes on a host with no `pulumi` at all | |
| The whole cycle runs for real and stops at the identity gate rather than on the host | `experiments/minimal-cycle/run-cycle run --config <distrobox config>` on this host | A run that finds no Orca inside the box and uses the host's `orca`, which produces a complete green manifest | |

**Cannot be observed:** that Orca actually starts, shows a window, and drives a
Claude Code worker inside either backend. No image on this host carries Orca,
`pulumi` is absent, and no tool image has been built, so every instrument here
stops at the identity gate or below it. The separate acceptance test the spec
reserves is the only thing that can observe those, and this plan does not
claim them.

## Stop conditions

`BLOCKED` rather than a workaround when: the pinned implement or review
harness is absent and a substitute would have to be chosen; a real cycle would
need a credential to be read; a backend would have to fall back to the host to
produce a green result; or `pulumi`, an Orca package, or a verified base image
would have to be installed on this host to finish a task.

Assumptions that hold for one environment and are not verified for the others:
the Distrobox path is exercised against rootless Podman with
`docker.io/library/ubuntu:24.04` already present locally; nothing here verifies
Docker as the container backend, another base image, or another architecture.
The virtual-machine path is exercised only through rendering and refusal —
`qemu:///session` answers and `/dev/kvm` exists, but no domain is created.

## Closure gates

```
git diff --check
bash -n tests/contracts.sh
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null
bash tests/contracts.sh
test "$(wc -l < tests/contracts.sh)" -le 280
test ! -e git-hooks/pre-push
test ! -e docs/delivery-log.md
test ! -e docs/findings.md
test ! -e docs/harness-surface.md
test ! -e docs/options.md
test ! -e docs/_plans/2026-08-24-automation-first-dely-design.md
test ! -e bin/delivery-doctor
test ! -e bin/delivery-evidence
test ! -e hooks/hooks.json
test ! -e hooks/grok-hooks.json.template
test ! -e hooks/post-tool-journal.sh
test ! -e hooks/session-start-context.sh
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

All run from the repository root. The runner's own suite runs from
`experiments/minimal-cycle`:

```
python3 -m unittest discover -s tests -t . -v
```
