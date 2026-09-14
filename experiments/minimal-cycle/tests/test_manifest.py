"""The manifest is the run's durable record and it validates against the schema."""

import json
import unittest
from pathlib import Path

from cycle_runner import manifest, result, status
from tests.test_config import minimal_document

from cycle_runner import config as config_module

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema.json"


def blocked():
    return result.blocked_result(
        run_id="20260914T221530Z-abc123-0123abcd",
        backend="distrobox",
        tested_revision="rev",
        dely_revision="rev",
        reason="no orca inside the environment",
    )


def built(run_result=None, **overrides):
    arguments = {
        "run_result": run_result or blocked(),
        "run_config": config_module.from_document(minimal_document()),
        "host_before": {"hostname_digest": "abc", "processes": 1},
        "host_after": {"hostname_digest": "abc", "processes": 1},
        "artifacts": [{"path": "manifest.json", "size_bytes": 2, "sha256": "0" * 64}],
        "tool_versions": {"runner": "one", "distrobox": "1.8.2.5"},
        "generated_at": "2026-09-14T22:16:00Z",
    }
    arguments.update(overrides)
    return manifest.build(**arguments)


class SchemaTest(unittest.TestCase):
    def test_the_schema_file_parses(self):
        json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    def test_every_required_field_the_schema_names_is_produced_by_the_builder(self):
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        document = built()
        for name in schema["required"]:
            self.assertIn(name, document, f"builder does not produce {name}")


class ValidationTest(unittest.TestCase):
    def test_a_built_manifest_validates(self):
        manifest.validate(built())

    def test_a_blocked_run_still_validates_with_every_block_present(self):
        document = built()
        self.assertEqual(document["status"], "BLOCKED")
        self.assertEqual(document["cleanup"]["status"], "RESIDUE")
        self.assertEqual(document["check"]["status"], "SKIPPED")
        manifest.validate(document)

    def test_a_missing_required_field_is_named(self):
        document = built()
        document.pop("cleanup")
        with self.assertRaises(manifest.ManifestError) as caught:
            manifest.validate(document)
        self.assertIn("cleanup", str(caught.exception))

    def test_a_missing_nested_required_field_is_named_with_its_path(self):
        document = built()
        document["cleanup"].pop("verified")
        with self.assertRaises(manifest.ManifestError) as caught:
            manifest.validate(document)
        self.assertIn("cleanup.verified", str(caught.exception))

    def test_a_wrong_type_is_refused(self):
        document = built()
        document["timeout_seconds"] = "nine hundred"
        with self.assertRaises(manifest.ManifestError) as caught:
            manifest.validate(document)
        self.assertIn("timeout_seconds", str(caught.exception))

    def test_a_status_outside_the_closed_set_is_refused(self):
        document = built()
        document["status"] = "MOSTLY_FINE"
        with self.assertRaises(manifest.ManifestError) as caught:
            manifest.validate(document)
        self.assertIn("status", str(caught.exception))

    def test_a_run_identifier_of_the_wrong_shape_is_refused(self):
        document = built()
        document["run_id"] = "yesterdays-run"
        with self.assertRaises(manifest.ManifestError) as caught:
            manifest.validate(document)
        self.assertIn("run_id", str(caught.exception))

    def test_an_artifact_without_a_digest_is_refused(self):
        document = built()
        document["artifacts"][0].pop("sha256")
        with self.assertRaises(manifest.ManifestError) as caught:
            manifest.validate(document)
        self.assertIn("sha256", str(caught.exception))

    def test_validation_reports_every_problem_it_found(self):
        document = built()
        document.pop("cleanup")
        document.pop("export")
        with self.assertRaises(manifest.ManifestError) as caught:
            manifest.validate(document)
        message = str(caught.exception)
        self.assertIn("cleanup", message)
        self.assertIn("export", message)


class RedactionTest(unittest.TestCase):
    def test_the_manifest_is_redacted_before_it_is_returned(self):
        run_result = blocked()
        run_result.failure_classification = (
            "worker refused key sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopas"
        )
        document = built(run_result=run_result)
        self.assertNotIn("zzqwertyuiopasdfghjklzxcvbnm", json.dumps(document))

    def test_the_configuration_echo_carries_no_credential(self):
        document = built()
        self.assertIn("config", document)
        self.assertNotIn("/home/someone/.claude", json.dumps(document["config"]))


class WriteTest(unittest.TestCase):
    def test_writing_validates_before_it_touches_the_disk(self):
        import tempfile

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "manifest.json"
            document = built()
            document.pop("cleanup")
            with self.assertRaises(manifest.ManifestError):
                manifest.write(document, target)
            self.assertFalse(target.exists())

    def test_a_valid_manifest_is_written_as_indented_json(self):
        import tempfile

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "manifest.json"
            manifest.write(built(), target)
            reloaded = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(reloaded["backend"], "distrobox")
            self.assertIn("\n  ", target.read_text(encoding="utf-8"))
