#!/usr/bin/env python3
"""Run every acceptance counterexample and check its instrument goes red.

Each entry replaces a rail with an implementation that is present, runs, and
returns a pass — the wrong implementation a green suite would otherwise
accept — and then runs the tests that are supposed to reject it. A case that
stays green is a row whose instrument proves nothing.

    python3 counterexamples.py            run them all
    python3 counterexamples.py --list     print the table
    python3 counterexamples.py --only <name>

The edit is applied to the working tree and restored afterwards, including on
failure, so nothing is left mutated.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent


@dataclass(frozen=True)
class Counterexample:
    """One wrong-but-passing implementation, and what should reject it."""

    name: str
    requirement: str
    path: str
    original: str
    replacement: str
    instruments: tuple[str, ...]


CASES: tuple[Counterexample, ...] = (
    Counterexample(
        name="no-host-fallback",
        requirement="A probe result equal to the host's own snapshot is rejected",
        path="cycle_runner/probe.py",
        original="""    markers = _markers(host, environment)
    record.markers = markers

    if not markers:""",
        replacement="""    markers = _markers(host, environment)
    record.markers = markers
    record.verdict = IDENTITY_ENVIRONMENT
    record.reason = "the probe answered, so the command ran in the environment"
    return record

    if not markers:""",
        instruments=(
            "tests.test_probe.VerdictTest",
            "tests.test_lifecycle.HostFallbackTest",
        ),
    ),
    Counterexample(
        name="orca-is-the-environments-own",
        requirement="An orca that resolves to the host's installation is not present",
        path="cycle_runner/probe.py",
        original="""        orca_present=bool(environment_orca)
        and not is_host_installation
        and bool(environment_version),""",
        replacement="""        orca_present=bool(environment_orca),""",
        instruments=(
            "tests.test_probe.OrcaPresenceTest",
            "tests.test_lifecycle.HostOrcaTest",
        ),
    ),
    Counterexample(
        name="export-before-destroy",
        requirement="Cleanup runs only after a confirmed export",
        path="cycle_runner/cleanup.py",
        original="    if not export_record.status.permits_cleanup:",
        replacement="    if False:",
        instruments=("tests.test_cleanup.GateTest", "tests.test_lifecycle.ExportGateTest"),
    ),
    Counterexample(
        name="stop-must-be-confirmed",
        requirement="Cleanup runs only after a confirmed stop",
        path="cycle_runner/cleanup.py",
        original="    if not stop_confirmed:",
        replacement="    if False:",
        instruments=(
            "tests.test_cleanup.StopGateTest",
            "tests.test_lifecycle.ExportGateTest",
        ),
    ),
    Counterexample(
        name="destroy-after-export",
        requirement="Evidence is collected and exported before anything is destroyed",
        path="cycle_runner/lifecycle.py",
        original="""        self._collect(baseline, fetched)
        export_record = self._export()
        cleanup_record = self._cleanup(export_record)""",
        replacement="""        from .result import ExportRecord as _AssumedExport
        from .status import ExportStatus as _AssumedStatus

        cleanup_record = self._cleanup(
            _AssumedExport(status=_AssumedStatus.CONFIRMED, detail="assumed")
        )
        self._collect(baseline, fetched)
        export_record = self._export()""",
        instruments=(
            "tests.test_lifecycle.TimeoutTest",
            "tests.test_lifecycle.SettledCycleTest",
            "tests.test_lifecycle.ExportGateTest",
        ),
    ),
    Counterexample(
        name="receipt-is-a-re-read",
        requirement="The receipt proves bytes on the host, not bytes in memory",
        path="cycle_runner/export.py",
        original="            described = hashing.describe_file(target, relative_to=self.root)",
        replacement="""            described = {
                "path": relative,
                "size_bytes": 1,
                "sha256": declared.expected_sha256 or "0" * 64,
            }""",
        instruments=("tests.test_export",),
    ),
    Counterexample(
        name="cleanup-only-per-run",
        requirement="A per-run path that contains a shared resource is refused",
        path="cycle_runner/cleanup.py",
        original="                if shared_path == owned_path or shared_path.is_relative_to(owned_path):",
        replacement="                if False:",
        instruments=("tests.test_cleanup.DeclarationTest",),
    ),
    Counterexample(
        name="redaction-by-shape",
        requirement="Redaction catches a credential this run has never seen",
        path="cycle_runner/redact.py",
        original="""    for shape in _TOKEN_SHAPES:
        cleaned = shape.sub(TOKEN_MARK, cleaned)""",
        replacement="""    for known in ("a-token-the-runner-was-told-about",):
        cleaned = cleaned.replace(known, TOKEN_MARK)""",
        instruments=("tests.test_redact",),
    ),
    Counterexample(
        name="manifest-required-fields",
        requirement="The manifest carries every required field on every path",
        path="cycle_runner/manifest.py",
        original="""            if name not in document:
                problems.append(f"missing required field: {f'{trail}.{name}' if trail else name}")""",
        replacement="""            if False:
                problems.append("never")""",
        instruments=("tests.test_manifest.ValidationTest",),
    ),
    Counterexample(
        name="run-id-carries-no-name",
        requirement="The run identifier discloses neither the host name nor the auth reference",
        path="cycle_runner/ids.py",
        original='    return f"{stamp}-{host_segment(host_name)}-{secrets.token_hex(_ENTROPY_BYTES)}"',
        replacement='    return f"{stamp}-{host_name}-{secrets.token_hex(_ENTROPY_BYTES)}"',
        instruments=("tests.test_ids",),
    ),
    Counterexample(
        name="config-refuses-a-secret",
        requirement="A secret-shaped value under a dull key is refused",
        path="cycle_runner/config.py",
        original="    refuse_secrets(document)",
        replacement="    pass",
        instruments=("tests.test_config.SecretRefusalTest",),
    ),
    Counterexample(
        name="auth-leaves-no-material",
        requirement="No credential value, length or prefix reaches a receipt",
        path="cycle_runner/auth.py",
        original="""    record.detail = (
        f"the value of {variable} is passed to the worker process for this run only "
        "and is never written to a file, an image, a seed or a log"
    )""",
        replacement="""    record.detail = (
        f"the value of {variable} (length {len(value)}, starting {value[:4]}) is "
        "passed to the worker process for this run only"
    )""",
        instruments=("tests.test_auth.ShortLivedTokenTest",),
    ),
    Counterexample(
        name="host-home-mount-acknowledged",
        requirement="An unacknowledged host-home mount blocks the run",
        path="cycle_runner/adapters/distrobox.py",
        original="        if self.settings.accept_host_home_mount:",
        replacement="        if True:",
        instruments=("tests.test_adapter_distrobox.DryRunTest",),
    ),
    Counterexample(
        name="preflight-leaves-no-residue",
        requirement="Preflight inspects without creating the run's state",
        path="cycle_runner/adapters/distrobox.py",
        original="""                self.render_manifest(home_override=Path(staging) / "home"),""",
        replacement="""                self.render_manifest(),""",
        instruments=("tests.test_adapter_distrobox.RealPreflightResidueTest",),
    ),
    Counterexample(
        name="base-is-only-a-backing-file",
        requirement="The preserved base image is a backing volume, never a per-run one",
        path="cycle_runner/adapters/vm.py",
        original="""                Resource(
                    kind="volume",
                    identifier=str(
                        Path(self.settings.base_image).parent
                        / f"{self.domain_name}-overlay.qcow2"
                    ),
                ),""",
        replacement="""                Resource(
                    kind="volume", identifier=str(self.settings.base_image)
                ),""",
        instruments=("tests.test_adapter_vm.ResourceTest",),
    ),
    Counterexample(
        name="overlay-is-not-the-base",
        requirement="The rendered program creates an overlay, not a volume named like the base",
        path="cycle_runner/adapters/vm.py",
        original='    name=DOMAIN_NAME + "-overlay.qcow2",',
        replacement="    name=BASE_VOLUME,",
        instruments=("tests.test_adapter_vm.ProgramTest",),
    ),
    Counterexample(
        name="failed-create-names-its-residue",
        requirement="A create that fails partway records what it may have left behind",
        path="cycle_runner/lifecycle.py",
        original="        planned = self.create_attempted and self.adapter.plan_handle()",
        replacement="        planned = None",
        instruments=("tests.test_lifecycle.CreateFailureTest",),
    ),
    Counterexample(
        name="the-application-is-started",
        requirement="The runner starts the application rather than hoping something did",
        path="cycle_runner/lifecycle.py",
        original="""            if not runtime.ready:
                started = self.execute(
                    orca.start_argv(self.config.orca.app_argv, self.config.orca.display),
                    timeout=min(180, self.config.timeout_seconds),
                )
                record.commands.append(started.to_record())""",
        replacement="""            if False:
                pass""",
        instruments=("tests.test_lifecycle.OrcaSessionTest",),
    ),
    Counterexample(
        name="a-present-orca-is-not-a-ready-one",
        requirement="A dispatch waits for Orca's runtime, not just for its binary",
        path="cycle_runner/lifecycle.py",
        original="""            if not runtime.ready:""",
        replacement="""            if False:""",
        instruments=("tests.test_lifecycle.OrcaSessionTest",),
    ),
    Counterexample(
        name="dispatch-needs-a-sender-terminal",
        requirement="Every orchestration command names the terminal it is sent from",
        path="cycle_runner/worker.py",
        original="""    if coordinator_handle:
        for command in (created, start, wait):
            command.extend(["--from", coordinator_handle])""",
        replacement="""    if False:
        for command in (created, start, wait):
            command.extend(["--from", coordinator_handle])""",
        instruments=("tests.test_worker.CoordinatorTerminalTest",),
    ),
    Counterexample(
        name="an-address-is-not-readiness",
        requirement="Creation waits for the guest to answer, not just to take an address",
        path="cycle_runner/adapters/vm.py",
        original="""            outcome = self.runner(
                self.ssh_argv(["true"]), timeout=60, context="environment"
            )
            if outcome.ok:
                return True""",
        replacement="""            return True""",
        instruments=("tests.test_adapter_vm.TransportReadinessTest",),
    ),
    Counterexample(
        name="remote-command-is-quoted",
        requirement="An argument vector survives the transport intact",
        path="cycle_runner/adapters/vm.py",
        original="            shlex.join(str(item) for item in argv),",
        replacement="            *[str(item) for item in argv],",
        instruments=("tests.test_adapter_vm.RemoteQuotingTest",),
    ),
    Counterexample(
        name="forwarded-value-is-redacted",
        requirement="A value forwarded into the guest is redacted from captured output",
        path="cycle_runner/adapters/vm.py",
        original="            extra_values=tuple(extra_values) + tuple((env or {}).values()),",
        replacement="            extra_values=tuple(extra_values),",
        instruments=("tests.test_adapter_vm.TransportRedactionTest",),
    ),
    Counterexample(
        name="provider-schema-verified",
        requirement="A program the provider cannot be checked against blocks the run",
        path="cycle_runner/adapters/vm.py",
        original="""        ran, problems = schema.verify_with_interpreter(program, interpreter)
        if not ran:""",
        replacement="""        ran, problems = schema.verify_with_interpreter(program, interpreter)
        if False:""",
        instruments=("tests.test_adapter_vm.PreflightTest",),
    ),
    Counterexample(
        name="state-backend-is-local",
        requirement="A cloud state backend blocks the machine backend",
        path="cycle_runner/adapters/vm.py",
        original="            ok=backend.startswith(\"file://\"),",
        replacement="            ok=True,",
        instruments=("tests.test_adapter_vm.PreflightTest",),
    ),
    Counterexample(
        name="graphics-type-is-supported",
        requirement="A graphics type this emulator lacks blocks the run",
        path="cycle_runner/adapters/vm.py",
        original="            ok=self.settings.graphics in supported,",
        replacement="            ok=True,",
        instruments=("tests.test_adapter_vm.PreflightTest",),
    ),
    Counterexample(
        name="transport-address-is-the-right-one",
        requirement="Another interface's address is not mistaken for the transport's",
        path="cycle_runner/adapters/vm.py",
        original="                if self.transport_mac in line:",
        replacement="                if True:",
        instruments=("tests.test_adapter_vm.AddressDiscoveryTest",),
    ),
)


def applicable(case: Counterexample) -> bool:
    """Whether this case's target text is still present in the tree."""
    return case.original in (ROOT / case.path).read_text(encoding="utf-8")


def run(case: Counterexample) -> tuple[bool, str]:
    """Apply one counterexample, run its instruments, and restore the tree."""
    target = ROOT / case.path
    backup = target.read_text(encoding="utf-8")
    if case.original not in backup:
        return False, "the counterexample no longer applies to this code"
    target.write_text(backup.replace(case.original, case.replacement, 1), encoding="utf-8")
    try:
        completed = subprocess.run(
            [sys.executable, "-m", "unittest", *case.instruments],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
    finally:
        target.write_text(backup, encoding="utf-8")
    if completed.returncode == 0:
        return False, "the instruments stayed green: this row proves nothing"
    reasons = [
        line
        for line in completed.stderr.splitlines()
        if line.startswith(("FAIL:", "ERROR:"))
    ]
    return True, "; ".join(reasons[:2]) or "red"


def main(argv: list[str] | None = None) -> int:
    """Run the selected counterexamples and report which discriminated."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="print the table and exit")
    parser.add_argument("--only", help="run one counterexample by name")
    arguments = parser.parse_args(argv)

    cases = CASES
    if arguments.only:
        cases = tuple(case for case in CASES if case.name == arguments.only)
        if not cases:
            print(f"no counterexample named {arguments.only!r}", file=sys.stderr)
            return 2

    if arguments.list:
        for case in CASES:
            print(f"{case.name}\n    {case.requirement}\n    {', '.join(case.instruments)}")
        return 0

    width = max(len(case.name) for case in cases)
    failures = []
    for case in cases:
        discriminated, detail = run(case)
        verdict = "RED " if discriminated else "GREEN"
        print(f"{verdict}  {case.name.ljust(width)}  {case.requirement}")
        if not discriminated:
            failures.append(case.name)
            print(f"        {detail}")
    print()
    if failures:
        print(f"{len(failures)} counterexample(s) did not discriminate: {', '.join(failures)}")
        return 1
    print(f"all {len(cases)} counterexamples discriminated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
