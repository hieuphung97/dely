"""The run configuration.

One document names the backend, the pinned revisions and versions, the single
task and the single check, where artifacts land, and how the environment
authenticates. It never names a credential value: a key whose name means
"secret" is refused, and so is a value that redaction would change.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Mapping, Sequence

from . import redact

try:  # pragma: no cover - environment dependent
    import yaml as _DEFAULT_YAML
except ImportError:  # pragma: no cover - environment dependent
    _DEFAULT_YAML = None

BACKENDS = ("distrobox", "vm")
AUTH_MODES = ("existing_login", "short_lived_token", "api_key_helper")

#: Keys whose name mentions a secret but whose value is the *name* of
#: something rather than the thing itself.
NAME_ONLY_KEYS = frozenset({"token_env"})

_UNSET = object()


class ConfigError(ValueError):
    """The configuration document cannot be used as written."""


def _fail(message: str) -> None:
    raise ConfigError(message)


def _section(document: Mapping[str, Any], name: str, *, required: bool) -> dict:
    value = document.get(name)
    if value is None:
        if required:
            _fail(f"missing required section: {name}")
        return {}
    if not isinstance(value, Mapping):
        _fail(f"section {name} must be a mapping")
    return dict(value)


def _reject_unknown(document: Mapping[str, Any], allowed: Sequence[str], where: str) -> None:
    for key in document:
        if key not in allowed:
            _fail(f"unknown key in {where}: {key}")


def _text(document: Mapping[str, Any], key: str, where: str, default=_UNSET) -> str:
    if key not in document:
        if default is _UNSET:
            _fail(f"missing required field: {where}.{key}" if where else f"missing required field: {key}")
        return default
    value = document[key]
    if not isinstance(value, str) or not value.strip():
        _fail(f"field {where}.{key} must be a non-empty string" if where else f"field {key} must be a non-empty string")
    return value


def _positive_int(document: Mapping[str, Any], key: str, where: str, default=_UNSET) -> int:
    if key not in document:
        if default is _UNSET:
            _fail(f"missing required field: {key}")
        return default
    value = document[key]
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        _fail(f"field {key} must be a positive whole number, got {value!r}")
    return value


def _absolute(document: Mapping[str, Any], key: str) -> Path:
    raw = _text(document, key, "")
    path = Path(raw)
    if not path.is_absolute():
        _fail(f"field {key} must be an absolute path, got {raw!r}")
    return path


def _relative(value: str, where: str) -> str:
    candidate = Path(value)
    if candidate.is_absolute() or ".." in candidate.parts:
        _fail(f"{where} must be a relative path that stays inside its root, got {value!r}")
    return candidate.as_posix()


def _argv(document: Mapping[str, Any], key: str, where: str, default=_UNSET) -> tuple[str, ...]:
    if key not in document:
        if default is _UNSET:
            _fail(f"missing required field: {where}.{key}")
        return tuple(default)
    value = document[key]
    if not isinstance(value, (list, tuple)) or not value:
        _fail(f"field {where}.{key} must be a non-empty list of strings")
    for item in value:
        if not isinstance(item, str):
            _fail(f"field {where}.{key} must contain only strings")
    return tuple(value)


def refuse_secrets(document: Any, trail: str = "") -> None:
    """Refuse a document that names a secret or carries a secret-shaped value."""
    if isinstance(document, Mapping):
        for key, value in document.items():
            here = f"{trail}.{key}" if trail else str(key)
            if (
                isinstance(key, str)
                and key not in NAME_ONLY_KEYS
                and redact.SENSITIVE_KEY.match(key)
            ):
                _fail(f"configuration key names a secret and must not exist: {here}")
            refuse_secrets(value, here)
    elif isinstance(document, (list, tuple)):
        for index, item in enumerate(document):
            refuse_secrets(item, f"{trail}[{index}]")
    elif isinstance(document, str):
        if not redact.looks_secret_free(document):
            _fail(f"configuration value looks like a secret at {trail or 'the document root'}")


@dataclass(frozen=True)
class ProjectConfig:
    source: Path
    revision: str
    environment_path: str = "project"

    def to_document(self) -> dict[str, Any]:
        return {
            "source": str(self.source),
            "revision": self.revision,
            "environment_path": self.environment_path,
        }


@dataclass(frozen=True)
class TaskConfig:
    marker: str
    relative_path: str
    prompt_path: str | None = None

    def to_document(self) -> dict[str, Any]:
        document: dict[str, Any] = {
            "marker": self.marker,
            "relative_path": self.relative_path,
        }
        if self.prompt_path is not None:
            document["prompt_path"] = self.prompt_path
        return document


@dataclass(frozen=True)
class CheckConfig:
    relative_path: str
    expected_marker: str

    def to_document(self) -> dict[str, Any]:
        return {
            "relative_path": self.relative_path,
            "expected_marker": self.expected_marker,
        }


@dataclass(frozen=True)
class AuthConfig:
    mode: str
    reference: str
    allowlist: tuple[str, ...] = ()
    token_env: str | None = None
    helper_argv: tuple[str, ...] = ()

    def to_document(self) -> dict[str, Any]:
        document: dict[str, Any] = {"mode": self.mode, "reference": self.reference}
        if self.allowlist:
            document["allowlist"] = list(self.allowlist)
        if self.token_env is not None:
            document["token_env"] = self.token_env
        if self.helper_argv:
            document["helper_argv"] = list(self.helper_argv)
        return document


@dataclass(frozen=True)
class OrcaConfig:
    version: str
    model: str
    effort: str
    agent: str = "claude"
    status_argv: tuple[str, ...] = ("orca", "status", "--json")
    version_argv: tuple[str, ...] = ("orca", "--version")
    run_objective: str = "dely minimal cycle"

    def to_document(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "model": self.model,
            "effort": self.effort,
            "agent": self.agent,
            "status_argv": list(self.status_argv),
            "version_argv": list(self.version_argv),
            "run_objective": self.run_objective,
        }


@dataclass(frozen=True)
class DistroboxConfig:
    image: str
    container_prefix: str
    extra_mounts: tuple[str, ...] = ()
    provision: tuple[tuple[str, ...], ...] = ()

    def to_document(self) -> dict[str, Any]:
        return {
            "image": self.image,
            "container_prefix": self.container_prefix,
            "extra_mounts": list(self.extra_mounts),
            "provision": [list(argv) for argv in self.provision],
        }


@dataclass(frozen=True)
class VmConfig:
    provider: str
    provider_version: str
    stack_prefix: str
    base_image: Path
    base_image_sha256: str
    guest_user: str
    pulumi_binary: str = "pulumi"
    connect_uri: str = "qemu:///session"
    overlay_size: str = "24g"
    memory_mb: int = 4096
    vcpus: int = 2
    graphics: str = "spice"
    transport: str = "ssh"
    provision: tuple[tuple[str, ...], ...] = ()

    def to_document(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "provider_version": self.provider_version,
            "stack_prefix": self.stack_prefix,
            "base_image": str(self.base_image),
            "base_image_sha256": self.base_image_sha256,
            "guest_user": self.guest_user,
            "pulumi_binary": self.pulumi_binary,
            "connect_uri": self.connect_uri,
            "overlay_size": self.overlay_size,
            "memory_mb": self.memory_mb,
            "vcpus": self.vcpus,
            "graphics": self.graphics,
            "transport": self.transport,
            "provision": [list(argv) for argv in self.provision],
        }


@dataclass(frozen=True)
class RunConfig:
    backend: str
    tested_revision: str
    dely_revision: str
    claude_code_version: str
    timeout_seconds: int
    artifact_root: Path
    state_root: Path
    project: ProjectConfig
    task: TaskConfig
    check: CheckConfig
    auth: AuthConfig
    orca: OrcaConfig
    distrobox: DistroboxConfig | None = None
    vm: VmConfig | None = None
    source_path: Path | None = field(default=None, compare=False)

    def to_document(self) -> dict[str, Any]:
        document: dict[str, Any] = {
            "backend": self.backend,
            "tested_revision": self.tested_revision,
            "dely_revision": self.dely_revision,
            "claude_code_version": self.claude_code_version,
            "timeout_seconds": self.timeout_seconds,
            "artifact_root": str(self.artifact_root),
            "state_root": str(self.state_root),
            "project": self.project.to_document(),
            "task": self.task.to_document(),
            "check": self.check.to_document(),
            "auth": self.auth.to_document(),
            "orca": self.orca.to_document(),
        }
        if self.distrobox is not None:
            document["distrobox"] = self.distrobox.to_document()
        if self.vm is not None:
            document["vm"] = self.vm.to_document()
        return document

    def with_source(self, path: Path) -> "RunConfig":
        return replace(self, source_path=path)


_TOP_LEVEL = (
    "backend",
    "tested_revision",
    "dely_revision",
    "claude_code_version",
    "timeout_seconds",
    "artifact_root",
    "state_root",
    "project",
    "task",
    "check",
    "auth",
    "orca",
    "distrobox",
    "vm",
)


def _project(document: Mapping[str, Any]) -> ProjectConfig:
    _reject_unknown(document, ("source", "revision", "environment_path"), "project")
    source = Path(_text(document, "source", "project"))
    if not source.is_absolute():
        _fail("field project.source must be an absolute path")
    return ProjectConfig(
        source=source,
        revision=_text(document, "revision", "project"),
        environment_path=_relative(
            _text(document, "environment_path", "project", "project"),
            "project.environment_path",
        ),
    )


def _task(document: Mapping[str, Any]) -> TaskConfig:
    _reject_unknown(document, ("marker", "relative_path", "prompt_path"), "task")
    return TaskConfig(
        marker=_text(document, "marker", "task"),
        relative_path=_relative(
            _text(document, "relative_path", "task"), "task.relative_path"
        ),
        prompt_path=document.get("prompt_path"),
    )


def _check(document: Mapping[str, Any], task: TaskConfig) -> CheckConfig:
    _reject_unknown(document, ("relative_path", "expected_marker"), "check")
    return CheckConfig(
        relative_path=_relative(
            _text(document, "relative_path", "check"), "check.relative_path"
        ),
        expected_marker=_text(document, "expected_marker", "check", task.marker),
    )


def _auth(document: Mapping[str, Any]) -> AuthConfig:
    _reject_unknown(
        document, ("mode", "reference", "allowlist", "token_env", "helper_argv"), "auth"
    )
    mode = _text(document, "mode", "auth")
    if mode not in AUTH_MODES:
        _fail(f"auth.mode must be one of {', '.join(AUTH_MODES)}, got {mode!r}")
    allowlist = tuple(document.get("allowlist") or ())
    for entry in allowlist:
        if not isinstance(entry, str):
            _fail("auth.allowlist must contain only strings")
        _relative(entry, "auth.allowlist entry")
    token_env = document.get("token_env")
    helper_argv = tuple(document.get("helper_argv") or ())
    if mode == "existing_login":
        if not allowlist:
            _fail("auth.allowlist must name at least one relative path for existing_login")
    elif allowlist:
        _fail(f"auth.allowlist is only meaningful for existing_login, not {mode}")
    if mode == "short_lived_token" and not token_env:
        _fail("auth.token_env must name the variable carrying the short-lived token")
    if mode == "api_key_helper" and not helper_argv:
        _fail("auth.helper_argv must name the helper command")
    return AuthConfig(
        mode=mode,
        reference=_text(document, "reference", "auth"),
        allowlist=allowlist,
        token_env=token_env,
        helper_argv=helper_argv,
    )


def _orca(document: Mapping[str, Any]) -> OrcaConfig:
    _reject_unknown(
        document,
        ("version", "model", "effort", "agent", "status_argv", "version_argv", "run_objective"),
        "orca",
    )
    return OrcaConfig(
        version=_text(document, "version", "orca"),
        model=_text(document, "model", "orca"),
        effort=_text(document, "effort", "orca"),
        agent=_text(document, "agent", "orca", "claude"),
        status_argv=_argv(document, "status_argv", "orca", ("orca", "status", "--json")),
        version_argv=_argv(document, "version_argv", "orca", ("orca", "--version")),
        run_objective=_text(document, "run_objective", "orca", "dely minimal cycle"),
    )


def _provision(document: Mapping[str, Any], where: str) -> tuple[tuple[str, ...], ...]:
    raw = document.get("provision") or ()
    if not isinstance(raw, (list, tuple)):
        _fail(f"field {where}.provision must be a list of argv lists")
    steps = []
    for index, argv in enumerate(raw):
        if not isinstance(argv, (list, tuple)) or not argv:
            _fail(f"field {where}.provision[{index}] must be a non-empty argv list")
        for item in argv:
            if not isinstance(item, str):
                _fail(f"field {where}.provision[{index}] must contain only strings")
        steps.append(tuple(argv))
    return tuple(steps)


def _distrobox(document: Mapping[str, Any]) -> DistroboxConfig:
    _reject_unknown(
        document, ("image", "container_prefix", "extra_mounts", "provision"), "distrobox"
    )
    mounts = tuple(document.get("extra_mounts") or ())
    for mount in mounts:
        if not isinstance(mount, str):
            _fail("distrobox.extra_mounts must contain only strings")
    return DistroboxConfig(
        image=_text(document, "image", "distrobox"),
        container_prefix=_text(document, "container_prefix", "distrobox"),
        extra_mounts=mounts,
        provision=_provision(document, "distrobox"),
    )


def _vm(document: Mapping[str, Any]) -> VmConfig:
    _reject_unknown(
        document,
        (
            "provider",
            "provider_version",
            "stack_prefix",
            "base_image",
            "base_image_sha256",
            "guest_user",
            "pulumi_binary",
            "connect_uri",
            "overlay_size",
            "memory_mb",
            "vcpus",
            "graphics",
            "transport",
            "provision",
        ),
        "vm",
    )
    base_image = Path(_text(document, "base_image", "vm"))
    if not base_image.is_absolute():
        _fail("field vm.base_image must be an absolute path")
    digest = _text(document, "base_image_sha256", "vm")
    if len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest):
        _fail("field vm.base_image_sha256 must be a lowercase content digest")
    return VmConfig(
        provider=_text(document, "provider", "vm"),
        provider_version=_text(document, "provider_version", "vm"),
        stack_prefix=_text(document, "stack_prefix", "vm"),
        base_image=base_image,
        base_image_sha256=digest,
        guest_user=_text(document, "guest_user", "vm"),
        pulumi_binary=_text(document, "pulumi_binary", "vm", "pulumi"),
        connect_uri=_text(document, "connect_uri", "vm", "qemu:///session"),
        overlay_size=_text(document, "overlay_size", "vm", "24g"),
        memory_mb=_positive_int(document, "memory_mb", "vm", 4096),
        vcpus=_positive_int(document, "vcpus", "vm", 2),
        graphics=_text(document, "graphics", "vm", "spice"),
        transport=_text(document, "transport", "vm", "ssh"),
        provision=_provision(document, "vm"),
    )


def from_document(document: Mapping[str, Any]) -> RunConfig:
    """Validate a loaded document and return the typed configuration."""
    if not isinstance(document, Mapping):
        _fail("the configuration must be a mapping")
    refuse_secrets(document)
    _reject_unknown(document, _TOP_LEVEL, "the configuration")

    backend = _text(document, "backend", "")
    if backend not in BACKENDS:
        _fail(f"backend must be one of {', '.join(BACKENDS)}, got {backend!r}")

    artifact_root = _absolute(document, "artifact_root")
    state_root = _absolute(document, "state_root")
    if artifact_root.is_relative_to(state_root):
        _fail("artifact_root must not be inside state_root; cleanup would remove the evidence")
    if state_root.is_relative_to(artifact_root):
        _fail("state_root must not be inside artifact_root; cleanup would remove the evidence")

    task = _task(_section(document, "task", required=True))
    distrobox_document = _section(document, "distrobox", required=backend == "distrobox")
    vm_document = _section(document, "vm", required=backend == "vm")
    if backend == "distrobox" and not distrobox_document:
        _fail("backend distrobox requires a distrobox section")
    if backend == "vm" and not vm_document:
        _fail("backend vm requires a vm section")

    return RunConfig(
        backend=backend,
        tested_revision=_text(document, "tested_revision", ""),
        dely_revision=_text(document, "dely_revision", ""),
        claude_code_version=_text(document, "claude_code_version", ""),
        timeout_seconds=_positive_int(document, "timeout_seconds", ""),
        artifact_root=artifact_root,
        state_root=state_root,
        project=_project(_section(document, "project", required=True)),
        task=task,
        check=_check(_section(document, "check", required=True), task),
        auth=_auth(_section(document, "auth", required=True)),
        orca=_orca(_section(document, "orca", required=True)),
        distrobox=_distrobox(distrobox_document) if distrobox_document else None,
        vm=_vm(vm_document) if vm_document else None,
    )


def load(path: Path, *, yaml_module: Any = _UNSET) -> RunConfig:
    """Load a configuration from a JSON or YAML file."""
    path = Path(path)
    raw = path.read_text(encoding="utf-8")
    if path.suffix.lower() in (".yaml", ".yml"):
        parser = _DEFAULT_YAML if yaml_module is _UNSET else yaml_module
        if parser is None:
            _fail(
                f"{path} needs a yaml parser this host does not have; "
                "write the same document as json and pass that instead"
            )
        document = parser.safe_load(raw)
    else:
        document = json.loads(raw)
    return from_document(document).with_source(path)
