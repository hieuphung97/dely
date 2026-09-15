"""The virtual-machine backend: Pulumi Python over the libvirt provider.

What this backend buys is a separate kernel, so the identity gate can demand a
distinct boot identity rather than a container marker. What it costs is a
preserved tool image, a rendered program, a seed and a transport, and every one
of those is a place a credential could end up. None of them carries one: the
seed authorises one per-run public key, the private half never leaves the
per-run state directory, and the tool image is opened only as a backing file.

Nothing about the provider is assumed. The rendered program is checked field by
field against the provider importable from the pinned environment, and every
host fact the domain depends on — the state backend, the pool, the network, the
graphics types this qemu actually has — is read before a domain is declared.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import time
from pathlib import Path
from typing import Callable, Mapping, Sequence

from .. import cleanup, ids, proc
from ..config import RunConfig
from . import schema
from .base import (
    BackendAdapter,
    DestroyReport,
    EnvironmentHandle,
    Finding,
    PreflightReport,
    Resource,
    StopReport,
)

REQUIRED_TOOLS = ("qemu-img", "virsh", "ssh", "scp")

#: Added to the generated domain so the guest can reach the internet without
#: the host's forwarding path, which a firewall or a virtual private network
#: may refuse. A user-mode interface is served by qemu itself.
EGRESS_XSLT = """<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>
  <xsl:template match="@*|node()">
    <xsl:copy><xsl:apply-templates select="@*|node()"/></xsl:copy>
  </xsl:template>
  <xsl:template match="/domain/devices">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
      <interface type="user">
        <mac address="{egress_mac}"/>
        <model type="virtio"/>
      </interface>
    </xsl:copy>
  </xsl:template>
</xsl:stylesheet>
"""

PROGRAM_TEMPLATE = '''"""Per-run domain for one dely minimal cycle.

Rendered by cycle_runner.adapters.vm. Every class and field below is checked
against the provider importable from the pinned environment before this program
is applied; preflight blocks when that check cannot run.
"""

import pulumi
import pulumi_libvirt as libvirt

DOMAIN_NAME = {domain_name!r}
POOL = {pool!r}
BASE_VOLUME = {base_volume!r}
NETWORK = {network!r}
TRANSPORT_MAC = {transport_mac!r}
USER_DATA = {user_data!r}
META_DATA = {meta_data!r}
NETWORK_CONFIG = {network_config!r}
GRAPHICS = {graphics!r}
LISTEN_ADDRESS = {listen_address!r}
MEMORY_MB = {memory_mb!r}
VCPUS = {vcpus!r}
OVERLAY_SIZE_BYTES = {overlay_size_bytes!r}
EGRESS_XSLT = {egress_xslt!r}

overlay = libvirt.Volume(
    "overlay",
    name=DOMAIN_NAME + "-overlay.qcow2",
    pool=POOL,
    base_volume_name=BASE_VOLUME,
    base_volume_pool=POOL,
    size=OVERLAY_SIZE_BYTES,
    format="qcow2",
)

seed = libvirt.CloudInitDisk(
    "seed",
    name=DOMAIN_NAME + "-seed.iso",
    pool=POOL,
    user_data=USER_DATA,
    meta_data=META_DATA,
    network_config=NETWORK_CONFIG,
)

domain = libvirt.Domain(
    "domain",
    name=DOMAIN_NAME,
    memory=MEMORY_MB,
    vcpu=VCPUS,
    running=True,
    qemu_agent=True,
    cloudinit=seed.id,
    disks=[libvirt.DomainDiskArgs(volume_id=overlay.id)],
    network_interfaces=[
        libvirt.DomainNetworkInterfaceArgs(network_name=NETWORK, mac=TRANSPORT_MAC)
    ],
    graphics=libvirt.DomainGraphicsArgs(
        type=GRAPHICS,
        listen_type="address",
        listen_address=LISTEN_ADDRESS,
        autoport=True,
    ),
    consoles=[
        libvirt.DomainConsoleArgs(type="pty", target_port="0", target_type="serial")
    ],
    xml=libvirt.DomainXmlArgs(xslt=EGRESS_XSLT),
)

pulumi.export("domain_name", domain.name)
pulumi.export("transport_mac", TRANSPORT_MAC)
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

#: Both interfaces take an address; the user-mode one carries the default route
#: because the bridged one cannot reach anything past the host.
NETWORK_CONFIG_TEMPLATE = """version: 2
ethernets:
  transport:
    match:
      macaddress: "{transport_mac}"
    dhcp4: true
    dhcp4-overrides:
      route-metric: 300
  egress:
    match:
      macaddress: "{egress_mac}"
    dhcp4: true
    dhcp4-overrides:
      route-metric: 100
"""

NETWORK_CONFIG_TRANSPORT_ONLY = """version: 2
ethernets:
  transport:
    match:
      macaddress: "{transport_mac}"
    dhcp4: true
"""

_ADDRESS = re.compile(r"(\d{1,3}(?:\.\d{1,3}){3})/\d+")


class VmContractError(RuntimeError):
    """The machine backend was asked for something it refuses to do."""


def _mac(prefix: str, run_id: str) -> str:
    digest = hashlib.sha256(f"{prefix}:{run_id}".encode("utf-8")).hexdigest()
    return f"{prefix}:{digest[0:2]}:{digest[2:4]}:{digest[4:6]}"


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
        sleeper: Callable[[float], None] = time.sleep,
    ):
        if run_config.vm is None:
            raise VmContractError("the configuration carries no vm section")
        self.config = run_config
        self.settings = run_config.vm
        self.run_id = run_id
        self.runner = runner
        self.which = which
        self.sleeper = sleeper
        self.domain_name = ids.resource_name(self.settings.stack_prefix, run_id)
        self.stack_name = self.domain_name
        self.run_state = run_config.state_root / run_id
        self.stack_dir = self.run_state / "stack"
        self.private_key_path = self.run_state / "id_cycle"
        self.public_key_path = self.run_state / "id_cycle.pub"
        self.home_path = f"/home/{self.settings.guest_user}"
        self.project_path = f"{self.home_path}/{run_config.project.environment_path}"
        self.transport_mac = _mac("52:54:00", run_id)
        self.egress_mac = _mac("52:54:01", run_id)
        self.address: str | None = None
        self._passphrase = hashlib.sha256(
            f"ephemeral:{run_id}:{id(self)}".encode("utf-8")
        ).hexdigest()

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

    def render_network_config(self) -> str:
        """Render the guest's interfaces, matched by their per-run addresses."""
        if not self.settings.egress:
            return NETWORK_CONFIG_TRANSPORT_ONLY.format(transport_mac=self.transport_mac)
        return NETWORK_CONFIG_TEMPLATE.format(
            transport_mac=self.transport_mac, egress_mac=self.egress_mac
        )

    def render_egress_xslt(self) -> str:
        """Render the transform that adds the user-mode interface."""
        return EGRESS_XSLT.format(egress_mac=self.egress_mac)

    def render_program(self) -> str:
        """Render the Pulumi program for this run's domain."""
        return PROGRAM_TEMPLATE.format(
            domain_name=self.domain_name,
            pool=self.settings.pool,
            base_volume=self.settings.base_volume_name,
            network=self.settings.network,
            transport_mac=self.transport_mac,
            user_data=self.render_user_data(),
            meta_data=self.render_meta_data(),
            network_config=self.render_network_config(),
            graphics=self.settings.graphics,
            listen_address=self.settings.listen_address,
            memory_mb=self.settings.memory_mb,
            vcpus=self.settings.vcpus,
            overlay_size_bytes=self.settings.overlay_size_bytes,
            egress_xslt=self.render_egress_xslt() if self.settings.egress else "",
        )

    def render_project(self) -> str:
        """Render Pulumi.yaml, pinning the runtime to the prepared environment."""
        return (
            f"name: {self.settings.stack_prefix}\n"
            "runtime:\n"
            "  name: python\n"
            "  options:\n"
            f"    virtualenv: {self.settings.venv}\n"
            f"description: one dely minimal cycle domain for run {self.run_id}\n"
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

    def plan_handle(self) -> EnvironmentHandle:
        """Describe the environment this adapter will create."""
        return EnvironmentHandle(
            environment_id=self.domain_name,
            home_path=self.home_path,
            project_path=self.project_path,
            per_run_resources=(
                Resource(kind="domain", identifier=self.domain_name),
                Resource(kind="path", identifier=str(self.run_state)),
                Resource(
                    kind="volume",
                    identifier=str(
                        Path(self.settings.base_image).parent
                        / f"{self.domain_name}-overlay.qcow2"
                    ),
                ),
                Resource(
                    kind="volume",
                    identifier=str(
                        Path(self.settings.base_image).parent
                        / f"{self.domain_name}-seed.iso"
                    ),
                ),
            ),
            shared_resources=(
                Resource(kind="image", identifier=str(self.settings.base_image)),
            ),
            description={
                "domain": self.domain_name,
                "stack": str(self.stack_dir),
                "pool": self.settings.pool,
                "network": self.settings.network,
                "connect_uri": self.settings.connect_uri,
                "provider": f"{self.settings.provider}@{self.settings.provider_version}",
                "base_image": str(self.settings.base_image),
                "base_volume": self.settings.base_volume_name,
                "graphics": self.settings.graphics,
                "transport_mac": self.transport_mac,
                "egress": self.settings.egress,
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

    def _virsh(self, *arguments: str, timeout: float = 120) -> proc.CommandOutcome:
        return self.runner(
            ["virsh", "--connect", self.settings.connect_uri, *arguments],
            timeout=timeout,
            context="host",
        )

    def _pulumi_environment(self) -> dict[str, str]:
        return {
            "PULUMI_BACKEND_URL": f"file://{self.run_state}",
            "PULUMI_CONFIG_PASSPHRASE": self._passphrase,
            "PULUMI_SKIP_UPDATE_CHECK": "true",
            "LIBVIRT_DEFAULT_URI": self.settings.connect_uri,
        }

    def _pulumi(self, arguments: Sequence[str], *, timeout: float) -> proc.CommandOutcome:
        return self.runner(
            [self.settings.pulumi_binary, *arguments],
            timeout=timeout,
            context="host",
            cwd=str(self.stack_dir),
            env=self._pulumi_environment(),
            extra_values=(self._passphrase,),
        )

    def _state_backend_finding(self) -> Finding:
        name = "pulumi state backend is local"
        outcome = self.runner(
            [self.settings.pulumi_binary, "whoami", "-v"],
            timeout=120,
            context="host",
            env={"PULUMI_SKIP_UPDATE_CHECK": "true"},
        )
        if not outcome.ok:
            return Finding(
                name=name,
                ok=False,
                detail="pulumi could not report its backend: "
                + (outcome.stderr or outcome.stdout).strip()[:200],
            )
        match = re.search(r"Backend URL:\s*(\S+)", outcome.stdout)
        backend = match.group(1) if match else "unknown"
        return Finding(
            name=name,
            ok=backend.startswith("file://"),
            detail=(
                f"state lives at {backend}"
                if backend.startswith("file://")
                else f"the backend is {backend}, not a local file backend; run "
                "pulumi login --local"
            ),
        )

    def _schema_finding(self) -> Finding:
        name = "provider schema verified"
        interpreter = Path(self.settings.venv) / "bin" / "python"
        try:
            program = self.render_program()
        except VmContractError as error:
            return Finding(name=name, ok=False, detail=str(error))
        ran, problems = schema.verify_with_interpreter(program, interpreter)
        if not ran:
            return Finding(
                name=name,
                ok=False,
                detail="the rendered program could not be checked against "
                f"{self.settings.provider}@{self.settings.provider_version}: "
                + "; ".join(problems),
            )
        if problems:
            return Finding(name=name, ok=False, detail="; ".join(problems[:4]))
        return Finding(
            name=name,
            ok=True,
            detail=(
                "every class and field the program names exists in "
                f"{self.settings.provider}@{self.settings.provider_version}"
            ),
        )

    def _graphics_finding(self) -> Finding:
        name = "graphics type supported by this emulator"
        outcome = self._virsh("domcapabilities")
        if not outcome.ok:
            return Finding(
                name=name,
                ok=False,
                detail="libvirt did not report domain capabilities",
            )
        block = re.search(r"<graphics supported='yes'>(.*?)</graphics>", outcome.stdout, re.S)
        supported = re.findall(r"<value>(\w+)</value>", block.group(1)) if block else []
        return Finding(
            name=name,
            ok=self.settings.graphics in supported,
            detail=(
                f"{self.settings.graphics} is among {', '.join(supported)}"
                if self.settings.graphics in supported
                else f"this emulator offers {', '.join(supported) or 'nothing'}, "
                f"not {self.settings.graphics}"
            ),
        )

    def preflight(self) -> PreflightReport:
        """Report whether this host can declare and run the domain."""
        findings = []
        pulumi_path = self.which(self.settings.pulumi_binary)
        findings.append(
            Finding(
                name="pulumi on the path",
                ok=bool(pulumi_path),
                detail=pulumi_path or f"{self.settings.pulumi_binary} was not found",
            )
        )
        for tool in REQUIRED_TOOLS:
            located = self.which(tool)
            findings.append(
                Finding(
                    name=f"{tool} on the path",
                    ok=bool(located),
                    detail=located or f"{tool} was not found on PATH",
                )
            )
        interpreter = Path(self.settings.venv) / "bin" / "python"
        findings.append(
            Finding(
                name="pinned environment present",
                ok=interpreter.is_file(),
                detail=str(interpreter)
                if interpreter.is_file()
                else f"no interpreter at {interpreter}; run host/prepare-host",
            )
        )
        if pulumi_path:
            findings.append(self._state_backend_finding())
        if interpreter.is_file():
            findings.append(self._schema_finding())

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
            connection = self._virsh("list", "--all")
            findings.append(
                Finding(
                    name="libvirt connection answers",
                    ok=connection.ok,
                    detail=self.settings.connect_uri
                    if connection.ok
                    else (connection.stderr or connection.stdout).strip()[:200],
                )
            )
            if connection.ok:
                pools = self._virsh("pool-list", "--name")
                findings.append(
                    Finding(
                        name="storage pool active",
                        ok=self.settings.pool in pools.stdout.split(),
                        detail=(
                            f"{self.settings.pool} is active"
                            if self.settings.pool in pools.stdout.split()
                            else f"pool {self.settings.pool} is not active; "
                            "run host/prepare-host"
                        ),
                    )
                )
                networks = self._virsh("net-list", "--name")
                findings.append(
                    Finding(
                        name="network active",
                        ok=self.settings.network in networks.stdout.split(),
                        detail=(
                            f"{self.settings.network} is active"
                            if self.settings.network in networks.stdout.split()
                            else f"network {self.settings.network} is not active"
                        ),
                    )
                )
                findings.append(self._graphics_finding())
        return PreflightReport(backend=self.name, findings=tuple(findings))

    # -- lifecycle --------------------------------------------------------

    def discover_address(self, *, timeout: float | None = None) -> str | None:
        """Poll libvirt until the transport interface has an address."""
        deadline = time.monotonic() + (
            self.settings.address_timeout_seconds if timeout is None else timeout
        )
        while True:
            outcome = self._virsh(
                "domifaddr", self.domain_name, "--source", "lease", timeout=60
            )
            for line in outcome.stdout.splitlines():
                if self.transport_mac in line:
                    match = _ADDRESS.search(line)
                    if match:
                        return match.group(1)
            if time.monotonic() >= deadline:
                return None
            self.sleeper(5)

    def create(self) -> EnvironmentHandle:
        """Declare the domain with Pulumi, then find the address it was given."""
        self.prepare_identity()
        self.write_declarations()
        self._pulumi(
            ["stack", "init", self.stack_name, "--non-interactive"], timeout=600
        )
        applied = self._pulumi(
            ["up", "--yes", "--non-interactive", "--stack", self.stack_name],
            timeout=self.config.timeout_seconds,
        )
        if not applied.ok:
            raise VmContractError(
                "pulumi up did not bring the domain up: "
                + (applied.stderr or applied.stdout).strip()[:500]
            )
        self.address = self.discover_address()
        if not self.address:
            raise VmContractError(
                f"{self.domain_name} took no address on {self.settings.network} within "
                f"{self.settings.address_timeout_seconds} seconds, so nothing can be "
                "run in it"
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
            inside = ["env", *[f"{name}={value}" for name, value in env.items()], *inside]
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
        outcome = self._virsh("shutdown", self.domain_name, timeout=300)
        deadline = time.monotonic() + 120
        while self._domain_running() and time.monotonic() < deadline:
            self.sleeper(5)
        running = self._domain_running()
        if running:
            self._virsh("destroy", self.domain_name, timeout=120)
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
        return "running" in self._virsh("domstate", self.domain_name, timeout=60).stdout.lower()

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
        self._virsh("pool-refresh", self.settings.pool, timeout=120)
        return DestroyReport(
            removed=tuple(removed),
            retained=(f"image:{self.settings.base_image}",),
            detail="the domain, the overlay, the seed and the stack were removed; the base was not",
            outcomes=tuple(outcomes),
        )

    def resource_exists(self, resource: Resource) -> bool:
        """Report whether a declared resource is still on this host."""
        if resource.kind in ("path", "image", "volume"):
            return Path(resource.identifier).exists()
        if resource.kind == "domain":
            listed = self._virsh("list", "--all", "--name")
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
            "pool": self.settings.pool,
            "network": self.settings.network,
            "base_image": str(self.settings.base_image),
            "base_volume": self.settings.base_volume_name,
            "base_image_sha256": self.settings.base_image_sha256,
            "graphics": self.settings.graphics,
            "listen_address": self.settings.listen_address,
            "transport_mac": self.transport_mac,
            "egress_interface": self.settings.egress,
            "address": self.address,
        }
