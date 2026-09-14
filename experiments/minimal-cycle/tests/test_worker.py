"""The single Claude Code worker is launched through Orca, inside the environment."""

import json
import tempfile
import unittest
from pathlib import Path

from cycle_runner import config as config_module, status, worker
from tests.fakes import ScriptedAdapter
from tests.test_config import minimal_document

READY = json.dumps({"runId": "run-abcdef"})
STARTED = json.dumps({"dispatchId": "dispatch-abcdef", "status": "ready"})
SETTLED = json.dumps({"messages": [{"type": "worker_done", "outcome": "DONE"}]})

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
                json.dumps({"messages": [{"type": "escalation", "outcome": "BLOCKED"}]}),
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
