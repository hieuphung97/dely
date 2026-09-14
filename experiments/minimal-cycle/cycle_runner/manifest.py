"""Building and validating the run manifest.

The manifest is the only durable claim the runner makes, so it is redacted
before it is returned and validated before it is written. Validation uses the
restricted subset of the schema vocabulary this package needs, because the
runtime is the standard library alone.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Mapping

from . import redact
from .config import RunConfig
from .result import RunResult

SCHEMA_VERSION = 1
SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema.json"

_TYPE_NAMES = {
    "object": dict,
    "array": list,
    "string": str,
    "number": (int, float),
    "integer": int,
    "boolean": bool,
    "null": type(None),
}


class ManifestError(ValueError):
    """The manifest does not satisfy the schema."""


def load_schema(path: Path | None = None) -> dict[str, Any]:
    """Return the manifest schema document."""
    return json.loads(Path(path or SCHEMA_PATH).read_text(encoding="utf-8"))


def _matches_type(value: Any, expected: Any) -> bool:
    names = expected if isinstance(expected, list) else [expected]
    for name in names:
        python_type = _TYPE_NAMES.get(name)
        if python_type is None:
            continue
        if name == "integer" and isinstance(value, bool):
            continue
        if name == "number" and isinstance(value, bool):
            continue
        if isinstance(value, python_type):
            return True
    return False


def _check(document: Any, schema: Mapping[str, Any], trail: str, problems: list[str]) -> None:
    if "const" in schema and document != schema["const"]:
        problems.append(f"{trail or 'document'} must be {schema['const']!r}")
        return
    if "type" in schema and not _matches_type(document, schema["type"]):
        problems.append(
            f"{trail or 'document'} must be of type {schema['type']!r}, "
            f"got {type(document).__name__}"
        )
        return
    if "enum" in schema and document not in schema["enum"]:
        problems.append(f"{trail or 'document'} must be one of {schema['enum']!r}, got {document!r}")
        return
    if "pattern" in schema and isinstance(document, str):
        if not re.match(schema["pattern"], document):
            problems.append(f"{trail or 'document'} does not match {schema['pattern']!r}")
            return
    if isinstance(document, dict):
        for name in schema.get("required", ()):
            if name not in document:
                problems.append(f"missing required field: {f'{trail}.{name}' if trail else name}")
        for name, subschema in schema.get("properties", {}).items():
            if name in document:
                _check(document[name], subschema, f"{trail}.{name}" if trail else name, problems)
    elif isinstance(document, list) and "items" in schema:
        for index, item in enumerate(document):
            _check(item, schema["items"], f"{trail}[{index}]", problems)


def validate(document: Mapping[str, Any], schema: Mapping[str, Any] | None = None) -> None:
    """Raise :class:`ManifestError` naming every problem the schema finds."""
    problems: list[str] = []
    _check(document, schema or load_schema(), "", problems)
    if problems:
        raise ManifestError("; ".join(problems))


def build(
    *,
    run_result: RunResult,
    run_config: RunConfig,
    host_before: Mapping[str, Any],
    host_after: Mapping[str, Any],
    artifacts: list[Mapping[str, Any]],
    tool_versions: Mapping[str, Any],
    generated_at: str,
) -> dict[str, Any]:
    """Return the redacted manifest document for one run."""
    document = dict(run_result.to_document())
    document.update(
        {
            "schema_version": SCHEMA_VERSION,
            "generated_at": generated_at,
            "timeout_seconds": run_config.timeout_seconds,
            "config": run_config.to_document(),
            "artifact_root": str(run_config.artifact_root / run_result.run_id),
            "artifacts": [dict(entry) for entry in artifacts],
            "host_before": dict(host_before),
            "host_after": dict(host_after),
        }
    )
    document["versions"] = {**dict(run_result.versions), **dict(tool_versions)}
    return redact.structure(document)


def write(document: Mapping[str, Any], path: Path) -> None:
    """Validate, then write the manifest; an invalid manifest reaches no disk."""
    validate(document)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(
        json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
