"""Statuses are a closed set and every one maps to exactly one exit code."""

import unittest

from cycle_runner import status


class RunStatusTest(unittest.TestCase):
    def test_the_documented_statuses_all_exist(self):
        names = {member.value for member in status.RunStatus}
        self.assertEqual(
            names,
            {
                "SETTLED",
                "ERROR",
                "TIMEOUT",
                "CANCELLED",
                "CLEANUP_FAILED",
                "UNKNOWN",
                "BLOCKED",
            },
        )

    def test_only_a_settled_run_exits_zero(self):
        for member in status.RunStatus:
            code = status.exit_code(member)
            if member is status.RunStatus.SETTLED:
                self.assertEqual(code, 0)
            else:
                self.assertNotEqual(code, 0)

    def test_every_status_has_a_distinct_exit_code(self):
        codes = [status.exit_code(member) for member in status.RunStatus]
        self.assertEqual(len(codes), len(set(codes)))

    def test_an_unmapped_object_is_refused(self):
        with self.assertRaises(KeyError):
            status.exit_code("SETTLED")


class CleanupStatusTest(unittest.TestCase):
    def test_cleanup_states_are_the_three_the_design_names(self):
        names = {member.value for member in status.CleanupStatus}
        self.assertEqual(names, {"DESTROYED", "RESIDUE", "UNKNOWN"})


class ExportStatusTest(unittest.TestCase):
    def test_export_states_separate_confirmed_from_partial(self):
        names = {member.value for member in status.ExportStatus}
        self.assertEqual(names, {"CONFIRMED", "PARTIAL", "FAILED"})

    def test_only_confirmed_permits_cleanup(self):
        self.assertTrue(status.ExportStatus.CONFIRMED.permits_cleanup)
        self.assertFalse(status.ExportStatus.PARTIAL.permits_cleanup)
        self.assertFalse(status.ExportStatus.FAILED.permits_cleanup)


class PhaseStatusTest(unittest.TestCase):
    def test_phase_states_cover_the_lifecycle_outcomes(self):
        names = {member.value for member in status.PhaseStatus}
        self.assertEqual(names, {"OK", "FAILED", "SKIPPED", "TIMEOUT", "BLOCKED"})
