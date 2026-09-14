"""Content digests and sizes for export receipts and manifests."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

_CHUNK = 1024 * 1024


def digest_file(path: Path) -> str:
    """Return the content digest of one file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(_CHUNK)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def describe_file(path: Path, *, relative_to: Path) -> dict[str, Any]:
    """Describe one file by its relative path, size and digest."""
    resolved = Path(path)
    if not resolved.is_file():
        raise FileNotFoundError(str(resolved))
    return {
        "path": resolved.relative_to(relative_to).as_posix(),
        "size_bytes": resolved.stat().st_size,
        "sha256": digest_file(resolved),
    }


def describe_tree(root: Path) -> list[dict[str, Any]]:
    """Describe every regular file under a directory, in path order."""
    root = Path(root)
    if not root.is_dir():
        return []
    described = [
        describe_file(path, relative_to=root)
        for path in sorted(root.rglob("*"))
        if path.is_file() and not path.is_symlink()
    ]
    return sorted(described, key=lambda entry: entry["path"])
