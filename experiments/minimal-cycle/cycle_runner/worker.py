"""Launching the one Claude Code worker through Orca, inside the environment.

The prompt is a file in the environment and the dispatch carries a pointer to
it, because a prompt inlined as a shell argument is mangled by quoting. The
model and the effort are named on every launch, so the worker never runs on a
harness default the manifest cannot report.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from . import redact
from .adapters.base import BackendAdapter, EnvironmentHandle
from .config import RunConfig
from .result import WorkerRecord
from .status import PhaseStatus

SETTLING_TYPES = ("worker_done", "escalation", "question")

#: States the execution plane uses to say it could not tell what happened. They
#: are not failures: the worker may still be starting, wedged, or holding the
#: task unsent. Treating them as failures claims knowledge nobody has.
UNVERIFIABLE_STATES = ("outcome_unknown",)
PROMPT_NAME = "dispatch-prompt.md"
DEFAULT_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent / "fixtures" / "evidence-task" / "prompt.md"
)


@dataclass(frozen=True)
class LaunchPlan:
    """The three Orca commands one dispatch needs, as argv."""

    prompt_path: str
    spec: str
    run_create_argv: tuple[str, ...]
    worker_start_argv: tuple[str, ...]
    wait_argv: tuple[str, ...]


def build_prompt(run_config: RunConfig, handle: EnvironmentHandle) -> str:
    """Render the task prompt for this run's marker and project copy."""
    source = run_config.task.prompt_path
    if source:
        candidate = Path(source)
        if not candidate.is_absolute() and run_config.source_path is not None:
            candidate = run_config.source_path.parent / candidate
        template = candidate.read_text(encoding="utf-8")
    else:
        template = DEFAULT_PROMPT_PATH.read_text(encoding="utf-8")
    return (
        template.replace("{{project_path}}", handle.project_path)
        .replace("{{relative_path}}", run_config.task.relative_path)
        .replace("{{marker}}", run_config.task.marker)
    )


def build_plan(
    *,
    run_config: RunConfig,
    handle: EnvironmentHandle,
    timeout_seconds: int,
    orca_run_id: str | None,
    coordinator_handle: str | None = None,
) -> LaunchPlan:
    """Compose the argv for run-create, worker-start and the completion wait."""
    prompt_path = str(Path(handle.home_path) / PROMPT_NAME)
    spec = (
        f"Read the file {prompt_path} in this environment and do exactly what it says."
    )
    deadline = str(int(timeout_seconds) * 1000)
    start = [
        "orca",
        "orchestration",
        "worker-start",
        "--spec",
        spec,
        "--agent",
        run_config.orca.agent,
        "--model",
        run_config.orca.model,
        "--effort",
        run_config.orca.effort,
        "--worktree",
        run_config.orca.worktree_selector,
        "--timeout-ms",
        deadline,
        "--json",
    ]
    wait = [
        "orca",
        "orchestration",
        "check",
        "--wait",
        "--types",
        ",".join(SETTLING_TYPES),
        "--timeout-ms",
        deadline,
        "--json",
    ]
    if orca_run_id:
        start.extend(["--run", orca_run_id])
        wait.extend(["--run", orca_run_id])
    created = [
        "orca",
        "orchestration",
        "run-create",
        "--objective",
        run_config.orca.run_objective,
        "--json",
    ]
    # Every orchestration command names the terminal the runtime knows it by;
    # without one Orca refuses with no_active_sender_terminal. The wait takes it
    # as `--terminal`, not `--from`, and rejects `--from` outright.
    if coordinator_handle:
        for command in (created, start):
            command.extend(["--from", coordinator_handle])
        wait.extend(["--terminal", coordinator_handle])
    return LaunchPlan(
        prompt_path=prompt_path,
        spec=spec,
        run_create_argv=tuple(created),
        worker_start_argv=tuple(start),
        wait_argv=tuple(wait),
    )


def _first_document(text: str) -> dict[str, Any]:
    for candidate in (text, *text.splitlines()):
        stripped = candidate.strip()
        if not stripped.startswith("{"):
            continue
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return {}


def _result(document: Mapping[str, Any]) -> Mapping[str, Any]:
    result = document.get("result")
    return result if isinstance(result, Mapping) else {}


def run_identifier(document: Mapping[str, Any]) -> str | None:
    """Return the Run identifier from a run-create or worker-start reply.

    The reply's top-level `id` is the identifier of the *request*, not of the
    Run. Passing it as `--run` makes the next command fail with
    `consumer_fenced`, because no Run by that name is bound to the terminal.
    """
    result = _result(document)
    run = result.get("run")
    if isinstance(run, Mapping) and isinstance(run.get("id"), str):
        return run["id"]
    value = result.get("runId")
    return value if isinstance(value, str) and value else None


def dispatch_identifier(document: Mapping[str, Any]) -> str | None:
    """Return the Dispatch identifier from a worker-start reply."""
    value = _result(document).get("dispatchId")
    return value if isinstance(value, str) and value else None


def dispatch_state(document: Mapping[str, Any]) -> str | None:
    """Return what the plane said the dispatch reached, if it said anything."""
    value = _result(document).get("state")
    return value if isinstance(value, str) and value else None


def orca_error(document: Mapping[str, Any]) -> str | None:
    """Return the code and message of an Orca reply's error, if it carries one.

    The reply is a document with a structured error at a known place. Showing
    the tail of the raw text instead loses the code, which sits near the start
    and is the one part worth reading.
    """
    error = document.get("error")
    if not isinstance(error, Mapping):
        return None
    code = error.get("code")
    message = error.get("message")
    if code and message and code != message:
        return f"{code}: {message}"
    return str(code or message) if (code or message) else None


def _explain(outcome, secrets) -> str:
    """Describe a failed orca command by its error, falling back to its output."""
    described = orca_error(_first_document(outcome.stdout))
    if described:
        return redact.text(described, secrets)
    text = (outcome.stderr or outcome.stdout).strip()[-400:]
    return redact.text(f"exit={outcome.exit_code}: {text}", secrets)


def task_identifier(document: Mapping[str, Any]) -> str | None:
    """Return the Task identifier from a worker-start reply."""
    value = _result(document).get("taskId")
    return value if isinstance(value, str) and value else None


def _settling_message(document: Mapping[str, Any]) -> dict[str, Any]:
    """Return the message that settled the wait, from the plane's own reply.

    The delivery is a field of the reply's `result`; the reply's top level is
    the request envelope. Reading the envelope finds no messages and reports a
    worker that finished as one that never answered.
    """
    messages = _result(document).get("messages")
    if isinstance(messages, list):
        for message in messages:
            if isinstance(message, Mapping) and message.get("type") in SETTLING_TYPES:
                return dict(message)
    return {}


def launch(
    *,
    run_config: RunConfig,
    adapter: BackendAdapter,
    handle: EnvironmentHandle,
    timeout_seconds: int,
    env_overlay: Mapping[str, str] | None = None,
    coordinator_handle: str | None = None,
    keep: Callable[[str, str, str], None] | None = None,
) -> WorkerRecord:
    """Run exactly one worker and report how it settled.

    `keep` is offered each orchestration reply under a name, redacted. The
    reply is what decides the run, and a run that reports only its verdict
    leaves the next reader nothing to check the verdict against.
    """
    record = WorkerRecord(
        agent=run_config.orca.agent,
        model=run_config.orca.model,
        effort=run_config.orca.effort,
    )
    overlay = dict(env_overlay or {})
    secrets: Sequence[str] = tuple(value for value in overlay.values() if value)

    def remember(name: str, outcome) -> None:
        if keep is not None:
            keep(
                name,
                redact.text(outcome.stdout or "", secrets),
                redact.text(outcome.stderr or "", secrets),
            )

    plan = build_plan(
        run_config=run_config,
        handle=handle,
        timeout_seconds=timeout_seconds,
        orca_run_id=None,
        coordinator_handle=coordinator_handle,
    )

    created = adapter.execute(
        plan.run_create_argv, timeout=timeout_seconds, env=overlay, extra_values=secrets
    )
    record.commands.append(created.to_record())
    remember("run-create", created)
    if created.timed_out:
        record.status = PhaseStatus.TIMEOUT
        record.detail = "orca orchestration run-create reached the run deadline"
        return record
    if not created.ok:
        record.status = PhaseStatus.FAILED
        record.detail = (
            "orca orchestration run-create did not return a Run: "
            + _explain(created, secrets)
        )
        return record
    record.run_id = run_identifier(_first_document(created.stdout))

    plan = build_plan(
        run_config=run_config,
        handle=handle,
        timeout_seconds=timeout_seconds,
        orca_run_id=record.run_id,
        coordinator_handle=coordinator_handle,
    )
    adapter.write_file(plan.prompt_path, build_prompt(run_config, handle), mode=0o644)

    started = adapter.execute(
        plan.worker_start_argv,
        timeout=timeout_seconds,
        env=overlay,
        extra_values=secrets,
    )
    record.commands.append(started.to_record())
    remember("worker-start", started)
    if started.timed_out:
        record.status = PhaseStatus.TIMEOUT
        record.detail = "orca orchestration worker-start reached the run deadline"
        return record
    start_document = _first_document(started.stdout)
    record.dispatch_id = dispatch_identifier(start_document)
    record.run_id = record.run_id or run_identifier(start_document)
    state = dispatch_state(start_document)
    record.outcome = state
    if not started.ok:
        # An unobserved turn start is not a dead worker: the plane says so
        # itself. The dispatch exists and may still settle, so the completion
        # wait runs. Only a start that produced no dispatch is terminal.
        if state in UNVERIFIABLE_STATES and record.dispatch_id:
            record.detail = (
                f"worker-start reported {state}; the dispatch exists, so the "
                "completion wait decides"
            )
        else:
            record.status = PhaseStatus.FAILED
            record.detail = (
                f"orca orchestration worker-start reported {state or 'no state'}: "
                + _explain(started, secrets)
            )
            return record
    elif state:
        record.detail = f"the plane reported the dispatch as {state}"

    settled = adapter.execute(
        plan.wait_argv, timeout=timeout_seconds, env=overlay, extra_values=secrets
    )
    record.commands.append(settled.to_record())
    remember("completion-wait", settled)
    if settled.timed_out:
        record.status = PhaseStatus.TIMEOUT
        record.detail = "the completion wait reached the run deadline before the worker settled"
        return record
    if not settled.ok:
        record.status = PhaseStatus.FAILED
        record.detail = "the completion wait failed: " + _explain(settled, secrets)
        return record

    message = _settling_message(_first_document(settled.stdout))
    record.outcome = message.get("outcome") or message.get("type") or record.outcome
    if message.get("type") == "worker_done":
        record.status = PhaseStatus.OK
        record.detail = f"the worker reported worker_done with outcome {record.outcome!r}"
    elif message:
        record.status = PhaseStatus.FAILED
        record.detail = (
            f"the wait settled on {message.get('type')!r} rather than worker_done"
        )
    else:
        record.status = PhaseStatus.FAILED
        record.detail = "the wait returned no settling message for this dispatch"
    return record
