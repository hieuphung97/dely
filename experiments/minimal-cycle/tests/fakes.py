"""A backend adapter that records what the lifecycle asked it to do.

It is a real implementation of the interface over a host directory, not a
mock: the lifecycle's ordering claims are checked against what actually
happened to files, and the recorded call list is what proves the order.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Mapping, Sequence

from cycle_runner import probe, proc
from cycle_runner.adapters.base import (
    BackendAdapter,
    DestroyReport,
    EnvironmentHandle,
    Finding,
    PreflightReport,
    Resource,
    StopReport,
)

HOST = {
    "hostname": "workshop",
    "machine_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "boot_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "home": "/home/someone",
    "user": "someone",
    "path": "/usr/bin:/bin",
    "pid": "1",
    "uname": "linux workshop amd64",
    "container_marker": "",
    "virt": "none",
    "orca_path": "/usr/bin/orca",
    "orca_version": "1.4.201",
    "project_real": "/home/someone/code/under-test",
}


ORCA_DISPATCH_REPLY = (
    '{"runId": "run-fake", "dispatchId": "dispatch-fake", '
    '"messages": [{"type": "worker_done", "outcome": "DONE"}]}'
)


def render(snapshot: Mapping[str, str]) -> str:
    return "".join(f"{key}={value}\n" for key, value in snapshot.items())


class FakeAdapter(BackendAdapter):
    """An environment that is really just a directory on the host."""

    name = "fake"

    def __init__(
        self,
        root: Path,
        *,
        preflight_ok: bool = True,
        identity: str = "environment",
        orca_present: bool = True,
        check_exit_code: int = 0,
        task_hangs: bool = False,
        fetch_fails: bool = False,
        stop_confirmed: bool = True,
        leave_residue: bool = False,
        marker: str = "dely-cycle-marker",
        orca_path_from_host: bool = False,
        create_fails: bool = False,
        task_writes_nothing: bool = False,
        host_project: Path | None = None,
    ):
        self.root = Path(root)
        self.home = self.root / "home"
        self.project = self.home / "project"
        self.shared_base = self.root.parent / "shared" / "base.img"
        self.calls: list[str] = []
        self.preflight_ok = preflight_ok
        self.identity = identity
        self.orca_present = orca_present
        self.check_exit_code = check_exit_code
        self.task_hangs = task_hangs
        self.fetch_fails = fetch_fails
        self.stop_confirmed = stop_confirmed
        self.leave_residue = leave_residue
        self.marker = marker
        self.orca_path_from_host = orca_path_from_host
        self.create_fails = create_fails
        self.task_writes_nothing = task_writes_nothing
        self.host_project = host_project
        self.destroyed = False

    # -- lifecycle --------------------------------------------------------

    def preflight(self) -> PreflightReport:
        self.calls.append("preflight")
        return PreflightReport(
            backend=self.name,
            findings=(
                Finding(
                    name="fake backend",
                    ok=self.preflight_ok,
                    detail="configured by the test",
                ),
            ),
        )

    def plan_handle(self) -> EnvironmentHandle:
        return EnvironmentHandle(
            environment_id=f"fake-{self.root.name}",
            home_path=str(self.home),
            project_path=str(self.project),
            per_run_resources=(Resource(kind="path", identifier=str(self.home)),),
            shared_resources=(Resource(kind="image", identifier=str(self.shared_base)),),
            description={"image": "fake"},
        )

    def create(self) -> EnvironmentHandle:
        self.calls.append("create")
        self.project.mkdir(parents=True, exist_ok=True)
        if self.create_fails:
            self.shared_base.parent.mkdir(parents=True, exist_ok=True)
            self.shared_base.write_bytes(b"shared base image")
            raise RuntimeError("the container manager refused halfway through")
        self.shared_base.parent.mkdir(parents=True, exist_ok=True)
        self.shared_base.write_bytes(b"shared base image")
        return EnvironmentHandle(
            environment_id=f"fake-{self.root.name}",
            home_path=str(self.home),
            project_path=str(self.project),
            per_run_resources=(Resource(kind="path", identifier=str(self.home)),),
            shared_resources=(Resource(kind="image", identifier=str(self.shared_base)),),
            description={"image": "fake"},
        )

    def _host_snapshot_text(self) -> str:
        target = str(self.host_project or self.project)
        return proc.run(probe.probe_argv(target), timeout=30, context="host").stdout

    def _snapshot(self) -> str:
        if self.identity == "host":
            # The counterexample: the command really did run on the host, so the
            # probe answers with the host's own values rather than a stand-in.
            return self._host_snapshot_text()
        environment = dict(HOST)
        environment.update(
            {
                "hostname": "fake-box",
                "machine_id": "cccccccccccccccccccccccccccccccc",
                "boot_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
                "home": str(self.home),
                "container_marker": "containerenv",
                "project_real": str(self.project),
                "orca_path": self._orca_path(),
                "orca_version": "1.4.201" if self.orca_present else "",
            }
        )
        return render(environment)

    def _orca_path(self) -> str:
        if not self.orca_present:
            return ""
        if self.orca_path_from_host:
            return probe.parse(self._host_snapshot_text()).get("orca_path", "")
        return "/usr/bin/orca"

    def execute(
        self,
        argv: Sequence[str],
        *,
        timeout: float,
        cwd: str | None = None,
        env: Mapping[str, str] | None = None,
        extra_values: Sequence[str] = (),
    ) -> proc.CommandOutcome:
        joined = " ".join(argv)
        if probe.PROBE_SCRIPT in joined:
            self.calls.append("probe")
            return self._outcome(argv, 0, self._snapshot(), "")
        if "orchestration" in joined:
            self.calls.append("worker")
            if self.task_hangs:
                return self._outcome(argv, None, "", "deadline reached", timed_out=True)
            if not self.task_writes_nothing:
                self.project.mkdir(parents=True, exist_ok=True)
                (self.project / "evidence.txt").write_text(self.marker, encoding="utf-8")
            return self._outcome(argv, 0, ORCA_DISPATCH_REPLY, "")
        if tuple(argv[:2]) == ("orca", "status"):
            self.calls.append("orca-status")
            return self._outcome(argv, 0, '{"ready": true}', "")
        if "cycle-check" in joined:
            self.calls.append("check")
        else:
            self.calls.append(f"execute:{argv[0]}")
        return proc.run(
            argv,
            timeout=timeout,
            context="environment",
            cwd=cwd,
            env=env,
            extra_values=extra_values,
        )

    def _outcome(self, argv, exit_code, stdout, stderr, timed_out=False):
        return proc.CommandOutcome(
            argv=tuple(argv),
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            started_at="2026-09-14T22:15:30Z",
            finished_at="2026-09-14T22:15:31Z",
            elapsed_seconds=1.0,
            timed_out=timed_out,
            context="environment",
        )

    def put_tree(self, local_dir: Path, remote_dir: str) -> None:
        self.calls.append("put_tree")
        destination = Path(remote_dir)
        destination.mkdir(parents=True, exist_ok=True)
        for path in sorted(Path(local_dir).rglob("*")):
            if path.is_file():
                target = destination / path.relative_to(local_dir)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(path.read_bytes())

    def fetch_tree(self, remote_dir: str, local_dir: Path) -> None:
        self.calls.append("fetch_tree")
        if self.fetch_fails:
            raise OSError("the transport refused to copy the tree out")
        source = Path(remote_dir)
        Path(local_dir).mkdir(parents=True, exist_ok=True)
        for path in sorted(source.rglob("*")):
            if path.is_file():
                target = Path(local_dir) / path.relative_to(source)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(path.read_bytes())

    def write_file(self, remote_path: str, content: str, *, mode: int = 0o600) -> None:
        self.calls.append("write_file")
        target = Path(remote_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        target.chmod(mode)

    def stop(self) -> StopReport:
        self.calls.append("stop")
        return StopReport(
            confirmed=self.stop_confirmed,
            detail="stopped by the fake adapter"
            if self.stop_confirmed
            else "the fake adapter could not confirm the stop",
        )

    def destroy(self) -> DestroyReport:
        self.calls.append("destroy")
        if not self.leave_residue and self.home.exists():
            shutil.rmtree(self.home)
        self.destroyed = True
        return DestroyReport(
            removed=() if self.leave_residue else (str(self.home),),
            retained=(str(self.shared_base),),
            detail="fake destroy",
        )

    def resource_exists(self, resource: Resource) -> bool:
        return Path(resource.identifier).exists()

    def describe(self) -> dict:
        return {"backend": self.name, "image": "fake"}


class ScriptedAdapter(FakeAdapter):
    """A fake whose command answers are chosen by matching the argv."""

    def __init__(self, root: Path, script=None, **options):
        super().__init__(root, **options)
        self.script = list(script or [])
        self.executed: list[tuple[str, ...]] = []
        self.written: list[tuple[str, str, int]] = []

    def execute(
        self,
        argv,
        *,
        timeout: float,
        cwd=None,
        env=None,
        extra_values=(),
    ):
        argv = tuple(argv)
        self.executed.append(argv)
        joined = " ".join(argv)
        for needle, exit_code, stdout, stderr, timed_out in self.script:
            if needle in joined:
                return self._outcome(argv, exit_code, stdout, stderr, timed_out)
        return self._outcome(argv, 0, "", "")

    def write_file(self, remote_path: str, content: str, *, mode: int = 0o600) -> None:
        self.written.append((remote_path, content, mode))
        super().write_file(remote_path, content, mode=mode)
