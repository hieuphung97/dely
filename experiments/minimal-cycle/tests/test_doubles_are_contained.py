"""The test doubles must not run anything on the machine running the tests.

A fake environment here is a directory on a developer's own machine, so a
command the fake does not recognise runs *there*. When the runner gained a step
that starts the Orca desktop application, every lifecycle test launched a real
one on the host desktop — dozens of windows, and a reboot to clear them. These
tests exist so that cannot happen again.
"""

import tempfile
import unittest
from pathlib import Path

from tests.fakes import RUNNABLE_PROGRAMS, RUNNABLE_SHELL_SCRIPTS, FakeAdapter
from tests.test_adapter_distrobox import PASSTHROUGH_PROGRAMS, StubRunner


class FakeAdapterContainmentTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.adapter = FakeAdapter(Path(self._tmp.name) / "run")
        self.adapter.create()
        self.addCleanup(self._tmp.cleanup)

    def test_the_application_start_is_simulated_not_executed(self):
        from cycle_runner import orca

        log = Path.home() / "orca-app.log"
        existed = log.exists()
        outcome = self.adapter.execute(
            orca.start_argv(("/opt/Orca/orca-ide",), ":0"), timeout=5
        )
        self.assertIn("orca-start", self.adapter.calls)
        self.assertIn("started 1786", outcome.stdout)
        self.assertTrue(self.adapter.app_started)
        # The real script would write this beside the home directory it ran in.
        self.assertEqual(log.exists(), existed)

    def test_the_allowlist_would_refuse_the_start_if_it_ever_reached_execution(self):
        from cycle_runner import orca

        refusal = self.adapter._refuse(orca.start_argv(("/opt/Orca/orca-ide",), ":0"))
        self.assertIsNotNone(refusal)
        self.assertEqual(refusal.exit_code, 127)
        self.assertIn("orca-start", refusal.stderr)

    def test_an_arbitrary_program_is_refused(self):
        outcome = self.adapter.execute(["/usr/bin/firefox"], timeout=5)
        self.assertEqual(outcome.exit_code, 127)
        self.assertIn("firefox", outcome.stderr)

    def test_an_unnamed_shell_script_is_refused(self):
        outcome = self.adapter.execute(
            ["sh", "-c", "touch /tmp/should-not-exist", "whatever"], timeout=5
        )
        self.assertEqual(outcome.exit_code, 127)
        self.assertFalse(Path("/tmp/should-not-exist").exists())

    def test_removing_outside_the_fake_root_is_refused(self):
        outcome = self.adapter.execute(["rm", "-f", "/etc/hosts"], timeout=5)
        self.assertNotEqual(outcome.exit_code, 0)
        self.assertIn("refusing to remove", outcome.stderr)
        self.assertTrue(Path("/etc/hosts").exists())

    def test_the_runner_own_scripts_still_run(self):
        target = self.adapter.project / "evidence.txt"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("dely-cycle-marker", encoding="utf-8")
        from cycle_runner.lifecycle import check_argv

        outcome = self.adapter.execute(
            check_argv(str(self.adapter.project), "evidence.txt", "dely-cycle-marker"),
            timeout=10,
        )
        self.assertEqual(outcome.exit_code, 0)

    def test_the_allowlists_stay_small_and_name_nothing_graphical(self):
        # A ceiling, so the list cannot grow quietly. Raising it is a decision
        # a reader sees; `git` was added for the repository the copy has to be.
        self.assertLessEqual(len(RUNNABLE_PROGRAMS), 9)
        self.assertNotIn("orca", RUNNABLE_PROGRAMS)
        self.assertNotIn("nohup", RUNNABLE_PROGRAMS)
        self.assertNotIn("orca-start", RUNNABLE_SHELL_SCRIPTS)

    def test_git_is_only_allowed_inside_the_fake_root(self):
        outside = self.adapter._refuse(["git", "-C", "/etc", "init"])
        self.assertIsNotNone(outside)
        self.assertEqual(outside.exit_code, 127)
        inside = self.adapter._refuse(
            ["git", "-C", str(self.adapter.project), "init"]
        )
        self.assertIsNone(inside)

    def test_git_in_any_other_form_is_refused(self):
        refusal = self.adapter._refuse(["git", "clone", "https://example.invalid/x"])
        self.assertIsNotNone(refusal)
        self.assertEqual(refusal.exit_code, 127)


class StubRunnerContainmentTest(unittest.TestCase):
    def test_passthrough_is_only_for_key_generation(self):
        self.assertEqual(PASSTHROUGH_PROGRAMS, frozenset({"ssh-keygen"}))

    def test_an_unlisted_program_is_answered_not_run(self):
        runner = StubRunner(passthrough=True)
        outcome = runner(
            ["sh", "-c", "touch /tmp/stub-should-not-exist"],
            timeout=5,
            context="host",
        )
        self.assertEqual(outcome.exit_code, 0)
        self.assertFalse(Path("/tmp/stub-should-not-exist").exists())
