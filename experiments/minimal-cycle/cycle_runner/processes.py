"""What the run started, and whether any of it is still on the host.

A backend that shares namespaces with its host — Distrobox shares the process
table, the message bus and the display sockets — can leave a process running
after the resource that nominally contained it is gone. Removing the container
reports success, and the application it held keeps running, keeps its window on
the host's screen, and keeps writing to a directory the run has deleted.

So a run surveys for processes still holding a path of its own, stops them, and
reports what it stopped. The survey is by path, never by program name: a name
would reach the operator's own application, which is the failure this exists to
prevent rather than a worse version of it.
"""

from __future__ import annotations

import os
import signal
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

PROC_ROOT = Path("/proc")


@dataclass(frozen=True)
class Process:
    """One process, and everything that can tie it to this run.

    The command line alone is not enough. The application this runner starts
    appears in the process table as `orca-ide --disable-gpu` and names no path
    at all; only its children carry `--user-data-dir`, and only its own
    environment and working directory name the home it was given. A survey that
    reads argv finds the children and leaves the parent running.
    """

    pid: int
    command: str
    parent: int = 0
    home: str = ""
    cwd: str = ""

    def names(self, path: str) -> bool:
        """Report whether this process is tied to the given path."""
        return any(path in field for field in (self.command, self.home, self.cwd))


@dataclass
class SurveyReport:
    """What was still running, what was stopped, and what would not stop."""

    found: list[int] = field(default_factory=list)
    stopped: list[int] = field(default_factory=list)
    surviving: list[int] = field(default_factory=list)
    detail: str = "no survey ran"

    @property
    def clean(self) -> bool:
        return not self.surviving

    def to_document(self) -> dict[str, Any]:
        return {
            "found": list(self.found),
            "stopped": list(self.stopped),
            "surviving": list(self.surviving),
            "clean": self.clean,
            "detail": self.detail,
        }


def _read(pid: int, name: str) -> str:
    try:
        raw = (PROC_ROOT / str(pid) / name).read_bytes()
    except (OSError, ValueError):
        return ""
    return raw.replace(b"\0", b" ").decode("utf-8", "replace").strip()


def _read_home(pid: int) -> str:
    for pair in _read(pid, "environ").split(" "):
        if pair.startswith("HOME="):
            return pair[5:]
    return ""


def _read_parent(pid: int) -> int:
    for line in _read(pid, "status").splitlines():
        if line.startswith("PPid:"):
            try:
                return int(line.split()[1])
            except (IndexError, ValueError):
                return 0
    return 0


def holding(
    paths: Sequence[str],
    *,
    lister: Callable[[], Iterable[Process]] | None = None,
    exclude: Sequence[int] = (),
    roots: Sequence[int] = (),
) -> list[Process]:
    """Return the processes tied to these paths, and the trees under `roots`.

    A root is a process identifier the run recorded when it started something.
    It is only meaningful on a backend that shares the host's process table,
    so the caller decides whether to pass one: on a backend that does not, the
    same number belongs to some unrelated process on this machine.
    """
    wanted = [str(path) for path in paths if str(path).strip()]
    skip = set(exclude) | {os.getpid(), os.getppid()}
    processes = [
        process
        for process in (list(lister()) if lister is not None else _live_processes())
        if process.pid not in skip
    ]
    matched = {
        process.pid: process
        for process in processes
        if any(process.names(path) for path in wanted)
    }
    for root in roots:
        if root in skip or root <= 1:
            continue
        for process in processes:
            if process.pid == root:
                matched[process.pid] = process
        for process in _tree(processes, root):
            matched[process.pid] = process
    return [matched[pid] for pid in sorted(matched)]


def _tree(processes: Sequence[Process], root: int) -> list[Process]:
    """Return every descendant of `root` in this table."""
    children: dict[int, list[Process]] = {}
    for process in processes:
        children.setdefault(process.parent, []).append(process)
    found: list[Process] = []
    pending = [root]
    seen = {root}
    while pending:
        current = pending.pop()
        for child in children.get(current, ()):
            if child.pid in seen:
                continue
            seen.add(child.pid)
            found.append(child)
            pending.append(child.pid)
    return found


def _live_processes() -> list[Process]:
    found = []
    for entry in PROC_ROOT.iterdir():
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        command = _read(pid, "cmdline")
        if not command:
            continue
        try:
            cwd = os.readlink(PROC_ROOT / entry.name / "cwd")
        except OSError:
            cwd = ""
        found.append(
            Process(
                pid=pid,
                command=command,
                parent=_read_parent(pid),
                home=_read_home(pid),
                cwd=cwd,
            )
        )
    return found


def survey_and_stop(
    paths: Sequence[str],
    *,
    lister: Callable[[], Iterable[Process]] | None = None,
    signaller: Callable[[int, int], None] = os.kill,
    sleeper: Callable[[float], None] = time.sleep,
    grace_seconds: float = 5.0,
    exclude: Sequence[int] = (),
    roots: Sequence[int] = (),
) -> SurveyReport:
    """Stop every process still holding one of this run's paths, and confirm it."""
    found = holding(paths, lister=lister, exclude=exclude, roots=roots)
    report = SurveyReport(found=[process.pid for process in found])
    if not found:
        report.detail = "no process on the host was still holding a path of this run"
        return report
    for process in found:
        try:
            signaller(process.pid, signal.SIGTERM)
        except (OSError, ProcessLookupError):
            continue
    sleeper(grace_seconds)
    still = holding(paths, lister=lister, exclude=exclude, roots=roots)
    for process in still:
        try:
            signaller(process.pid, signal.SIGKILL)
        except (OSError, ProcessLookupError):
            continue
    if still:
        sleeper(1.0)
    remaining = holding(paths, lister=lister, exclude=exclude, roots=roots)
    report.surviving = [process.pid for process in remaining]
    report.stopped = [pid for pid in report.found if pid not in report.surviving]
    report.detail = (
        f"{len(report.stopped)} process(es) the run had started were still on the "
        "host and were stopped"
        if report.clean
        else (
            f"{len(report.surviving)} process(es) the run had started would not stop "
            "and are still on the host"
        )
    )
    return report
