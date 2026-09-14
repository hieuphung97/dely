"""The virtual-machine backend: Pulumi Python over the libvirt provider.

The isolation this backend buys is a separate kernel, so the identity gate can
ask for a distinct boot identity rather than a container marker. What it costs
is a preserved base image, a rendered program, a seed and a transport, and
every one of those is a place a credential could end up. None of them carries
one: the seed authorises one per-run public key, the private half never leaves
the per-run state directory, and the base image is opened only as a backing
file.

The provider's resource schema is not assumed. This runner renders a program
against a pinned provider version and refuses to run until the configuration
records that the schema was actually checked against that version.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Callable, Mapping, Sequence

from .. import cleanup, ids, proc
from ..config import RunConfig
from .base import (
    BackendAdapter,
    DestroyReport,
    EnvironmentHandle,
    Finding,
    PreflightReport,
    Resource,
    StopReport,
)

REQUIRED_TOOLS = ("pulumi", "qemu-img", "virsh", "ssh", "scp")

PROGRAM_TEMPLATE = '''"""Per-run domain for one dely minimal cycle.

Rendered by cycle_runner.adapters.vm. The resource fields below belong to the
pinned provider version named in Pulumi.yaml; the runner refuses to apply this
program until the configuration records that the schema was checked against
that version.
"""

import pulumi
import pulumi_libvirt as libvirt

DOMAIN_NAME = {domain_name!r}
OVERLAY_PATH = {overlay_path!r}
USER_DATA = {user_data!r}
META_DATA = {meta_data!r}
GRAPHICS = {graphics!r}
MEMORY_MB = {memory_mb!r}
VCPUS = {vcpus!r}
NETWORK = {network!r}

seed = libvirt.CloudInItDisk(
    "seed",
    name=DOMAIN_NAME + "-seed.iso",
    user_data=USER_DATA,
    meta_data=META_DATA,
)

domain = libvirt.Domain(
    "domain",
    name=DOMAIN_NAME,
    memory=MEMORY_MB,
    vcpu=VCPUS,
    cloudinit=seed.id,
    disks=[libvirt.DomainDiskArgs(file=OVERLAY_PATH)],
    network_interfaces=[
        libvirt.DomainNetworkInterfaceArgs(network_name=NETWORK, wait_for_lease=True)
    ],
    graphics=libvirt.DomainGraphicsArgs(type=GRAPHICS, listen_type="address"),
)

pulumi.export("domain_name", domain.name)
pulumi.export("address", domain.network_interfaces[0].addresses[0])
'''

USER_DATA_TEMPLATE = """#cloud-config
hostname: {hostname}
preserve_hostname: false
users:
  - name: {user}
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    lock_passwd: true
    ssh_authorized_keys:
      - {public_key}
write_files:
  - path: /etc/dely-cycle-run
    permissions: '0444'
    content: |
      run_id={run_id}
      domain={hostname}
runcmd:
  - [ install, -d, -o, {user}, -g, {user}, -m, '0750', {home} ]
"""

META_DATA_TEMPLATE = """instance-id: {run_id}
local-hostname: {hostname}
"""


class VmContractError(RuntimeError):
    """The machine backend was asked for something it refuses to do."""


class VmAdapter(BackendAdapter):
    """One disposable domain, declared with Pulumi and destroyed with it."""

    name = "vm"

    def __init__(
        self,
        *,
        run_config: RunConfig,
        run_id: str,
        runner: Callable[..., proc.CommandOutcome] = proc.run,
        which: Callable[[str], str | None] = shutil.which,
    ):
        if run_config.vm is None:
            raise VmContractError("the configuration carries no vm section")
        self.config = run_config
        self.settings = run_config.vm
        self.run_id = run_id
        self.runner = runner
        self.which = which
        self.domain_name = ids.resource_name(self.settings.stack_prefix, run_id)
        self.stack_name = self.domain_name
        self.run_state = run_config.state_root / run_id
        self.stack_dir = self.run_state / "stack"
        self.overlay_path = self.run_state / "overlay.qcow2"
        self.private_key_path = self.run_state / "id_cycle"
        self.public_key_path = self.run_state / "id_cycle.pub"
        self.home_path = f"/home/{self.settings.guest_user}"
        self.project_path = f"{self.home_path}/{run_config.project.environment_path}"
        self.address: str | None = None

    # -- per-run identity -------------------------------------------------

    def prepare_identity(self) -> None:
        """Generate the per-run transport key pair inside the per-run state."""
        self.run_state.mkdir(parents=True, exist_ok=True)
        if self.private_key_path.exists():
            return
        generated = self.runner(
            [
                "ssh-keygen",
                "-t",
                "ed25519",
                "-N",
                "",
                "-C",
                f"dely-cycle-{self.run_id}",
                "-f",
                str(self.private_key_path),
            ],
            timeout=120,
            context="host",
        )
        if not self.private_key_path.exists():
            raise VmContractError(
                "the per-run transport key could not be generated: "
                + (generated.stderr or generated.stdout).strip()[:300]
            )
        self.private_key_path.chmod(0o600)

    # -- rendered declarations -------------------------------------------

    def render_user_data(self) -> str:
        """Render the cloud-init user data; it carries no credential."""
        self.prepare_identity()
        return USER_DATA_TEMPLATE.format(
            hostname=self.domain_name,
            user=self.settings.guest_user,
            public_key=self.public_key_path.read_text(encoding="utf-8").strip(),
            run_id=self.run_id,
            home=self.home_path,
        )

    def render_meta_data(self) -> str:
        """Render the cloud-init metadata naming this run and this domain."""
        return META_DATA_TEMPLATE.format(
            run_id=self.run_id.lower(), hostname=self.domain_name
        )

    def render_program(self) -> str:
        """Render the Pulumi program for this run's domain."""
        return PROGRAM_TEMPLATE.format(
            domain_name=self.domain_name,
            overlay_path=str(self.overlay_path),
            user_data=self.render_user_data(),
            meta_data=self.render_meta_data(),
            graphics=self.settings.graphics,
            memory_mb=self.settings.memory_mb,
            vcpus=self.settings.vcpus,
            network=self.settings.network,
        )

    def render_project(self) -> str:
        """Render Pulumi.yaml, pinning the provider and its version."""
        return (
            f"name: {self.settings.stack_prefix}\n"
            "runtime: python\n"
            f"description: one dely minimal cycle domain for run {self.run_id}\n"
            "packages:\n"
            f"  libvirt: {self.settings.provider}@{self.settings.provider_version}\n"
        )

    def render_stack_settings(self) -> str:
        """Render the stack settings; nothing here is a secret."""
        return (
            "config:\n"
            f"  {self.settings.stack_prefix}:runId: {self.run_id}\n"
            f"  {self.settings.stack_prefix}:domain: {self.domain_name}\n"
            f"  {self.settings.stack_prefix}:connectUri: {self.settings.connect_uri}\n"
        )

    def write_declarations(self) -> None:
        """Write the program, the project file and the stack settings."""
        self.stack_dir.mkdir(parents=True, exist_ok=True)
        (self.stack_dir / "__main__.py").write_text(self.render_program(), encoding="utf-8")
        (self.stack_dir / "Pulumi.yaml").write_text(self.render_project(), encoding="utf-8")
        (self.stack_dir / f"Pulumi.{self.stack_name}.yaml").write_text(
            self.render_stack_settings(), encoding="utf-8"
        )

    def overlay_argv(self) -> list[str]:
        """Return the command that creates the overlay over the preserved base."""
        return [
            "qemu-img",
            "create",
            "-f",
            "qcow2",
            "-b",
            str(self.settings.base_image),
            "-F",
            "qcow2",
            str(self.overlay_path),
            self.settings.overlay_size,
        ]

    def plan_handle(self) -> EnvironmentHandle:
        """Describe the environment this adapter will create."""
        return EnvironmentHandle(
            environment_id=self.domain_name,
            home_path=self.home_path,
            project_path=self.project_path,
            per_run_resources=(
                Resource(kind="domain", identifier=self.domain_name),
                Resource(kind="path", identifier=str(self.run_state)),
            ),
            shared_resources=(
                Resource(kind="image", identifier=str(self.settings.base_image)),
            ),
            description={
                "domain": self.domain_name,
                "overlay": str(self.overlay_path),
                "stack": str(self.stack_dir),
                "connect_uri": self.settings.connect_uri,
                "provider": f"{self.settings.provider}@{self.settings.provider_version}",
                "base_image": str(self.settings.base_image),
            },
        )

    # -- host facts -------------------------------------------------------

    def _base_digest(self) -> str | None:
        base = Path(self.settings.base_image)
        if not base.is_file():
            return None
        digest = hashlib.sha256()
        with base.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def preflight(self) -> PreflightReport:
        """Report whether this host can declare and run the domain."""
        findings = []
        for tool in REQUIRED_TOOLS:
            located = self.which(tool)
            findings.append(
                Finding(
                    name=f"{tool} on the path",
                    ok=bool(located),
                    detail=located or f"{tool} was not found on PATH",
                )
            )
        findings.append(
            Finding(
                name="provider schema verified",
                ok=self.settings.provider_schema_verified,
                detail=(
                    f"{self.settings.provider}@{self.settings.provider_version} was "
                    "recorded as checked against the rendered program"
                    if self.settings.provider_schema_verified
                    else (
                        "the rendered program's resource fields have not been checked "
                        f"against {self.settings.provider}@"
                        f"{self.settings.provider_version}; set "
                        "vm.provider_schema_verified once they have been"
                    )
                ),
            )
        )
        base_present = Path(self.settings.base_image).is_file()
        findings.append(
            Finding(
                name="base image present",
                ok=base_present,
                detail=str(self.settings.base_image)
                if base_present
                else f"{self.settings.base_image} is not a file on this host",
            )
        )
        if base_present:
            observed = self._base_digest()
            findings.append(
                Finding(
                    name="base image digest matches the pin",
                    ok=observed == self.settings.base_image_sha256,
                    detail=(
                        "the preserved base matches the pinned digest"
                        if observed == self.settings.base_image_sha256
                        else f"the base image digest is {observed}, not the pinned value"
                    ),
                )
            )
        accelerator = Path("/dev/kvm")
        findings.append(
            Finding(
                name="hardware acceleration device",
                ok=accelerator.exists(),
                detail=str(accelerator)
                if accelerator.exists()
                else "/dev/kvm is absent; this host cannot run the domain natively",
            )
        )
        if self.which("virsh"):
            listed = self.runner(
                ["virsh", "--connect", self.settings.connect_uri, "list", "--all"],
                timeout=120,
                context="host",
            )
            findings.append(
                Finding(
                    name="libvirt connection answers",
                    ok=listed.ok,
                    detail=self.settings.connect_uri
                    if listed.ok
                    else (listed.stderr or listed.stdout).strip()[:200],
                )
            )
        return PreflightReport(backend=self.name, findings=tuple(findings))

    # -- lifecycle --------------------------------------------------------

    def _pulumi(self, arguments: Sequence[str], *, timeout: float) -> proc.CommandOutcome:
        return self.runner(
            [self.settings.pulumi_binary, *arguments],
            timeout=timeout,
            context="host",
            cwd=str(self.stack_dir),
            env={
                "PULUMI_BACKEND_URL": f"file://{self.run_state}",
                "PULUMI_SKIP_UPDATE_CHECK": "true",
                "LIBVIRT_DEFAULT_URI": self.settings.connect_uri,
            },
        )

    def create(self) -> EnvironmentHandle:
        """Create the overlay, the seed and the domain, then find its address."""
        self.prepare_identity()
        overlay = self.runner(self.overlay_argv(), timeout=600, context="host")
        if not overlay.ok:
            raise VmContractError(
                "the overlay could not be created over the preserved base: "
                + (overlay.stderr or overlay.stdout).strip()[:300]
            )
        self.write_declarations()
        self._pulumi(["stack", "init", self.stack_name, "--non-interactive"], timeout=600)
        applied = self._pulumi(
            ["up", "--yes", "--non-interactive", "--stack", self.stack_name],
            timeout=self.config.timeout_seconds,
        )
        if not applied.ok:
            raise VmContractError(
                "pulumi up did not bring the domain up: "
                + (applied.stderr or applied.stdout).strip()[:400]
            )
        outputs = self._pulumi(
            ["stack", "output", "--json", "--stack", self.stack_name], timeout=300
        )
        try:
            self.address = json.loads(outputs.stdout or "{}").get("address")
        except json.JSONDecodeError:
            self.address = None
        if not self.address:
            raise VmContractError(
                "the stack reported no address for the domain, so nothing can be run in it"
            )
        handle = self.plan_handle()
        return EnvironmentHandle(
            environment_id=handle.environment_id,
            home_path=handle.home_path,
            project_path=handle.project_path,
            per_run_resources=handle.per_run_resources,
            shared_resources=handle.shared_resources,
            description={**handle.description, "address": self.address},
        )

    def ssh_argv(self, argv: Sequence[str]) -> list[str]:
        """Return the argv that runs a command inside the domain."""
        if not self.address:
            raise VmContractError(
                "the domain has no known address yet; nothing may be run in it"
            )
        return [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "-o",
            f"UserKnownHostsFile={self.run_state / 'known_hosts'}",
            "-p",
            str(self.settings.ssh_port),
            "-i",
            str(self.private_key_path),
            f"{self.settings.guest_user}@{self.address}",
            "--",
            *[str(item) for item in argv],
        ]

    def execute(
        self,
        argv: Sequence[str],
        *,
        timeout: float,
        cwd: str | None = None,
        env: Mapping[str, str] | None = None,
        extra_values: Sequence[str] = (),
    ) -> proc.CommandOutcome:
        """Run a command inside the domain over the per-run transport."""
        inside = list(argv)
        if env:
            inside = [
                "env",
                *[f"{name}={value}" for name, value in env.items()],
                *inside,
            ]
        if cwd:
            inside = ["sh", "-c", 'cd "$1" || exit 1; shift; exec "$@"', "cycle-cd", cwd, *inside]
        return self.runner(
            self.ssh_argv(inside),
            timeout=timeout,
            context="environment",
            extra_values=tuple(extra_values) + tuple((env or {}).values()),
        )

    def _scp_argv(self, source: str, destination: str) -> list[str]:
        return [
            "scp",
            "-r",
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "-o",
            f"UserKnownHostsFile={self.run_state / 'known_hosts'}",
            "-P",
            str(self.settings.ssh_port),
            "-i",
            str(self.private_key_path),
            source,
            destination,
        ]

    def put_tree(self, local_dir: Path, remote_dir: str) -> None:
        """Copy a host directory into the domain."""
        self.execute(["mkdir", "-p", remote_dir], timeout=300)
        outcome = self.runner(
            self._scp_argv(
                f"{Path(local_dir)}/.",
                f"{self.settings.guest_user}@{self.address}:{remote_dir}/",
            ),
            timeout=1800,
            context="host",
        )
        if not outcome.ok:
            raise VmContractError(
                "the project copy could not be placed in the domain: "
                + (outcome.stderr or outcome.stdout).strip()[:300]
            )

    def fetch_tree(self, remote_dir: str, local_dir: Path) -> None:
        """Bring a directory out of the domain onto the host."""
        Path(local_dir).mkdir(parents=True, exist_ok=True)
        outcome = self.runner(
            self._scp_argv(
                f"{self.settings.guest_user}@{self.address}:{remote_dir}/.",
                f"{Path(local_dir)}/",
            ),
            timeout=1800,
            context="host",
        )
        if not outcome.ok:
            raise VmContractError(
                "the project tree could not be brought out of the domain: "
                + (outcome.stderr or outcome.stdout).strip()[:300]
            )

    def write_file(self, remote_path: str, content: str, *, mode: int = 0o600) -> None:
        """Write a file inside the domain with the given permissions."""
        self.execute(["mkdir", "-p", str(Path(remote_path).parent)], timeout=300)
        written = self.runner(
            self.ssh_argv(
                [
                    "sh",
                    "-c",
                    'umask 077; cat > "$1"; chmod "$2" "$1"',
                    "cycle-write",
                    remote_path,
                    format(mode, "04o"),
                ]
            ),
            timeout=300,
            context="environment",
            stdin_text=content,
            extra_values=(content,),
        )
        if not written.ok:
            raise VmContractError(f"could not write {remote_path} inside the domain")

    def stop(self) -> StopReport:
        """Shut the domain down and confirm libvirt no longer runs it."""
        outcome = self.runner(
            ["virsh", "--connect", self.settings.connect_uri, "shutdown", self.domain_name],
            timeout=300,
            context="host",
        )
        running = self._domain_running()
        return StopReport(
            confirmed=not running,
            detail=(
                f"{self.domain_name} is no longer running"
                if not running
                else f"{self.domain_name} is still reported as running"
            ),
            outcomes=(outcome,),
        )

    def _domain_running(self) -> bool:
        listed = self.runner(
            ["virsh", "--connect", self.settings.connect_uri, "domstate", self.domain_name],
            timeout=120,
            context="host",
        )
        return "running" in listed.stdout.lower()

    def destroy(self) -> DestroyReport:
        """Destroy the stack and the per-run state; never the preserved base."""
        removed: list[str] = []
        outcomes = []
        if self.stack_dir.exists():
            destroyed = self._pulumi(
                ["destroy", "--yes", "--non-interactive", "--stack", self.stack_name],
                timeout=self.config.timeout_seconds,
            )
            outcomes.append(destroyed)
            if destroyed.ok:
                removed.append(f"domain:{self.domain_name}")
            outcomes.append(
                self._pulumi(
                    ["stack", "rm", "--yes", "--non-interactive", self.stack_name],
                    timeout=600,
                )
            )
        cleanup.safe_remove(
            self.run_state,
            allowed_roots=[self.config.state_root],
            protected=[Path(self.settings.base_image)],
        )
        if not self.run_state.exists():
            removed.append(f"path:{self.run_state}")
        return DestroyReport(
            removed=tuple(removed),
            retained=(f"image:{self.settings.base_image}",),
            detail="the domain, the overlay, the seed and the stack were removed; the base was not",
            outcomes=tuple(outcomes),
        )

    def resource_exists(self, resource: Resource) -> bool:
        """Report whether a declared resource is still on this host."""
        if resource.kind == "path":
            return Path(resource.identifier).exists()
        if resource.kind == "image":
            return Path(resource.identifier).is_file()
        if resource.kind == "domain":
            listed = self.runner(
                ["virsh", "--connect", self.settings.connect_uri, "list", "--all", "--name"],
                timeout=120,
                context="host",
            )
            return resource.identifier in listed.stdout.split()
        return False

    def describe(self) -> dict:
        """Return backend facts for the manifest."""
        return {
            "backend": self.name,
            "domain": self.domain_name,
            "stack": self.stack_name,
            "provider": f"{self.settings.provider}@{self.settings.provider_version}",
            "connect_uri": self.settings.connect_uri,
            "base_image": str(self.settings.base_image),
            "base_image_sha256": self.settings.base_image_sha256,
            "overlay": str(self.overlay_path),
            "graphics": self.settings.graphics,
            "provider_schema_verified": self.settings.provider_schema_verified,
        }
