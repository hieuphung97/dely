"""Orca's own session: a ready runtime and a coordinator terminal to send from."""

import json
import unittest

from cycle_runner import orca, status
from tests.test_adapter_distrobox import StubRunner

READY = json.dumps(
    {
        "ok": True,
        "result": {
            "app": {"running": True, "pid": 1786, "desktopWindowStatus": "available"},
            "runtime": {
                "state": "ready",
                "reachable": True,
                "connectionState": "connected",
                "runtimeId": "9386612e-bf79-44a0-9232-173c653dcba8",
                "appVersion": "1.4.201",
                "capabilities": ["orchestration.contract.v1"],
            },
        },
    }
)

NOT_RUNNING = json.dumps(
    {
        "ok": True,
        "result": {
            "app": {"running": False, "pid": None},
            "runtime": {"state": "unavailable", "reachable": False},
        },
    }
)

TERMINAL = json.dumps(
    {
        "ok": True,
        "result": {
            "terminal": {
                "handle": "term_50c4a5b6-5060-4cab-ba85-609b60a69f45",
                "worktreeId": "repo::/home/cycle/project",
                "surface": "visible",
            }
        },
    }
)


class Environment:
    """A stand-in environment that answers orca commands from a table."""

    def __init__(self, table):
        self.runner = StubRunner(table)
        self.seen = self.runner.seen

    def execute(self, argv, *, timeout, cwd=None, env=None, extra_values=()):
        return self.runner(
            argv, timeout=timeout, context="environment", cwd=cwd, env=env,
            extra_values=extra_values,
        )


class RuntimeStatusTest(unittest.TestCase):
    def test_a_ready_runtime_is_recognised(self):
        report = orca.read_status(Environment([("status", 0, READY, "")]), ("orca", "status", "--json"), timeout=5)
        self.assertTrue(report.ready)
        self.assertTrue(report.app_running)
        self.assertEqual(report.runtime_id, "9386612e-bf79-44a0-9232-173c653dcba8")
        self.assertEqual(report.app_version, "1.4.201")

    def test_an_app_that_is_not_running_is_not_ready(self):
        report = orca.read_status(Environment([("status", 0, NOT_RUNNING, "")]), ("orca", "status", "--json"), timeout=5)
        self.assertFalse(report.ready)
        self.assertFalse(report.app_running)
        self.assertIsNone(report.runtime_id)

    def test_output_that_is_not_readable_is_not_ready(self):
        report = orca.read_status(Environment([("status", 0, "not json", "")]), ("orca", "status", "--json"), timeout=5)
        self.assertFalse(report.ready)
        self.assertIn("could not", report.detail.lower())

    def test_a_failing_command_is_not_ready(self):
        report = orca.read_status(Environment([("status", 1, "", "no runtime")]), ("orca", "status", "--json"), timeout=5)
        self.assertFalse(report.ready)

    def test_the_orchestration_capability_is_reported(self):
        report = orca.read_status(Environment([("status", 0, READY, "")]), ("orca", "status", "--json"), timeout=5)
        self.assertIn("orchestration.contract.v1", report.capabilities)


class WaitForRuntimeTest(unittest.TestCase):
    class Waking:
        """Reports the app down for a few polls, then ready."""

        def __init__(self, downs):
            self.downs = downs
            self.polls = 0

        def execute(self, argv, *, timeout, cwd=None, env=None, extra_values=()):
            from cycle_runner import proc

            self.polls += 1
            payload = NOT_RUNNING if self.polls <= self.downs else READY
            return proc.CommandOutcome(
                argv=tuple(argv), exit_code=0, stdout=payload, stderr="",
                started_at="2026-09-15T11:00:00Z", finished_at="2026-09-15T11:00:00Z",
                elapsed_seconds=0.1, timed_out=False, context="environment",
            )

    def test_a_runtime_that_becomes_ready_is_waited_for(self):
        environment = self.Waking(3)
        report = orca.wait_for_runtime(
            environment, ("orca", "status", "--json"), timeout=60, sleeper=lambda _s: None
        )
        self.assertTrue(report.ready)
        self.assertGreaterEqual(environment.polls, 4)

    def test_a_runtime_that_never_starts_is_reported_not_guessed(self):
        report = orca.wait_for_runtime(
            self.Waking(10_000), ("orca", "status", "--json"), timeout=0, sleeper=lambda _s: None
        )
        self.assertFalse(report.ready)


class CoordinatorTerminalTest(unittest.TestCase):
    def test_the_repo_is_registered_and_a_terminal_is_created(self):
        environment = Environment(
            [("repo add", 0, '{"ok": true}', ""), ("terminal create", 0, TERMINAL, "")]
        )
        handle = orca.open_coordinator_terminal(environment, "/home/cycle/project", timeout=5)
        self.assertEqual(handle, "term_50c4a5b6-5060-4cab-ba85-609b60a69f45")
        joined = [" ".join(argv) for argv in environment.seen]
        self.assertTrue(any("repo add" in line for line in joined))
        self.assertTrue(any("terminal create" in line for line in joined))

    def test_the_terminal_is_bound_to_the_project_copy(self):
        environment = Environment(
            [("repo add", 0, '{"ok": true}', ""), ("terminal create", 0, TERMINAL, "")]
        )
        orca.open_coordinator_terminal(environment, "/home/cycle/project", timeout=5)
        create = next(argv for argv in environment.seen if "create" in argv)
        self.assertIn("path:/home/cycle/project", create)

    def test_a_terminal_that_is_not_created_is_reported(self):
        environment = Environment(
            [("repo add", 0, '{"ok": true}', ""), ("terminal create", 1, "", "refused")]
        )
        with self.assertRaises(orca.OrcaSessionError) as caught:
            orca.open_coordinator_terminal(environment, "/home/cycle/project", timeout=5)
        self.assertIn("terminal", str(caught.exception).lower())


class StartApplicationTest(unittest.TestCase):
    """The command line is a client; something has to start the application.

    Observed in a real guest: launched from the window manager's autostart the
    application left only a crash handler directory and a singleton lock, and
    the runtime never appeared. Launched as a detached command it reached
    `ready`. So the runner starts it, and that start is a recorded command.
    """

    def test_the_application_is_started_detached_with_a_display(self):
        environment = Environment([])
        orca.start_application(
            environment, ("/opt/Orca/orca-ide",), display=":0", timeout=30
        )
        argv = environment.seen[-1]
        joined = " ".join(argv)
        self.assertIn("/opt/Orca/orca-ide", joined)
        self.assertIn("nohup", joined)
        # The display is an argument the script exports, never inlined text.
        self.assertIn('export DISPLAY="$1"', joined)
        self.assertIn(":0", argv)
        self.assertEqual(argv[-1], "/opt/Orca/orca-ide")

    def test_a_stale_singleton_lock_is_cleared_first(self):
        environment = Environment([])
        orca.start_application(
            environment, ("/opt/Orca/orca-ide",), display=":0", timeout=30
        )
        joined = " ".join(" ".join(argv) for argv in environment.seen)
        self.assertIn("SingletonLock", joined)

    def test_the_start_reports_what_it_ran(self):
        environment = Environment([])
        outcome = orca.start_application(
            environment, ("/opt/Orca/orca-ide",), display=":0", timeout=30
        )
        self.assertEqual(outcome.context, "environment")


class CoordinatorTerminalIsInsideTest(unittest.TestCase):
    """A terminal that opens outside the environment looks identical until asked."""

    CREATED = json.dumps(
        {"ok": True, "result": {"terminal": {"handle": "term_fake", "surface": "visible"}}}
    )

    def environment(self, screen):
        return Environment(
            [
                ("repo add", 0, '{"ok": true}', ""),
                ("terminal create", 0, self.CREATED, ""),
                ("terminal send", 0, '{"ok": true}', ""),
                ("terminal read", 0, screen, ""),
            ]
        )

    def open(self, environment, **options):
        return orca.open_coordinator_terminal(
            environment,
            "/home/cycle/project",
            timeout=5,
            sleeper=lambda _seconds: None,
            **options,
        )

    def test_a_terminal_that_answers_with_this_environment_is_accepted(self):
        environment = self.environment(
            "handle: term_fake\nstatus: running\n\ncycle-terminal:dely-cycle-abc\n"
        )
        self.assertEqual(
            self.open(environment, expected_host="dely-cycle-abc"), "term_fake"
        )

    def test_a_terminal_that_answers_with_another_machine_stops_the_run(self):
        environment = self.environment(
            "handle: term_fake\nstatus: running\n\ncycle-terminal:workstation\n"
        )
        with self.assertRaises(orca.OrcaSessionError) as raised:
            self.open(environment, expected_host="dely-cycle-abc")
        self.assertIn("workstation", str(raised.exception))
        self.assertIn("not in this environment", str(raised.exception))

    def test_a_terminal_that_never_answers_stops_the_run(self):
        environment = self.environment("handle: term_fake\nstatus: running\n\n$ \n")
        with self.assertRaises(orca.OrcaSessionError):
            self.open(
                environment,
                expected_host="dely-cycle-abc",
            )

    def test_nothing_is_asked_when_no_machine_is_named(self):
        environment = self.environment("")
        self.assertEqual(self.open(environment), "term_fake")
        self.assertFalse(
            [argv for argv in environment.seen if "send" in " ".join(argv)],
            "a run that names no machine should ask no question",
        )
