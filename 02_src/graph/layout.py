"""Layout dispatcher. Prefers client-side (Cosmograph) when graph is large."""
from __future__ import annotations

from typing import Literal

LayoutStrategy = Literal["client_force", "server_force_atlas2", "spring"]


def suggest_layout(n_nodes: int, n_edges: int) -> LayoutStrategy:
    if n_nodes > 5_000:
        return "client_force"
    try:
        import cugraph  # type: ignore  # noqa: F401

        return "server_force_atlas2"
    except Exception:  # noqa: BLE001
        return "spring"
