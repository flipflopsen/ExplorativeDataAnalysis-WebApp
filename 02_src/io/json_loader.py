"""JSON loader supporting record arrays, nested objects, and NDJSON."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


def load_json(
    path: str | Path,
    record_path: str | None = None,
    lines: bool = False,
) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)

    if lines:
        return pd.read_json(p, lines=True)

    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if record_path:
        for key in record_path.split("."):
            data = data[key]

    if isinstance(data, list):
        return pd.json_normalize(data)
    if isinstance(data, dict):
        # Single-record dict → 1-row frame
        return pd.json_normalize([data])
    raise ValueError(f"Unsupported JSON top-level type: {type(data).__name__}")
