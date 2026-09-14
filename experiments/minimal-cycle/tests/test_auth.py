"""Auth reaches the environment by one declared method and leaves no trace."""

import json
import tempfile
import unittest
from pathlib import Path

from cycle_runner import auth, config as config_module, status
from tests.fakes import FakeAdapter
from tests.test_config import minimal_document

TOKEN = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"


def make_config(auth_section):
    document = minimal_document()
    document["auth"] = auth_section
    return config_module.from_document(document)


class ExistingLoginTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.host_home = self.root / "hosthome"
        (self.host_home / ".claude").mkdir(parents=True)
        (self.host_home / ".claude" / ".credentials.json").write_text(
            json.dumps({"token": TOKEN}), encoding="utf-8"
        )
        (self.host_home / ".claude" / "history.jsonl").write_text(
            "not allowlisted\n", encoding="utf-8"
        )
        self.adapter = FakeAdapter(self.root / "run")
        self.handle = self.adapter.create()
        self.config = make_config(
            {
                "mode": "existing_login",
                "reference": "workshop-host-login",
                "allowlist": [".claude/.credentials.json"],
            }
        )
        self.addCleanup(self._tmp.cleanup)

    def bootstrap(self):
        return auth.bootstrap(
            run_config=self.config,
            adapter=self.adapter,
            handle=self.handle,
            host_home=self.host_home,
            environ={},
        )

    def test_the_allowlisted_entry_reaches_the_environment(self):
        record, _ = self.bootstrap()
        self.assertEqual(record.status, status.PhaseStatus.OK)
        copied = Path(self.handle.home_path) / ".claude" / ".credentials.json"
        self.assertTrue(copied.is_file())

    def test_entries_outside_the_allowlist_are_left_on_the_host(self):
        self.bootstrap()
        self.assertFalse(
            (Path(self.handle.home_path) / ".claude" / "history.jsonl").exists()
        )

    def test_the_copied_entry_is_owner_only(self):
        self.bootstrap()
        copied = Path(self.handle.home_path) / ".claude" / ".credentials.json"
        self.assertEqual(copied.stat().st_mode & 0o777, 0o600)

    def test_no_auth_material_in_any_rendered_artifact(self):
        record, overlay = self.bootstrap()
        rendered = json.dumps(record.to_document())
        self.assertNotIn(TOKEN, rendered)
        self.assertNotIn("zzqwertyuiopasdfghjklzxcvbnm", rendered)
        self.assertEqual(overlay, {})

    def test_the_receipt_names_the_method_and_the_relative_entries_only(self):
        record, _ = self.bootstrap()
        self.assertEqual(record.mode, "existing_login")
        self.assertEqual(record.reference, "workshop-host-login")
        self.assertEqual(record.entries, [".claude/.credentials.json"])
        self.assertNotIn(str(self.host_home), json.dumps(record.to_document()))

    def test_a_missing_allowlisted_entry_blocks_the_run(self):
        (self.host_home / ".claude" / ".credentials.json").unlink()
        record, _ = self.bootstrap()
        self.assertEqual(record.status, status.PhaseStatus.BLOCKED)
        self.assertIn(".claude/.credentials.json", record.detail)

    def test_teardown_removes_the_entry_and_verifies_it(self):
        record, _ = self.bootstrap()
        after = auth.teardown(adapter=self.adapter, handle=self.handle, record=record)
        self.assertTrue(after.removed_after_run)
        self.assertFalse(
            (Path(self.handle.home_path) / ".claude" / ".credentials.json").exists()
        )


class ShortLivedTokenTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.adapter = FakeAdapter(self.root / "run")
        self.handle = self.adapter.create()
        self.config = make_config(
            {
                "mode": "short_lived_token",
                "reference": "workshop-token",
                "token_env": "CLAUDE_CODE_OAUTH_TOKEN",
            }
        )
        self.addCleanup(self._tmp.cleanup)

    def test_the_value_travels_in_the_process_environment_only(self):
        record, overlay = auth.bootstrap(
            run_config=self.config,
            adapter=self.adapter,
            handle=self.handle,
            host_home=self.root,
            environ={"CLAUDE_CODE_OAUTH_TOKEN": TOKEN},
        )
        self.assertEqual(record.status, status.PhaseStatus.OK)
        self.assertEqual(overlay, {"CLAUDE_CODE_OAUTH_TOKEN": TOKEN})
        self.assertNotIn("write_file", self.adapter.calls)
        self.assertNotIn(TOKEN, json.dumps(record.to_document()))
        self.assertTrue(record.removed_after_run)

    def test_a_missing_variable_blocks_rather_than_prompting(self):
        record, overlay = auth.bootstrap(
            run_config=self.config,
            adapter=self.adapter,
            handle=self.handle,
            host_home=self.root,
            environ={},
        )
        self.assertEqual(record.status, status.PhaseStatus.BLOCKED)
        self.assertIn("CLAUDE_CODE_OAUTH_TOKEN", record.detail)
        self.assertEqual(overlay, {})

    def test_the_receipt_records_no_length_and_no_prefix(self):
        record, _ = auth.bootstrap(
            run_config=self.config,
            adapter=self.adapter,
            handle=self.handle,
            host_home=self.root,
            environ={"CLAUDE_CODE_OAUTH_TOKEN": TOKEN},
        )
        rendered = json.dumps(record.to_document())
        self.assertNotIn(str(len(TOKEN)), rendered)
        self.assertNotIn(TOKEN[:4], rendered)


class HelperTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.adapter = FakeAdapter(self.root / "run")
        self.handle = self.adapter.create()
        self.config = make_config(
            {
                "mode": "api_key_helper",
                "reference": "workshop-helper",
                "helper_argv": ["/usr/local/bin/fetch-key", "--quiet"],
            }
        )
        self.addCleanup(self._tmp.cleanup)

    def test_the_helper_is_declared_and_no_value_is_passed(self):
        record, overlay = auth.bootstrap(
            run_config=self.config,
            adapter=self.adapter,
            handle=self.handle,
            host_home=self.root,
            environ={},
        )
        self.assertEqual(record.status, status.PhaseStatus.OK)
        self.assertEqual(overlay, {})
        settings = Path(self.handle.home_path) / ".claude" / "settings.json"
        self.assertTrue(settings.is_file())
        self.assertEqual(
            json.loads(settings.read_text(encoding="utf-8"))["apiKeyHelper"],
            "/usr/local/bin/fetch-key --quiet",
        )
