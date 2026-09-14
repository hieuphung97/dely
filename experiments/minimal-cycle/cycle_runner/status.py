"""The closed sets of states a cycle can end in, and how they leave the process.

A status name never stands in for evidence: these values only classify what
the manifest already records.
"""

from __future__ import annotations

import enum


class RunStatus(enum.Enum):
    """How the whole cycle ended."""

    SETTLED = "SETTLED"
    ERROR = "ERROR"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"
    CLEANUP_FAILED = "CLEANUP_FAILED"
    UNKNOWN = "UNKNOWN"
    BLOCKED = "BLOCKED"


class CleanupStatus(enum.Enum):
    """What happened to the per-run resources."""

    DESTROYED = "DESTROYED"
    RESIDUE = "RESIDUE"
    UNKNOWN = "UNKNOWN"


class ExportStatus(enum.Enum):
    """Whether the host holds every artifact the run promised."""

    CONFIRMED = "CONFIRMED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"

    @property
    def permits_cleanup(self) -> bool:
        """Only a confirmed export releases the run to destroy anything."""
        return self is ExportStatus.CONFIRMED


class PhaseStatus(enum.Enum):
    """How one lifecycle phase ended."""

    OK = "OK"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    TIMEOUT = "TIMEOUT"
    BLOCKED = "BLOCKED"


_EXIT_CODES = {
    RunStatus.SETTLED: 0,
    RunStatus.ERROR: 1,
    RunStatus.TIMEOUT: 2,
    RunStatus.CANCELLED: 3,
    RunStatus.BLOCKED: 4,
    RunStatus.CLEANUP_FAILED: 5,
    RunStatus.UNKNOWN: 6,
}


def exit_code(run_status: RunStatus) -> int:
    """Return the process exit code that reports this run status."""
    return _EXIT_CODES[run_status]
