"""The run configuration is explicit, backend-aware, and never carries a secret."""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from cycle_runner import config


def minimal_document(**overrides):
    document = {
        "backend": "distrobox",
        "tested_revision": "6688d475413f80c862e131f1ebc93cf27a5fc830",
        "dely_revision": "6688d475413f80c862e131f1ebc93cf27a5fc830",
        "claude_code_version": "pinned-by-the-operator",
        "timeout_seconds": 900,
        "artifact_root": "/var/tmp/cycle-artifacts",
        "state_root": "/var/tmp/cycle-state",
        "project": {
            "source": "/home/someone/code/under-test",
            "revision": "main",
            "environment_path": "project",
        },
        "task": {"marker": "dely-cycle-marker", "relative_path": "evidence.txt"},
        "check": {"relative_path": "evidence.txt"},
        "auth": {
            "mode": "existing_login",
            "reference": "workshop-host-login",
            "allowlist": [".claude/.credentials.json"],
        },
        "orca": {
            "version": "1.4.201",
            "model": "pinned-model",
            "effort": "high",
            "agent": "claude",
        },
        "distrobox": {
            "image": "docker.io/library/ubuntu:24.04",
            "container_prefix": "dely-cycle",
        },
    }
    document.update(overrides)
    return document


class LoadTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def write(self, document, name="config.json"):
        path = self.root / name
        path.write_text(json.dumps(document), encoding="utf-8")
        return path

    def test_a_valid_document_loads_into_a_typed_configuration(self):
        loaded = config.load(self.write(minimal_document()))
        self.assertEqual(loaded.backend, "distrobox")
        self.assertEqual(loaded.timeout_seconds, 900)
        self.assertEqual(loaded.artifact_root, Path("/var/tmp/cycle-artifacts"))
        self.assertEqual(loaded.project.environment_path, "project")
        self.assertEqual(loaded.distrobox.image, "docker.io/library/ubuntu:24.04")
        self.assertIsNone(loaded.vm)

    def test_yaml_is_accepted_when_the_parser_is_available(self):
        try:
            import yaml
        except ImportError:  # pragma: no cover - environment dependent
            self.skipTest("no yaml parser on this host")
        path = self.root / "config.yaml"
        path.write_text(yaml.safe_dump(minimal_document()), encoding="utf-8")
        self.assertEqual(config.load(path).backend, "distrobox")

    def test_yaml_without_a_parser_names_the_json_alternative(self):
        path = self.root / "config.yaml"
        path.write_text("backend: distrobox\n", encoding="utf-8")
        with self.assertRaises(config.ConfigError) as caught:
            config.load(path, yaml_module=None)
        self.assertIn("json", str(caught.exception).lower())

    def test_the_check_marker_defaults_to_the_task_marker(self):
        loaded = config.load(self.write(minimal_document()))
        self.assertEqual(loaded.check.expected_marker, "dely-cycle-marker")

    def test_an_explicit_check_marker_is_kept(self):
        document = minimal_document()
        document["check"]["expected_marker"] = "a-different-marker"
        loaded = config.load(self.write(document))
        self.assertEqual(loaded.check.expected_marker, "a-different-marker")


class RejectionTest(unittest.TestCase):
    def assert_rejected(self, document, needle):
        with self.assertRaises(config.ConfigError) as caught:
            config.from_document(document)
        self.assertIn(needle, str(caught.exception))

    def test_an_unknown_backend_is_refused(self):
        self.assert_rejected(minimal_document(backend="kubernetes"), "backend")

    def test_the_selected_backend_needs_its_own_section(self):
        document = minimal_document(backend="vm")
        document.pop("distrobox")
        self.assert_rejected(document, "vm")

    def test_an_unknown_top_level_key_is_refused(self):
        self.assert_rejected(minimal_document(harbor={}), "harbor")

    def test_an_unknown_nested_key_is_refused(self):
        document = minimal_document()
        document["orca"]["sandbox"] = "none"
        self.assert_rejected(document, "sandbox")

    def test_a_non_positive_timeout_is_refused(self):
        self.assert_rejected(minimal_document(timeout_seconds=0), "timeout_seconds")

    def test_a_relative_artifact_root_is_refused(self):
        self.assert_rejected(minimal_document(artifact_root="results"), "absolute")

    def test_an_artifact_root_inside_the_per_run_state_is_refused(self):
        document = minimal_document(
            artifact_root="/var/tmp/cycle-state/results",
            state_root="/var/tmp/cycle-state",
        )
        self.assert_rejected(document, "artifact_root")

    def test_a_state_root_inside_the_artifact_root_is_refused(self):
        document = minimal_document(
            artifact_root="/var/tmp/results",
            state_root="/var/tmp/results/state",
        )
        self.assert_rejected(document, "state_root")

    def test_an_unknown_auth_mode_is_refused(self):
        document = minimal_document()
        document["auth"]["mode"] = "whatever-works"
        self.assert_rejected(document, "mode")

    def test_an_absolute_allowlist_entry_is_refused(self):
        document = minimal_document()
        document["auth"]["allowlist"] = ["/etc/hosts"]
        self.assert_rejected(document, "relative")

    def test_an_escaping_allowlist_entry_is_refused(self):
        document = minimal_document()
        document["auth"]["allowlist"] = ["../settings.json"]
        self.assert_rejected(document, "relative")

    def test_an_absolute_credential_path_is_refused_before_anything_else(self):
        document = minimal_document()
        document["auth"]["allowlist"] = ["/home/someone/.claude/.credentials.json"]
        self.assert_rejected(document, "secret")

    def test_an_allowlist_outside_the_existing_login_mode_is_refused(self):
        document = minimal_document()
        document["auth"] = {
            "mode": "short_lived_token",
            "reference": "workshop-token",
            "allowlist": [".claude/.credentials.json"],
            "token_env": "CLAUDE_CODE_OAUTH_TOKEN",
        }
        self.assert_rejected(document, "allowlist")

    def test_a_short_lived_token_mode_needs_the_variable_name(self):
        document = minimal_document()
        document["auth"] = {"mode": "short_lived_token", "reference": "workshop"}
        self.assert_rejected(document, "token_env")

    def test_a_helper_mode_needs_the_helper_argv(self):
        document = minimal_document()
        document["auth"] = {"mode": "api_key_helper", "reference": "workshop"}
        self.assert_rejected(document, "helper_argv")

    def test_an_escaping_task_path_is_refused(self):
        document = minimal_document()
        document["task"]["relative_path"] = "../evidence.txt"
        self.assert_rejected(document, "relative")

    def test_a_missing_required_field_is_named(self):
        document = minimal_document()
        document.pop("tested_revision")
        self.assert_rejected(document, "tested_revision")


class SecretRefusalTest(unittest.TestCase):
    def assert_rejected(self, document, needle):
        with self.assertRaises(config.ConfigError) as caught:
            config.from_document(document)
        self.assertIn(needle, str(caught.exception))

    def test_a_key_that_names_a_secret_is_refused(self):
        document = minimal_document()
        document["auth"]["token"] = "irrelevant"
        self.assert_rejected(document, "token")

    def test_a_secret_shaped_value_under_a_dull_key_is_refused(self):
        document = minimal_document()
        document["orca"]["model"] = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyui"
        self.assert_rejected(document, "secret")

    def test_the_variable_name_for_a_token_is_allowed_because_it_is_a_name(self):
        document = minimal_document()
        document["auth"] = {
            "mode": "short_lived_token",
            "reference": "workshop-token",
            "token_env": "CLAUDE_CODE_OAUTH_TOKEN",
        }
        loaded = config.from_document(document)
        self.assertEqual(loaded.auth.token_env, "CLAUDE_CODE_OAUTH_TOKEN")


class DocumentRoundTripTest(unittest.TestCase):
    def test_the_configuration_renders_back_to_a_json_shaped_document(self):
        document = minimal_document()
        loaded = config.from_document(copy.deepcopy(document))
        rendered = loaded.to_document()
        self.assertEqual(rendered["backend"], "distrobox")
        self.assertEqual(rendered["auth"]["mode"], "existing_login")
        json.dumps(rendered)

    def test_the_rendered_document_reloads_unchanged(self):
        loaded = config.from_document(minimal_document())
        reloaded = config.from_document(loaded.to_document())
        self.assertEqual(reloaded.to_document(), loaded.to_document())
