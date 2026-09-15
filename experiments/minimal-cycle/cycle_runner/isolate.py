"""Keeping the host's own session out of the environment.

This runner is usually launched from inside the very execution plane it is
testing, and that plane identifies its terminals through the environment. A
backend that inherits the host's environment therefore hands the environment
the host's session identity — and, in Orca's case, a token with it.

The effect is not subtle: the environment's own command line attests as the
host's terminal and refuses to act, which is the plane correctly noticing that
two different things claim to be the same session.
"""

from __future__ import annotations

from typing import Sequence

#: Variables whose names begin with these belong to the host's session, not to
#: the environment's. They are removed before any command runs inside one.
LEAKING_PREFIXES = ("ORCA_",)

#: Unsets by prefix rather than by name: the plane may add a variable tomorrow,
#: and a list of names would silently stop covering it.
_SCRIPT = (
    'for prefix in "$@"; do '
    '  case "$prefix" in --) shift; break;; esac; '
    'done; '
    'for name in $(env | sed -n "s/^\\([A-Za-z_][A-Za-z0-9_]*\\)=.*/\\1/p"); do '
    '  case "$name" in '
    + "|".join(f"{prefix}*" for prefix in LEAKING_PREFIXES)
    + ') unset "$name";; '
    '  esac; '
    'done; '
    'exec "$@"'
)


def without_host_session(argv: Sequence[str]) -> list[str]:
    """Return an argv that runs the same command with the host's session removed."""
    return ["sh", "-c", _SCRIPT, "cycle-isolate", "--", *[str(item) for item in argv]]
