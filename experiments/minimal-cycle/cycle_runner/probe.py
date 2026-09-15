"""Proving which side of the boundary a command ran on.

The same shell probe runs on the host and inside the environment. A verdict
that cannot tell the two apart is a host fallback, and a host fallback stops
the run: it never degrades into using the host's Orca, the host's home or the
host's checkout.
"""

from __future__ import annotations

import hashlib
from typing import Any, Mapping

from .result import (
    IDENTITY_ENVIRONMENT,
    IDENTITY_HOST_FALLBACK,
    IDENTITY_UNKNOWN,
    IdentityRecord,
)

REQUIRED_FIELDS = (
    "hostname",
    "machine_id",
    "boot_id",
    "home",
    "user",
    "path",
    "pid",
    "uname",
    "container_marker",
    "virt",
    "orca_path",
    "orca_version",
    "orca_fingerprint",
    "project_real",
)

#: POSIX shell. It is run identically on the host and in the environment, and
#: it reads only what every image can be expected to expose.
PROBE_SCRIPT = r"""
set -u
project_path="${1:-}"
orca_command="${2:-orca}"

first_line() {
    if [ -r "$1" ]; then
        head -n 1 "$1" 2>/dev/null || printf ''
    else
        printf ''
    fi
}

marker=''
if [ -f /run/.containerenv ]; then marker='containerenv'; fi
if [ -z "$marker" ] && [ -f /.dockerenv ]; then marker='dockerenv'; fi
if [ -z "$marker" ] && [ -f /run/.toolboxenv ]; then marker='toolboxenv'; fi
if [ -z "$marker" ] && [ -n "${container:-}" ]; then marker="${container}"; fi

virt='unknown'
if command -v systemd-detect-virt >/dev/null 2>&1; then
    detected="$(systemd-detect-virt 2>/dev/null | head -n 1)"
    if [ -n "$detected" ]; then virt="$detected"; fi
fi

orca_binary="$(command -v "$orca_command" 2>/dev/null || printf '')"
orca_release=''
orca_fingerprint=''
if [ -n "$orca_binary" ]; then
    orca_release="$("$orca_binary" --version 2>/dev/null | head -n 1 || printf '')"
    orca_resolved="$(readlink -f "$orca_binary" 2>/dev/null || printf '%s' "$orca_binary")"
    orca_fingerprint="$(stat -c '%i:%s:%Y' "$orca_resolved" 2>/dev/null || printf '')"
fi

project_resolved=''
if [ -n "$project_path" ] && [ -d "$project_path" ]; then
    project_resolved="$(cd "$project_path" 2>/dev/null && pwd -P || printf '')"
fi

printf 'hostname=%s\n' "$(uname -n 2>/dev/null || printf '')"
printf 'machine_id=%s\n' "$(first_line /etc/machine-id)"
printf 'boot_id=%s\n' "$(first_line /proc/sys/kernel/random/boot_id)"
printf 'home=%s\n' "${HOME:-}"
printf 'user=%s\n' "$(id -un 2>/dev/null || printf '')"
printf 'path=%s\n' "${PATH:-}"
printf 'pid=%s\n' "$$"
printf 'uname=%s\n' "$(uname -srm 2>/dev/null || printf '')"
printf 'container_marker=%s\n' "$marker"
printf 'virt=%s\n' "$virt"
printf 'orca_path=%s\n' "$orca_binary"
printf 'orca_version=%s\n' "$orca_release"
printf 'orca_fingerprint=%s\n' "$orca_fingerprint"
printf 'project_real=%s\n' "$project_resolved"
"""

_UNINFORMATIVE_VIRT = ("", "none", "unknown")


def probe_argv(project_path: str, orca_command: str = "orca") -> list[str]:
    """Return the argv that runs the probe for a project path and an Orca command.

    The command is named rather than assumed: a container inherits the host's
    search path, so the bare name can resolve to the host's own launcher even
    when the container has an installation of its own.
    """
    return ["sh", "-c", PROBE_SCRIPT, "cycle-probe", project_path, orca_command]


def parse(text: str) -> dict[str, str]:
    """Parse the probe's key-value output; unrecognised lines are dropped."""
    snapshot: dict[str, str] = {}
    for line in text.splitlines():
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key:
            snapshot[key] = value.strip()
    return snapshot


def digest(value: str) -> str:
    """Return a short, non-reversing digest for an identifier."""
    if not value:
        return ""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _host_view(host: Mapping[str, str]) -> dict[str, Any]:
    return {
        "hostname_digest": digest(host.get("hostname", "")),
        "machine_id_digest": digest(host.get("machine_id", "")),
        "boot_id_digest": digest(host.get("boot_id", "")),
        "home_digest": digest(host.get("home", "")),
        "user_digest": digest(host.get("user", "")),
        "project_real_digest": digest(host.get("project_real", "")),
        # Digests, not paths: the host's own installation may sit under a home
        # directory, and this block travels into artifacts a person may share.
        "orca_path_digest": digest(host.get("orca_path", "")),
        "orca_fingerprint_digest": digest(host.get("orca_fingerprint", "")),
        "virt": host.get("virt", ""),
        "orca_present": bool(host.get("orca_path")),
    }


def _environment_view(environment: Mapping[str, str]) -> dict[str, Any]:
    return {
        key: environment.get(key, "")
        for key in (
            "hostname",
            "home",
            "user",
            "path",
            "pid",
            "uname",
            "container_marker",
            "virt",
            "orca_path",
            "orca_version",
            "orca_fingerprint",
            "project_real",
        )
    }


def _markers(host: Mapping[str, str], environment: Mapping[str, str]) -> list[str]:
    markers: list[str] = []
    marker = environment.get("container_marker", "")
    if marker:
        markers.append(f"container-marker:{marker}")
    machine = environment.get("machine_id", "")
    if machine and machine != host.get("machine_id", ""):
        markers.append("distinct-machine-identity")
    boot = environment.get("boot_id", "")
    if boot and boot != host.get("boot_id", ""):
        markers.append("distinct-boot-identity")
    name = environment.get("hostname", "")
    if name and name != host.get("hostname", ""):
        markers.append("distinct-hostname")
    virt = environment.get("virt", "")
    if virt not in _UNINFORMATIVE_VIRT and virt != host.get("virt", ""):
        markers.append(f"reported-virtualisation:{virt}")
    return markers


def verdict(
    *,
    host: Mapping[str, str],
    environment: Mapping[str, str],
    backend: str,
    expected_home: str,
    expected_project: str,
) -> IdentityRecord:
    """Decide whether the environment answered as itself or as the host."""
    environment_orca = environment.get("orca_path", "")
    host_orca = host.get("orca_path", "")
    environment_version = environment.get("orca_version", "")
    # The same path is not the same file: a container that installs its own
    # Orca has it where the host does. Compare what the path resolves to, and
    # fall back to the path only when nothing could be resolved.
    environment_print = environment.get("orca_fingerprint", "")
    host_print = host.get("orca_fingerprint", "")
    if environment_print and host_print:
        is_host_installation = environment_print == host_print
    else:
        is_host_installation = bool(environment_orca) and environment_orca == host_orca
    record = IdentityRecord(
        host=_host_view(host),
        environment=_environment_view(environment),
        # A path that resolves is not an installation the environment has: a
        # Distrobox box inherits the host PATH and sees the host home, so the
        # host's own launcher answers `command -v orca` inside it.
        orca_present=bool(environment_orca)
        and not is_host_installation
        and bool(environment_version),
        orca_is_host_installation=is_host_installation,
        orca_version=environment_version or None,
    )

    missing = [field for field in ("hostname", "home") if not environment.get(field)]
    if missing:
        record.verdict = IDENTITY_UNKNOWN
        record.reason = (
            "the environment probe returned no "
            + ", ".join(missing)
            + "; nothing can be concluded about where the command ran"
        )
        return record

    markers = _markers(host, environment)
    record.markers = markers

    if not markers:
        record.verdict = IDENTITY_HOST_FALLBACK
        record.reason = (
            "the environment answered with the host's own identity: no container "
            "marker, no distinct machine or boot identity, and the same host name"
        )
        return record

    if backend == "vm" and "distinct-boot-identity" not in markers:
        record.verdict = IDENTITY_HOST_FALLBACK
        record.reason = (
            "the machine backend requires a distinct boot identity; the probe "
            "reported the host's own boot identity, so this is not a separate kernel"
        )
        return record

    observed_home = environment.get("home", "")
    if observed_home != expected_home:
        record.verdict = IDENTITY_HOST_FALLBACK
        record.reason = (
            f"the environment home is {observed_home!r}, not the per-run home "
            f"{expected_home!r}"
        )
        return record

    observed_project = environment.get("project_real", "")
    if observed_project != expected_project:
        record.verdict = IDENTITY_HOST_FALLBACK
        record.reason = (
            f"the resolved project path is {observed_project!r}, not the per-run "
            f"project copy {expected_project!r}"
        )
        return record

    record.verdict = IDENTITY_ENVIRONMENT
    record.reason = "the environment answered with its own identity, home and project copy"
    return record


def may_continue(record: IdentityRecord) -> tuple[bool, str]:
    """Report whether the run may proceed past the identity gate, and why not."""
    if record.verdict != IDENTITY_ENVIRONMENT:
        return False, record.reason
    if record.orca_present:
        return True, record.reason
    found = record.environment.get("orca_path", "")
    if record.orca_is_host_installation:
        return (
            False,
            f"the environment resolved orca to the host's own installation at "
            f"{found}; the run stops rather than driving the host from inside a "
            "disposable environment",
        )
    if not found:
        return (
            False,
            "orca is not present inside the environment; the run stops rather than "
            "using the host's installation",
        )
    return (
        False,
        f"orca is at {found} inside the environment but reported no version there, "
        "so it cannot be driven from inside it",
    )
