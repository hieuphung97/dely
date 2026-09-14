"""Run identifiers.

A run identifier has to survive in a directory name, a container name, a
domain name and a log line, and it must not disclose anything about the host
or about how the run authenticates. It therefore carries a timestamp, a
digest of the host name rather than the host name, and fresh entropy.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime, timezone

RUN_ID_PATTERN = re.compile(r"^\d{8}T\d{6}Z-[0-9a-f]{6}-[0-9a-f]{8}$")

_TIMESTAMP_FORMAT = "%Y%m%dT%H%M%SZ"
_HOST_SEGMENT_LENGTH = 6
_ENTROPY_BYTES = 4
_MAX_RESOURCE_NAME = 63
_PREFIX_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")


def host_segment(host_name: str) -> str:
    """Return a stable, non-reversing short segment for a host name."""
    digest = hashlib.sha256(host_name.encode("utf-8")).hexdigest()
    return digest[:_HOST_SEGMENT_LENGTH]


def mint_run_id(*, now: datetime, host_name: str) -> str:
    """Mint one run identifier for the given instant and host."""
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("run identifiers need an aware timestamp")
    stamp = now.astimezone(timezone.utc).strftime(_TIMESTAMP_FORMAT)
    return f"{stamp}-{host_segment(host_name)}-{secrets.token_hex(_ENTROPY_BYTES)}"


def is_run_id(candidate: str) -> bool:
    """Report whether a string is shaped like a minted run identifier."""
    return bool(RUN_ID_PATTERN.match(candidate))


def resource_name(prefix: str, run_id: str) -> str:
    """Return a backend resource name derived from a run identifier.

    The run identifier is kept whole so two runs never collide; the prefix is
    what gives way when the combined name would exceed the limit that
    container and domain names share.
    """
    if not _PREFIX_PATTERN.match(prefix):
        raise ValueError(f"resource prefix is not a safe name: {prefix!r}")
    if not is_run_id(run_id):
        raise ValueError(f"not a run identifier: {run_id!r}")
    tail = run_id.lower()
    budget = _MAX_RESOURCE_NAME - len(tail) - 1
    if budget < 1:
        raise ValueError("run identifier leaves no room for a resource prefix")
    return f"{prefix[:budget].rstrip('-')}-{tail}"
