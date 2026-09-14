"""Digests are how an export receipt proves the host holds the bytes."""

import tempfile
import unittest
from pathlib import Path

from cycle_runner import hashing


class DigestFileTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def test_digest_reports_size_and_content_digest(self):
        target = self.root / "artifact.txt"
        target.write_bytes(b"marker")
        described = hashing.describe_file(target, relative_to=self.root)
        self.assertEqual(described["path"], "artifact.txt")
        self.assertEqual(described["size_bytes"], 6)
        self.assertEqual(len(described["sha256"]), 64)

    def test_an_empty_file_still_describes(self):
        target = self.root / "empty.txt"
        target.write_bytes(b"")
        described = hashing.describe_file(target, relative_to=self.root)
        self.assertEqual(described["size_bytes"], 0)

    def test_changing_one_byte_changes_the_digest(self):
        target = self.root / "artifact.txt"
        target.write_bytes(b"marker")
        before = hashing.describe_file(target, relative_to=self.root)["sha256"]
        target.write_bytes(b"markeR")
        after = hashing.describe_file(target, relative_to=self.root)["sha256"]
        self.assertNotEqual(before, after)

    def test_a_missing_file_raises_rather_than_reporting_zero(self):
        with self.assertRaises(FileNotFoundError):
            hashing.describe_file(self.root / "absent", relative_to=self.root)

    def test_paths_are_reported_with_forward_slashes(self):
        nested = self.root / "logs" / "runner.log"
        nested.parent.mkdir()
        nested.write_bytes(b"line")
        described = hashing.describe_file(nested, relative_to=self.root)
        self.assertEqual(described["path"], "logs/runner.log")


class DescribeTreeTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def test_a_tree_is_described_in_a_stable_order(self):
        (self.root / "b.txt").write_bytes(b"two")
        (self.root / "a.txt").write_bytes(b"one")
        (self.root / "nested").mkdir()
        (self.root / "nested" / "c.txt").write_bytes(b"three")
        described = hashing.describe_tree(self.root)
        self.assertEqual(
            [entry["path"] for entry in described],
            ["a.txt", "b.txt", "nested/c.txt"],
        )

    def test_an_absent_tree_describes_as_empty(self):
        self.assertEqual(hashing.describe_tree(self.root / "absent"), [])
