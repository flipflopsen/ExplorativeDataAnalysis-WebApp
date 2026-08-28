"""Config + single-row + column-values endpoints."""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ...utils.cache import DATASETS

log = logging.getLogger(__name__)
router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = REPO_ROOT / "graph_config.json"


@router.get("/config")
def get_config() -> dict:
    if not CONFIG_PATH.exists():
        raise HTTPException(404, f"graph_config.json not found at {CONFIG_PATH}")
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Invalid graph_config.json: {exc}") from exc


def _json_safe(v):
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if hasattr(v, "item"):
        try:
            return _json_safe(v.item())
        except Exception:  # noqa: BLE001
            pass
    if isinstance(v, (int, str, bool)):
        return v
    return str(v)


@router.get("/datasets/{dataset_id}/row/{idx}")
def get_row(dataset_id: str, idx: int) -> dict:
    try:
        df = DATASETS.get(dataset_id)
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {dataset_id}")
    if idx < 0 or idx >= df.shape[0]:
        raise HTTPException(400, f"row index {idx} out of range [0, {df.shape[0]})")
    row = df.iloc[idx]
    return {"index": idx, "values": {str(k): _json_safe(v) for k, v in row.items()}}


@router.get("/datasets/{dataset_id}/column/{col}")
def get_column(dataset_id: str, col: str) -> dict:
    """Return a column's values for client-side coloring (numeric or categorical)."""
    try:
        df = DATASETS.get(dataset_id)
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {dataset_id}")
    if col not in df.columns:
        raise HTTPException(400, f"Unknown column {col}")
    s = df[col]
    values: list = [_json_safe(v) for v in s.tolist()]
    is_numeric = bool(s.dtype.kind in ("i", "f", "u"))
    return {
        "column": col,
        "n": int(s.shape[0]),
        "is_numeric": is_numeric,
        "values": values,
    }
