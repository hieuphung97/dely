"""The rendered program is checked against the provider it is pinned to."""

import textwrap
import unittest

from cycle_runner.adapters import schema

PROGRAM = textwrap.dedent(
    """
    import pulumi
    import pulumi_libvirt as libvirt

    overlay = libvirt.Volume(
        "overlay", name="x", pool="p", base_volume_name="b", size=1, format="qcow2"
    )
    seed = libvirt.CloudInitDisk("seed", name="s", pool="p", user_data="u", meta_data="m")
    domain = libvirt.Domain(
        "domain",
        name="d",
        memory=1024,
        disks=[libvirt.DomainDiskArgs(volume_id=overlay.id)],
        graphics=libvirt.DomainGraphicsArgs(type="vnc"),
    )
    pulumi.export("address", domain.name)
    """
)


class FakeAttribute:
    def __init__(self, properties):
        self._properties = properties


def fake_module(classes):
    module = type("FakeLibvirt", (), {})()
    for name, properties in classes.items():
        holder = type(name, (), {p: property(lambda self: None) for p in properties})
        setattr(module, name, holder)
    return module


class DeclaredSymbolsTest(unittest.TestCase):
    def test_every_provider_call_and_keyword_is_collected(self):
        found = schema.declared_symbols(PROGRAM)
        self.assertEqual(
            set(found),
            {"Volume", "CloudInitDisk", "Domain", "DomainDiskArgs", "DomainGraphicsArgs"},
        )
        self.assertIn("base_volume_name", found["Volume"])
        self.assertIn("volume_id", found["DomainDiskArgs"])
        self.assertIn("meta_data", found["CloudInitDisk"])

    def test_calls_on_other_modules_are_ignored(self):
        found = schema.declared_symbols(PROGRAM)
        self.assertNotIn("export", found)

    def test_the_positional_resource_name_is_not_a_keyword(self):
        found = schema.declared_symbols(PROGRAM)
        self.assertNotIn("overlay", found["Volume"])

    def test_a_program_that_does_not_parse_is_refused(self):
        with self.assertRaises(SyntaxError):
            schema.declared_symbols("def broken(:")

    def test_the_alias_is_taken_from_the_import(self):
        found = schema.declared_symbols(
            "import pulumi_libvirt as lv\nx = lv.Domain('d', name='n')\n"
        )
        self.assertEqual(set(found), {"Domain"})


class VerifyAgainstTest(unittest.TestCase):
    def test_a_matching_module_reports_no_problem(self):
        module = fake_module(
            {
                "Volume": {"name", "pool", "base_volume_name", "size", "format"},
                "CloudInitDisk": {"name", "pool", "user_data", "meta_data"},
                "Domain": {"name", "memory", "disks", "graphics"},
                "DomainDiskArgs": {"volume_id"},
                "DomainGraphicsArgs": {"type"},
            }
        )
        self.assertEqual(schema.verify_against(schema.declared_symbols(PROGRAM), module), [])

    def test_a_class_the_provider_does_not_have_is_named(self):
        module = fake_module({"Volume": {"name"}})
        problems = schema.verify_against({"CloudInItDisk": {"name"}}, module)
        self.assertEqual(len(problems), 1)
        self.assertIn("CloudInItDisk", problems[0])

    def test_a_keyword_the_provider_does_not_have_is_named(self):
        module = fake_module({"Domain": {"name", "memory"}})
        problems = schema.verify_against({"Domain": {"name", "cloudinit"}}, module)
        self.assertEqual(len(problems), 1)
        self.assertIn("cloudinit", problems[0])
        self.assertIn("Domain", problems[0])

    def test_every_problem_is_reported_not_just_the_first(self):
        module = fake_module({"Domain": {"name"}})
        problems = schema.verify_against(
            {"Domain": {"name", "one", "two"}, "Absent": {"x"}}, module
        )
        self.assertEqual(len(problems), 3)
