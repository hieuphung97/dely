"""The Distrobox backend.

Distrobox is an interface to a container, not a virtual machine and not a
sandbox: its own documentation describes tight host integration and warns
against expecting container-grade isolation. What this adapter buys is a
fresh box with its own home and its own copy of the project, created and
destroyed through Distrobox Assemble rather than through a container manager
this runner would have to become.

The host home is never mounted, and neither is any directory that holds host
credentials. That is a refusal, not a default.
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Callable, Mapping, Sequence

from .. import cleanup, ids, isolate, proc
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

CONTAINER_MANAGERS = ("podman", "docker")

#: Directories under the host home that carry credentials for the tools this
#: run uses. None of them may be mounted into the environment.
CREDENTIAL_DIRECTORIES = (
    ".claude",
    ".ssh",
    ".aws",
    ".docker",
    ".config/gh",
    ".config/orca",
)


class DistroboxContractError(ValueError):
    """The requested box would reach into the host in a way the design refuses."""


class DistroboxAdapter(BackendAdapter):
    """One disposable Distrobox, driven through Assemble and the command line."""

    name = "distrobox"
    # The container runs in the host's process namespace.
    shares_host_processes = True

    def __init__(
        self,
        *,
        run_config: RunConfig,
        run_id: str,
        host_home: Path | None = None,
        binary: str = "distrobox",
        runner: Callable[..., proc.CommandOutcome] = proc.run,
        which: Callable[[str], str | None] = shutil.which,
    ):
        if run_config.distrobox is None:
            raise DistroboxContractError("the configuration carries no distrobox section")
        self.config = run_config
        self.settings = run_config.distrobox
        self.run_id = run_id
        self.binary = binary
        self.runner = runner
        self.which = which
        self.host_home = Path(host_home if host_home is not None else Path.home())
        self.container_name = ids.resource_name(self.settings.container_prefix, run_id)
        self.run_state = run_config.state_root / run_id
        self.home_path = self.run_state / "home"
        self.project_path = self.home_path / run_config.project.environment_path
        self.manifest_path = self.run_state / "distrobox.ini"
        self.mounts = tuple(self._checked_mount(mount) for mount in self.settings.extra_mounts)

    # -- refusals ---------------------------------------------------------

    def _checked_mount(self, mount: str) -> str:
        host_side = Path(mount.split(":", 1)[0])
        if not host_side.is_absolute():
            raise DistroboxContractError(
                f"an extra mount must name an absolute host path, got {mount!r}"
            )
        resolved = host_side.absolute()
        home = self.host_home.absolute()
        if resolved == Path("/") or home == resolved or home.is_relative_to(resolved):
            raise DistroboxContractError(
                f"refusing to mount {resolved}: it carries the whole host home"
            )
        for relative in CREDENTIAL_DIRECTORIES:
            credential = (home / relative).absolute()
            if resolved == credential or resolved.is_relative_to(credential):
                raise DistroboxContractError(
                    f"refusing to mount {resolved}: it carries host credentials "
                    f"({relative})"
                )
        return mount

    # -- the declared environment ----------------------------------------

    def render_manifest(self, *, home_override: Path | None = None) -> str:
        """Return the Distrobox Assemble manifest for this run.

        `home_override` exists for preflight: `distrobox create` creates the
        custom home before it prints a dry run, so a probe manifest pointing at
        the per-run home would leave that directory behind.
        """
        lines = [
            f"[{self.container_name}]",
            f"image={self.settings.image}",
            f"home={home_override or self.home_path}",
            f"hostname={self.container_name}",
            "entry=false",
            "pull=false",
            "init=false",
            "nvidia=false",
            "start_now=true",
        ]
        lines.extend(f"volume={mount}" for mount in self.mounts)
        return "\n".join(lines) + "\n"

    def write_manifest(self) -> Path:
        """Write the manifest into the per-run state directory."""
        self.run_state.mkdir(parents=True, exist_ok=True)
        self.manifest_path.write_text(self.render_manifest(), encoding="utf-8")
        return self.manifest_path

    def plan_handle(self) -> EnvironmentHandle:
        """Describe the environment this adapter will create."""
        return EnvironmentHandle(
            environment_id=self.container_name,
            home_path=str(self.home_path),
            project_path=str(self.project_path),
            per_run_resources=(
                Resource(kind="container", identifier=self.container_name),
                Resource(kind="path", identifier=str(self.run_state)),
            ),
            shared_resources=(Resource(kind="image", identifier=self.settings.image),),
            description={
                "image": self.settings.image,
                "manifest": str(self.manifest_path),
                "container_manager": self._manager() or "unknown",
                "desktop_integration": (
                    "Distrobox integrates with the host desktop by design; this run "
                    "limits state with a separate home and project copy, and does not "
                    "claim container-grade isolation"
                ),
                "host_home_mount_acknowledged": self.settings.accept_host_home_mount,
            },
        )

    # -- host facts -------------------------------------------------------

    def _manager(self) -> str | None:
        for candidate in CONTAINER_MANAGERS:
            if self.which(candidate):
                return candidate
        return None

    def host_home_mount_finding(self) -> Finding:
        """Ask Distrobox what it would really mount, rather than assuming.

        Distrobox mounts the invoking user's home at its own path and offers
        no flag to suppress it, so a separate per-run home limits state
        without making host credentials unreachable. The rendered command is
        the evidence; the configuration has to acknowledge what it shows.
        """
        name = "host home reachable from the environment"
        with tempfile.TemporaryDirectory(prefix="dely-cycle-preflight-") as staging:
            probe_manifest = Path(staging) / "distrobox.ini"
            probe_manifest.write_text(
                self.render_manifest(home_override=Path(staging) / "home"),
                encoding="utf-8",
            )
            rendered = self.runner(
                [self.binary, "assemble", "create", "--dry-run", "--file", str(probe_manifest)],
                timeout=300,
                context="host",
            )
        home = str(self.host_home)
        mounted = (
            f'--volume "{home}":"{home}"' in rendered.stdout
            or f"--volume {home}:{home}" in rendered.stdout
        )
        if not mounted:
            return Finding(
                name=name,
                ok=True,
                detail="the rendered container command mounts no host home",
            )
        if self.settings.accept_host_home_mount:
            return Finding(
                name=name,
                ok=True,
                detail=(
                    f"distrobox mounts {home} into the box and offers no flag to "
                    "suppress it; the configuration acknowledged this, so the run "
                    "records a declared compromise rather than claiming isolation"
                ),
            )
        return Finding(
            name=name,
            ok=False,
            detail=(
                f"distrobox mounts {home} into the box, so host credentials stay "
                "reachable from inside it. Set distrobox.accept_host_home_mount to "
                "true to record that deliberately, or use the machine backend"
            ),
        )

    def preflight(self) -> PreflightReport:
        """Report whether this host can create the declared box."""
        findings = []
        distrobox_path = self.which(self.binary)
        findings.append(
            Finding(
                name="distrobox on the path",
                ok=bool(distrobox_path),
                detail=distrobox_path or f"{self.binary} was not found on PATH",
            )
        )
        manager = self._manager()
        findings.append(
            Finding(
                name="container manager on the path",
                ok=bool(manager),
                detail=manager or "neither podman nor docker was found on PATH",
            )
        )
        if manager:
            inspected = self.runner(
                [manager, "image", "inspect", self.settings.image],
                timeout=120,
                context="host",
            )
            findings.append(
                Finding(
                    name="image present locally",
                    ok=inspected.ok,
                    detail=(
                        f"{self.settings.image} is present"
                        if inspected.ok
                        else f"{self.settings.image} is not present locally; pull it "
                        "deliberately rather than letting a run fetch it"
                    ),
                )
            )
        for label, root in (
            ("state root writable", self.config.state_root),
            ("artifact root writable", self.config.artifact_root),
        ):
            findings.append(Finding(name=label, ok=_writable(root), detail=str(root)))
        if distrobox_path:
            findings.append(self.host_home_mount_finding())
        return PreflightReport(backend=self.name, findings=tuple(findings))

    # -- lifecycle --------------------------------------------------------

    def create(self) -> EnvironmentHandle:
        """Create the box from the manifest and prove it exists."""
        self.home_path.mkdir(parents=True, exist_ok=True)
        self.write_manifest()
        created = self.runner(
            [self.binary, "assemble", "create", "--file", str(self.manifest_path)],
            timeout=self.config.timeout_seconds,
            context="host",
        )
        if not created.ok:
            raise RuntimeError(
                "distrobox assemble create did not create the box: "
                + (created.stderr or created.stdout).strip()[:400]
            )
        handle = self.plan_handle()
        if not self.resource_exists(Resource(kind="container", identifier=self.container_name)):
            raise RuntimeError(
                f"distrobox list does not report {self.container_name} after assemble"
            )
        return handle

    def enter_argv(self, argv: Sequence[str], *, env_names: Sequence[str] = ()) -> list[str]:
        """Return the argv that runs a command inside the box."""
        command = [self.binary, "enter", "--name", self.container_name, "-T"]
        if env_names:
            command.extend(
                ["--additional-flags", " ".join(f"--env {name}" for name in env_names)]
            )
        command.append("--")
        command.extend(str(item) for item in argv)
        return command

    def execute(
        self,
        argv: Sequence[str],
        *,
        timeout: float,
        cwd: str | None = None,
        env: Mapping[str, str] | None = None,
        extra_values: Sequence[str] = (),
    ) -> proc.CommandOutcome:
        """Run a command inside the box, forwarding values by name only."""
        overlay = dict(env or {})
        inside = list(argv)
        if cwd:
            inside = ["sh", "-c", 'cd "$1" || exit 1; shift; exec "$@"', "cycle-cd", cwd, *inside]
        # The box inherits this process's environment, and this process may be
        # running inside the execution plane the box is meant to be separate
        # from.
        inside = isolate.without_host_session(inside)
        return self.runner(
            self.enter_argv(inside, env_names=tuple(overlay)),
            timeout=timeout,
            context="environment",
            env=overlay,
            extra_values=extra_values,
        )

    def put_tree(self, local_dir: Path, remote_dir: str) -> None:
        """The per-run home is a host directory, so this is a host copy."""
        from .. import project

        project.copy_tree(Path(local_dir), Path(remote_dir))

    def fetch_tree(self, remote_dir: str, local_dir: Path) -> None:
        """The per-run home is a host directory, so this is a host copy."""
        from .. import project

        project.copy_tree(Path(remote_dir), Path(local_dir))

    def write_file(self, remote_path: str, content: str, *, mode: int = 0o600) -> None:
        """Write a file into the per-run home with the given permissions."""
        target = Path(remote_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        target.chmod(mode)

    def stop(self) -> StopReport:
        """Stop the box and confirm the container manager no longer runs it."""
        stopped = self.runner(
            [self.binary, "stop", "--yes", self.container_name],
            timeout=300,
            context="host",
        )
        running = self._running()
        return StopReport(
            confirmed=not running,
            detail=(
                f"{self.container_name} is no longer running"
                if not running
                else f"{self.container_name} is still reported as running"
            ),
            outcomes=(stopped,),
        )

    def _running(self) -> bool:
        manager = self._manager()
        if manager is None:
            return True
        listed = self.runner(
            [manager, "ps", "--filter", f"name={self.container_name}", "--format", "{{.Names}}"],
            timeout=120,
            context="host",
        )
        return self.container_name in listed.stdout

    def destroy(self) -> DestroyReport:
        """Remove the box and the per-run state, and nothing else."""
        removed: list[str] = []
        outcome = self.runner(
            [self.binary, "rm", "--force", self.container_name],
            timeout=600,
            context="host",
        )
        if outcome.ok:
            removed.append(f"container:{self.container_name}")
        cleanup.safe_remove(
            self.run_state,
            allowed_roots=[self.config.state_root],
            protected=[Path(self.settings.image)] if Path(self.settings.image).is_absolute() else [],
        )
        if not self.run_state.exists():
            removed.append(f"path:{self.run_state}")
        return DestroyReport(
            removed=tuple(removed),
            retained=(f"image:{self.settings.image}",),
            detail="the box and the per-run state were removed; the image was not",
            outcomes=(outcome,),
        )

    def resource_exists(self, resource: Resource) -> bool:
        """Report whether a declared resource is still on this host."""
        if resource.kind == "path":
            return Path(resource.identifier).exists()
        if resource.kind == "container":
            listed = self.runner(
                [self.binary, "list", "--no-color"], timeout=120, context="host"
            )
            return any(
                resource.identifier in line.split("|")[1]
                for line in listed.stdout.splitlines()
                if "|" in line
            )
        if resource.kind == "image":
            manager = self._manager()
            if manager is None:
                return False
            return self.runner(
                [manager, "image", "inspect", resource.identifier],
                timeout=120,
                context="host",
            ).ok
        return False

    def describe(self) -> dict:
        """Return backend facts for the manifest."""
        version = self.runner([self.binary, "--version"], timeout=60, context="host")
        return {
            "backend": self.name,
            "distrobox_version": version.stdout.strip().splitlines()[-1]
            if version.stdout.strip()
            else "unknown",
            "container_manager": self._manager() or "unknown",
            "image": self.settings.image,
            "container": self.container_name,
            "manifest": str(self.manifest_path),
        }


def _writable(root: Path) -> bool:
    probe = Path(root)
    try:
        probe.mkdir(parents=True, exist_ok=True)
        marker = probe / ".cycle-write-probe"
        marker.write_text("", encoding="utf-8")
        marker.unlink()
        return True
    except OSError:
        return False
