"""Commands are captured with their timings, their deadline and their context."""

import sys
import unittest

from cycle_runner import proc


class RunTest(unittest.TestCase):
    def test_output_and_exit_code_are_captured(self):
        outcome = proc.run(
            ["sh", "-c", "echo out; echo err >&2; exit 3"],
            timeout=10,
            context="host",
        )
        self.assertEqual(outcome.exit_code, 3)
        self.assertIn("out", outcome.stdout)
        self.assertIn("err", outcome.stderr)
        self.assertFalse(outcome.timed_out)

    def test_the_command_records_its_argv_and_context(self):
        outcome = proc.run(["true"], timeout=10, context="environment")
        self.assertEqual(outcome.argv, ("true",))
        self.assertEqual(outcome.context, "environment")

    def test_timings_are_recorded_and_ordered(self):
        outcome = proc.run(["true"], timeout=10, context="host")
        self.assertLessEqual(outcome.started_at, outcome.finished_at)
        self.assertGreaterEqual(outcome.elapsed_seconds, 0.0)

    def test_a_deadline_marks_the_command_rather_than_raising(self):
        outcome = proc.run(
            [sys.executable, "-c", "import time; time.sleep(30)"],
            timeout=0.4,
            context="host",
        )
        self.assertTrue(outcome.timed_out)
        self.assertIsNone(outcome.exit_code)
        self.assertLess(outcome.elapsed_seconds, 20)

    def test_a_deadline_leaves_no_child_behind(self):
        outcome = proc.run(
            [
                sys.executable,
                "-c",
                "import subprocess, sys, time;"
                "subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)']);"
                "time.sleep(30)",
            ],
            timeout=0.6,
            context="host",
        )
        self.assertTrue(outcome.timed_out)
        self.assertTrue(outcome.killed_process_group)

    def test_output_is_redacted_before_it_is_kept(self):
        secret = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"
        outcome = proc.run(
            ["sh", "-c", f"echo {secret}"], timeout=10, context="host"
        )
        self.assertNotIn(secret, outcome.stdout)

    def test_a_missing_executable_is_reported_rather_than_raised(self):
        outcome = proc.run(
            ["this-command-does-not-exist-anywhere"], timeout=10, context="host"
        )
        self.assertIsNone(outcome.exit_code)
        self.assertFalse(outcome.timed_out)
        self.assertIn("this-command-does-not-exist-anywhere", outcome.stderr)
        self.assertTrue(outcome.launch_failed)

    def test_the_outcome_converts_to_a_command_record(self):
        record = proc.run(["true"], timeout=10, context="host").to_record()
        document = record.to_document()
        self.assertEqual(document["argv"], ["true"])
        self.assertEqual(document["context"], "host")

    def test_extra_values_are_redacted_too(self):
        outcome = proc.run(
            ["sh", "-c", "echo plainvalue"],
            timeout=10,
            context="host",
            extra_values=["plainvalue"],
        )
        self.assertNotIn("plainvalue", outcome.stdout)

    def test_an_environment_overlay_reaches_the_child(self):
        outcome = proc.run(
            ["sh", "-c", "echo $CYCLE_PROBE"],
            timeout=10,
            context="host",
            env={"CYCLE_PROBE": "visible"},
        )
        self.assertIn("visible", outcome.stdout)

    def test_the_command_succeeded_helper_reads_the_exit_code(self):
        self.assertTrue(proc.run(["true"], timeout=10, context="host").ok)
        self.assertFalse(proc.run(["false"], timeout=10, context="host").ok)
