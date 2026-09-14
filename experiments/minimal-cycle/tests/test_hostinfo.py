"""The host baseline is what shows whether the run leaked outside its environment."""

import tempfile
import unittest
from pathlib import Path

from cycle_runner import hostinfo


class SnapshotTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.state = self.root / "state"
        self.artifacts = self.root / "artifacts"
        self.state.mkdir()
        self.artifacts.mkdir()
        self.addCleanup(self._tmp.cleanup)

    def snapshot(self):
        return hostinfo.snapshot(state_root=self.state, artifact_root=self.artifacts)

    def test_the_snapshot_names_the_facts_a_reader_needs(self):
        taken = self.snapshot()
        for key in (
            "captured_at",
            "kernel",
            "architecture",
            "python_version",
            "hostname_digest",
            "machine_id_digest",
            "boot_id_digest",
            "user_digest",
            "state_root",
            "artifact_root",
        ):
            self.assertIn(key, taken)

    def test_identifiers_are_digests_rather_than_names(self):
        import socket

        taken = self.snapshot()
        self.assertNotIn(socket.gethostname(), str(taken))
        self.assertEqual(len(taken["hostname_digest"]), 16)

    def test_the_roots_are_listed_by_their_immediate_entries(self):
        (self.state / "run-one").mkdir()
        (self.state / "run-two").mkdir()
        taken = self.snapshot()
        self.assertEqual(taken["state_root"]["entries"], ["run-one", "run-two"])
        self.assertTrue(taken["state_root"]["exists"])

    def test_an_absent_root_is_recorded_rather_than_raised(self):
        taken = hostinfo.snapshot(
            state_root=self.root / "absent", artifact_root=self.artifacts
        )
        self.assertFalse(taken["state_root"]["exists"])
        self.assertEqual(taken["state_root"]["entries"], [])

    def test_extra_backend_facts_are_carried_through(self):
        taken = hostinfo.snapshot(
            state_root=self.state,
            artifact_root=self.artifacts,
            extra={"containers": ["one"]},
        )
        self.assertEqual(taken["extra"]["containers"], ["one"])


class DifferenceTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.state = self.root / "state"
        self.artifacts = self.root / "artifacts"
        self.state.mkdir()
        self.artifacts.mkdir()
        self.addCleanup(self._tmp.cleanup)

    def snapshot(self):
        return hostinfo.snapshot(state_root=self.state, artifact_root=self.artifacts)

    def test_identical_snapshots_differ_in_nothing(self):
        before = self.snapshot()
        after = self.snapshot()
        self.assertEqual(hostinfo.difference(before, after), {})

    def test_an_entry_left_behind_is_reported(self):
        before = self.snapshot()
        (self.state / "leftover").mkdir()
        after = self.snapshot()
        self.assertEqual(
            hostinfo.difference(before, after)["state_root_added"], ["leftover"]
        )

    def test_an_entry_that_disappeared_is_reported(self):
        (self.state / "temporary").mkdir()
        before = self.snapshot()
        (self.state / "temporary").rmdir()
        after = self.snapshot()
        self.assertEqual(
            hostinfo.difference(before, after)["state_root_removed"], ["temporary"]
        )
