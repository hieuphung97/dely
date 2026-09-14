"""Redaction.

Everything the runner writes to the host passes through here. The rules match
on shape rather than on a list of known values, so a credential this run has
never seen is still removed; a list of known values is accepted as an
addition, never as the mechanism.
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Sequence

VALUE_MARK = "<redacted:value>"
BEARER_MARK = "<redacted:bearer>"
TOKEN_MARK = "<redacted:token>"
KEY_BLOCK_MARK = "<redacted:private-key-block>"
PATH_MARK = "<redacted:credential-path>"

_SENSITIVE_WORD = (
    r"(?:token|secret|password|passwd|api[_-]?key|apikey|credential|cookie"
    r"|authorization|private[_-]?key|session[_-]?key|passphrase)"
)

SENSITIVE_KEY = re.compile(
    rf"^[\"']?[A-Za-z0-9_.\-]*{_SENSITIVE_WORD}[A-Za-z0-9_.\-]*[\"']?$",
    re.IGNORECASE,
)

_PRIVATE_KEY_BLOCK = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
)

_BEARER = re.compile(r"\bBearer\s+[A-Za-z0-9._\-+/=]+", re.IGNORECASE)

_ASSIGNMENT = re.compile(
    rf"(?P<key>[\"']?[A-Za-z0-9_.\-]*{_SENSITIVE_WORD}[A-Za-z0-9_.\-]*[\"']?)"
    r"(?P<sep>\s*[:=]\s*)"
    r"(?P<value>\"[^\"]*\"|'[^']*'|[^\s,;)\]}]+)",
    re.IGNORECASE,
)

_TOKEN_SHAPES = (
    re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"\bxox[baprse]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"\bey[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}"),
)

_CREDENTIAL_PATH = re.compile(
    r"(?:~|/)[^\s:;,'\"]*/"
    r"(?:\.credentials\.json|\.netrc|credentials\.json|credentials"
    r"|id_[a-z0-9]+|\.ssh/[^\s:;,'\"]*|\.aws/credentials|\.docker/config\.json)"
)


def _redact_assignment(match: "re.Match[str]") -> str:
    value = match.group("value")
    quote = value[0] if value[:1] in ("\"", "'") else ""
    return f"{match.group('key')}{match.group('sep')}{quote}{VALUE_MARK}{quote}"


def text(value: str, extra_values: Sequence[str] = ()) -> str:
    """Return the string with every recognised secret shape removed."""
    if not isinstance(value, str):
        raise TypeError("redact.text needs a string")
    cleaned = _PRIVATE_KEY_BLOCK.sub(KEY_BLOCK_MARK, value)
    cleaned = _BEARER.sub(f"Bearer {BEARER_MARK}", cleaned)
    for shape in _TOKEN_SHAPES:
        cleaned = shape.sub(TOKEN_MARK, cleaned)
    cleaned = _CREDENTIAL_PATH.sub(PATH_MARK, cleaned)
    cleaned = _ASSIGNMENT.sub(_redact_assignment, cleaned)
    for literal in sorted({v for v in extra_values if v}, key=len, reverse=True):
        cleaned = cleaned.replace(literal, VALUE_MARK)
    return cleaned


def data(raw: bytes, extra_values: Sequence[str] = ()) -> bytes:
    """Redact a captured byte stream without requiring it to be valid text."""
    decoded = raw.decode("utf-8", errors="surrogateescape")
    return text(decoded, extra_values).encode("utf-8", errors="surrogateescape")


def structure(document: Any, extra_values: Sequence[str] = ()) -> Any:
    """Return a redacted deep copy of a JSON-shaped document."""
    if isinstance(document, dict):
        result = {}
        for key, value in document.items():
            if isinstance(key, str) and SENSITIVE_KEY.match(key):
                result[key] = VALUE_MARK
            else:
                result[key] = structure(value, extra_values)
        return result
    if isinstance(document, (list, tuple)):
        return [structure(item, extra_values) for item in document]
    if isinstance(document, str):
        return text(document, extra_values)
    return document


def looks_secret_free(value: str) -> bool:
    """Report whether redaction would change the string at all."""
    return text(value) == value


def sensitive_keys(document: Any) -> Iterable[str]:
    """Yield every dictionary key in the document that names a secret."""
    if isinstance(document, dict):
        for key, value in document.items():
            if isinstance(key, str) and SENSITIVE_KEY.match(key):
                yield key
            yield from sensitive_keys(value)
    elif isinstance(document, (list, tuple)):
        for item in document:
            yield from sensitive_keys(item)
