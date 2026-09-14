"""The counterexample table has to still apply to the code it describes."""

import unittest

import counterexamples


class TableTest(unittest.TestCase):
    def test_every_counterexample_still_applies_to_the_code(self):
        for case in counterexamples.CASES:
            with self.subTest(case=case.name):
                self.assertTrue(
                    counterexamples.applicable(case),
                    f"{case.name} no longer matches {case.path}",
                )

    def test_every_counterexample_names_at_least_one_instrument(self):
        for case in counterexamples.CASES:
            with self.subTest(case=case.name):
                self.assertTrue(case.instruments)

    def test_every_counterexample_changes_something(self):
        for case in counterexamples.CASES:
            with self.subTest(case=case.name):
                self.assertNotEqual(case.original, case.replacement)

    def test_the_names_are_unique(self):
        names = [case.name for case in counterexamples.CASES]
        self.assertEqual(len(names), len(set(names)))
