"""The result contract both backend adapters settle into.

Every block exists on every path. A run that never reached the check still
carries a `check` block saying so, because a manifest that omits what did not
happen reads like a manifest that was never asked.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Sequence

from .status import CleanupStatus, ExportStatus, PhaseStatus, RunStatus

CONTEXTS = ("host", "environment")

IDENTITY_ENVIRONMENT = "ENVIRONMENT"
IDENTITY_HOST_FALLBACK = "HOST_FALLBACK"
IDENTITY_UNKNOWN = "UNKNOWN"


@dataclass
class CommandRecord:
    """One executed command, and which side of the boundary it ran on."""

    argv: Sequence[str]
    exit_code: int | None
    started_at: str
    finished_at: str
    elapsed_seconds: float
    timed_out: bool
    context: str
    stdout_path: str | None = None
    stderr_path: str | None = None

    def __post_init__(self) -> None:
        if self.context not in CONTEXTS:
            raise ValueError(
                f"a command runs on the host or in the environment, not {self.context!r}"
            )

    def to_document(self) -> dict[str, Any]:
        return {
            "argv": list(self.argv),
            "exit_code": self.exit_code,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_seconds": self.elapsed_seconds,
            "timed_out": self.timed_out,
            "context": self.context,
            "stdout_path": self.stdout_path,
            "stderr_path": self.stderr_path,
        }


@dataclass
class PhaseRecord:
    """One lifecycle phase and the commands that produced its outcome."""

    name: str
    status: PhaseStatus
    started_at: str | None = None
    finished_at: str | None = None
    elapsed_seconds: float | None = None
    detail: str = ""
    commands: list[CommandRecord] = field(default_factory=list)

    def to_document(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status.value,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_seconds": self.elapsed_seconds,
            "detail": self.detail,
            "commands": [command.to_document() for command in self.commands],
        }


@dataclass
class IdentityRecord:
    """Whether the environment answered as itself or as the host."""

    verdict: str = IDENTITY_UNKNOWN
    reason: str = "not attempted"
    host: dict[str, Any] = field(default_factory=dict)
    environment: dict[str, Any] = field(default_factory=dict)
    markers: list[str] = field(default_factory=list)
    orca_present: bool = False
    orca_is_host_installation: bool = False
    orca_version: str | None = None
    orca_status_exit_code: int | None = None

    def to_document(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict,
            "reason": self.reason,
            "host": dict(self.host),
            "environment": dict(self.environment),
            "markers": list(self.markers),
            "orca_present": self.orca_present,
            "orca_is_host_installation": self.orca_is_host_installation,
            "orca_version": self.orca_version,
            "orca_status_exit_code": self.orca_status_exit_code,
        }


@dataclass
class WorkerRecord:
    """The single Claude Code worker Orca was asked to run."""

    status: PhaseStatus = PhaseStatus.SKIPPED
    agent: str | None = None
    model: str | None = None
    effort: str | None = None
    run_id: str | None = None
    dispatch_id: str | None = None
    outcome: str | None = None
    detail: str = "not attempted"
    commands: list[CommandRecord] = field(default_factory=list)

    def to_document(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "agent": self.agent,
            "model": self.model,
            "effort": self.effort,
            "run_id": self.run_id,
            "dispatch_id": self.dispatch_id,
            "outcome": self.outcome,
            "detail": self.detail,
            "commands": [command.to_document() for command in self.commands],
        }


@dataclass
class CheckRecord:
    """The one independent check, as a process rather than as an opinion."""

    status: PhaseStatus = PhaseStatus.SKIPPED
    argv: Sequence[str] = ()
    exit_code: int | None = None
    started_at: str | None = None
    finished_at: str | None = None
    elapsed_seconds: float | None = None
    stdout_path: str | None = None
    stderr_path: str | None = None
    expected_marker: str | None = None
    detail: str = "not attempted"

    def to_document(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "argv": list(self.argv),
            "exit_code": self.exit_code,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_seconds": self.elapsed_seconds,
            "stdout_path": self.stdout_path,
            "stderr_path": self.stderr_path,
            "expected_marker": self.expected_marker,
            "detail": self.detail,
        }


@dataclass
class ExportRecord:
    """What the host holds, proved by re-reading it."""

    status: ExportStatus = ExportStatus.FAILED
    confirmed_at: str | None = None
    receipt_path: str | None = None
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    detail: str = "not attempted"

    def to_document(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "confirmed_at": self.confirmed_at,
            "receipt_path": self.receipt_path,
            "artifacts": [dict(entry) for entry in self.artifacts],
            "missing": list(self.missing),
            "detail": self.detail,
        }


@dataclass
class CleanupRecord:
    """What was removed, what was deliberately kept, and how that was checked."""

    status: CleanupStatus = CleanupStatus.RESIDUE
    reason: str = "not attempted"
    removed: list[str] = field(default_factory=list)
    retained: list[str] = field(default_factory=list)
    shared_preserved: list[str] = field(default_factory=list)
    verified: bool = False

    def to_document(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "reason": self.reason,
            "removed": list(self.removed),
            "retained": list(self.retained),
            "shared_preserved": list(self.shared_preserved),
            "verified": self.verified,
        }


@dataclass
class AuthRecord:
    """The auth method and its observed status, never its material."""

    mode: str = "unknown"
    reference: str = ""
    status: PhaseStatus = PhaseStatus.SKIPPED
    target: str | None = None
    entries: list[str] = field(default_factory=list)
    removed_after_run: bool = False
    detail: str = "not attempted"

    def to_document(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "reference": self.reference,
            "status": self.status.value,
            "target": self.target,
            "entries": list(self.entries),
            "removed_after_run": self.removed_after_run,
            "detail": self.detail,
        }


@dataclass
class RunResult:
    """One cycle, whatever backend produced it."""

    run_id: str
    backend: str
    tested_revision: str
    dely_revision: str
    environment_id: str | None = None
    status: RunStatus = RunStatus.UNKNOWN
    started_at: str | None = None
    finished_at: str | None = None
    elapsed_seconds: float | None = None
    failure_classification: str = ""
    versions: dict[str, Any] = field(default_factory=dict)
    environment: dict[str, Any] = field(default_factory=dict)
    phases: list[PhaseRecord] = field(default_factory=list)
    identity: IdentityRecord = field(default_factory=IdentityRecord)
    worker: WorkerRecord = field(default_factory=WorkerRecord)
    check: CheckRecord = field(default_factory=CheckRecord)
    export: ExportRecord = field(default_factory=ExportRecord)
    cleanup: CleanupRecord = field(default_factory=CleanupRecord)
    auth: AuthRecord = field(default_factory=AuthRecord)

    def phase(self, name: str) -> PhaseRecord | None:
        for record in self.phases:
            if record.name == name:
                return record
        return None

    def to_document(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "backend": self.backend,
            "tested_revision": self.tested_revision,
            "dely_revision": self.dely_revision,
            "environment_id": self.environment_id,
            "status": self.status.value,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_seconds": self.elapsed_seconds,
            "failure_classification": self.failure_classification,
            "versions": dict(self.versions),
            "environment": dict(self.environment),
            "phases": [phase.to_document() for phase in self.phases],
            "identity": self.identity.to_document(),
            "worker": self.worker.to_document(),
            "check": self.check.to_document(),
            "export": self.export.to_document(),
            "cleanup": self.cleanup.to_document(),
            "auth": self.auth.to_document(),
        }


def blocked_result(
    *,
    run_id: str,
    backend: str,
    tested_revision: str,
    dely_revision: str,
    reason: str,
) -> RunResult:
    """Return a result for a run that stopped before it could prove anything."""
    record = RunResult(
        run_id=run_id,
        backend=backend,
        tested_revision=tested_revision,
        dely_revision=dely_revision,
        status=RunStatus.BLOCKED,
        failure_classification=reason,
    )
    record.identity.reason = reason
    record.cleanup.reason = reason
    record.export.detail = reason
    record.check.detail = reason
    record.worker.detail = reason
    record.auth.detail = reason
    return record
