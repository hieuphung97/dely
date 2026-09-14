"""The machine adapter renders a per-run domain over a base it never writes."""

import hashlib
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from cycle_runner import cleanup, config as config_module, proc
from cycle_runner.adapters import vm
from tests.test_adapter_distrobox import StubRunner
from tests.test_config import minimal_document

RUN_ID = "20260914T221530Z-abc123-0123abcd"
TOKEN = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"


class VmTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.shared = self.root / "shared"
        self.shared.mkdir()
        self.base = self.shared / "tool-image.qcow2"
        self.base.write_bytes(b"pretend this is a prepared tool image")
        self.base_digest = hashlib.sha256(self.base.read_bytes()).hexdigest()
        self.addCleanup(self._tmp.cleanup)

    def make(self, *, runner=None, present=("pulumi", "qemu-img", "virsh", "ssh", "scp"), **overrides):
        document = minimal_document(backend="vm")
        document.pop("distrobox")
        document["state_root"] = str(self.root / "state")
        document["artifact_root"] = str(self.root / "artifacts")
        section = {
            "provider": "pulumi-libvirt",
            "provider_version": "0.5.3",
            "stack_prefix": "dely-cycle",
            "base_image": str(self.base),
            "base_image_sha256": self.base_digest,
            "guest_user": "cycle",
            "provider_schema_verified": True,
        }
        section.update(overrides)
        document["vm"] = section
        run_config = config_module.from_document(document)
        return vm.VmAdapter(
            run_config=run_config,
            run_id=RUN_ID,
            runner=runner or StubRunner(passthrough=True),
            which=lambda name: f"/usr/bin/{name}" if name in present else None,
        )


class SeedTest(VmTestCase):
    def test_the_seed_carries_no_credential(self):
        adapter = self.make()
        adapter.prepare_identity()
        user_data = adapter.render_user_data()
        self.assertNotIn(TOKEN, user_data)
        self.assertNotIn("PRIVATE KEY", user_data)
        self.assertNotIn(adapter.private_key_path.read_text(encoding="utf-8"), user_data)
        self.assertNotIn("password", user_data.lower())

    def test_the_seed_authorises_only_the_per_run_public_key(self):
        adapter = self.make()
        adapter.prepare_identity()
        public_key = adapter.public_key_path.read_text(encoding="utf-8").strip()
        user_data = adapter.render_user_data()
        self.assertIn(public_key, user_data)
        self.assertEqual(user_data.count("ssh-"), user_data.count(public_key.split()[0]))

    def test_the_seed_names_the_run_and_a_distinct_host_name(self):
        adapter = self.make()
        meta = adapter.render_meta_data()
        self.assertIn(RUN_ID.lower(), meta)
        self.assertIn(adapter.domain_name, meta)

    def test_the_private_key_never_leaves_the_per_run_state(self):
        adapter = self.make()
        adapter.prepare_identity()
        self.assertTrue(
            adapter.private_key_path.is_relative_to(adapter.run_state)
        )
        self.assertEqual(adapter.private_key_path.stat().st_mode & 0o777, 0o600)


class OverlayTest(VmTestCase):
    def test_the_overlay_command_names_the_base_as_a_backing_file(self):
        adapter = self.make()
        argv = adapter.overlay_argv()
        self.assertEqual(argv[:3], ["qemu-img", "create", "-f"])
        self.assertIn("-b", argv)
        self.assertEqual(argv[argv.index("-b") + 1], str(self.base))
        self.assertEqual(argv[-2], str(adapter.overlay_path))

    def test_the_base_is_never_the_output_path(self):
        adapter = self.make()
        argv = adapter.overlay_argv()
        self.assertNotEqual(argv[-2], str(self.base))
        self.assertFalse(Path(argv[-2]).is_relative_to(self.shared))

    def test_a_wrong_base_digest_blocks(self):
        adapter = self.make(base_image_sha256="0" * 64)
        report = adapter.preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("digest" in finding.name for finding in report.blockers))

    def test_a_missing_base_blocks(self):
        self.base.unlink()
        adapter = self.make()
        report = adapter.preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("base image" in finding.name for finding in report.blockers))


class ProgramTest(VmTestCase):
    def test_the_rendered_program_is_valid_python(self):
        compile(self.make().render_program(), "__main__.py", "exec")

    def test_the_program_pins_the_provider_version(self):
        adapter = self.make()
        project_file = adapter.render_project()
        self.assertIn("0.5.3", project_file)
        self.assertIn("pulumi-libvirt", project_file)

    def test_the_program_names_the_overlay_the_seed_and_the_graphics(self):
        program = self.make().render_program()
        for needle in ("OVERLAY_PATH", "USER_DATA", "META_DATA", "GRAPHICS"):
            self.assertIn(needle, program)

    def test_the_stack_settings_carry_no_secret(self):
        adapter = self.make()
        settings = adapter.render_stack_settings()
        self.assertNotIn(TOKEN, settings)
        self.assertNotIn("PRIVATE KEY", settings)

    def test_the_program_never_writes_the_base_image(self):
        adapter = self.make()
        program = adapter.render_program()
        self.assertIn(str(adapter.overlay_path), program)
        self.assertNotIn(f'"{self.base}"', program)


class ResourceTest(VmTestCase):
    def test_the_base_image_is_declared_shared_and_stays_out_of_the_destroy_plan(self):
        adapter = self.make()
        handle = adapter.plan_handle()
        per_run = {str(item) for item in handle.per_run_resources}
        shared = {str(item) for item in handle.shared_resources}
        self.assertIn(f"image:{self.base}", shared)
        self.assertNotIn(f"image:{self.base}", per_run)
        for item in per_run:
            self.assertNotIn(str(self.base), item)

    def test_the_declarations_do_not_overlap(self):
        handle = self.make().plan_handle()
        cleanup.assert_declarations_disjoint(
            per_run=handle.per_run_resources, shared=handle.shared_resources
        )

    def test_the_per_run_resources_name_the_domain_the_overlay_and_the_stack(self):
        handle = self.make().plan_handle()
        kinds = {item.kind for item in handle.per_run_resources}
        self.assertEqual(kinds, {"domain", "path"})


class PreflightTest(VmTestCase):
    def test_a_missing_pulumi_blocks(self):
        adapter = self.make(present=("qemu-img", "virsh", "ssh", "scp"))
        report = adapter.preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("pulumi" in finding.name for finding in report.blockers))

    def test_an_unverified_provider_schema_blocks(self):
        adapter = self.make(provider_schema_verified=False)
        report = adapter.preflight()
        self.assertFalse(report.ok)
        self.assertTrue(
            any("provider schema" in finding.name for finding in report.blockers)
        )

    def test_a_missing_hardware_acceleration_device_is_reported(self):
        adapter = self.make()
        report = adapter.preflight()
        names = [finding.name for finding in report.findings]
        self.assertIn("hardware acceleration device", names)

    def test_a_ready_host_passes(self):
        runner = StubRunner([("virsh", 0, " Id   Name   State\n", "")])
        adapter = self.make(runner=runner)
        report = adapter.preflight()
        if Path("/dev/kvm").exists():
            self.assertTrue(report.ok, [item.detail for item in report.blockers])


class TransportTest(VmTestCase):
    def test_the_transport_argv_is_non_interactive_and_uses_the_per_run_key(self):
        adapter = self.make()
        adapter.prepare_identity()
        adapter.address = "192.0.2.10"
        argv = adapter.ssh_argv(["true"])
        self.assertEqual(argv[0], "ssh")
        self.assertIn("BatchMode=yes", " ".join(argv))
        self.assertIn(str(adapter.private_key_path), argv)
        self.assertIn("cycle@192.0.2.10", argv)
        self.assertEqual(argv[-1], "true")

    def test_the_transport_refuses_to_run_before_an_address_is_known(self):
        adapter = self.make()
        with self.assertRaises(vm.VmContractError):
            adapter.ssh_argv(["true"])


@unittest.skipUnless(shutil.which("qemu-img"), "qemu-img is not on this host")
class OverlayIntegrationTest(VmTestCase):
    def test_the_overlay_is_backed_by_the_base_and_the_base_is_unchanged(self):
        base = self.shared / "real-base.qcow2"
        subprocess.run(
            ["qemu-img", "create", "-f", "qcow2", str(base), "16M"],
            check=True,
            capture_output=True,
        )
        before = hashlib.sha256(base.read_bytes()).hexdigest()
        adapter = self.make(
            base_image=str(base),
            base_image_sha256=before,
            runner=proc.run,
        )
        adapter.run_state.mkdir(parents=True, exist_ok=True)
        outcome = proc.run(adapter.overlay_argv(), timeout=120, context="host")
        self.assertEqual(outcome.exit_code, 0, outcome.stderr)
        chain = subprocess.run(
            ["qemu-img", "info", "--backing-chain", str(adapter.overlay_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn(str(base), chain.stdout)
        self.assertEqual(hashlib.sha256(base.read_bytes()).hexdigest(), before)
