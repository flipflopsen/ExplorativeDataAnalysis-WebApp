"""Aggregate stats for a column-subset selection."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...utils.cache import DATASETS

router = APIRouter()


class StatsRequest(BaseModel):
    dataset_id: str
    node_ids: list[int] | None = None  # None = all rows
    columns: list[str] | None = None  # None = all columns
    top_k: int = 5


def _safe(v):
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
    if hasattr(v, "item"):
        try:
            return _safe(v.item())
        except Exception:  # noqa: BLE001
            pass
    return v


@router.post("/stats")
def column_stats(req: StatsRequest) -> dict:
    try:
        df = DATASETS.get(req.dataset_id)
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {req.dataset_id}")

    if req.node_ids:
        ids = np.asarray(req.node_ids, dtype=int)
        ids = ids[(ids >= 0) & (ids < df.shape[0])]
        sub = df.iloc[ids]
    else:
        sub = df

    cols = req.columns or list(df.columns)
    out: list[dict] = []
    for c in cols:
        if c not in df.columns:
            continue
        s = sub[c]
        n = int(s.shape[0])
        n_null = int(s.isna().sum())
        if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
            vals = pd.to_numeric(s, errors="coerce").dropna()
            if vals.empty:
                out.append({"column": c, "kind": "numeric", "n": n, "n_null": n_null})
                continue
            out.append(
                {
                    "column": c,
                    "kind": "numeric",
                    "n": n,
                    "n_null": n_null,
                    "min": _safe(float(vals.min())),
                    "max": _safe(float(vals.max())),
                    "mean": _safe(float(vals.mean())),
                    "median": _safe(float(vals.median())),
                    "std": _safe(float(vals.std())) if vals.shape[0] > 1 else 0.0,
                }
            )
        else:
            vc = s.dropna().astype(str).value_counts().head(req.top_k)
            out.append(
                {
                    "column": c,
                    "kind": "categorical",
                    "n": n,
                    "n_null": n_null,
                    "n_unique": int(s.nunique(dropna=True)),
                    "top": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
                }
            )
    return {"n_rows": int(sub.shape[0]), "columns": out}
