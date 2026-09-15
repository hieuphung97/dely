"""The Distrobox adapter declares a fresh box and never reaches for the host home."""

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from cycle_runner import config as config_module, proc, redact
from cycle_runner.adapters import distrobox
from tests.test_config import minimal_document

RUN_ID = "20260914T221530Z-abc123-0123abcd"


#: Passthrough exists so a test can generate a real key pair, and for nothing
#: else. Anything not named here is answered from the table, never run: a stub
#: that runs whatever it is handed runs it on the developer's own machine.
PASSTHROUGH_PROGRAMS = frozenset({"ssh-keygen"})


class StubRunner:
    """Answers commands from a table so the adapter can be tested without podman."""

    def __init__(self, table=None, *, passthrough=False):
        self.table = list(table or [])
        self.passthrough = passthrough
        self.seen: list[tuple[str, ...]] = []
        self.extra_values_seen: list[tuple[str, ...]] = []

    def __call__(self, argv, *, timeout, context, cwd=None, env=None, extra_values=(), stdin_text=None):
        argv = tuple(str(item) for item in argv)
        self.seen.append(argv)
        self.extra_values_seen.append(tuple(extra_values))
        joined = " ".join(argv)
        for needle, code, out, err in self.table:
            if needle in joined:
                return self._outcome(argv, code, out, err, context, extra_values)
        if self.passthrough and Path(argv[0]).name in PASSTHROUGH_PROGRAMS:
            return proc.run(
                argv,
                timeout=timeout,
                context=context,
                cwd=cwd,
                env=env,
                extra_values=extra_values,
                stdin_text=stdin_text,
            )
        return self._outcome(argv, 0, "", "", context, extra_values)

    @staticmethod
    def _outcome(argv, code, out, err, context, extra_values=()):
        # Redact exactly as the real runner does, so a test cannot pass only
        # because the double skipped the step the adapter relies on.
        return proc.CommandOutcome(
            argv=argv,
            exit_code=code,
            stdout=redact.text(out, tuple(extra_values)),
            stderr=redact.text(err, tuple(extra_values)),
            started_at="2026-09-14T22:15:30Z",
            finished_at="2026-09-14T22:15:31Z",
            elapsed_seconds=0.1,
            timed_out=False,
            context=context,
        )


class AdapterTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.host_home = self.root / "hosthome"
        (self.host_home / ".claude").mkdir(parents=True)
        self.addCleanup(self._tmp.cleanup)

    def make(
        self,
        *,
        extra_mounts=(),
        runner=None,
        present=("distrobox", "podman"),
        accept_host_home_mount=False,
        host_home=None,
    ):
        document = minimal_document()
        document["state_root"] = str(self.root / "state")
        document["artifact_root"] = str(self.root / "artifacts")
        document["distrobox"]["extra_mounts"] = list(extra_mounts)
        document["distrobox"]["accept_host_home_mount"] = accept_host_home_mount
        run_config = config_module.from_document(document)
        return distrobox.DistroboxAdapter(
            run_config=run_config,
            run_id=RUN_ID,
            host_home=host_home or self.host_home,
            runner=runner or StubRunner(),
            which=lambda name: f"/usr/bin/{name}" if name in present else None,
        )


class ManifestTest(AdapterTestCase):
    def test_the_manifest_names_the_image_the_home_and_a_distinct_hostname(self):
        adapter = self.make()
        text = adapter.render_manifest()
        self.assertIn(f"[{adapter.container_name}]", text)
        self.assertIn("image=docker.io/library/ubuntu:24.04", text)
        self.assertIn(f"home={adapter.home_path}", text)
        self.assertIn(f"hostname={adapter.container_name}", text)

    def test_the_manifest_disables_the_desktop_entry_and_the_pull(self):
        text = self.make().render_manifest()
        self.assertIn("entry=false", text)
        self.assertIn("pull=false", text)

    def test_the_manifest_never_names_the_host_home(self):
        text = self.make().render_manifest()
        self.assertNotIn(str(self.host_home), text)

    def test_an_ordinary_extra_mount_is_kept(self):
        adapter = self.make(extra_mounts=["/opt/shared:/opt/shared:ro"])
        self.assertIn("volume=/opt/shared:/opt/shared:ro", adapter.render_manifest())

    def test_host_home_mount_is_refused(self):
        with self.assertRaises(distrobox.DistroboxContractError) as caught:
            self.make(extra_mounts=[f"{self.host_home}:{self.host_home}"])
        self.assertIn("home", str(caught.exception))

    def test_a_mount_above_the_host_home_is_refused(self):
        with self.assertRaises(distrobox.DistroboxContractError):
            self.make(extra_mounts=[f"{self.host_home.parent}:/mnt/host"])

    def test_a_credential_directory_mount_is_refused(self):
        with self.assertRaises(distrobox.DistroboxContractError) as caught:
            self.make(extra_mounts=[f"{self.host_home / '.claude'}:/root/.claude"])
        self.assertIn(".claude", str(caught.exception))

    def test_the_manifest_carries_no_unshare_flag_it_was_not_asked_for(self):
        text = self.make().render_manifest()
        self.assertNotIn("unshare", text)


class CommandTest(AdapterTestCase):
    def test_the_enter_argv_is_non_interactive_and_names_the_container(self):
        adapter = self.make()
        argv = adapter.enter_argv(["true"], env_names=())
        self.assertEqual(argv[:2], ["distrobox", "enter"])
        self.assertIn("--name", argv)
        self.assertIn(adapter.container_name, argv)
        self.assertIn("-T", argv)
        self.assertEqual(argv[argv.index("--") + 1 :], ["true"])

    def test_an_environment_overlay_passes_names_not_values(self):
        adapter = self.make()
        argv = adapter.enter_argv(["true"], env_names=("CLAUDE_CODE_OAUTH_TOKEN",))
        flags = argv[argv.index("--additional-flags") + 1]
        self.assertEqual(flags, "--env CLAUDE_CODE_OAUTH_TOKEN")
        self.assertNotIn("=", flags)

    def test_executing_forwards_the_values_through_the_process_environment(self):
        runner = StubRunner()
        adapter = self.make(runner=runner)
        adapter.execute(["true"], timeout=5, env={"CLAUDE_CODE_OAUTH_TOKEN": "value"})
        argv = runner.seen[-1]
        self.assertIn("--env CLAUDE_CODE_OAUTH_TOKEN", argv)
        self.assertNotIn("value", " ".join(argv))

    def test_stop_asks_without_a_prompt_and_verifies(self):
        runner = StubRunner([("ps --filter", 0, "", "")])
        adapter = self.make(runner=runner)
        report = adapter.stop()
        self.assertTrue(any("stop" in " ".join(argv) for argv in runner.seen))
        self.assertTrue(any("--yes" in argv for argv in runner.seen))
        self.assertTrue(report.confirmed)

    def test_a_container_still_running_is_not_a_confirmed_stop(self):
        adapter = self.make()
        runner = StubRunner([("ps --filter", 0, adapter.container_name + "\n", "")])
        adapter = self.make(runner=runner)
        self.assertFalse(adapter.stop().confirmed)


class ResourceTest(AdapterTestCase):
    def test_the_declared_resources_separate_the_run_from_the_image(self):
        adapter = self.make()
        handle = adapter.plan_handle()
        per_run = {str(item) for item in handle.per_run_resources}
        shared = {str(item) for item in handle.shared_resources}
        self.assertIn(f"container:{adapter.container_name}", per_run)
        self.assertIn(f"path:{adapter.run_state}", per_run)
        self.assertEqual(shared, {"image:docker.io/library/ubuntu:24.04"})

    def test_the_project_copy_lives_under_the_per_run_home(self):
        adapter = self.make()
        handle = adapter.plan_handle()
        self.assertTrue(Path(handle.project_path).is_relative_to(Path(handle.home_path)))

    def test_the_declarations_do_not_overlap(self):
        from cycle_runner import cleanup

        handle = self.make().plan_handle()
        cleanup.assert_declarations_disjoint(
            per_run=handle.per_run_resources, shared=handle.shared_resources
        )


class PreflightTest(AdapterTestCase):
    def test_a_missing_distrobox_blocks(self):
        adapter = self.make(present=("podman",))
        report = adapter.preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("distrobox" in finding.name for finding in report.blockers))

    def test_a_missing_container_manager_blocks(self):
        adapter = self.make(present=("distrobox",))
        report = adapter.preflight()
        self.assertFalse(report.ok)
        self.assertTrue(
            any("container manager" in finding.name for finding in report.blockers)
        )

    def test_an_absent_image_blocks_rather_than_pulling_silently(self):
        runner = StubRunner([("image inspect", 1, "", "no such image")])
        adapter = self.make(runner=runner)
        report = adapter.preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("image" in finding.name for finding in report.blockers))

    def test_a_ready_host_passes(self):
        adapter = self.make()
        self.assertTrue(adapter.preflight().ok)


@unittest.skipUnless(shutil.which("distrobox"), "distrobox is not on this host")
class DryRunTest(AdapterTestCase):
    """Distrobox itself is the instrument: the rendered command is the evidence."""

    def make(self, **options):
        options.setdefault("host_home", Path.home())
        options.setdefault("runner", proc.run)
        return super().make(**options)

    def test_the_rendered_manifest_is_accepted_by_distrobox(self):
        adapter = self.make()
        adapter.write_manifest()
        completed = subprocess.run(
            ["distrobox", "assemble", "create", "--dry-run", "--file", str(adapter.manifest_path)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn(adapter.container_name, completed.stdout)
        self.assertIn(f'HOME={adapter.home_path}', completed.stdout)
        self.assertIn(f"{adapter.home_path}:{adapter.home_path}", completed.stdout)

    def test_distrobox_really_does_mount_the_host_home(self):
        """The property the next test blocks on is observed, not assumed."""
        adapter = self.make()
        adapter.write_manifest()
        completed = subprocess.run(
            ["distrobox", "assemble", "create", "--dry-run", "--file", str(adapter.manifest_path)],
            capture_output=True,
            text=True,
        )
        real_home = str(Path.home())
        self.assertIn(f'--volume "{real_home}":"{real_home}"', completed.stdout)

    def test_the_unacknowledged_host_home_mount_blocks_this_host(self):
        adapter = self.make()
        report = adapter.preflight()
        blocker_names = [finding.name for finding in report.blockers]
        self.assertIn("host home reachable from the environment", blocker_names)
        self.assertFalse(report.ok)

    def test_acknowledging_the_mount_records_it_as_a_declared_compromise(self):
        adapter = self.make(accept_host_home_mount=True)
        report = adapter.preflight()
        finding = next(
            item
            for item in report.findings
            if item.name == "host home reachable from the environment"
        )
        self.assertTrue(finding.ok)
        self.assertIn("acknowledged", finding.detail)
        self.assertTrue(report.ok, [item.detail for item in report.blockers])


class PreflightResidueTest(AdapterTestCase):
    """Preflight inspects; it does not create the run's state."""

    def test_preflight_leaves_no_per_run_state_behind(self):
        adapter = self.make()
        adapter.preflight()
        self.assertFalse(
            adapter.run_state.exists(),
            f"preflight created {adapter.run_state}",
        )

    def test_preflight_leaves_no_state_root_entry_behind(self):
        adapter = self.make()
        before = (
            sorted(p.name for p in adapter.config.state_root.iterdir())
            if adapter.config.state_root.is_dir()
            else []
        )
        adapter.preflight()
        after = (
            sorted(p.name for p in adapter.config.state_root.iterdir())
            if adapter.config.state_root.is_dir()
            else []
        )
        self.assertEqual(before, after)


@unittest.skipUnless(shutil.which("distrobox"), "distrobox is not on this host")
class RealPreflightResidueTest(AdapterTestCase):
    """distrobox itself creates the custom home, so only a real run shows this."""

    def make(self, **options):
        options.setdefault("host_home", Path.home())
        options.setdefault("runner", proc.run)
        return super().make(**options)

    def test_a_real_preflight_leaves_no_per_run_state_behind(self):
        adapter = self.make()
        adapter.preflight()
        self.assertFalse(
            adapter.run_state.exists(),
            f"preflight left {adapter.run_state} on the host",
        )

    def test_a_real_preflight_leaves_the_state_root_empty(self):
        adapter = self.make()
        adapter.preflight()
        entries = (
            sorted(p.name for p in adapter.config.state_root.iterdir())
            if adapter.config.state_root.is_dir()
            else []
        )
        self.assertEqual(entries, [])
