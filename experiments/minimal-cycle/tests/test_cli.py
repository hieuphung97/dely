"""One command runs the cycle, reports it, and exits with the mapped code."""

import io
import json
import tempfile
import unittest
from pathlib import Path

from cycle_runner import cli, status
from tests.test_config import minimal_document
from tests.test_lifecycle import make_source_repo


class CliTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.repo = make_source_repo(self.root / "src")
        self.addCleanup(self._tmp.cleanup)

    def write_config(self, **overrides):
        document = minimal_document()
        document["artifact_root"] = str(self.root / "artifacts")
        document["state_root"] = str(self.root / "state")
        document["project"]["source"] = str(self.repo)
        document["project"]["revision"] = "main"
        document.update(overrides)
        path = self.root / "config.json"
        path.write_text(json.dumps(document), encoding="utf-8")
        return path

    def invoke(self, arguments):
        out, err = io.StringIO(), io.StringIO()
        code = cli.main(arguments, stdout=out, stderr=err)
        return code, out.getvalue(), err.getvalue()


class PreflightCommandTest(CliTestCase):
    def test_preflight_prints_every_finding(self):
        code, out, _ = self.invoke(["preflight", "--config", str(self.write_config())])
        self.assertIn("distrobox on the path", out)
        self.assertIn("container manager on the path", out)
        self.assertIn(
            code, {0, status.exit_code(status.RunStatus.BLOCKED)}, out
        )

    def test_preflight_reports_machine_readable_findings(self):
        code, out, _ = self.invoke(
            ["preflight", "--config", str(self.write_config()), "--json"]
        )
        document = json.loads(out)
        self.assertEqual(document["backend"], "distrobox")
        self.assertIn("findings", document)
        self.assertTrue(all("ok" in finding for finding in document["findings"]))

    def test_a_blocked_backend_exits_with_the_blocked_code(self):
        path = self.write_config(backend="vm")
        document = json.loads(path.read_text(encoding="utf-8"))
        document.pop("distrobox")
        document["vm"] = {
            "provider": "pulumi-libvirt",
            "provider_version": "0.5.3",
            "stack_prefix": "dely-cycle",
            "base_image": str(self.root / "absent.qcow2"),
            "base_image_sha256": "0" * 64,
            "guest_user": "cycle",
            "venv": str(self.root / "absent-venv"),
        }
        path.write_text(json.dumps(document), encoding="utf-8")
        code, out, _ = self.invoke(["preflight", "--config", str(path)])
        self.assertEqual(code, status.exit_code(status.RunStatus.BLOCKED))
        self.assertIn("base image present", out)


class ErrorReportingTest(CliTestCase):
    def test_a_missing_configuration_is_reported_without_a_traceback(self):
        code, _, err = self.invoke(["preflight", "--config", str(self.root / "absent.json")])
        self.assertNotEqual(code, 0)
        self.assertNotIn("Traceback", err)
        self.assertIn("absent.json", err)

    def test_an_invalid_configuration_names_the_field(self):
        path = self.root / "bad.json"
        path.write_text(json.dumps({"backend": "kubernetes"}), encoding="utf-8")
        code, _, err = self.invoke(["preflight", "--config", str(path)])
        self.assertNotEqual(code, 0)
        self.assertIn("backend", err)
        self.assertNotIn("Traceback", err)

    def test_no_subcommand_prints_usage(self):
        code, _, err = self.invoke([])
        self.assertNotEqual(code, 0)
        self.assertIn("usage", err.lower())


class RunCommandTest(CliTestCase):
    def test_a_run_identifier_can_be_pinned_for_a_reproducible_directory(self):
        path = self.write_config()
        code, out, err = self.invoke(
            [
                "run",
                "--config",
                str(path),
                "--run-id",
                "20260914T221530Z-abc123-0123abcd",
            ]
        )
        self.assertTrue(
            (self.root / "artifacts" / "20260914T221530Z-abc123-0123abcd").is_dir(),
            err,
        )
        self.assertIn("20260914T221530Z-abc123-0123abcd", out)

    def test_a_malformed_run_identifier_is_refused(self):
        code, _, err = self.invoke(
            ["run", "--config", str(self.write_config()), "--run-id", "yesterday"]
        )
        self.assertNotEqual(code, 0)
        self.assertIn("run identifier", err)

    def test_the_run_reports_its_status_and_artifact_directory(self):
        code, out, _ = self.invoke(
            [
                "run",
                "--config",
                str(self.write_config()),
                "--run-id",
                "20260914T221531Z-abc123-0123abcd",
            ]
        )
        self.assertIn("status", out.lower())
        self.assertIn("artifacts", out)
        self.assertNotEqual(code, 0)
