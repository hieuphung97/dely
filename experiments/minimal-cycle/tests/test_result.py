"""Both adapters settle into one result contract."""

import json
import unittest

from cycle_runner import result, status


def command():
    return result.CommandRecord(
        argv=("sh", "-c", "true"),
        exit_code=0,
        started_at="2026-09-14T22:15:30Z",
        finished_at="2026-09-14T22:15:31Z",
        elapsed_seconds=1.0,
        timed_out=False,
        context="environment",
    )


class CommandRecordTest(unittest.TestCase):
    def test_a_command_records_where_it_ran(self):
        document = command().to_document()
        self.assertEqual(document["context"], "environment")
        self.assertEqual(document["argv"], ["sh", "-c", "true"])
        self.assertFalse(document["timed_out"])

    def test_a_command_context_outside_the_two_the_runner_knows_is_refused(self):
        with self.assertRaises(ValueError):
            result.CommandRecord(
                argv=("true",),
                exit_code=0,
                started_at="2026-09-14T22:15:30Z",
                finished_at="2026-09-14T22:15:31Z",
                elapsed_seconds=1.0,
                timed_out=False,
                context="somewhere",
            )


class RunResultTest(unittest.TestCase):
    def test_a_blocked_result_still_carries_every_block(self):
        blocked = result.blocked_result(
            run_id="20260914T221530Z-abc123-0123abcd",
            backend="distrobox",
            tested_revision="rev",
            dely_revision="rev",
            reason="no orca inside the environment",
        )
        document = blocked.to_document()
        for key in ("identity", "check", "export", "cleanup", "auth", "worker"):
            self.assertIn(key, document)
        self.assertEqual(document["status"], "BLOCKED")
        self.assertEqual(document["failure_classification"], "no orca inside the environment")
        json.dumps(document)

    def test_the_result_serialises_enumerations_as_their_names(self):
        blocked = result.blocked_result(
            run_id="20260914T221530Z-abc123-0123abcd",
            backend="vm",
            tested_revision="rev",
            dely_revision="rev",
            reason="pulumi is absent",
        )
        document = blocked.to_document()
        self.assertEqual(document["cleanup"]["status"], status.CleanupStatus.RESIDUE.value)
        self.assertEqual(document["export"]["status"], status.ExportStatus.FAILED.value)

    def test_phases_keep_the_order_they_ran_in(self):
        record = result.RunResult(
            run_id="20260914T221530Z-abc123-0123abcd",
            backend="distrobox",
            tested_revision="rev",
            dely_revision="rev",
        )
        record.phases.append(result.PhaseRecord(name="prepare", status=status.PhaseStatus.OK))
        record.phases.append(result.PhaseRecord(name="create", status=status.PhaseStatus.OK))
        names = [phase["name"] for phase in record.to_document()["phases"]]
        self.assertEqual(names, ["prepare", "create"])

    def test_a_phase_carries_the_commands_that_produced_it(self):
        phase = result.PhaseRecord(name="check", status=status.PhaseStatus.OK)
        phase.commands.append(command())
        self.assertEqual(phase.to_document()["commands"][0]["exit_code"], 0)
