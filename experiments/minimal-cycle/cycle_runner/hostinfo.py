"""What the host looked like before and after the run.

The comparison is what shows whether anything the run created outlived it.
Host identifiers are stored as digests: the snapshot travels into artifacts a
person may share, and the run never needs the names themselves.
"""

from __future__ import annotations

import platform
import socket
from pathlib import Path
from typing import Any, Mapping

from .probe import digest
from .proc import utc_now


def _read_first_line(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.readline().strip()
    except OSError:
        return ""


def _root_view(root: Path) -> dict[str, Any]:
    root = Path(root)
    if not root.is_dir():
        return {"path": str(root), "exists": False, "entries": []}
    return {
        "path": str(root),
        "exists": True,
        "entries": sorted(child.name for child in root.iterdir()),
    }


def snapshot(
    *,
    state_root: Path,
    artifact_root: Path,
    extra: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Capture the host facts this run is allowed to compare against."""
    return {
        "captured_at": utc_now(),
        "kernel": platform.release(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "hostname_digest": digest(socket.gethostname()),
        "machine_id_digest": digest(_read_first_line("/etc/machine-id")),
        "boot_id_digest": digest(_read_first_line("/proc/sys/kernel/random/boot_id")),
        "user_digest": digest(str(Path.home())),
        "state_root": _root_view(state_root),
        "artifact_root": _root_view(artifact_root),
        "extra": dict(extra or {}),
    }


def difference(before: Mapping[str, Any], after: Mapping[str, Any]) -> dict[str, Any]:
    """Report what changed between two host snapshots."""
    changes: dict[str, Any] = {}
    for name in ("state_root", "artifact_root"):
        was = set(before.get(name, {}).get("entries", []))
        now = set(after.get(name, {}).get("entries", []))
        added = sorted(now - was)
        removed = sorted(was - now)
        if added:
            changes[f"{name}_added"] = added
        if removed:
            changes[f"{name}_removed"] = removed
    return changes
