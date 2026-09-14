"""The run identifier is durable, sortable, and free of anything secret."""

import re
import unittest
from datetime import datetime, timezone

from cycle_runner import ids


class MintRunIdTest(unittest.TestCase):
    def test_run_id_matches_the_documented_shape(self):
        minted = ids.mint_run_id(
            now=datetime(2026, 9, 14, 22, 15, 30, tzinfo=timezone.utc),
            host_name="workshop.example",
        )
        self.assertRegex(minted, r"^20260914T221530Z-[0-9a-f]{6}-[0-9a-f]{8}$")

    def test_run_id_excludes_auth_reference_and_host_name(self):
        minted = ids.mint_run_id(
            now=datetime(2026, 9, 14, 22, 15, 30, tzinfo=timezone.utc),
            host_name="workshop.example",
        )
        self.assertNotIn("workshop", minted)
        self.assertNotIn("example", minted)

    def test_same_host_gives_a_stable_short_segment(self):
        first = ids.mint_run_id(
            now=datetime(2026, 9, 14, 22, 15, 30, tzinfo=timezone.utc),
            host_name="workshop.example",
        )
        second = ids.mint_run_id(
            now=datetime(2026, 9, 14, 22, 15, 31, tzinfo=timezone.utc),
            host_name="workshop.example",
        )
        self.assertEqual(first.split("-")[1], second.split("-")[1])

    def test_run_ids_sort_by_time_and_stay_unique(self):
        early = ids.mint_run_id(
            now=datetime(2026, 9, 14, 22, 15, 30, tzinfo=timezone.utc),
            host_name="workshop.example",
        )
        late = ids.mint_run_id(
            now=datetime(2026, 9, 14, 22, 15, 31, tzinfo=timezone.utc),
            host_name="workshop.example",
        )
        self.assertLess(early, late)
        minted = {
            ids.mint_run_id(
                now=datetime(2026, 9, 14, 22, 15, 30, tzinfo=timezone.utc),
                host_name="workshop.example",
            )
            for _ in range(64)
        }
        self.assertEqual(len(minted), 64)

    def test_naive_timestamps_are_refused(self):
        with self.assertRaises(ValueError):
            ids.mint_run_id(now=datetime(2026, 9, 14, 22, 15, 30), host_name="h")

    def test_run_id_is_safe_as_a_path_segment(self):
        minted = ids.mint_run_id(
            now=datetime(2026, 9, 14, 22, 15, 30, tzinfo=timezone.utc),
            host_name="../../etc",
        )
        self.assertIsNone(re.search(r"[^0-9A-Za-z-]", minted))


class ResourceNameTest(unittest.TestCase):
    def test_resource_name_is_prefixed_and_bounded(self):
        name = ids.resource_name("dely-cycle", "20260914T221530Z-abc123-0123abcd")
        self.assertTrue(name.startswith("dely-cycle-"))
        self.assertLessEqual(len(name), 63)
        self.assertRegex(name, r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")

    def test_resource_name_keeps_runs_distinct(self):
        first = ids.resource_name("dely-cycle", "20260914T221530Z-abc123-0123abcd")
        second = ids.resource_name("dely-cycle", "20260914T221530Z-abc123-0123abce")
        self.assertNotEqual(first, second)
