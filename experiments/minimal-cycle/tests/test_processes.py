"""Removing the container is not ending what the run started inside it."""

import unittest

from cycle_runner import processes

RUN_PATH = "/var/tmp/dely-cycle/state/20260915T000000Z-aaaaaa-00000001"


def process(pid, command):
    return processes.Process(pid=pid, command=command)


class Table:
    """A stand-in process table that a signal really changes."""

    def __init__(self, rows, stubborn=()):
        self.rows = list(rows)
        self.stubborn = set(stubborn)
        self.signalled = []

    def lister(self):
        return list(self.rows)

    def signaller(self, pid, number):
        self.signalled.append((pid, number))
        if pid in self.stubborn and number != 9:
            return
        self.rows = [row for row in self.rows if row.pid != pid]


class SurveyTest(unittest.TestCase):
    def setUp(self):
        self.slept = []

    def run_survey(self, table, **options):
        return processes.survey_and_stop(
            [RUN_PATH],
            lister=table.lister,
            signaller=table.signaller,
            sleeper=self.slept.append,
            **options,
        )

    def test_a_process_holding_this_runs_path_is_found_and_stopped(self):
        table = Table([
            process(101, f"/opt/Orca/orca-ide --user-data-dir={RUN_PATH}/home/.config/orca"),
            process(102, "/opt/Orca/orca-ide --user-data-dir=/home/someone/.config/orca"),
        ])
        report = self.run_survey(table)
        self.assertEqual(report.found, [101])
        self.assertEqual(report.stopped, [101])
        self.assertTrue(report.clean)

    def test_the_operators_own_application_is_never_touched(self):
        table = Table([
            process(201, "/opt/Orca/orca-ide --user-data-dir=/home/someone/.config/orca"),
            process(202, "/opt/Orca/orca-ide"),
        ])
        report = self.run_survey(table)
        self.assertEqual(report.found, [])
        self.assertEqual(table.signalled, [])
        self.assertIn("no process", report.detail)

    def test_a_process_that_ignores_the_first_signal_is_killed(self):
        table = Table([process(301, f"bash --rcfile {RUN_PATH}/home/.bashrc")], stubborn={301})
        report = self.run_survey(table)
        self.assertEqual([number for _pid, number in table.signalled], [15, 9])
        self.assertTrue(report.clean)

    def test_a_process_that_will_not_stop_is_reported_as_surviving(self):
        class Unkillable(Table):
            def signaller(self, pid, number):
                self.signalled.append((pid, number))

        table = Unkillable([process(401, f"orca-ide --user-data-dir={RUN_PATH}/x")])
        report = self.run_survey(table)
        self.assertEqual(report.surviving, [401])
        self.assertFalse(report.clean)
        self.assertIn("would not stop", report.detail)

    def test_the_survey_never_signals_the_runner_itself(self):
        import os

        table = Table([process(os.getpid(), f"python3 run-cycle {RUN_PATH}")])
        report = self.run_survey(table)
        self.assertEqual(report.found, [])
        self.assertEqual(table.signalled, [])

    def test_an_empty_path_list_surveys_nothing(self):
        table = Table([process(501, f"orca-ide {RUN_PATH}")])
        report = processes.survey_and_stop(
            [""], lister=table.lister, signaller=table.signaller, sleeper=self.slept.append
        )
        self.assertEqual(report.found, [])
        self.assertEqual(table.signalled, [])


if __name__ == "__main__":
    unittest.main()


class ParentWithoutAMarkerTest(unittest.TestCase):
    """The application this runner starts names no path in its own argv."""

    def setUp(self):
        self.slept = []

    def table(self):
        return Table([
            # As it really appears: the parent names nothing, the children do.
            process(900, "/opt/Orca/orca-ide --disable-gpu"),
            process(901, f"/opt/Orca/orca-ide --type=gpu-process --user-data-dir={RUN_PATH}/home/.config/orca"),
            process(902, "/opt/Orca/orca-ide parcel-watcher-process-entry.js"),
            process(999, "/opt/Orca/orca-ide"),
        ])

    def test_a_parent_that_names_nothing_is_left_when_only_argv_is_read(self):
        table = self.table()
        found = processes.holding([RUN_PATH], lister=table.lister)
        self.assertEqual([p.pid for p in found], [901])

    def test_its_home_ties_it_to_the_run(self):
        table = Table([
            processes.Process(
                pid=900,
                command="/opt/Orca/orca-ide --disable-gpu",
                home=f"{RUN_PATH}/home",
            ),
            processes.Process(pid=999, command="/opt/Orca/orca-ide", home="/home/someone"),
        ])
        found = processes.holding([RUN_PATH], lister=table.lister)
        self.assertEqual([p.pid for p in found], [900])

    def test_a_recorded_identifier_takes_its_whole_tree(self):
        table = Table([
            processes.Process(pid=900, command="/opt/Orca/orca-ide --disable-gpu", parent=1),
            processes.Process(pid=901, command="helper", parent=900),
            processes.Process(pid=902, command="helper of a helper", parent=901),
            processes.Process(pid=999, command="/opt/Orca/orca-ide", parent=1),
        ])
        found = processes.holding([], lister=table.lister, roots=[900])
        self.assertEqual([p.pid for p in found], [900, 901, 902])

    def test_no_recorded_identifier_means_no_tree_is_taken(self):
        table = Table([
            processes.Process(pid=900, command="/opt/Orca/orca-ide --disable-gpu", parent=1),
            processes.Process(pid=901, command="helper", parent=900),
        ])
        self.assertEqual(processes.holding([], lister=table.lister), [])

    def test_the_runner_is_never_a_root(self):
        import os

        table = Table([
            processes.Process(pid=os.getpid(), command="the runner", parent=1),
            processes.Process(pid=2, command="a child of the runner", parent=os.getpid()),
        ])
        self.assertEqual(processes.holding([], lister=table.lister, roots=[os.getpid()]), [])
