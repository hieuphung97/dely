"""A fresh home has never run the agent, and the agent asks before it works."""

import json
import tempfile
import unittest
from pathlib import Path

from cycle_runner import config as config_module, firstrun
from tests.fakes import FakeAdapter
from tests.test_config import minimal_document


def make_config(auth_section=None):
    document = minimal_document()
    if auth_section is not None:
        document["auth"] = auth_section
    return config_module.from_document(document)


class FirstRunStateTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.adapter = FakeAdapter(self.root / "run")
        self.handle = self.adapter.create()
        self.config = make_config()
        self.addCleanup(self._tmp.cleanup)

    def apply(self):
        return firstrun.apply(
            run_config=self.config, adapter=self.adapter, handle=self.handle
        )

    def state(self):
        return json.loads(
            (Path(self.handle.home_path) / firstrun.STATE_RELATIVE).read_text()
        )

    def settings(self):
        return json.loads(
            (Path(self.handle.home_path) / firstrun.SETTINGS_RELATIVE).read_text()
        )

    def test_onboarding_is_answered_so_the_agent_does_not_ask_to_sign_in(self):
        self.apply()
        self.assertTrue(self.state()["hasCompletedOnboarding"])

    def test_the_project_copy_is_trusted_by_its_path_inside_the_environment(self):
        self.apply()
        entry = self.state()["projects"][self.handle.project_path]
        self.assertTrue(entry["hasTrustDialogAccepted"])

    def test_the_external_imports_this_project_declares_are_answered(self):
        self.apply()
        entry = self.state()["projects"][self.handle.project_path]
        self.assertTrue(entry["hasClaudeMdExternalIncludesApproved"])

    def test_the_permission_mode_warning_is_answered_in_the_settings_file(self):
        self.apply()
        self.assertTrue(self.settings()["skipDangerousModePermissionPrompt"])

    def test_the_state_is_written_rather_than_copied_from_the_host(self):
        record = self.apply()
        rendered = json.dumps(self.state()) + json.dumps(record.to_document())
        self.assertNotIn(str(Path.home()), rendered)
        for key in ("oauthAccount", "userID", "machineID", "history"):
            self.assertNotIn(key, rendered)

    def test_the_receipt_names_the_files_and_the_questions_they_answer(self):
        record = self.apply()
        self.assertEqual(
            record.entries, [firstrun.STATE_RELATIVE, firstrun.SETTINGS_RELATIVE]
        )
        self.assertTrue(record.questions)

    def test_an_api_key_helper_keeps_its_settings_entry(self):
        self.config = make_config(
            {
                "mode": "api_key_helper",
                "reference": "workshop-helper",
                "helper_argv": ["/usr/local/bin/key-helper"],
            }
        )
        self.apply()
        settings = self.settings()
        self.assertEqual(settings["apiKeyHelper"], "/usr/local/bin/key-helper")
        self.assertTrue(settings["skipDangerousModePermissionPrompt"])


if __name__ == "__main__":
    unittest.main()
