"""Exporting the project at a pinned revision, and diffing it afterwards.

The export is `git archive`, so the copy carries the tracked tree at exactly
one revision and none of the repository's own state. The patch is computed on
the host from the fetched tree, so no image has to carry a diff tool and both
backends produce the same artifact.
"""

from __future__ import annotations

import difflib
import subprocess
import tarfile
import tempfile
from pathlib import Path

from . import redact

_TEXT_SAMPLE = 8192


class ProjectError(RuntimeError):
    """The project copy could not be produced from the named revision."""


def _git(source: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ["git", "-C", str(source), *arguments],
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise ProjectError(
            f"git {' '.join(arguments)} failed in {source}: "
            f"{redact.text(completed.stderr.strip())}"
        )
    return completed.stdout


def resolve_revision(source: Path, revision: str) -> str:
    """Resolve a revision to the commit it names."""
    source = Path(source)
    if not source.is_dir():
        raise ProjectError(f"project source is not a directory: {source}")
    return _git(source, "rev-parse", "--verify", f"{revision}^{{commit}}").strip()


def export_revision(source: Path, revision: str, destination: Path) -> str:
    """Export the tracked tree at `revision` into an empty destination."""
    source = Path(source)
    destination = Path(destination)
    if destination.exists() and any(destination.iterdir()):
        raise ProjectError(f"project destination is not empty: {destination}")
    commit = resolve_revision(source, revision)
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as staging:
        archive = Path(staging) / "project.tar"
        _git(source, "archive", "--format=tar", f"--output={archive}", commit)
        with tarfile.open(archive) as bundle:
            bundle.extractall(destination, filter="data")
    return commit


def copy_tree(source: Path, destination: Path) -> None:
    """Copy a directory tree verbatim, files only, creating parents as needed."""
    source = Path(source)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    for path in sorted(source.rglob("*")):
        if path.is_symlink() or not path.is_file():
            continue
        target = destination / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(path.read_bytes())


def _relative_files(root: Path) -> dict[str, Path]:
    root = Path(root)
    if not root.is_dir():
        return {}
    return {
        path.relative_to(root).as_posix(): path
        for path in sorted(root.rglob("*"))
        if path.is_file() and not path.is_symlink()
    }


def _is_text(raw: bytes) -> bool:
    if b"\x00" in raw[:_TEXT_SAMPLE]:
        return False
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def _lines(raw: bytes) -> list[str]:
    return raw.decode("utf-8").splitlines(keepends=True)


def unified_diff(baseline: Path, current: Path) -> str:
    """Return one redacted patch describing what the run changed."""
    before = _relative_files(baseline)
    after = _relative_files(current)
    pieces: list[str] = []
    for relative in sorted(set(before) | set(after)):
        old = before.get(relative)
        new = after.get(relative)
        old_bytes = old.read_bytes() if old else b""
        new_bytes = new.read_bytes() if new else b""
        if old and new and old_bytes == new_bytes:
            continue
        if not _is_text(old_bytes) or not _is_text(new_bytes):
            pieces.append(f"Binary files a/{relative} and b/{relative} differ\n")
            continue
        from_file = "/dev/null" if old is None else f"a/{relative}"
        to_file = "/dev/null" if new is None else f"b/{relative}"
        pieces.extend(
            difflib.unified_diff(
                _lines(old_bytes),
                _lines(new_bytes),
                fromfile=from_file,
                tofile=to_file,
                lineterm="\n",
            )
        )
    return redact.text("".join(pieces))
