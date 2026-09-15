"""The agent's first run, in a home that has never run it.

A disposable environment gives Claude Code a home it has never seen, and a
first run asks before it works: finish onboarding and sign in, trust this
folder, accept the permission mode it was launched with, allow the external
imports this project's own instructions declare. Each question is a modal
the dispatch cannot answer, so the agent holds the task unsent and the
execution plane reports a turn that never started — the same symptom as a
worker that died, with none of the cause.

The answers are recorded state, not credentials. They are written here from
what the configuration already says rather than copied from the host, so no
account, machine or history travels into the environment with them.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import auth
from .adapters.base import BackendAdapter, EnvironmentHandle
from .config import RunConfig
from .result import FirstRunRecord
from .status import PhaseStatus

#: Where Claude Code keeps what it has been told, relative to the home.
STATE_RELATIVE = ".claude.json"
SETTINGS_RELATIVE = auth.SETTINGS_RELATIVE

#: One line per question this state answers, for the receipt. Naming them is
#: the difference between a run that answered four prompts and a run that
#: silently pre-approved whatever the agent might ask.
QUESTIONS = (
    "onboarding, which otherwise offers a theme and an interactive sign-in",
    "trusting the project copy, by its path inside the environment",
    "the external imports the project's own instructions declare",
    "the permission mode the execution plane launches the agent with",
)


def state_document(project_path: str) -> dict[str, Any]:
    """Return the first-run state for one project copy."""
    return {
        "hasCompletedOnboarding": True,
        "projects": {
            project_path: {
                "hasTrustDialogAccepted": True,
                "hasClaudeMdExternalIncludesApproved": True,
                "hasClaudeMdExternalIncludesWarningShown": True,
            }
        },
    }


def settings_document(run_config: RunConfig) -> dict[str, Any]:
    """Return the per-run settings, including whatever auth declared there."""
    return {
        **auth.settings_document(run_config),
        "skipDangerousModePermissionPrompt": True,
    }


def apply(
    *, run_config: RunConfig, adapter: BackendAdapter, handle: EnvironmentHandle
) -> FirstRunRecord:
    """Write the first-run state into the per-run home and report what it wrote."""
    record = FirstRunRecord(
        target=str(Path(handle.home_path)),
        entries=[STATE_RELATIVE, SETTINGS_RELATIVE],
        questions=list(QUESTIONS),
    )
    home = Path(handle.home_path)
    for relative, document in (
        (STATE_RELATIVE, state_document(handle.project_path)),
        (SETTINGS_RELATIVE, settings_document(run_config)),
    ):
        adapter.write_file(
            str(home / relative), json.dumps(document, indent=2) + "\n", mode=0o600
        )
    record.status = PhaseStatus.OK
    record.detail = (
        f"{len(record.entries)} first-run state file(s) written into the per-run "
        f"home, answering {len(record.questions)} question(s) the agent asks a "
        "home it has never run in"
    )
    return record
