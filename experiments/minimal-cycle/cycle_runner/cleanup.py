"""Destroying the run, and proving what was destroyed.

Two rules carry the weight. Destruction happens only after a confirmed
export, so evidence is never traded for tidiness. And destruction targets a
declared list of per-run resources, so a shared base image survives because
nothing was ever allowed to point at it, not because the command happened to
point elsewhere.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Callable, Iterable, Sequence

from . import processes
from .adapters.base import BackendAdapter, EnvironmentHandle, Resource
from .result import CleanupRecord, ExportRecord
from .status import CleanupStatus

_NEVER_REMOVABLE = (Path("/"), Path("/home"), Path("/usr"), Path("/etc"), Path("/var"))


class CleanupContractError(RuntimeError):
    """A removal was asked for that the declarations do not permit."""


def assert_declarations_disjoint(
    *, per_run: Sequence[Resource], shared: Sequence[Resource]
) -> None:
    """Refuse declarations where removing a per-run resource takes a shared one."""
    for owned in per_run:
        for common in shared:
            if owned.kind == common.kind and owned.identifier == common.identifier:
                raise CleanupContractError(
                    f"{owned} is declared both per-run and shared"
                )
            if owned.kind == "path" and common.kind in ("path", "image", "volume"):
                owned_path = Path(owned.identifier).resolve()
                shared_path = Path(common.identifier).resolve()
                if shared_path == owned_path or shared_path.is_relative_to(owned_path):
                    raise CleanupContractError(
                        f"the per-run path {owned_path} contains the shared resource "
                        f"{shared_path}; removing it would take the shared resource"
                    )


def safe_remove(
    path: Path, *, allowed_roots: Iterable[Path], protected: Iterable[Path]
) -> None:
    """Remove a path only when it is inside an allowed root and holds nothing shared."""
    target = Path(path)
    resolved = target.resolve() if target.exists() else target.absolute()
    if resolved in _NEVER_REMOVABLE:
        raise CleanupContractError(f"refusing to remove {resolved}")
    roots = [Path(root).resolve() for root in allowed_roots]
    if not any(resolved.is_relative_to(root) for root in roots):
        raise CleanupContractError(
            f"{resolved} is outside every allowed root {[str(root) for root in roots]}"
        )
    for keep in protected:
        keep_path = Path(keep).resolve() if Path(keep).exists() else Path(keep).absolute()
        if keep_path == resolved or keep_path.is_relative_to(resolved):
            raise CleanupContractError(
                f"refusing to remove {resolved}: it holds the protected path {keep_path}"
            )
    if not target.exists() and not target.is_symlink():
        return
    if target.is_dir() and not target.is_symlink():
        shutil.rmtree(target)
    else:
        target.unlink()


def run_paths(handle: EnvironmentHandle) -> list[str]:
    """Return the paths that belong to this run and nothing else."""
    paths = [handle.home_path]
    paths.extend(
        item.identifier for item in handle.per_run_resources if item.kind == "path"
    )
    return [path for path in dict.fromkeys(paths) if path]


def perform(
    *,
    adapter: BackendAdapter,
    handle: EnvironmentHandle,
    export_record: ExportRecord,
    stop_confirmed: bool = True,
    survey: Callable[..., processes.SurveyReport] | None = None,
    started: Sequence[int] = (),
) -> CleanupRecord:
    """Destroy per-run resources only after a confirmed export and a confirmed stop."""
    per_run = list(handle.per_run_resources)
    shared = list(handle.shared_resources)
    assert_declarations_disjoint(per_run=per_run, shared=shared)

    if not export_record.status.permits_cleanup:
        return CleanupRecord(
            status=CleanupStatus.RESIDUE,
            reason=(
                "the export was not confirmed "
                f"({export_record.status.value}), so nothing was destroyed and the "
                "environment is left standing for a manual decision"
            ),
            retained=[str(item) for item in per_run],
            shared_preserved=[str(item) for item in shared],
            verified=False,
        )

    if not stop_confirmed:
        return CleanupRecord(
            status=CleanupStatus.RESIDUE,
            reason=(
                "the stop was not confirmed, so nothing was destroyed; a resource "
                "whose state is unknown is left standing for a manual decision"
            ),
            retained=[str(item) for item in per_run],
            shared_preserved=[str(item) for item in shared],
            verified=False,
        )

    # Before the directory goes: a process still holding a path of this run
    # outlives the resource that nominally contained it, keeps its window on the
    # host's screen, and writes to a directory that is about to stop existing.
    survey_report = (
        survey(run_paths(handle), roots=tuple(started))
        if survey is not None
        else processes.SurveyReport(detail="no survey was asked for")
    )

    report = adapter.destroy()

    surviving = [item for item in per_run if adapter.resource_exists(item)]
    lost_shared = [item for item in shared if not adapter.resource_exists(item)]
    preserved_shared = [item for item in shared if adapter.resource_exists(item)]

    if lost_shared:
        return CleanupRecord(
            status=CleanupStatus.UNKNOWN,
            reason=(
                "cleanup removed a shared resource it must never touch: "
                + ", ".join(str(item) for item in lost_shared)
            ),
            removed=list(report.removed),
            retained=[str(item) for item in surviving],
            shared_preserved=[str(item) for item in preserved_shared],
            verified=False,
            processes=survey_report.to_document(),
        )

    if surviving:
        return CleanupRecord(
            status=CleanupStatus.RESIDUE,
            reason=(
                "destroy returned but these per-run resources are still present: "
                + ", ".join(str(item) for item in surviving)
            ),
            removed=list(report.removed),
            retained=[str(item) for item in surviving],
            shared_preserved=[str(item) for item in preserved_shared],
            verified=True,
            processes=survey_report.to_document(),
        )

    if not survey_report.clean:
        return CleanupRecord(
            status=CleanupStatus.RESIDUE,
            reason=(
                "every declared per-run resource is gone, and "
                + survey_report.detail
            ),
            removed=list(report.removed),
            retained=[f"process:{pid}" for pid in survey_report.surviving],
            shared_preserved=[str(item) for item in preserved_shared],
            verified=True,
            processes=survey_report.to_document(),
        )

    return CleanupRecord(
        status=CleanupStatus.DESTROYED,
        reason=(
            "every declared per-run resource is gone, every shared one remains, and "
            + survey_report.detail
        ),
        removed=list(report.removed),
        retained=[],
        shared_preserved=[str(item) for item in preserved_shared],
        verified=True,
        processes=survey_report.to_document(),
    )
