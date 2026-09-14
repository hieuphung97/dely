"""Backend adapters behind one interface."""

from __future__ import annotations

from typing import Any

from ..config import RunConfig
from .base import BackendAdapter

__all__ = ["BackendAdapter", "build"]


def build(*, run_config: RunConfig, run_id: str, **options: Any) -> BackendAdapter:
    """Return the adapter the configuration selected."""
    if run_config.backend == "distrobox":
        from .distrobox import DistroboxAdapter

        return DistroboxAdapter(run_config=run_config, run_id=run_id, **options)
    if run_config.backend == "vm":
        from .vm import VmAdapter

        return VmAdapter(run_config=run_config, run_id=run_id, **options)
    raise ValueError(f"no adapter for backend {run_config.backend!r}")
