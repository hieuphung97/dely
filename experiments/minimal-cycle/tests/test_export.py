"""The export receipt is a re-read of the host, not a memory of the write."""

import json
import tempfile
import unittest
from pathlib import Path

from cycle_runner import export, status


class ExporterTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "run"
        self.exporter = export.Exporter(self.root)
        self.addCleanup(self._tmp.cleanup)

    def test_a_written_artifact_lands_on_the_host(self):
        self.exporter.write_text("check.stdout", "marker matched\n")
        self.assertEqual(
            (self.root / "check.stdout").read_text(encoding="utf-8"), "marker matched\n"
        )

    def test_nested_artifacts_create_their_directories(self):
        self.exporter.write_text("logs/runner.log", "line\n")
        self.assertTrue((self.root / "logs" / "runner.log").is_file())

    def test_a_confirmed_export_describes_every_artifact(self):
        self.exporter.write_text("check.stdout", "marker matched\n")
        self.exporter.write_json("run.json", {"status": "SETTLED"})
        record = self.exporter.confirm()
        self.assertEqual(record.status, status.ExportStatus.CONFIRMED)
        paths = {entry["path"] for entry in record.artifacts}
        self.assertEqual(paths, {"check.stdout", "run.json"})
        for entry in record.artifacts:
            self.assertEqual(len(entry["sha256"]), 64)
            self.assertGreater(entry["size_bytes"], 0)

    def test_receipt_fails_when_artifact_changes_after_write(self):
        self.exporter.write_text("check.stdout", "marker matched\n")
        (self.root / "check.stdout").write_text("", encoding="utf-8")
        record = self.exporter.confirm()
        self.assertNotEqual(record.status, status.ExportStatus.CONFIRMED)
        self.assertTrue(any("check.stdout" in entry for entry in record.missing))

    def test_receipt_fails_when_a_required_artifact_disappears(self):
        self.exporter.write_text("check.stdout", "marker matched\n")
        (self.root / "check.stdout").unlink()
        record = self.exporter.confirm()
        self.assertNotEqual(record.status, status.ExportStatus.CONFIRMED)
        self.assertTrue(any("check.stdout" in entry for entry in record.missing))

    def test_an_export_with_some_evidence_left_is_partial_not_failed(self):
        self.exporter.write_text("check.stdout", "marker matched\n")
        self.exporter.write_text("run.json", "{}\n")
        (self.root / "check.stdout").unlink()
        record = self.exporter.confirm()
        self.assertEqual(record.status, status.ExportStatus.PARTIAL)

    def test_an_export_with_nothing_left_has_failed(self):
        self.exporter.write_text("check.stdout", "marker matched\n")
        (self.root / "check.stdout").unlink()
        record = self.exporter.confirm()
        self.assertEqual(record.status, status.ExportStatus.FAILED)

    def test_an_optional_artifact_that_is_absent_does_not_block(self):
        self.exporter.write_text("run.json", "{}\n")
        self.exporter.declare("task-artifact/evidence.txt", required=False)
        record = self.exporter.confirm()
        self.assertEqual(record.status, status.ExportStatus.CONFIRMED)

    def test_a_required_artifact_declared_but_never_written_blocks(self):
        self.exporter.write_text("run.json", "{}\n")
        self.exporter.declare("diff.patch", required=True)
        record = self.exporter.confirm()
        self.assertNotEqual(record.status, status.ExportStatus.CONFIRMED)
        self.assertTrue(any("diff.patch" in entry for entry in record.missing))

    def test_only_a_confirmed_export_permits_cleanup(self):
        self.exporter.write_text("run.json", "{}\n")
        self.assertTrue(self.exporter.confirm().status.permits_cleanup)

    def test_the_receipt_is_written_and_reloads(self):
        self.exporter.write_text("run.json", "{}\n")
        record = self.exporter.confirm()
        receipt = self.root / "export-receipt.json"
        self.assertTrue(receipt.is_file())
        self.assertEqual(record.receipt_path, "export-receipt.json")
        reloaded = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual(reloaded["status"], "CONFIRMED")
        self.assertIn("artifacts", reloaded)

    def test_written_text_is_redacted_on_the_way_out(self):
        secret = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"
        self.exporter.write_text("logs/runner.log", f"key {secret}\n")
        written = (self.root / "logs" / "runner.log").read_text(encoding="utf-8")
        self.assertNotIn(secret, written)

    def test_written_structures_are_redacted_on_the_way_out(self):
        self.exporter.write_json("auth-receipt.json", {"token": "hunterhunterhunter"})
        written = (self.root / "auth-receipt.json").read_text(encoding="utf-8")
        self.assertNotIn("hunterhunterhunter", written)

    def test_a_path_escaping_the_run_directory_is_refused(self):
        with self.assertRaises(export.ExportError):
            self.exporter.write_text("../escape.txt", "x")

    def test_an_absolute_path_is_refused(self):
        with self.assertRaises(export.ExportError):
            self.exporter.write_text("/etc/passwd", "x")

    def test_an_adopted_tree_is_copied_and_described(self):
        source = Path(self._tmp.name) / "source"
        (source / "nested").mkdir(parents=True)
        (source / "nested" / "evidence.txt").write_text("marker\n", encoding="utf-8")
        self.exporter.adopt_tree("task-artifact", source, required=True)
        record = self.exporter.confirm()
        self.assertEqual(record.status, status.ExportStatus.CONFIRMED)
        self.assertTrue(
            (self.root / "task-artifact" / "nested" / "evidence.txt").is_file()
        )
        self.assertTrue(
            any(entry["path"].startswith("task-artifact/") for entry in record.artifacts)
        )

    def test_adopting_an_absent_tree_is_reported_rather_than_raised(self):
        self.exporter.write_text("run.json", "{}\n")
        self.exporter.adopt_tree("task-artifact", Path("/nonexistent"), required=True)
        record = self.exporter.confirm()
        self.assertNotEqual(record.status, status.ExportStatus.CONFIRMED)
