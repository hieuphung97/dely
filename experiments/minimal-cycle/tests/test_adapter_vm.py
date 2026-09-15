"""The machine adapter declares a per-run domain over a base it never writes."""

import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path

from cycle_runner import cleanup, config as config_module, proc
from cycle_runner.adapters import schema, vm
from tests.test_adapter_distrobox import StubRunner
from tests.test_config import minimal_document

RUN_ID = "20260914T221530Z-abc123-0123abcd"
OTHER_RUN_ID = "20260914T221530Z-abc123-0123abce"
TOKEN = "sk-ant-api-zzqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfgh"

DOMCAPS = """<domainCapabilities>
  <devices>
    <graphics supported='yes'>
      <enum name='type'>
        <value>sdl</value>
        <value>vnc</value>
        <value>egl-headless</value>
      </enum>
    </graphics>
  </devices>
</domainCapabilities>"""

HEALTHY = [
    ("whoami -v", 0, "User: someone\nBackend URL: file://~\n", ""),
    ("domcapabilities", 0, DOMCAPS, ""),
    ("pool-list", 0, "dely-cycle\ndefault\n", ""),
    ("net-list", 0, "default\n", ""),
    ("list --all", 0, "", ""),
]


class VmTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.images = self.root / "images"
        self.images.mkdir()
        self.base = self.images / "tool-image.qcow2"
        self.base.write_bytes(b"pretend this is a prepared ubuntu tool image")
        self.base_digest = hashlib.sha256(self.base.read_bytes()).hexdigest()
        self.venv = self.root / "venv"
        (self.venv / "bin").mkdir(parents=True)
        # A stand-in for the prepared environment: it answers the provider probe
        # with "no problems", so these tests exercise the rest of preflight. The
        # real check runs in ProviderSchemaIntegrationTest against the pinned
        # provider itself.
        (self.venv / "bin" / "python").write_text(
            "#!/bin/sh\ncat > /dev/null\necho '[]'\n", encoding="utf-8"
        )
        (self.venv / "bin" / "python").chmod(0o755)
        self.mute_venv = self.root / "mute-venv"
        (self.mute_venv / "bin").mkdir(parents=True)
        (self.mute_venv / "bin" / "python").write_text(
            "#!/bin/sh\ncat > /dev/null\nexit 0\n", encoding="utf-8"
        )
        (self.mute_venv / "bin" / "python").chmod(0o755)
        self.addCleanup(self._tmp.cleanup)

    def make(self, *, runner=None, run_id=RUN_ID, present=None, **overrides):
        present = present or ("pulumi", "qemu-img", "virsh", "ssh", "scp")
        document = minimal_document(backend="vm")
        document.pop("distrobox")
        document["state_root"] = str(self.root / "state")
        document["artifact_root"] = str(self.root / "artifacts")
        section = {
            "provider": "pulumi-libvirt",
            "provider_version": "0.5.4",
            "stack_prefix": "dely-cycle",
            "base_image": str(self.base),
            "base_image_sha256": self.base_digest,
            "guest_user": "cycle",
            "venv": str(self.venv),
        }
        section.update(overrides)
        document["vm"] = section
        run_config = config_module.from_document(document)
        return vm.VmAdapter(
            run_config=run_config,
            run_id=run_id,
            runner=runner or StubRunner(HEALTHY, passthrough=True),
            which=lambda name: f"/usr/bin/{name}" if name in present else None,
            sleeper=lambda _seconds: None,
        )


class SeedTest(VmTestCase):
    def test_the_seed_carries_no_credential(self):
        adapter = self.make()
        from cycle_runner import redact

        user_data = adapter.render_user_data()
        self.assertFalse(redact.carries_credential_shape(user_data))
        self.assertNotIn(adapter.private_key_path.read_text(encoding="utf-8"), user_data)
        self.assertNotIn("password", user_data.lower())

    def test_the_seed_authorises_only_the_per_run_public_key(self):
        adapter = self.make()
        adapter.prepare_identity()
        public_key = adapter.public_key_path.read_text(encoding="utf-8").strip()
        self.assertIn(public_key, adapter.render_user_data())

    def test_the_seed_names_the_run_and_a_distinct_host_name(self):
        adapter = self.make()
        meta = adapter.render_meta_data()
        self.assertIn(RUN_ID.lower(), meta)
        self.assertIn(adapter.domain_name, meta)

    def test_the_private_key_never_leaves_the_per_run_state(self):
        adapter = self.make()
        adapter.prepare_identity()
        self.assertTrue(adapter.private_key_path.is_relative_to(adapter.run_state))
        self.assertEqual(adapter.private_key_path.stat().st_mode & 0o777, 0o600)


class InterfaceTest(VmTestCase):
    def test_the_two_interfaces_have_distinct_per_run_addresses(self):
        adapter = self.make()
        self.assertNotEqual(adapter.transport_mac, adapter.egress_mac)
        self.assertTrue(adapter.transport_mac.startswith("52:54:00:"))
        self.assertTrue(adapter.egress_mac.startswith("52:54:01:"))

    def test_the_addresses_are_stable_for_a_run_and_differ_between_runs(self):
        first = self.make().transport_mac
        again = self.make().transport_mac
        other = self.make(run_id=OTHER_RUN_ID).transport_mac
        self.assertEqual(first, again)
        self.assertNotEqual(first, other)

    def test_the_transform_adds_a_user_mode_interface_with_that_address(self):
        adapter = self.make()
        transform = adapter.render_egress_xslt()
        self.assertIn('<interface type="user">', transform)
        self.assertIn(adapter.egress_mac, transform)

    def test_the_guest_prefers_the_egress_route(self):
        adapter = self.make()
        config_text = adapter.render_network_config()
        transport_metric = config_text.index("route-metric: 300")
        egress_metric = config_text.index("route-metric: 100")
        self.assertLess(transport_metric, egress_metric)
        self.assertIn(adapter.transport_mac, config_text)
        self.assertIn(adapter.egress_mac, config_text)

    def test_disabling_egress_leaves_only_the_transport_interface(self):
        adapter = self.make(egress=False)
        config_text = adapter.render_network_config()
        self.assertIn(adapter.transport_mac, config_text)
        self.assertNotIn(adapter.egress_mac, config_text)
        self.assertNotIn("route-metric", config_text)


class ProgramTest(VmTestCase):
    def test_the_rendered_program_is_valid_python(self):
        compile(self.make().render_program(), "__main__.py", "exec")

    def test_the_disk_is_the_pool_volume_not_a_file_path(self):
        program = self.make().render_program()
        self.assertIn("DomainDiskArgs(volume_id=overlay.id)", program)
        self.assertNotIn("DomainDiskArgs(file=", program)

    def test_the_overlay_is_backed_by_the_base_volume_in_the_pool(self):
        adapter = self.make()
        program = adapter.render_program()
        self.assertIn("base_volume_name=BASE_VOLUME", program)
        self.assertIn("base_volume_pool=POOL", program)
        self.assertIn(f"BASE_VOLUME = {adapter.settings.base_volume_name!r}", program)

    def test_the_program_never_names_the_base_image_as_an_output(self):
        adapter = self.make()
        program = adapter.render_program()
        self.assertIn("-overlay.qcow2", program)
        self.assertNotIn(f'name={adapter.settings.base_volume_name!r}', program)

    def test_the_project_file_points_at_the_pinned_environment(self):
        adapter = self.make()
        project = adapter.render_project()
        self.assertIn("runtime:", project)
        self.assertIn("name: python", project)
        self.assertIn(f"virtualenv: {self.venv}", project)

    def test_the_stack_settings_carry_no_secret(self):
        from cycle_runner import redact

        self.assertFalse(
            redact.carries_credential_shape(self.make().render_stack_settings())
        )

    def test_the_stack_passphrase_is_never_written_to_a_file(self):
        adapter = self.make()
        adapter.write_declarations()
        for path in sorted(adapter.stack_dir.rglob("*")):
            if path.is_file():
                self.assertNotIn(adapter._passphrase, path.read_text(encoding="utf-8"))

    def test_the_passphrase_reaches_pulumi_only_through_the_environment(self):
        adapter = self.make()
        self.assertEqual(
            adapter._pulumi_environment()["PULUMI_CONFIG_PASSPHRASE"], adapter._passphrase
        )
        self.assertTrue(
            adapter._pulumi_environment()["PULUMI_BACKEND_URL"].startswith("file://")
        )


class ResourceTest(VmTestCase):
    def test_the_base_image_is_shared_and_stays_out_of_the_destroy_plan(self):
        handle = self.make().plan_handle()
        per_run = {str(item) for item in handle.per_run_resources}
        shared = {str(item) for item in handle.shared_resources}
        self.assertIn(f"image:{self.base}", shared)
        for item in per_run:
            self.assertNotIn(str(self.base), item)

    def test_the_per_run_resources_name_the_domain_overlay_seed_and_state(self):
        handle = self.make().plan_handle()
        kinds = sorted(item.kind for item in handle.per_run_resources)
        self.assertEqual(kinds, ["domain", "path", "volume", "volume"])

    def test_the_declarations_do_not_overlap(self):
        handle = self.make().plan_handle()
        cleanup.assert_declarations_disjoint(
            per_run=handle.per_run_resources, shared=handle.shared_resources
        )


class AddressDiscoveryTest(VmTestCase):
    def test_the_address_for_the_transport_interface_is_found(self):
        adapter = self.make()
        lease = (
            " Name       MAC address          Protocol     Address\n"
            "-------------------------------------------------------\n"
            f" vnet0      {self.make().transport_mac}    ipv4         192.168.122.61/24\n"
        )
        adapter.runner = StubRunner([("domifaddr", 0, lease, "")])
        self.assertEqual(adapter.discover_address(timeout=1), "192.168.122.61")

    def test_another_interface_address_is_not_mistaken_for_it(self):
        adapter = self.make()
        lease = " vnet1      52:54:09:aa:bb:cc    ipv4         10.0.2.15/24\n"
        adapter.runner = StubRunner([("domifaddr", 0, lease, "")])
        self.assertIsNone(adapter.discover_address(timeout=0))

    def test_no_address_within_the_deadline_returns_nothing(self):
        adapter = self.make()
        adapter.runner = StubRunner([("domifaddr", 0, "", "")])
        self.assertIsNone(adapter.discover_address(timeout=0))


class PreflightTest(VmTestCase):
    def test_a_ready_host_passes(self):
        adapter = self.make()
        report = adapter.preflight()
        blockers = [f"{f.name}: {f.detail}" for f in report.blockers]
        self.assertTrue(report.ok, blockers)

    def test_a_missing_pulumi_blocks(self):
        report = self.make(present=("qemu-img", "virsh", "ssh", "scp")).preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("pulumi" in f.name for f in report.blockers))

    def test_a_cloud_state_backend_blocks(self):
        runner = StubRunner(
            [("whoami -v", 0, "Backend URL: https://api.pulumi.com\n", "")] + HEALTHY,
            passthrough=True,
        )
        report = self.make(runner=runner).preflight()
        self.assertFalse(report.ok)
        blocker = next(f for f in report.blockers if "state backend" in f.name)
        self.assertIn("pulumi login --local", blocker.detail)

    def test_an_environment_that_cannot_answer_the_probe_blocks(self):
        report = self.make(venv=str(self.mute_venv)).preflight()
        self.assertFalse(report.ok)
        blocker = next(f for f in report.blockers if "provider schema" in f.name)
        self.assertIn("could not be checked", blocker.detail)

    def test_a_missing_pinned_environment_blocks(self):
        report = self.make(venv=str(self.root / "absent-venv")).preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("pinned environment" in f.name for f in report.blockers))

    def test_a_graphics_type_this_emulator_lacks_blocks(self):
        report = self.make(graphics="spice").preflight()
        self.assertFalse(report.ok)
        blocker = next(f for f in report.blockers if "graphics" in f.name)
        self.assertIn("vnc", blocker.detail)

    def test_an_absent_storage_pool_blocks(self):
        runner = StubRunner(
            [("pool-list", 0, "default\n", "")] + HEALTHY, passthrough=True
        )
        report = self.make(runner=runner).preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("storage pool" in f.name for f in report.blockers))

    def test_a_wrong_base_digest_blocks(self):
        report = self.make(base_image_sha256="0" * 64).preflight()
        self.assertFalse(report.ok)
        self.assertTrue(any("digest" in f.name for f in report.blockers))


class TransportTest(VmTestCase):
    def test_the_transport_argv_is_non_interactive_and_uses_the_per_run_key(self):
        adapter = self.make()
        adapter.prepare_identity()
        adapter.address = "192.168.122.61"
        argv = adapter.ssh_argv(["true"])
        self.assertEqual(argv[0], "ssh")
        self.assertIn("BatchMode=yes", " ".join(argv))
        self.assertIn(str(adapter.private_key_path), argv)
        self.assertIn("cycle@192.168.122.61", argv)
        self.assertEqual(argv[-1], "true")

    def test_the_transport_refuses_to_run_before_an_address_is_known(self):
        with self.assertRaises(vm.VmContractError):
            self.make().ssh_argv(["true"])

    def test_a_forwarded_value_is_redacted_from_what_is_captured(self):
        runner = StubRunner(
            [("echo", 0, f"the value was {TOKEN}", "")], passthrough=True
        )
        adapter = self.make(runner=runner)
        adapter.prepare_identity()
        adapter.address = "192.168.122.61"
        outcome = adapter.execute(
            ["echo", "x"], timeout=5, env={"CLAUDE_CODE_OAUTH_TOKEN": TOKEN}
        )
        self.assertNotIn(TOKEN, outcome.stdout)
        self.assertIn(TOKEN, runner.extra_values_seen[-1])


@unittest.skipUnless(
    Path(os.environ.get("DELY_CYCLE_VENV", "/var/tmp/dely-cycle/venv"), "bin", "python").is_file(),
    "no prepared environment to check the provider against",
)
class ProviderSchemaIntegrationTest(VmTestCase):
    """The provider itself is the instrument: the program is checked against it."""

    def prepared(self):
        return Path(os.environ.get("DELY_CYCLE_VENV", "/var/tmp/dely-cycle/venv"))

    def test_the_program_names_only_classes_and_fields_the_provider_has(self):
        adapter = self.make(venv=str(self.prepared()))
        ran, problems = schema.verify_with_interpreter(
            adapter.render_program(), self.prepared() / "bin" / "python"
        )
        self.assertTrue(ran, problems)
        self.assertEqual(problems, [])

    def test_a_field_the_provider_lacks_is_caught(self):
        adapter = self.make(venv=str(self.prepared()))
        program = adapter.render_program().replace(
            "qemu_agent=True,", "qemu_agent=True,\n    nonexistent_field=1,"
        )
        ran, problems = schema.verify_with_interpreter(
            program, self.prepared() / "bin" / "python"
        )
        self.assertTrue(ran)
        self.assertTrue(any("nonexistent_field" in problem for problem in problems), problems)

    def test_the_preflight_finding_reports_the_real_check(self):
        adapter = self.make(venv=str(self.prepared()))
        finding = adapter._schema_finding()
        self.assertTrue(finding.ok, finding.detail)
        self.assertIn("0.5.4", finding.detail)
