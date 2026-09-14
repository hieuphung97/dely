"""The one interface both backends implement.

Adapters differ in everything except this: they create a fresh environment,
run commands inside it, move trees across the boundary, stop it, destroy only
what belongs to the run, and say which resources are shared so the runner can
refuse to touch them.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

from ..proc import CommandOutcome

RESOURCE_KINDS = ("path", "container", "domain", "volume", "stack", "image")


@dataclass(frozen=True)
class Resource:
    """One thing a run created or depends on, named so cleanup can reason."""

    kind: str
    identifier: str

    def __post_init__(self) -> None:
        if self.kind not in RESOURCE_KINDS:
            raise ValueError(f"unknown resource kind: {self.kind!r}")

    def to_document(self) -> dict[str, str]:
        return {"kind": self.kind, "identifier": self.identifier}

    def __str__(self) -> str:
        return f"{self.kind}:{self.identifier}"


@dataclass(frozen=True)
class EnvironmentHandle:
    """The created environment, and what belongs to this run versus everyone."""

    environment_id: str
    home_path: str
    project_path: str
    per_run_resources: tuple[Resource, ...] = ()
    shared_resources: tuple[Resource, ...] = ()
    description: dict[str, Any] = field(default_factory=dict)

    def to_document(self) -> dict[str, Any]:
        return {
            "environment_id": self.environment_id,
            "home_path": self.home_path,
            "project_path": self.project_path,
            "per_run_resources": [item.to_document() for item in self.per_run_resources],
            "shared_resources": [item.to_document() for item in self.shared_resources],
            "description": dict(self.description),
        }


@dataclass(frozen=True)
class Finding:
    """One preflight fact, with the evidence that produced it."""

    name: str
    ok: bool
    detail: str

    def to_document(self) -> dict[str, Any]:
        return {"name": self.name, "ok": self.ok, "detail": self.detail}


@dataclass(frozen=True)
class PreflightReport:
    """Whether this host can run this backend, and what is missing."""

    backend: str
    findings: tuple[Finding, ...] = ()

    @property
    def ok(self) -> bool:
        return all(finding.ok for finding in self.findings)

    @property
    def blockers(self) -> tuple[Finding, ...]:
        return tuple(finding for finding in self.findings if not finding.ok)

    def to_document(self) -> dict[str, Any]:
        return {
            "backend": self.backend,
            "ok": self.ok,
            "findings": [finding.to_document() for finding in self.findings],
        }


@dataclass(frozen=True)
class StopReport:
    """Whether the environment was actually stopped, not whether it was asked."""

    confirmed: bool
    detail: str
    outcomes: tuple[CommandOutcome, ...] = ()


@dataclass(frozen=True)
class DestroyReport:
    """What destroy removed and what it deliberately left alone."""

    removed: tuple[str, ...] = ()
    retained: tuple[str, ...] = ()
    detail: str = ""
    outcomes: tuple[CommandOutcome, ...] = ()


class BackendAdapter(abc.ABC):
    """One disposable environment, driven through its own tool's interface."""

    name: str = "unnamed"

    @abc.abstractmethod
    def preflight(self) -> PreflightReport:
        """Report whether this host can run this backend at all."""

    @abc.abstractmethod
    def create(self) -> EnvironmentHandle:
        """Create the fresh per-run environment and describe it."""

    @abc.abstractmethod
    def execute(
        self,
        argv: Sequence[str],
        *,
        timeout: float,
        cwd: str | None = None,
        env: Mapping[str, str] | None = None,
        extra_values: Sequence[str] = (),
    ) -> CommandOutcome:
        """Run a command inside the environment."""

    @abc.abstractmethod
    def put_tree(self, local_dir: Path, remote_dir: str) -> None:
        """Place a host directory inside the environment."""

    @abc.abstractmethod
    def fetch_tree(self, remote_dir: str, local_dir: Path) -> None:
        """Bring a directory out of the environment onto the host."""

    @abc.abstractmethod
    def write_file(self, remote_path: str, content: str, *, mode: int = 0o600) -> None:
        """Write one file inside the environment with the given permissions."""

    @abc.abstractmethod
    def stop(self) -> StopReport:
        """Stop the environment through its documented path and confirm it."""

    @abc.abstractmethod
    def destroy(self) -> DestroyReport:
        """Remove only the per-run resources this adapter declared."""

    @abc.abstractmethod
    def resource_exists(self, resource: Resource) -> bool:
        """Report whether a resource is still present, for cleanup verification."""

    def plan_handle(self) -> EnvironmentHandle | None:
        """Describe the environment this adapter *would* create, before it does.

        The runner uses it when `create` fails partway: the resources it names
        may already exist, and a run that cannot confirm their state records
        them as residue rather than destroying them blind.
        """
        return None

    def describe(self) -> dict[str, Any]:
        """Return backend facts for the manifest."""
        return {"backend": self.name}
