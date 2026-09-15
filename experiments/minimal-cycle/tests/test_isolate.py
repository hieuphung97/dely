"""The host's own session must not reach into the environment.

Observed on a real container: this runner is itself launched from an Orca
terminal, which exports ORCA_TERMINAL_HANDLE and ORCA_AGENT_HOOK_TOKEN among
others. Distrobox inherits the host environment, so the container's Orca
attested as the *host's* terminal and refused the run with
`consumer_fenced: This terminal is attested as … and cannot act as …`.

That is an identifier of the host leaking into the environment, and one of the
leaked values is a token.
"""

import unittest

from cycle_runner import isolate, proc


class ScrubbedArgvTest(unittest.TestCase):
    def test_the_original_command_still_runs(self):
        outcome = proc.run(
            isolate.without_host_session(["printf", "%s", "ran"]),
            timeout=30, context="host",
        )
        self.assertEqual(outcome.exit_code, 0)
        self.assertEqual(outcome.stdout, "ran")

    def test_a_leaking_variable_does_not_reach_the_command(self):
        outcome = proc.run(
            isolate.without_host_session(["sh", "-c", 'echo "[${ORCA_TERMINAL_HANDLE:-gone}]"']),
            timeout=30, context="host",
            env={"ORCA_TERMINAL_HANDLE": "term_from_the_host"},
        )
        self.assertIn("[gone]", outcome.stdout)
        self.assertNotIn("term_from_the_host", outcome.stdout)

    def test_every_leaking_variable_goes_not_just_the_one_we_named(self):
        outcome = proc.run(
            isolate.without_host_session(["sh", "-c", "env | grep -c '^ORCA_' || true"]),
            timeout=30, context="host",
            env={
                "ORCA_TERMINAL_HANDLE": "a",
                "ORCA_AGENT_HOOK_TOKEN": "b",
                "ORCA_WORKSPACE_ID": "c",
            },
        )
        self.assertEqual(outcome.stdout.strip(), "0")

    def test_what_the_run_deliberately_passes_survives(self):
        outcome = proc.run(
            isolate.without_host_session(["sh", "-c", 'echo "[${CLAUDE_CODE_OAUTH_TOKEN:-gone}]"']),
            timeout=30, context="host",
            env={"CLAUDE_CODE_OAUTH_TOKEN": "kept", "ORCA_TERMINAL_HANDLE": "a"},
        )
        self.assertIn("[kept]", outcome.stdout)

    def test_arguments_with_spaces_and_quotes_survive(self):
        outcome = proc.run(
            isolate.without_host_session(["printf", "%s|%s", "two words", "it's"]),
            timeout=30, context="host",
        )
        self.assertEqual(outcome.stdout, "two words|it's")

    def test_the_prefixes_are_named_and_include_the_session_handle(self):
        self.assertIn("ORCA_", isolate.LEAKING_PREFIXES)


class AdaptersScrubTest(unittest.TestCase):
    """Both backends run their commands with the host's session removed."""

    def test_the_container_backend_scrubs(self):
        import tempfile
        from pathlib import Path

        from cycle_runner import config as config_module
        from cycle_runner.adapters import distrobox
        from tests.test_adapter_distrobox import StubRunner
        from tests.test_config import minimal_document

        with tempfile.TemporaryDirectory() as root:
            document = minimal_document()
            document["state_root"] = str(Path(root) / "state")
            document["artifact_root"] = str(Path(root) / "artifacts")
            runner = StubRunner()
            adapter = distrobox.DistroboxAdapter(
                run_config=config_module.from_document(document),
                run_id="20260914T221530Z-abc123-0123abcd",
                host_home=Path(root) / "hosthome",
                runner=runner,
                which=lambda name: f"/usr/bin/{name}",
            )
            adapter.execute(["true"], timeout=5)
            self.assertIn("cycle-isolate", runner.seen[-1])

    def test_the_machine_backend_scrubs(self):
        import tempfile
        from pathlib import Path

        from tests.test_adapter_vm import VmTestCase

        case = VmTestCase("run")
        case.setUp()
        try:
            adapter = case.make()
            adapter.prepare_identity()
            adapter.address = "192.168.122.11"
            adapter.execute(["true"], timeout=5)
            # The transport sends one quoted string, so the marker is inside it.
            self.assertIn("cycle-isolate", " ".join(adapter.runner.seen[-1]))
        finally:
            case.doCleanups()
