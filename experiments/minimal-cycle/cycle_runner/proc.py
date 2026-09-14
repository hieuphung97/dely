"""Running one command with a deadline, and keeping what it said.

A deadline is an outcome, not an exception: a timed-out command still carries
its partial output, its timings and the fact that the runner had to kill it.
Nothing captured here reaches a caller before redaction.
"""

from __future__ import annotations

import os
import signal
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping, Sequence

from . import redact
from .result import CommandRecord

_GRACE_SECONDS = 2.0


def utc_now() -> str:
    """Return the current instant as a second-resolution stamp."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class CommandOutcome:
    """What one command did, already redacted."""

    argv: tuple[str, ...]
    exit_code: int | None
    stdout: str
    stderr: str
    started_at: str
    finished_at: str
    elapsed_seconds: float
    timed_out: bool
    context: str
    killed_process_group: bool = False
    launch_failed: bool = False

    @property
    def ok(self) -> bool:
        """Whether the command ran to completion and reported success."""
        return self.exit_code == 0

    def to_record(self, *, stdout_path: str | None = None, stderr_path: str | None = None) -> CommandRecord:
        """Return the manifest-shaped record for this command."""
        return CommandRecord(
            argv=self.argv,
            exit_code=self.exit_code,
            started_at=self.started_at,
            finished_at=self.finished_at,
            elapsed_seconds=self.elapsed_seconds,
            timed_out=self.timed_out,
            context=self.context,
            stdout_path=stdout_path,
            stderr_path=stderr_path,
        )


def _kill_group(process: subprocess.Popen) -> bool:
    """Terminate the child's whole session; report whether the group was signalled."""
    try:
        group = os.getpgid(process.pid)
    except (ProcessLookupError, PermissionError):
        process.kill()
        return False
    for number in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(group, number)
        except (ProcessLookupError, PermissionError):
            break
        try:
            process.wait(timeout=_GRACE_SECONDS)
            break
        except subprocess.TimeoutExpired:
            continue
    return True


def run(
    argv: Sequence[str],
    *,
    timeout: float,
    context: str,
    cwd: Path | str | None = None,
    env: Mapping[str, str] | None = None,
    extra_values: Sequence[str] = (),
    stdin_text: str | None = None,
) -> CommandOutcome:
    """Run one command with a deadline and return its redacted outcome."""
    argv = tuple(str(item) for item in argv)
    started_at = utc_now()
    started = time.monotonic()
    child_env = dict(os.environ)
    if env:
        child_env.update(env)

    def finish(
        *,
        exit_code: int | None,
        stdout: str,
        stderr: str,
        timed_out: bool,
        killed_process_group: bool = False,
        launch_failed: bool = False,
    ) -> CommandOutcome:
        return CommandOutcome(
            argv=argv,
            exit_code=exit_code,
            stdout=redact.text(stdout, extra_values),
            stderr=redact.text(stderr, extra_values),
            started_at=started_at,
            finished_at=utc_now(),
            elapsed_seconds=round(time.monotonic() - started, 3),
            timed_out=timed_out,
            context=context,
            killed_process_group=killed_process_group,
            launch_failed=launch_failed,
        )

    try:
        process = subprocess.Popen(
            argv,
            cwd=str(cwd) if cwd is not None else None,
            env=child_env,
            stdin=subprocess.PIPE if stdin_text is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            errors="replace",
            start_new_session=True,
        )
    except OSError as error:
        return finish(
            exit_code=None,
            stdout="",
            stderr=f"could not launch {argv[0]}: {error}",
            timed_out=False,
            launch_failed=True,
        )

    try:
        stdout, stderr = process.communicate(input=stdin_text, timeout=timeout)
    except subprocess.TimeoutExpired:
        killed = _kill_group(process)
        try:
            stdout, stderr = process.communicate(timeout=_GRACE_SECONDS)
        except subprocess.TimeoutExpired:
            stdout, stderr = "", ""
        return finish(
            exit_code=None,
            stdout=stdout or "",
            stderr=(stderr or "") + f"\ndeadline of {timeout} seconds reached",
            timed_out=True,
            killed_process_group=killed,
        )
    return finish(
        exit_code=process.returncode, stdout=stdout or "", stderr=stderr or "", timed_out=False
    )
