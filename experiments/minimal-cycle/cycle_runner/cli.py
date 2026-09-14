"""The command line: preflight a backend, or run one cycle.

Every failure this tool can reasonably meet — an absent configuration, an
invalid one, a backend this host cannot run — is reported as a sentence and an
exit code rather than as a traceback.
"""

from __future__ import annotations

import argparse
import json
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence, TextIO

from . import adapters, config as config_module, ids, lifecycle, manifest, proc
from .status import RunStatus, exit_code

USAGE_EXIT = 2


def _load(path: Path) -> config_module.RunConfig:
    if not Path(path).is_file():
        raise config_module.ConfigError(f"no configuration at {path}")
    return config_module.load(Path(path))


def _tool_versions() -> dict[str, str]:
    versions = {"runner": "minimal-cycle", "python": sys.version.split()[0]}
    for name, argv in (
        ("distrobox", ["distrobox", "--version"]),
        ("podman", ["podman", "--version"]),
        ("qemu_img", ["qemu-img", "--version"]),
        ("virsh", ["virsh", "--version"]),
        ("pulumi", ["pulumi", "version"]),
        ("git", ["git", "--version"]),
    ):
        outcome = proc.run(argv, timeout=60, context="host")
        if outcome.ok and outcome.stdout.strip():
            versions[name] = outcome.stdout.strip().splitlines()[-1]
    return versions


def _preflight(arguments, stdout: TextIO, stderr: TextIO) -> int:
    run_config = _load(arguments.config)
    adapter = adapters.build(
        run_config=run_config,
        run_id=arguments.run_id or _mint(),
    )
    report = adapter.preflight()
    if arguments.json:
        print(json.dumps(report.to_document(), indent=2, sort_keys=True), file=stdout)
    else:
        print(f"backend: {report.backend}", file=stdout)
        for finding in report.findings:
            mark = "ok    " if finding.ok else "BLOCK "
            print(f"  {mark} {finding.name}: {finding.detail}", file=stdout)
        print(
            "usable on this host" if report.ok else "not usable on this host",
            file=stdout,
        )
    return 0 if report.ok else exit_code(RunStatus.BLOCKED)


def _mint() -> str:
    return ids.mint_run_id(now=datetime.now(timezone.utc), host_name=socket.gethostname())


def _run(arguments, stdout: TextIO, stderr: TextIO) -> int:
    run_config = _load(arguments.config)
    run_id = arguments.run_id or _mint()
    if not ids.is_run_id(run_id):
        raise config_module.ConfigError(
            f"{run_id!r} is not a run identifier of the documented shape"
        )
    adapter = adapters.build(run_config=run_config, run_id=run_id)
    outcome = lifecycle.run_cycle(
        run_config=run_config,
        adapter=adapter,
        run_id=run_id,
        tool_versions=_tool_versions(),
    )
    result = outcome.run_result
    if arguments.json:
        print(
            json.dumps(result.to_document(), indent=2, sort_keys=True), file=stdout
        )
    else:
        print(f"run_id:    {result.run_id}", file=stdout)
        print(f"backend:   {result.backend}", file=stdout)
        print(f"status:    {result.status.value}", file=stdout)
        print(f"identity:  {result.identity.verdict} — {result.identity.reason}", file=stdout)
        print(f"check:     {result.check.status.value} (exit {result.check.exit_code})", file=stdout)
        print(f"export:    {result.export.status.value}", file=stdout)
        print(f"cleanup:   {result.cleanup.status.value} — {result.cleanup.reason}", file=stdout)
        print(f"artifacts: {outcome.artifact_dir}", file=stdout)
        if result.failure_classification:
            print(f"why:       {result.failure_classification}", file=stdout)
    return outcome.exit_code


def _schema(arguments, stdout: TextIO, stderr: TextIO) -> int:
    print(
        json.dumps(manifest.load_schema(), indent=2, sort_keys=True), file=stdout
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Return the argument parser for the runner."""
    parser = argparse.ArgumentParser(
        prog="run-cycle",
        description="Run one minimal proof cycle on a disposable environment.",
    )
    subcommands = parser.add_subparsers(dest="command")

    preflight = subcommands.add_parser(
        "preflight", help="report whether this host can run the configured backend"
    )
    preflight.add_argument("--config", required=True, type=Path)
    preflight.add_argument("--run-id")
    preflight.add_argument("--json", action="store_true")
    preflight.set_defaults(handler=_preflight)

    run = subcommands.add_parser("run", help="run one cycle end to end")
    run.add_argument("--config", required=True, type=Path)
    run.add_argument("--run-id", help="pin the run identifier instead of minting one")
    run.add_argument("--json", action="store_true")
    run.set_defaults(handler=_run)

    schema = subcommands.add_parser("schema", help="print the manifest schema")
    schema.set_defaults(handler=_schema)

    return parser


def main(
    argv: Sequence[str] | None = None,
    *,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
) -> int:
    """Run the command line and return the process exit code."""
    stdout = stdout or sys.stdout
    stderr = stderr or sys.stderr
    parser = build_parser()
    arguments = parser.parse_args(list(argv) if argv is not None else None)
    if not getattr(arguments, "handler", None):
        parser.print_usage(stderr)
        return USAGE_EXIT
    try:
        return arguments.handler(arguments, stdout, stderr)
    except (config_module.ConfigError, manifest.ManifestError) as error:
        print(f"error: {error}", file=stderr)
        return USAGE_EXIT
    except (OSError, RuntimeError, ValueError) as error:
        print(f"error: {type(error).__name__}: {error}", file=stderr)
        return exit_code(RunStatus.ERROR)
