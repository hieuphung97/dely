"""Cleanup runs only after a confirmed export, and only on per-run resources."""

import tempfile
import unittest
from pathlib import Path

from cycle_runner import cleanup, processes, result, status
from cycle_runner.adapters.base import Resource
from tests.fakes import FakeAdapter


def export_record(state):
    return result.ExportRecord(status=state, detail="from the test")


class GateTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "run"
        self.adapter = FakeAdapter(self.root)
        self.handle = self.adapter.create()
        self.addCleanup(self._tmp.cleanup)

    def test_no_destroy_when_export_is_not_confirmed(self):
        record = cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.PARTIAL),
        )
        self.assertNotIn("destroy", self.adapter.calls)
        self.assertEqual(record.status, status.CleanupStatus.RESIDUE)
        self.assertIn("export", record.reason.lower())
        self.assertTrue(self.adapter.home.exists())

    def test_a_confirmed_export_destroys_and_verifies(self):
        record = cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.CONFIRMED),
        )
        self.assertIn("destroy", self.adapter.calls)
        self.assertEqual(record.status, status.CleanupStatus.DESTROYED)
        self.assertTrue(record.verified)
        self.assertFalse(self.adapter.home.exists())

    def test_a_surviving_per_run_resource_is_reported_as_residue(self):
        self.adapter.leave_residue = True
        record = cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.CONFIRMED),
        )
        self.assertEqual(record.status, status.CleanupStatus.RESIDUE)
        self.assertTrue(any(str(self.adapter.home) in item for item in record.retained))

    def test_shared_base_survives_cleanup(self):
        cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.CONFIRMED),
        )
        self.assertTrue(self.adapter.shared_base.is_file())
        self.assertEqual(self.adapter.shared_base.read_bytes(), b"shared base image")

    def test_a_lost_shared_resource_makes_cleanup_unknown(self):
        record_before = self.adapter.shared_base
        self.adapter.destroy = _destroy_too_much(self.adapter)
        record = cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.CONFIRMED),
        )
        self.assertFalse(record_before.exists())
        self.assertEqual(record.status, status.CleanupStatus.UNKNOWN)
        self.assertIn("shared", record.reason.lower())


def _destroy_too_much(adapter):
    import shutil

    from cycle_runner.adapters.base import DestroyReport

    def destroy():
        adapter.calls.append("destroy")
        shutil.rmtree(adapter.root.parent)
        return DestroyReport(removed=(str(adapter.home),), detail="removed the world")

    return destroy


class DeclarationTest(unittest.TestCase):
    def test_a_per_run_path_that_contains_a_shared_path_is_refused(self):
        with self.assertRaises(cleanup.CleanupContractError):
            cleanup.assert_declarations_disjoint(
                per_run=(Resource(kind="path", identifier="/state/run"),),
                shared=(Resource(kind="path", identifier="/state/run/base.img"),),
            )

    def test_a_resource_declared_both_ways_is_refused(self):
        with self.assertRaises(cleanup.CleanupContractError):
            cleanup.assert_declarations_disjoint(
                per_run=(Resource(kind="container", identifier="box"),),
                shared=(Resource(kind="container", identifier="box"),),
            )

    def test_declarations_that_do_not_overlap_are_accepted(self):
        cleanup.assert_declarations_disjoint(
            per_run=(Resource(kind="path", identifier="/state/run/home"),),
            shared=(Resource(kind="image", identifier="/state/shared/base.img"),),
        )


class SafeRemoveTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def test_a_file_and_a_directory_are_removed(self):
        target_file = self.root / "overlay.img"
        target_file.write_bytes(b"x")
        target_dir = self.root / "home"
        (target_dir / "nested").mkdir(parents=True)
        cleanup.safe_remove(target_file, allowed_roots=[self.root], protected=[])
        cleanup.safe_remove(target_dir, allowed_roots=[self.root], protected=[])
        self.assertFalse(target_file.exists())
        self.assertFalse(target_dir.exists())

    def test_a_path_outside_the_allowed_roots_is_refused(self):
        outside = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: outside.rmdir() if outside.exists() else None)
        with self.assertRaises(cleanup.CleanupContractError):
            cleanup.safe_remove(outside, allowed_roots=[self.root], protected=[])
        self.assertTrue(outside.exists())

    def test_a_path_containing_a_protected_path_is_refused(self):
        home = self.root / "home"
        base = home / "shared" / "base.img"
        base.parent.mkdir(parents=True)
        base.write_bytes(b"shared")
        with self.assertRaises(cleanup.CleanupContractError):
            cleanup.safe_remove(home, allowed_roots=[self.root], protected=[base])
        self.assertTrue(base.is_file())

    def test_the_filesystem_root_is_never_removable(self):
        with self.assertRaises(cleanup.CleanupContractError):
            cleanup.safe_remove(Path("/"), allowed_roots=[Path("/")], protected=[])

    def test_removing_something_absent_is_not_an_error(self):
        cleanup.safe_remove(self.root / "absent", allowed_roots=[self.root], protected=[])


class StopGateTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "run"
        self.adapter = FakeAdapter(self.root)
        self.handle = self.adapter.create()
        self.addCleanup(self._tmp.cleanup)

    def test_an_unconfirmed_stop_prevents_destroy(self):
        record = cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.CONFIRMED),
            stop_confirmed=False,
        )
        self.assertNotIn("destroy", self.adapter.calls)
        self.assertEqual(record.status, status.CleanupStatus.RESIDUE)
        self.assertIn("stop", record.reason.lower())
        self.assertTrue(self.adapter.home.exists())

    def test_a_confirmed_stop_lets_destroy_run(self):
        record = cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.CONFIRMED),
            stop_confirmed=True,
        )
        self.assertEqual(record.status, status.CleanupStatus.DESTROYED)


class ProcessSurveyTest(unittest.TestCase):
    """Cleanup reports what the run left running, and refuses to call it clean."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.adapter = FakeAdapter(self.root / "run")
        self.handle = self.adapter.create()
        self.addCleanup(self._tmp.cleanup)

    def perform(self, survey, **options):
        return cleanup.perform(
            adapter=self.adapter,
            handle=self.handle,
            export_record=export_record(status.ExportStatus.CONFIRMED),
            survey=survey,
            **options,
        )

    def test_a_clean_survey_is_named_in_the_reason(self):
        record = self.perform(
            lambda paths, roots=(): processes.SurveyReport(detail="no process on the host")
        )
        self.assertEqual(record.status, status.CleanupStatus.DESTROYED)
        self.assertIn("no process on the host", record.reason)

    def test_a_surviving_process_is_residue_even_when_every_resource_is_gone(self):
        record = self.perform(
            lambda paths, roots=(): processes.SurveyReport(
                found=[7], surviving=[7], detail="1 process would not stop"
            )
        )
        self.assertEqual(record.status, status.CleanupStatus.RESIDUE)
        self.assertIn("process:7", record.retained)
        self.assertEqual(record.processes["surviving"], [7])

    def test_the_survey_is_given_this_runs_paths_and_no_others(self):
        seen = []

        def survey(paths, roots=()):
            seen.append(list(paths))
            return processes.SurveyReport(detail="looked")

        self.perform(survey)
        self.assertEqual(len(seen), 1)
        for path in seen[0]:
            self.assertTrue(path.startswith(str(self.root)), path)

    def test_what_the_run_started_is_handed_to_the_survey(self):
        seen = {}

        def survey(paths, roots=()):
            seen["roots"] = list(roots)
            return processes.SurveyReport(detail="looked")

        self.perform(survey, started=[4242])
        self.assertEqual(seen["roots"], [4242])
