"""Getting the environment authenticated without leaving a secret behind.

Exactly one of the three declared methods runs. None of them writes a
credential value, a length or a prefix into a receipt, a manifest, a log or
this repository, and the copied material is removed from the environment and
verified gone before cleanup.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Mapping

from .adapters.base import BackendAdapter, EnvironmentHandle
from .config import RunConfig
from .result import AuthRecord
from .status import PhaseStatus

SETTINGS_RELATIVE = ".claude/settings.json"


def settings_document(run_config: RunConfig) -> dict[str, str]:
    """Return what the configured auth method declares in the per-run settings."""
    if run_config.auth.mode != "api_key_helper":
        return {}
    return {"apiKeyHelper": " ".join(run_config.auth.helper_argv)}


def _environment_path(handle: EnvironmentHandle, relative: str) -> str:
    return str(Path(handle.home_path) / relative)


def _existing_login(
    run_config: RunConfig,
    adapter: BackendAdapter,
    handle: EnvironmentHandle,
    host_home: Path,
) -> tuple[AuthRecord, dict[str, str]]:
    record = AuthRecord(
        mode="existing_login",
        reference=run_config.auth.reference,
        target=str(Path(handle.home_path)),
        entries=list(run_config.auth.allowlist),
    )
    missing = [
        entry for entry in run_config.auth.allowlist if not (host_home / entry).is_file()
    ]
    if missing:
        record.status = PhaseStatus.BLOCKED
        record.detail = (
            "the host does not carry every allowlisted entry: " + ", ".join(missing)
        )
        return record, {}
    for entry in run_config.auth.allowlist:
        content = (host_home / entry).read_text(encoding="utf-8")
        adapter.write_file(_environment_path(handle, entry), content, mode=0o600)
    record.status = PhaseStatus.OK
    record.detail = (
        f"{len(record.entries)} allowlisted entry(s) copied into the per-run home "
        "with owner-only permissions"
    )
    return record, {}


def _short_lived_token(
    run_config: RunConfig,
    handle: EnvironmentHandle,
    environ: Mapping[str, str],
) -> tuple[AuthRecord, dict[str, str]]:
    variable = run_config.auth.token_env or ""
    record = AuthRecord(
        mode="short_lived_token",
        reference=run_config.auth.reference,
        target="the worker process environment",
        entries=[variable],
    )
    value = environ.get(variable, "")
    if not value:
        record.status = PhaseStatus.BLOCKED
        record.detail = (
            f"the variable {variable} carries no short-lived token on this host; "
            "the run stops rather than prompting for an interactive login"
        )
        return record, {}
    record.status = PhaseStatus.OK
    record.removed_after_run = True
    record.detail = (
        f"the value of {variable} is passed to the worker process for this run only "
        "and is never written to a file, an image, a seed or a log"
    )
    return record, {variable: value}


def _api_key_helper(
    run_config: RunConfig,
    adapter: BackendAdapter,
    handle: EnvironmentHandle,
) -> tuple[AuthRecord, dict[str, str]]:
    record = AuthRecord(
        mode="api_key_helper",
        reference=run_config.auth.reference,
        target=_environment_path(handle, SETTINGS_RELATIVE),
        entries=[SETTINGS_RELATIVE],
    )
    adapter.write_file(
        _environment_path(handle, SETTINGS_RELATIVE),
        json.dumps(settings_document(run_config), indent=2) + "\n",
        mode=0o600,
    )
    record.status = PhaseStatus.OK
    record.removed_after_run = False
    record.detail = (
        "the helper command is declared in the per-run settings; no credential "
        "value passes through the runner"
    )
    return record, {}


def bootstrap(
    *,
    run_config: RunConfig,
    adapter: BackendAdapter,
    handle: EnvironmentHandle,
    host_home: Path | None = None,
    environ: Mapping[str, str] | None = None,
) -> tuple[AuthRecord, dict[str, str]]:
    """Run the one configured auth method and return its record and overlay."""
    host_home = Path(host_home if host_home is not None else Path.home())
    environ = os.environ if environ is None else environ
    mode = run_config.auth.mode
    if mode == "existing_login":
        return _existing_login(run_config, adapter, handle, host_home)
    if mode == "short_lived_token":
        return _short_lived_token(run_config, handle, environ)
    return _api_key_helper(run_config, adapter, handle)


def teardown(
    *, adapter: BackendAdapter, handle: EnvironmentHandle, record: AuthRecord
) -> AuthRecord:
    """Remove copied auth material from the environment and verify it is gone."""
    if record.mode != "existing_login" or record.status is not PhaseStatus.OK:
        record.removed_after_run = record.mode == "short_lived_token"
        return record
    paths = [_environment_path(handle, entry) for entry in record.entries]
    adapter.execute(["rm", "-f", *paths], timeout=60)
    survey = adapter.execute(
        [
            "sh",
            "-c",
            'for candidate in "$@"; do if [ -e "$candidate" ]; then '
            'printf "present:%s\\n" "$candidate"; fi; done',
            "auth-teardown",
            *paths,
        ],
        timeout=60,
    )
    still_present = [line for line in survey.stdout.splitlines() if line.startswith("present:")]
    record.removed_after_run = not still_present
    record.detail = (
        "the copied auth material was removed from the per-run home and verified gone"
        if record.removed_after_run
        else "auth material is still present in the environment: " + ", ".join(still_present)
    )
    return record
