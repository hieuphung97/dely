"""The single Claude Code worker is launched through Orca, inside the environment."""

import json
import tempfile
import unittest
from pathlib import Path

from cycle_runner import config as config_module, status, worker
from tests.fakes import ScriptedAdapter
from tests.test_config import minimal_document

# These are the shapes a live runtime returns. The identifiers are nested under
# `result`; the top-level `id` belongs to the request, not to the Run.
READY = json.dumps(
    {
        "id": "request-abcdef",
        "ok": True,
        "result": {"run": {"id": "run-abcdef", "objective": "dely minimal cycle"}},
    }
)
STARTED = json.dumps(
    {
        "id": "request-123456",
        "ok": True,
        "result": {
            "runId": "run-abcdef",
            "taskId": "task-abcdef",
            "dispatchId": "dispatch-abcdef",
            "state": "ready",
        },
    }
)
# The shape `orca orchestration check` really answers with: the messages are
# a field of the result, and the reply's top level is the request envelope.
def delivery(*messages):
    """Return a check reply carrying these messages, as the plane sends it."""
    return json.dumps(
        {
            "id": "e0a1e4d0-0000-4000-8000-000000000000",
            "ok": True,
            "result": {"messages": list(messages), "count": len(messages)},
        }
    )


SETTLED = delivery({"type": "worker_done", "outcome": "DONE"})

DEFAULT_SCRIPT = [
    ("run-create", 0, READY, "", False),
    ("worker-start", 0, STARTED, "", False),
    ("check --wait", 0, SETTLED, "", False),
]


class WorkerTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.config = config_module.from_document(minimal_document())
        self.addCleanup(self._tmp.cleanup)

    def launch(self, script=None, **options):
        adapter = ScriptedAdapter(self.root / "run", script=script or DEFAULT_SCRIPT, **options)
        handle = adapter.create()
        record = worker.launch(
            run_config=self.config,
            adapter=adapter,
            handle=handle,
            timeout_seconds=self.config.timeout_seconds,
            env_overlay={},
        )
        return adapter, handle, record

    def test_the_launch_names_the_agent_model_and_effort(self):
        adapter, _, record = self.launch()
        start = next(argv for argv in adapter.executed if "worker-start" in argv)
        self.assertIn("--agent", start)
        self.assertIn("claude", start)
        self.assertIn("--model", start)
        self.assertIn("pinned-model", start)
        self.assertIn("--effort", start)
        self.assertIn("high", start)
        self.assertEqual(record.model, "pinned-model")
        self.assertEqual(record.effort, "high")

    def test_the_prompt_is_a_file_and_the_spec_only_points_at_it(self):
        adapter, handle, _ = self.launch()
        self.assertEqual(len(adapter.written), 1)
        path, content, _mode = adapter.written[0]
        self.assertTrue(path.startswith(handle.home_path))
        self.assertIn("dely-cycle-marker", content)
        start = next(argv for argv in adapter.executed if "worker-start" in argv)
        spec = start[start.index("--spec") + 1]
        self.assertIn(path, spec)
        self.assertNotIn("dely-cycle-marker", spec)

    def test_the_spec_stays_a_single_plain_line(self):
        adapter, _, _ = self.launch()
        start = next(argv for argv in adapter.executed if "worker-start" in argv)
        spec = start[start.index("--spec") + 1]
        self.assertNotIn("\n", spec)
        self.assertNotIn("`", spec)

    def test_the_prompt_names_the_marker_and_the_relative_path(self):
        adapter, _, _ = self.launch()
        _path, content, _mode = adapter.written[0]
        self.assertIn("evidence.txt", content)
        self.assertIn("dely-cycle-marker", content)

    def test_the_wait_asks_for_the_settling_types_with_a_millisecond_deadline(self):
        adapter, _, _ = self.launch()
        wait = next(argv for argv in adapter.executed if "--wait" in argv)
        self.assertIn("--types", wait)
        types = wait[wait.index("--types") + 1]
        self.assertEqual(sorted(types.split(",")), ["escalation", "question", "worker_done"])
        self.assertEqual(wait[wait.index("--timeout-ms") + 1], "900000")

    def test_a_settled_worker_is_recorded_with_its_identifiers(self):
        _, _, record = self.launch()
        self.assertEqual(record.status, status.PhaseStatus.OK)
        self.assertEqual(record.run_id, "run-abcdef")
        self.assertEqual(record.dispatch_id, "dispatch-abcdef")
        self.assertEqual(record.outcome, "DONE")

    def test_a_failed_launch_is_not_reported_as_done(self):
        script = [
            ("run-create", 0, READY, "", False),
            ("worker-start", 1, "", "the runtime refused the launch", False),
        ]
        _, _, record = self.launch(script=script)
        self.assertEqual(record.status, status.PhaseStatus.FAILED)
        self.assertIn("worker-start", record.detail)

    def test_a_failed_run_create_stops_before_the_launch(self):
        script = [("run-create", 1, "", "no runtime", False)]
        adapter, _, record = self.launch(script=script)
        self.assertEqual(record.status, status.PhaseStatus.FAILED)
        self.assertFalse(any("worker-start" in argv for argv in adapter.executed))

    def test_a_wait_that_reaches_the_deadline_is_a_timeout(self):
        script = [
            ("run-create", 0, READY, "", False),
            ("worker-start", 0, STARTED, "", False),
            ("check --wait", None, "", "deadline", True),
        ]
        _, _, record = self.launch(script=script)
        self.assertEqual(record.status, status.PhaseStatus.TIMEOUT)

    def test_an_escalation_settles_the_wait_without_claiming_success(self):
        script = [
            ("run-create", 0, READY, "", False),
            ("worker-start", 0, STARTED, "", False),
            (
                "check --wait",
                0,
                delivery({"type": "escalation", "outcome": "BLOCKED"}),
                "",
                False,
            ),
        ]
        _, _, record = self.launch(script=script)
        self.assertEqual(record.status, status.PhaseStatus.FAILED)
        self.assertEqual(record.outcome, "BLOCKED")

    def test_every_command_the_worker_ran_is_recorded(self):
        _, _, record = self.launch()
        contexts = {command.context for command in record.commands}
        self.assertEqual(contexts, {"environment"})
        self.assertGreaterEqual(len(record.commands), 3)

    def test_no_secret_reaches_the_worker_record(self):
        secret = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"
        script = [
            ("run-create", 0, READY, "", False),
            ("worker-start", 0, STARTED, f"key {secret}", False),
            ("check --wait", 0, SETTLED, "", False),
        ]
        _, _, record = self.launch(script=script)
        self.assertNotIn(secret, json.dumps(record.to_document()))

    def test_a_run_create_that_reaches_the_deadline_is_a_timeout(self):
        script = [("run-create", None, "", "deadline", True)]
        _, _, record = self.launch(script=script)
        self.assertEqual(record.status, status.PhaseStatus.TIMEOUT)
        self.assertIn("deadline", record.detail)


class CoordinatorTerminalTest(WorkerTest):
    """Orca refuses an orchestration command with no sender terminal.

    Observed inside a real guest: run-create returned
    no_active_sender_terminal until it was given --from.
    """

    def launch_from(self, handle):
        from tests.fakes import ScriptedAdapter

        adapter = ScriptedAdapter(self.root / "run", script=DEFAULT_SCRIPT)
        environment = adapter.create()
        record = worker.launch(
            run_config=self.config,
            adapter=adapter,
            handle=environment,
            timeout_seconds=self.config.timeout_seconds,
            env_overlay={},
            coordinator_handle=handle,
        )
        return adapter, record

    def test_every_orchestration_command_names_the_sender_terminal(self):
        adapter, _ = self.launch_from("term_abcdef")
        orchestration = [argv for argv in adapter.executed if "orchestration" in argv]
        self.assertEqual(len(orchestration), 3)
        for argv in orchestration:
            # The wait takes the terminal by a different flag; both are the
            # same handle, and neither command may go without one.
            flag = "--terminal" if "--wait" in argv else "--from"
            self.assertIn(flag, argv)
            self.assertEqual(argv[argv.index(flag) + 1], "term_abcdef")

    def test_without_a_terminal_the_flag_is_not_invented(self):
        adapter, _ = self.launch_from(None)
        for argv in adapter.executed:
            self.assertNotIn("--from", argv)


#: The shapes Orca actually returns, copied from a live guest. The earlier
#: fixtures put the identifiers at the top level; the real ones are nested, and
#: the top-level `id` is the request identifier, not the Run.
REAL_RUN_CREATE = json.dumps(
    {
        "id": "f1a0c3be-5f9d-4e21-81d1-dffcb6c647a8",
        "ok": True,
        "result": {
            "run": {
                "id": "run_a52fcdd366b4",
                "objective": "dely minimal cycle",
                "coordinator_handle": "term_50c4a5b6",
            }
        },
    }
)

REAL_WORKER_START = json.dumps(
    {
        "id": "7056aa38-852c-4d6d-8287-443521841556",
        "ok": True,
        "result": {
            "runId": "run_a52fcdd366b4",
            "taskId": "task_0e636c920592",
            "dispatchId": "ctx_098ec148783c",
            "state": "outcome_unknown",
            "stage": "turn_start_unobserved",
            "launch": {
                "requested": {"agent": "claude", "model": "m", "effort": "high"},
                "effective": {"agent": "claude", "model": "m", "effort": "high"},
            },
        },
    }
)


class RealResponseShapeTest(WorkerTest):
    """Observed against a live runtime: the identifiers are nested."""

    def test_the_run_identifier_comes_from_the_nested_run(self):
        self.assertEqual(worker.run_identifier(json.loads(REAL_RUN_CREATE)), "run_a52fcdd366b4")

    def test_the_request_identifier_is_never_mistaken_for_the_run(self):
        self.assertNotEqual(
            worker.run_identifier(json.loads(REAL_RUN_CREATE)),
            "f1a0c3be-5f9d-4e21-81d1-dffcb6c647a8",
        )

    def test_the_dispatch_identifier_comes_from_the_result(self):
        self.assertEqual(
            worker.dispatch_identifier(json.loads(REAL_WORKER_START)), "ctx_098ec148783c"
        )

    def test_the_task_and_state_are_carried_too(self):
        parsed = json.loads(REAL_WORKER_START)
        self.assertEqual(worker.dispatch_state(parsed), "outcome_unknown")

    def test_a_launch_against_the_real_shapes_uses_the_run_identifier(self):
        script = [
            ("run-create", 0, REAL_RUN_CREATE, "", False),
            ("worker-start", 0, REAL_WORKER_START, "", False),
            ("check --wait", 0, SETTLED, "", False),
        ]
        adapter, _, record = self.launch(script=script)
        start = next(argv for argv in adapter.executed if "worker-start" in argv)
        self.assertIn("--run", start)
        self.assertEqual(start[start.index("--run") + 1], "run_a52fcdd366b4")
        self.assertEqual(record.run_id, "run_a52fcdd366b4")
        self.assertEqual(record.dispatch_id, "ctx_098ec148783c")


UNVERIFIED_START = json.dumps(
    {
        "id": "request-999",
        "ok": False,
        "result": {
            "runId": "run-abcdef",
            "taskId": "task-abcdef",
            "dispatchId": "dispatch-abcdef",
            "state": "outcome_unknown",
            "stage": "turn_start_unobserved",
        },
    }
)


class UnverifiedStartTest(WorkerTest):
    """A start the plane could not observe is not a start that failed.

    Observed against a live runtime: worker-start exits non-zero with
    `outcome_unknown` when the agent's turn does not begin inside the
    observation window. The dispatch exists and may still settle, so the
    completion wait has to run.
    """

    def script(self, settled):
        return [
            ("run-create", 0, READY, "", False),
            ("worker-start", 1, UNVERIFIED_START, "", False),
            ("check --wait", 0, settled, "", False),
        ]

    def test_the_completion_wait_still_runs(self):
        adapter, _, _ = self.launch(script=self.script(SETTLED))
        self.assertTrue(any("--wait" in argv for argv in adapter.executed))

    def test_a_dispatch_that_settles_afterwards_is_done(self):
        _, _, record = self.launch(script=self.script(SETTLED))
        self.assertEqual(record.status, status.PhaseStatus.OK)
        self.assertEqual(record.outcome, "DONE")
        self.assertEqual(record.dispatch_id, "dispatch-abcdef")

    def test_a_dispatch_that_never_settles_keeps_the_unverifiable_state(self):
        _, _, record = self.launch(script=self.script(delivery()))
        self.assertEqual(record.outcome, "outcome_unknown")
        self.assertNotEqual(record.status, status.PhaseStatus.OK)

    def test_a_start_with_no_dispatch_is_still_a_failure(self):
        script = [
            ("run-create", 0, READY, "", False),
            ("worker-start", 1, json.dumps({"ok": False, "error": {"code": "refused"}}), "", False),
        ]
        adapter, _, record = self.launch(script=script)
        self.assertEqual(record.status, status.PhaseStatus.FAILED)
        self.assertFalse(any("--wait" in argv for argv in adapter.executed))


class SenderFlagShapeTest(WorkerTest):
    """The three commands do not take the sender the same way.

    Observed against a live runtime: `orchestration check` rejected `--from`
    with `Unknown flag --from for command: orchestration check`. It names the
    terminal with `--terminal`; run-create and worker-start use `--from`.
    """

    def plan(self):
        from cycle_runner.adapters.base import EnvironmentHandle

        handle = EnvironmentHandle(
            environment_id="e", home_path="/home/cycle", project_path="/home/cycle/project"
        )
        return worker.build_plan(
            run_config=self.config,
            handle=handle,
            timeout_seconds=900,
            orca_run_id="run-abcdef",
            coordinator_handle="term_abcdef",
        )

    def test_run_create_names_the_sender_with_from(self):
        argv = self.plan().run_create_argv
        self.assertIn("--from", argv)
        self.assertEqual(argv[argv.index("--from") + 1], "term_abcdef")

    def test_worker_start_names_the_sender_with_from(self):
        argv = self.plan().worker_start_argv
        self.assertIn("--from", argv)
        self.assertEqual(argv[argv.index("--from") + 1], "term_abcdef")

    def test_the_wait_names_the_terminal_and_never_uses_from(self):
        argv = self.plan().wait_argv
        self.assertNotIn("--from", argv)
        self.assertIn("--terminal", argv)
        self.assertEqual(argv[argv.index("--terminal") + 1], "term_abcdef")

    def test_the_wait_still_carries_the_run_and_the_settling_types(self):
        argv = self.plan().wait_argv
        self.assertEqual(argv[argv.index("--run") + 1], "run-abcdef")
        self.assertIn("--types", argv)


class ErrorReportingTest(WorkerTest):
    """Orca replies carry a structured error; the tail of raw JSON is not it."""

    def test_the_code_and_message_are_reported(self):
        reply = json.dumps({
            "id": "req", "ok": False,
            "error": {"code": "consumer_fenced", "message": "the Run is bound elsewhere",
                      "data": {"originalCommand": ["orca", "orchestration", "run-create"]}},
        })
        self.assertEqual(
            worker.orca_error(json.loads(reply)),
            "consumer_fenced: the Run is bound elsewhere",
        )

    def test_a_reply_without_an_error_reports_nothing(self):
        self.assertIsNone(worker.orca_error({"ok": True, "result": {}}))

    def test_a_failed_run_create_names_the_code(self):
        reply = json.dumps({
            "ok": False,
            "error": {"code": "selector_not_found", "message": "no such worktree"},
        })
        script = [("run-create", 1, reply, "", False)]
        _, _, record = self.launch(script=script)
        self.assertIn("selector_not_found", record.detail)
        self.assertIn("no such worktree", record.detail)
        # The point is that it reads as a sentence, not as a slice of a
        # document: the raw reply also contains the code, further in.
        self.assertNotIn("{", record.detail)
        self.assertLess(len(record.detail), 160, record.detail)

    def test_a_failed_start_names_the_code(self):
        reply = json.dumps({
            "ok": False,
            "error": {"code": "consumer_fenced", "message": "bound elsewhere"},
            "result": {"state": "failed"},
        })
        script = [("run-create", 0, READY, "", False), ("worker-start", 1, reply, "", False)]
        _, _, record = self.launch(script=script)
        self.assertIn("consumer_fenced", record.detail)
        self.assertNotIn("{", record.detail)


class KeptRepliesTest(WorkerTest):
    """The reply that decided the run is the one worth keeping."""

    def launch_keeping(self, **overrides):
        kept = {}
        adapter = ScriptedAdapter(self.root / "run", script=DEFAULT_SCRIPT)
        handle = adapter.create()
        worker.launch(
            run_config=self.config,
            adapter=adapter,
            handle=handle,
            timeout_seconds=self.config.timeout_seconds,
            keep=lambda name, stdout, stderr: kept.__setitem__(name, stdout + stderr),
            **overrides,
        )
        return kept

    def test_every_orchestration_reply_is_offered_for_export(self):
        kept = self.launch_keeping(env_overlay={})
        self.assertEqual(
            sorted(kept), ["completion-wait", "run-create", "worker-start"]
        )
        self.assertIn("worker_done", kept["completion-wait"])

    def test_a_kept_reply_carries_no_value_the_overlay_passed(self):
        kept = self.launch_keeping(
            env_overlay={"CLAUDE_CODE_OAUTH_TOKEN": "sk-ant-secret-value-here"}
        )
        for name, text in kept.items():
            self.assertNotIn("sk-ant-secret-value-here", text, name)
