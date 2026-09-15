"""Checking a rendered Pulumi program against the provider it is pinned to.

An example copied from a blog post is not evidence that a field exists in the
version this run installs. This module reads the program the adapter renders,
collects every provider class and keyword it names, and compares them with the
provider module actually importable from the pinned environment.
"""

from __future__ import annotations

import ast
import json
import subprocess
from pathlib import Path
from typing import Any, Mapping

PROVIDER_MODULE = "pulumi_libvirt"


def declared_symbols(program: str) -> dict[str, set[str]]:
    """Return the provider classes a program calls and the keywords it passes."""
    tree = ast.parse(program)
    aliases = {PROVIDER_MODULE}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for name in node.names:
                if name.name == PROVIDER_MODULE and name.asname:
                    aliases.add(name.asname)
    found: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        target = node.func
        if not isinstance(target, ast.Attribute):
            continue
        owner = target.value
        if not isinstance(owner, ast.Name) or owner.id not in aliases:
            continue
        keywords = {keyword.arg for keyword in node.keywords if keyword.arg}
        found.setdefault(target.attr, set()).update(keywords)
    return found


def _properties(holder: Any) -> set[str]:
    return {name for name, value in vars(holder).items() if isinstance(value, property)}


def verify_against(symbols: Mapping[str, set[str]], module: Any) -> list[str]:
    """Return one problem per class or keyword the provider does not have."""
    problems: list[str] = []
    for class_name in sorted(symbols):
        holder = getattr(module, class_name, None)
        if holder is None:
            problems.append(
                f"the pinned provider has no {class_name}; the program names it"
            )
            continue
        known = _properties(holder)
        for keyword in sorted(symbols[class_name]):
            if keyword not in known:
                problems.append(
                    f"{class_name} has no field {keyword!r} in the pinned provider"
                )
    return problems


_PROBE = """
import json, sys
import %s as provider

symbols = json.loads(sys.stdin.read())
problems = []
for class_name in sorted(symbols):
    holder = getattr(provider, class_name, None)
    if holder is None:
        problems.append("the pinned provider has no " + class_name + "; the program names it")
        continue
    known = {name for name, value in vars(holder).items() if isinstance(value, property)}
    for keyword in sorted(symbols[class_name]):
        if keyword not in known:
            problems.append(class_name + " has no field '" + keyword + "' in the pinned provider")
print(json.dumps(problems))
""" % PROVIDER_MODULE


def verify_with_interpreter(
    program: str, interpreter: Path, *, timeout: float = 120
) -> tuple[bool, list[str]]:
    """Verify a program against the provider importable from one interpreter.

    Returns (ran, problems). `ran` is False when the interpreter could not be
    used at all, which is a blocked preflight rather than a pass.
    """
    interpreter = Path(interpreter)
    if not interpreter.is_file():
        return False, [f"no interpreter at {interpreter}"]
    try:
        symbols = declared_symbols(program)
    except SyntaxError as error:
        return True, [f"the rendered program does not parse: {error}"]
    payload = json.dumps({name: sorted(values) for name, values in symbols.items()})
    completed = subprocess.run(
        [str(interpreter), "-c", _PROBE],
        input=payload,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if completed.returncode != 0:
        return False, [
            "the pinned environment could not import the provider: "
            + (completed.stderr or "").strip().splitlines()[-1:][0]
            if (completed.stderr or "").strip()
            else "the pinned environment could not import the provider"
        ]
    try:
        return True, list(json.loads(completed.stdout))
    except json.JSONDecodeError:
        return False, ["the provider probe returned nothing readable"]
