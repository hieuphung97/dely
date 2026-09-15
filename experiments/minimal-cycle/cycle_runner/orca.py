"""Orca's own session inside the environment.

Orca's command line is a client: it reaches a runtime the desktop application
owns, and every orchestration command is sent *from* a terminal that runtime
knows. So before a worker can be dispatched, two things have to be true inside
the environment, and both are observed rather than assumed: the runtime reports
itself ready, and a coordinator terminal exists in the project copy.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol, Sequence


class Environment(Protocol):
    """The part of a backend adapter this module needs."""

    def execute(self, argv: Sequence[str], *, timeout: float, cwd: str | None = ...,
                env: Any = ..., extra_values: Sequence[str] = ...) -> Any: ...


class OrcaSessionError(RuntimeError):
    """Orca could not be brought to a state that can accept a dispatch."""


@dataclass
class RuntimeReport:
    """What Orca said about itself inside the environment."""

    ready: bool = False
    app_running: bool = False
    app_pid: int | None = None
    desktop_window: str | None = None
    runtime_state: str | None = None
    runtime_id: str | None = None
    app_version: str | None = None
    capabilities: list[str] = field(default_factory=list)
    detail: str = ""

    def to_document(self) -> dict[str, Any]:
        return {
            "ready": self.ready,
            "app_running": self.app_running,
            "app_pid": self.app_pid,
            "desktop_window": self.desktop_window,
            "runtime_state": self.runtime_state,
            "runtime_id": self.runtime_id,
            "app_version": self.app_version,
            "capabilities": list(self.capabilities),
            "detail": self.detail,
        }


def _document(text: str) -> dict[str, Any] | None:
    for candidate in (text, *text.splitlines()):
        stripped = candidate.strip()
        if not stripped.startswith("{"):
            continue
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def read_status(environment: Environment, argv: Sequence[str], *, timeout: float) -> RuntimeReport:
    """Ask Orca inside the environment what state it is in."""
    outcome = environment.execute(list(argv), timeout=timeout)
    if not outcome.ok:
        return RuntimeReport(
            detail="orca status did not answer: "
            + (outcome.stderr or outcome.stdout).strip()[:200]
        )
    document = _document(outcome.stdout)
    if document is None:
        return RuntimeReport(detail="orca status could not be read as a document")
    result = document.get("result") or {}
    app = result.get("app") or {}
    runtime = result.get("runtime") or {}
    report = RuntimeReport(
        app_running=bool(app.get("running")),
        app_pid=app.get("pid"),
        desktop_window=app.get("desktopWindowStatus"),
        runtime_state=runtime.get("state"),
        runtime_id=runtime.get("runtimeId"),
        app_version=runtime.get("appVersion"),
        capabilities=list(runtime.get("capabilities") or []),
    )
    report.ready = bool(
        report.app_running and report.runtime_state == "ready" and runtime.get("reachable")
    )
    report.detail = (
        f"the runtime is {report.runtime_state} and the application is "
        f"{'running' if report.app_running else 'not running'}"
    )
    return report


def wait_for_runtime(
    environment: Environment,
    argv: Sequence[str],
    *,
    timeout: float,
    sleeper: Callable[[float], None] = time.sleep,
    interval: float = 5.0,
) -> RuntimeReport:
    """Poll until Orca reports a ready runtime, or the deadline passes."""
    deadline = time.monotonic() + timeout
    while True:
        report = read_status(environment, argv, timeout=min(120, max(timeout, 30)))
        if report.ready:
            return report
        if time.monotonic() >= deadline:
            return report
        sleeper(interval)


#: Launched detached with its own output kept, because a window manager's
#: autostart was observed to leave only a crash directory and a stale lock.
START_SCRIPT = (
    'export DISPLAY="$1"; shift; '
    'export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"; '
    # The graphical session starts at boot; the application must not be launched
    # before it is there, or it leaves a crash directory and a stale lock.
    'waited=0; '
    'while ! xset -q >/dev/null 2>&1; do '
    '  waited=$((waited + 2)); '
    '  if [ "$waited" -ge 120 ]; then printf "no display after %ss\n" "$waited" >&2; exit 3; fi; '
    '  sleep 2; '
    'done; '
    'printf "display ready after %ss\n" "$waited"; '
    'rm -f "$HOME/.config/orca/SingletonLock" "$HOME/.config/orca/SingletonCookie"; '
    'nohup "$@" > "$HOME/orca-app.log" 2>&1 & '
    'printf "started %s\n" "$!"'
)


def start_argv(app_argv: Sequence[str], display: str) -> list[str]:
    """Return the command that starts the application inside the environment."""
    return ["sh", "-c", START_SCRIPT, "orca-start", display, *[str(a) for a in app_argv]]


def start_application(
    environment: Environment,
    app_argv: Sequence[str],
    *,
    display: str,
    timeout: float,
) -> Any:
    """Start the Orca application inside the environment and return the outcome."""
    return environment.execute(start_argv(app_argv, display), timeout=timeout)


def open_coordinator_terminal(
    environment: Environment, project_path: str, *, timeout: float
) -> str:
    """Register the project copy with Orca and open the terminal to send from."""
    environment.execute(
        ["orca", "repo", "add", "--path", project_path, "--json"], timeout=timeout
    )
    created = environment.execute(
        [
            "orca",
            "terminal",
            "create",
            "--worktree",
            f"path:{project_path}",
            "--json",
        ],
        timeout=timeout,
    )
    if not created.ok:
        raise OrcaSessionError(
            "orca terminal create did not open a coordinator terminal: "
            + (created.stderr or created.stdout).strip()[:300]
        )
    document = _document(created.stdout) or {}
    terminal = ((document.get("result") or {}).get("terminal")) or {}
    handle = terminal.get("handle")
    if not handle:
        raise OrcaSessionError(
            "orca terminal create returned no terminal handle, so nothing can be "
            "dispatched from it"
        )
    return handle
