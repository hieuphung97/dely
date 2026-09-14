"""The identity verdict is what stands between a real run and a host fallback."""

import unittest

from cycle_runner import probe, result


def host_snapshot(**overrides):
    snapshot = {
        "hostname": "workshop",
        "machine_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "boot_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "home": "/home/someone",
        "user": "someone",
        "path": "/usr/bin:/bin",
        "pid": "4242",
        "uname": "linux workshop amd64",
        "container_marker": "",
        "virt": "none",
        "orca_path": "/opt/host/bin/orca",
        "orca_version": "1.4.201",
        "project_real": "/home/someone/code/under-test",
    }
    snapshot.update(overrides)
    return snapshot


def container_snapshot(**overrides):
    snapshot = host_snapshot(
        hostname="dely-cycle-box",
        machine_id="cccccccccccccccccccccccccccccccc",
        home="/var/tmp/cycle-state/run/home",
        container_marker="containerenv",
        project_real="/var/tmp/cycle-state/run/home/project",
        orca_path="/usr/bin/orca",
    )
    snapshot.update(overrides)
    return snapshot


def machine_snapshot(**overrides):
    snapshot = container_snapshot(
        container_marker="",
        boot_id="dddddddd-dddd-dddd-dddd-dddddddddddd",
        virt="kvm",
    )
    snapshot.update(overrides)
    return snapshot


def verdict(environment, *, backend="distrobox", host=None):
    return probe.verdict(
        host=host or host_snapshot(),
        environment=environment,
        backend=backend,
        expected_home="/var/tmp/cycle-state/run/home",
        expected_project="/var/tmp/cycle-state/run/home/project",
    )


class ParseTest(unittest.TestCase):
    def test_key_value_lines_parse_into_a_snapshot(self):
        parsed = probe.parse("hostname=box\nhome=/root\nempty=\n")
        self.assertEqual(parsed["hostname"], "box")
        self.assertEqual(parsed["home"], "/root")
        self.assertEqual(parsed["empty"], "")

    def test_values_containing_an_equals_sign_survive(self):
        parsed = probe.parse("path=/usr/bin:/bin\nnote=a=b\n")
        self.assertEqual(parsed["note"], "a=b")

    def test_unrecognised_lines_are_ignored_rather_than_crashing(self):
        parsed = probe.parse("garbage line\nhostname=box\n")
        self.assertEqual(parsed["hostname"], "box")

    def test_the_probe_script_is_posix_shell_and_names_every_field(self):
        script = probe.PROBE_SCRIPT
        for field in probe.REQUIRED_FIELDS:
            self.assertIn(f"{field}=", script)
        self.assertNotIn("bash", script)


class VerdictTest(unittest.TestCase):
    def test_a_container_snapshot_is_accepted(self):
        record = verdict(container_snapshot())
        self.assertEqual(record.verdict, result.IDENTITY_ENVIRONMENT)
        self.assertIn("container-marker", " ".join(record.markers))

    def test_host_snapshot_is_rejected(self):
        record = verdict(host_snapshot())
        self.assertEqual(record.verdict, result.IDENTITY_HOST_FALLBACK)
        self.assertIn("host", record.reason.lower())

    def test_a_snapshot_with_a_marker_but_the_host_home_is_rejected(self):
        record = verdict(container_snapshot(home="/home/someone"))
        self.assertEqual(record.verdict, result.IDENTITY_HOST_FALLBACK)
        self.assertIn("home", record.reason.lower())

    def test_a_snapshot_pointing_at_the_host_checkout_is_rejected(self):
        record = verdict(
            container_snapshot(project_real="/home/someone/code/under-test")
        )
        self.assertEqual(record.verdict, result.IDENTITY_HOST_FALLBACK)
        self.assertIn("project", record.reason.lower())

    def test_a_container_marker_does_not_satisfy_the_machine_backend(self):
        record = verdict(container_snapshot(), backend="vm")
        self.assertEqual(record.verdict, result.IDENTITY_HOST_FALLBACK)
        self.assertIn("boot", record.reason.lower())

    def test_a_machine_snapshot_satisfies_the_machine_backend(self):
        record = verdict(machine_snapshot(), backend="vm")
        self.assertEqual(record.verdict, result.IDENTITY_ENVIRONMENT)

    def test_an_empty_snapshot_is_unknown_rather_than_accepted(self):
        record = verdict({})
        self.assertEqual(record.verdict, result.IDENTITY_UNKNOWN)

    def test_identity_records_whether_orca_is_present_in_the_environment(self):
        present = verdict(container_snapshot())
        self.assertTrue(present.orca_present)
        self.assertEqual(present.orca_version, "1.4.201")
        absent = verdict(container_snapshot(orca_path="", orca_version=""))
        self.assertFalse(absent.orca_present)

    def test_the_host_identifiers_are_stored_as_digests_not_as_names(self):
        record = verdict(container_snapshot())
        self.assertNotIn("workshop", str(record.host))
        self.assertNotIn("/home/someone", str(record.host))
        self.assertIn("hostname_digest", record.host)

    def test_the_environment_home_and_project_stay_readable_for_a_reader(self):
        record = verdict(container_snapshot())
        self.assertEqual(record.environment["home"], "/var/tmp/cycle-state/run/home")


class GateTest(unittest.TestCase):
    def test_only_an_environment_verdict_with_orca_opens_the_gate(self):
        self.assertTrue(probe.may_continue(verdict(container_snapshot()))[0])
        blocked, reason = probe.may_continue(verdict(host_snapshot()))
        self.assertFalse(blocked)
        self.assertIn("host", reason.lower())

    def test_a_missing_orca_blocks_instead_of_falling_back(self):
        allowed, reason = probe.may_continue(
            verdict(container_snapshot(orca_path="", orca_version=""))
        )
        self.assertFalse(allowed)
        self.assertIn("orca", reason.lower())


class HostProbeIntegrationTest(unittest.TestCase):
    """The probe is shell, so the only honest check is running it."""

    def test_the_probe_emits_exactly_one_line_for_each_field(self):
        from pathlib import Path

        from cycle_runner import proc

        outcome = proc.run(
            probe.probe_argv(str(Path.cwd())), timeout=30, context="host"
        )
        self.assertEqual(outcome.exit_code, 0, outcome.stderr)
        lines = [line for line in outcome.stdout.splitlines() if line.strip()]
        keys = [line.split("=", 1)[0] for line in lines]
        self.assertEqual(sorted(keys), sorted(probe.REQUIRED_FIELDS))

    def test_the_probe_resolves_the_directory_it_is_given(self):
        from pathlib import Path

        from cycle_runner import proc

        here = Path.cwd().resolve()
        outcome = proc.run(probe.probe_argv(str(here)), timeout=30, context="host")
        self.assertEqual(probe.parse(outcome.stdout)["project_real"], str(here))

    def test_an_absent_project_directory_resolves_to_nothing(self):
        from cycle_runner import proc

        outcome = proc.run(
            probe.probe_argv("/nonexistent-cycle-path"), timeout=30, context="host"
        )
        self.assertEqual(probe.parse(outcome.stdout)["project_real"], "")


class OrcaPresenceTest(unittest.TestCase):
    """Observed on a real Distrobox run: `command -v orca` found the host's own.

    Distrobox mounts the host home and preserves PATH, so a shim on the host
    resolves inside the box. It is not an Orca the environment has.
    """

    def test_an_orca_resolved_to_the_host_installation_is_not_present(self):
        record = verdict(
            container_snapshot(
                orca_path=host_snapshot()["orca_path"], orca_version=""
            )
        )
        self.assertFalse(record.orca_present)
        self.assertTrue(record.orca_is_host_installation)

    def test_an_orca_that_reports_no_version_inside_is_not_present(self):
        record = verdict(
            container_snapshot(orca_path="/usr/bin/orca", orca_version="")
        )
        self.assertFalse(record.orca_present)
        self.assertFalse(record.orca_is_host_installation)

    def test_an_orca_of_its_own_is_present(self):
        record = verdict(
            container_snapshot(orca_path="/usr/bin/orca", orca_version="1.4.201")
        )
        self.assertTrue(record.orca_present)
        self.assertFalse(record.orca_is_host_installation)

    def test_the_gate_names_the_host_installation_when_that_is_what_it_found(self):
        allowed, reason = probe.may_continue(
            verdict(
                container_snapshot(
                    orca_path=host_snapshot()["orca_path"], orca_version=""
                )
            )
        )
        self.assertFalse(allowed)
        self.assertIn("host", reason.lower())
        self.assertIn(host_snapshot()["orca_path"], reason)

    def test_the_gate_names_a_version_that_never_came_back(self):
        allowed, reason = probe.may_continue(
            verdict(container_snapshot(orca_path="/usr/bin/orca", orca_version=""))
        )
        self.assertFalse(allowed)
        self.assertIn("version", reason.lower())

    def test_the_gate_opens_for_an_orca_the_environment_carries(self):
        allowed, _ = probe.may_continue(
            verdict(container_snapshot(orca_path="/usr/bin/orca", orca_version="1.4.201"))
        )
        self.assertTrue(allowed)
