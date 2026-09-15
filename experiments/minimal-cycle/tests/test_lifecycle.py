"""The shared lifecycle: export before destroy, and never a silent host fallback."""

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from cycle_runner import config as config_module, ids, lifecycle, status
from tests.fakes import FakeAdapter
from tests.test_config import minimal_document

RUN_ID = "20260914T221530Z-abc123-0123abcd"
MARKER = "dely-cycle-marker"


def make_source_repo(root: Path) -> Path:
    repo = root / "under-test"
    repo.mkdir(parents=True)
    for arguments in (
        ("init", "-q", "-b", "main"),
        ("config", "user.email", "cycle@example.invalid"),
        ("config", "user.name", "cycle"),
    ):
        subprocess.run(["git", "-C", str(repo), *arguments], check=True, capture_output=True)
    (repo / "readme.md").write_text("project under test\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True, capture_output=True)
    subprocess.run(
        ["git", "-C", str(repo), "commit", "-q", "-m", "initial"],
        check=True,
        capture_output=True,
    )
    return repo


class CycleTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.repo = make_source_repo(self.root / "src")
        self.artifacts = self.root / "artifacts"
        self.state = self.root / "state"
        self.host_home = self.root / "hosthome"
        (self.host_home / ".claude").mkdir(parents=True)
        (self.host_home / ".claude" / ".credentials.json").write_text(
            '{"note": "stand-in"}', encoding="utf-8"
        )
        self.addCleanup(self._tmp.cleanup)

    def make_config(self, **overrides):
        document = minimal_document()
        document["artifact_root"] = str(self.artifacts)
        document["state_root"] = str(self.state)
        document["project"]["source"] = str(self.repo)
        document["project"]["revision"] = "main"
        document["task"]["marker"] = MARKER
        # These tests drive a fake environment, so a runtime that is never going
        # to be ready should be given up on at once rather than in five minutes.
        document["orca"]["ready_timeout_seconds"] = 1
        document.update(overrides)
        return config_module.from_document(document)

    def run_cycle(self, **adapter_options):
        run_config = self.make_config()
        adapter = FakeAdapter(
            self.state / RUN_ID, host_project=self.repo, **adapter_options
        )
        outcome = lifecycle.run_cycle(
            run_config=run_config,
            adapter=adapter,
            run_id=RUN_ID,
            host_home=self.host_home,
            environ={},
            tool_versions={"runner": "one"},
        )
        return adapter, outcome

    def artifact(self, relative):
        return (self.artifacts / RUN_ID / relative)


class SettledCycleTest(CycleTestCase):
    def test_a_full_cycle_settles(self):
        _, outcome = self.run_cycle()
        self.assertEqual(outcome.run_result.status, status.RunStatus.SETTLED, outcome.run_result.failure_classification)
        self.assertEqual(outcome.exit_code, 0)

    def test_the_phases_run_in_the_documented_order(self):
        adapter, outcome = self.run_cycle()
        names = [phase.name for phase in outcome.run_result.phases]
        self.assertEqual(
            names,
            [
                "prepare",
                "create",
                "bootstrap",
                "identity",
                "task",
                "check",
                "collect",
                "export",
                "cleanup",
                "close",
            ],
        )

    def test_the_export_happens_before_the_environment_is_destroyed(self):
        adapter, outcome = self.run_cycle()
        self.assertIn("fetch_tree", adapter.calls)
        self.assertIn("destroy", adapter.calls)
        self.assertLess(adapter.calls.index("fetch_tree"), adapter.calls.index("destroy"))
        self.assertLess(adapter.calls.index("stop"), adapter.calls.index("destroy"))

    def test_every_required_artifact_is_on_the_host(self):
        _, outcome = self.run_cycle()
        for relative in (
            "manifest.json",
            "host-before.json",
            "host-after.json",
            "backend-status.json",
            "auth-receipt.json",
            "preflight.json",
            "identity/host-probe.txt",
            "identity/environment-probe.txt",
            "identity/orca-status.json",
            "check.stdout",
            "check.stderr",
            "diff.patch",
            "logs/runner.log",
            "logs/commands.jsonl",
            "run-before-cleanup.json",
            "export-receipt.json",
            "cleanup.json",
        ):
            self.assertTrue(self.artifact(relative).is_file(), f"missing {relative}")

    def test_the_task_artifact_is_exported(self):
        _, outcome = self.run_cycle()
        self.assertEqual(
            self.artifact("task-artifact/evidence.txt").read_text(encoding="utf-8"),
            MARKER,
        )

    def test_the_diff_shows_what_the_task_changed(self):
        _, outcome = self.run_cycle()
        patch = self.artifact("diff.patch").read_text(encoding="utf-8")
        self.assertIn("+++ b/evidence.txt", patch)
        self.assertIn(f"+{MARKER}", patch)

    def test_the_manifest_validates_and_names_the_run(self):
        _, outcome = self.run_cycle()
        document = json.loads(self.artifact("manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(document["run_id"], RUN_ID)
        self.assertEqual(document["status"], "SETTLED")
        self.assertEqual(document["cleanup"]["status"], "DESTROYED")
        self.assertEqual(document["export"]["status"], "CONFIRMED")
        self.assertTrue(document["artifacts"])

    def test_the_environment_is_gone_and_the_shared_base_is_not(self):
        adapter, _ = self.run_cycle()
        self.assertFalse(adapter.home.exists())
        self.assertTrue(adapter.shared_base.is_file())

    def test_the_check_really_ran_against_the_environment_copy(self):
        _, outcome = self.run_cycle()
        check = outcome.run_result.check
        self.assertEqual(check.exit_code, 0)
        self.assertEqual(check.status, status.PhaseStatus.OK)
        self.assertIn("marker matched", self.artifact("check.stdout").read_text(encoding="utf-8"))


class HostFallbackTest(CycleTestCase):
    def test_a_host_identity_blocks_before_the_worker_runs(self):
        adapter, outcome = self.run_cycle(identity="host")
        self.assertEqual(outcome.run_result.status, status.RunStatus.BLOCKED)
        self.assertNotIn("worker", adapter.calls)
        self.assertEqual(
            outcome.run_result.identity.verdict, "HOST_FALLBACK"
        )

    def test_a_blocked_run_still_exports_and_cleans_up(self):
        adapter, outcome = self.run_cycle(identity="host")
        self.assertEqual(outcome.run_result.export.status, status.ExportStatus.CONFIRMED)
        self.assertEqual(outcome.run_result.cleanup.status, status.CleanupStatus.DESTROYED)
        self.assertTrue(self.artifact("manifest.json").is_file())

    def test_a_missing_orca_blocks_rather_than_using_the_host(self):
        adapter, outcome = self.run_cycle(orca_present=False)
        self.assertEqual(outcome.run_result.status, status.RunStatus.BLOCKED)
        self.assertIn("orca", outcome.run_result.failure_classification.lower())
        self.assertNotIn("worker", adapter.calls)

    def test_a_blocked_run_exits_with_its_own_code(self):
        _, outcome = self.run_cycle(identity="host")
        self.assertEqual(outcome.exit_code, status.exit_code(status.RunStatus.BLOCKED))


class ExportGateTest(CycleTestCase):
    def test_no_destroy_when_export_unconfirmed(self):
        adapter, outcome = self.run_cycle(fetch_fails=True)
        self.assertNotIn("destroy", adapter.calls)
        self.assertEqual(outcome.run_result.cleanup.status, status.CleanupStatus.RESIDUE)
        self.assertNotEqual(outcome.run_result.export.status, status.ExportStatus.CONFIRMED)
        self.assertEqual(outcome.run_result.status, status.RunStatus.UNKNOWN)
        self.assertTrue(adapter.home.exists())

    def test_an_unconfirmed_stop_prevents_destroy(self):
        adapter, outcome = self.run_cycle(stop_confirmed=False)
        self.assertNotIn("destroy", adapter.calls)
        self.assertEqual(outcome.run_result.cleanup.status, status.CleanupStatus.RESIDUE)
        self.assertIn("stop", outcome.run_result.cleanup.reason.lower())

    def test_surviving_resources_are_reported_as_cleanup_failed(self):
        _, outcome = self.run_cycle(leave_residue=True)
        self.assertEqual(outcome.run_result.status, status.RunStatus.CLEANUP_FAILED)
        self.assertEqual(outcome.run_result.cleanup.status, status.CleanupStatus.RESIDUE)


class TimeoutTest(CycleTestCase):
    def test_timeout_exports_before_stop_and_settles_timeout(self):
        adapter, outcome = self.run_cycle(task_hangs=True)
        self.assertEqual(outcome.run_result.status, status.RunStatus.TIMEOUT)
        self.assertLess(adapter.calls.index("fetch_tree"), adapter.calls.index("stop"))
        self.assertEqual(outcome.run_result.export.status, status.ExportStatus.CONFIRMED)
        self.assertTrue(self.artifact("diff.patch").is_file())
        self.assertTrue(self.artifact("manifest.json").is_file())

    def test_a_timed_out_run_never_reports_a_check_result(self):
        _, outcome = self.run_cycle(task_hangs=True)
        self.assertEqual(outcome.run_result.check.status, status.PhaseStatus.SKIPPED)


class CheckFailureTest(CycleTestCase):
    def test_a_missing_marker_is_an_error_not_a_settled_run(self):
        _, outcome = self.run_cycle(task_writes_nothing=True)
        self.assertEqual(outcome.run_result.status, status.RunStatus.ERROR)
        self.assertEqual(outcome.run_result.check.status, status.PhaseStatus.FAILED)
        self.assertNotEqual(outcome.run_result.check.exit_code, 0)

    def test_a_wrong_marker_is_an_error(self):
        _, outcome = self.run_cycle(marker="not-the-marker")
        self.assertEqual(outcome.run_result.status, status.RunStatus.ERROR)
        self.assertIn(
            "mismatch", self.artifact("check.stderr").read_text(encoding="utf-8")
        )


class PreflightTest(CycleTestCase):
    def test_a_failed_preflight_blocks_without_creating_anything(self):
        adapter, outcome = self.run_cycle(preflight_ok=False)
        self.assertEqual(outcome.run_result.status, status.RunStatus.BLOCKED)
        self.assertNotIn("create", adapter.calls)
        self.assertTrue(self.artifact("preflight.json").is_file())
        self.assertTrue(self.artifact("manifest.json").is_file())


class RunIdentifierTest(CycleTestCase):
    def test_the_artifact_directory_is_named_by_the_run(self):
        _, outcome = self.run_cycle()
        self.assertEqual(outcome.artifact_dir, self.artifacts / RUN_ID)
        self.assertTrue(ids.is_run_id(outcome.run_result.run_id))


class HostOrcaTest(CycleTestCase):
    """Reproduces a real Distrobox run: the box saw the host's own orca.

    Distrobox mounts the host home and preserves PATH, so `command -v orca`
    resolved to the host launcher. The environment verdict was correct and the
    run still had no Orca of its own.
    """

    @unittest.skipUnless(shutil.which("orca"), "no orca on this host to resolve to")
    def test_an_orca_that_is_the_hosts_own_blocks_before_the_worker(self):
        adapter, outcome = self.run_cycle(orca_path_from_host=True)
        self.assertEqual(outcome.run_result.status, status.RunStatus.BLOCKED)
        self.assertNotIn("worker", adapter.calls)
        self.assertTrue(outcome.run_result.identity.orca_is_host_installation)
        self.assertIn("host", outcome.run_result.failure_classification.lower())

    @unittest.skipUnless(shutil.which("orca"), "no orca on this host to resolve to")
    def test_that_run_still_exports_and_cleans_up(self):
        adapter, outcome = self.run_cycle(orca_path_from_host=True)
        self.assertEqual(outcome.run_result.export.status, status.ExportStatus.CONFIRMED)
        self.assertEqual(outcome.run_result.cleanup.status, status.CleanupStatus.DESTROYED)


class CreateFailureTest(CycleTestCase):
    """A create that fails partway may already have made resources."""

    def test_a_failed_create_records_the_planned_resources_as_residue(self):
        adapter, outcome = self.run_cycle(create_fails=True)
        record = outcome.run_result.cleanup
        self.assertEqual(record.status, status.CleanupStatus.RESIDUE)
        self.assertTrue(
            any(str(adapter.home) in item for item in record.retained),
            record.retained,
        )
        self.assertIn("create", record.reason.lower())

    def test_a_failed_create_does_not_destroy_blind(self):
        adapter, _ = self.run_cycle(create_fails=True)
        self.assertNotIn("destroy", adapter.calls)

    def test_a_failed_create_still_writes_a_manifest(self):
        _, outcome = self.run_cycle(create_fails=True)
        self.assertTrue(self.artifact("manifest.json").is_file())
        self.assertEqual(outcome.run_result.status, status.RunStatus.ERROR)


class OrcaSessionTest(CycleTestCase):
    """Orca being installed is not Orca being able to take a dispatch."""

    def test_a_runtime_that_never_becomes_ready_blocks_before_the_worker(self):
        adapter, outcome = self.run_cycle(runtime_ready=False)
        self.assertEqual(outcome.run_result.status, status.RunStatus.BLOCKED)
        self.assertNotIn("worker", adapter.calls)
        self.assertIn("runtime", outcome.run_result.failure_classification.lower())

    def test_a_refused_coordinator_terminal_blocks_before_the_worker(self):
        adapter, outcome = self.run_cycle(terminal_refused=True)
        self.assertEqual(outcome.run_result.status, status.RunStatus.BLOCKED)
        self.assertNotIn("worker", adapter.calls)
        self.assertIn("terminal", outcome.run_result.failure_classification.lower())

    def test_a_ready_runtime_is_recorded_with_its_identifier(self):
        _, outcome = self.run_cycle()
        runtime = outcome.run_result.identity.orca_runtime
        self.assertTrue(runtime["ready"])
        self.assertEqual(runtime["runtime_id"], "runtime-fake")
        self.assertEqual(runtime["desktop_window"], "available")
        self.assertIn("orchestration.contract.v1", runtime["capabilities"])

    def test_the_runtime_report_is_exported(self):
        self.run_cycle()
        self.assertTrue(self.artifact("identity/orca-runtime.json").is_file())

    def test_the_coordinator_terminal_is_opened_before_the_dispatch(self):
        adapter, _ = self.run_cycle()
        self.assertIn("terminal-create", adapter.calls)
        self.assertLess(adapter.calls.index("terminal-create"), adapter.calls.index("worker"))


class OrcaApplicationStartTest(CycleTestCase):
    """Nothing else starts the application, so the runner does."""

    def test_the_application_is_started_inside_the_environment(self):
        adapter, _ = self.run_cycle()
        self.assertIn("orca-start", adapter.calls)
        self.assertLess(adapter.calls.index("orca-start"), adapter.calls.index("worker"))

    def test_an_already_ready_runtime_is_not_started_again(self):
        adapter, outcome = self.run_cycle(already_running=True)
        self.assertNotIn("orca-start", adapter.calls)
        self.assertEqual(outcome.run_result.status, status.RunStatus.SETTLED)

    def test_a_runtime_that_stays_down_after_a_start_blocks(self):
        adapter, outcome = self.run_cycle(runtime_ready=False)
        self.assertIn("orca-start", adapter.calls)
        self.assertEqual(outcome.run_result.status, status.RunStatus.BLOCKED)

    def test_the_start_is_recorded_as_a_command_of_the_identity_phase(self):
        _, outcome = self.run_cycle()
        identity = outcome.run_result.phase("identity")
        self.assertTrue(
            any("orca-start" in " ".join(c.argv) for c in identity.commands),
            [" ".join(c.argv)[:60] for c in identity.commands],
        )


class ProjectRepositoryTest(CycleTestCase):
    """Orca registers a worktree for a repository, so the copy becomes one."""

    def test_the_copy_is_initialised_as_a_repository_and_it_succeeds(self):
        _, outcome = self.run_cycle()
        bootstrap = outcome.run_result.phase("bootstrap")
        commands = [c for c in bootstrap.commands if c.argv and c.argv[0] == "git"]
        self.assertGreaterEqual(len(commands), 5, [c.argv for c in bootstrap.commands])
        for command in commands:
            self.assertEqual(command.exit_code, 0, " ".join(command.argv))
        joined = " ".join(" ".join(c.argv) for c in commands)
        self.assertIn("init", joined)
        self.assertIn("commit", joined)

    def test_a_failed_initialisation_stops_the_run_rather_than_continuing(self):
        adapter, outcome = self.run_cycle(refuse_repository=True)
        self.assertEqual(outcome.run_result.status, status.RunStatus.ERROR)
        self.assertIn("repository", outcome.run_result.failure_classification.lower())
        self.assertNotIn("worker", adapter.calls)

    def test_repository_metadata_does_not_appear_in_the_patch(self):
        _, outcome = self.run_cycle()
        patch = self.artifact("diff.patch").read_text(encoding="utf-8")
        self.assertNotIn(".git/", patch)
        self.assertIn("evidence.txt", patch)


class UnverifiableDispatchTest(CycleTestCase):
    """The plane saying it cannot tell is not the plane saying it failed.

    Observed against a live runtime: with no credential in the image, Claude
    Code's turn never began and Orca reported `outcome_unknown` with
    `turn_start_unobserved` — explicitly unverifiable, not proof of failure.
    """

    def test_an_unverifiable_dispatch_settles_unknown_rather_than_error(self):
        _, outcome = self.run_cycle(dispatch_state="outcome_unknown")
        self.assertEqual(outcome.run_result.status, status.RunStatus.UNKNOWN)
        self.assertIn("unknown", outcome.run_result.failure_classification.lower())

    def test_the_dispatch_identifiers_are_still_recorded(self):
        _, outcome = self.run_cycle(dispatch_state="outcome_unknown")
        worker_record = outcome.run_result.worker
        self.assertEqual(worker_record.dispatch_id, "dispatch-fake")
        self.assertEqual(worker_record.outcome, "outcome_unknown")
        self.assertEqual(worker_record.model, "pinned-model")

    def test_the_evidence_is_still_exported_and_the_environment_destroyed(self):
        _, outcome = self.run_cycle(dispatch_state="outcome_unknown")
        self.assertEqual(outcome.run_result.export.status, status.ExportStatus.CONFIRMED)
        self.assertEqual(outcome.run_result.cleanup.status, status.CleanupStatus.DESTROYED)

    def test_a_genuine_refusal_is_still_an_error(self):
        _, outcome = self.run_cycle(dispatch_state="refused")
        self.assertEqual(outcome.run_result.status, status.RunStatus.ERROR)
