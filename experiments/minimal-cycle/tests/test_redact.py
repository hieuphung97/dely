"""Redaction is by shape, so a secret the runner has never seen is still caught."""

import json
import unittest

from cycle_runner import redact

NEVER_SEEN = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"


class PatternRedactionTest(unittest.TestCase):
    def test_token_never_seen_before_is_redacted(self):
        line = f"launching worker with key {NEVER_SEEN} now"
        cleaned = redact.text(line)
        self.assertNotIn(NEVER_SEEN, cleaned)
        self.assertIn("launching worker with key", cleaned)
        self.assertIn("now", cleaned)

    def test_forge_and_chat_tokens_are_redacted(self):
        samples = [
            "ghp_qwertyuiopasdfghjklzxcvbnmqwertyui",
            "gho_qwertyuiopasdfghjklzxcvbnmqwertyui",
            "github_pat_qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcv",
            "xoxb-qwerty-asdfgh-zxcvbnmqwertyuiopasdfg",
            "xoxp-qwerty-asdfgh-zxcvbnmqwertyuiopasdfg",
        ]
        for sample in samples:
            with self.subTest(sample=sample[:8]):
                self.assertNotIn(sample, redact.text(f"value {sample} trailing"))

    def test_bearer_header_value_is_redacted_but_the_header_name_survives(self):
        cleaned = redact.text("authorization: Bearer abcdefghijklmnopqrstuvwxyz")
        self.assertNotIn("abcdefghijklmnopqrstuvwxyz", cleaned)
        self.assertIn("authorization", cleaned)

    def test_compact_web_token_is_redacted(self):
        token = "eyjhbgcioijiuzi1nij9.eyjzdwiioiixmjm0nta3odkwin0.qwertyuiopasdfgh"
        self.assertNotIn(token, redact.text(f"cookie value {token}"))

    def test_private_key_block_is_redacted_whole(self):
        block = (
            "-----BEGIN OPENSSH PRIVATE KEY-----\n"
            "qwertyuiopasdfghjklzxcvbnm\n"
            "asdfghjklqwertyuiopzxcvbnm\n"
            "-----END OPENSSH PRIVATE KEY-----"
        )
        cleaned = redact.text(f"before\n{block}\nafter")
        self.assertNotIn("qwertyuiopasdfghjklzxcvbnm", cleaned)
        self.assertIn("before", cleaned)
        self.assertIn("after", cleaned)

    def test_sensitive_assignments_are_redacted_in_every_common_spelling(self):
        samples = [
            "anthropic_api_key=hunterhunterhunter",
            "CLAUDE_CODE_OAUTH_TOKEN=hunterhunterhunter",
            'password: "hunterhunterhunter"',
            '"secret": "hunterhunterhunter"',
            "Cookie=hunterhunterhunter",
        ]
        for sample in samples:
            with self.subTest(sample=sample.split("=")[0][:12]):
                self.assertNotIn("hunterhunterhunter", redact.text(sample))

    def test_absolute_credential_paths_are_redacted(self):
        line = "reading /home/someone/.claude/.credentials.json for the run"
        cleaned = redact.text(line)
        self.assertNotIn("/home/someone", cleaned)
        self.assertIn("reading", cleaned)

    def test_relative_allowlist_entries_are_left_readable(self):
        cleaned = redact.text("allowlist entry .claude/.credentials.json")
        self.assertIn(".claude/.credentials.json", cleaned)

    def test_ordinary_text_is_untouched(self):
        line = "the worker reported a token budget of two hundred and one units"
        self.assertEqual(redact.text(line), line)

    def test_redaction_is_idempotent(self):
        once = redact.text(f"key {NEVER_SEEN}")
        self.assertEqual(redact.text(once), once)

    def test_bytes_are_redacted_without_decoding_errors(self):
        raw = ("prefix " + NEVER_SEEN).encode("utf-8") + b"\xff\xfe tail"
        cleaned = redact.data(raw)
        self.assertNotIn(NEVER_SEEN.encode("utf-8"), cleaned)
        self.assertIn(b"prefix", cleaned)


class StructureRedactionTest(unittest.TestCase):
    def test_nested_structures_are_redacted_by_key_and_by_shape(self):
        document = {
            "auth": {"mode": "short_lived_token", "token": "hunterhunterhunter"},
            "argv": ["orca", "--model", "pinned", "--header", f"Bearer {NEVER_SEEN}"],
            "notes": ["nothing secret here"],
            "count": 3,
        }
        cleaned = redact.structure(document)
        serialized = json.dumps(cleaned)
        self.assertNotIn("hunterhunterhunter", serialized)
        self.assertNotIn(NEVER_SEEN, serialized)
        self.assertEqual(cleaned["auth"]["mode"], "short_lived_token")
        self.assertEqual(cleaned["notes"], ["nothing secret here"])
        self.assertEqual(cleaned["count"], 3)

    def test_structure_redaction_does_not_mutate_its_input(self):
        document = {"token": "hunterhunterhunter"}
        redact.structure(document)
        self.assertEqual(document["token"], "hunterhunterhunter")

    def test_known_values_are_redacted_even_when_their_shape_is_dull(self):
        cleaned = redact.text("the value is plain", extra_values=["plain"])
        self.assertNotIn("plain", cleaned)


class ContainsSecretTest(unittest.TestCase):
    def test_a_clean_document_reports_secret_free(self):
        self.assertTrue(redact.looks_secret_free("mode existing_login reference host"))

    def test_a_document_carrying_a_token_is_not_secret_free(self):
        self.assertFalse(redact.looks_secret_free(f"key {NEVER_SEEN}"))


class CredentialShapeTest(unittest.TestCase):
    """A narrower question than redaction: does this text carry a value?"""

    def test_a_token_is_a_credential_shape(self):
        self.assertTrue(redact.carries_credential_shape(f"key {NEVER_SEEN}"))

    def test_a_private_key_block_is_a_credential_shape(self):
        block = (
            "-----BEGIN OPENSSH PRIVATE KEY-----\n"
            "qwertyuiopasdfghjklzxcvbnm\n"
            "-----END OPENSSH PRIVATE KEY-----"
        )
        self.assertTrue(redact.carries_credential_shape(block))

    def test_a_variable_name_is_not_a_credential_shape(self):
        self.assertFalse(
            redact.carries_credential_shape("token_env: CLAUDE_CODE_OAUTH_TOKEN")
        )

    def test_a_bearer_header_is_a_credential_shape(self):
        self.assertTrue(
            redact.carries_credential_shape("authorization: Bearer abcdefghijklmnop")
        )

    def test_ordinary_configuration_text_is_not_a_credential_shape(self):
        self.assertFalse(
            redact.carries_credential_shape("mode: existing_login\nreference: workshop")
        )
