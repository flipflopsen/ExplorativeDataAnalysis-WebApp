"""Selection-driven aggregation and chart-kind suggestions."""
from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ...models.schemas import ChartKind, ChartSuggestion, VizAggregateRequest
from ...utils.cache import DATASETS
from ...utils.schema_infer import _classify

router = APIRouter()


def _subset(req: VizAggregateRequest) -> pd.DataFrame:
    try:
        df = DATASETS.get(req.dataset_id)
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {req.dataset_id}")
    missing = [c for c in req.features if c not in df.columns]
    if missing:
        raise HTTPException(400, f"Unknown columns: {missing}")
    if req.node_ids:
        idx = np.asarray(req.node_ids, dtype=int)
        idx = idx[(idx >= 0) & (idx < df.shape[0])]
        df = df.iloc[idx]
    return df[req.features]


@router.post("/aggregate")
def aggregate(req: VizAggregateRequest) -> dict:
    sub = _subset(req)

    if req.kind == "histogram":
        if len(req.features) != 1:
            raise HTTPException(400, "histogram needs exactly 1 feature")
        col = req.features[0]
        s = pd.to_numeric(sub[col], errors="coerce").dropna()
        if s.empty:
            return {"kind": "histogram", "feature": col, "bins": [], "counts": []}
        counts, edges = np.histogram(s.to_numpy(), bins=req.bins)
        return {
            "kind": "histogram",
            "feature": col,
            "bin_edges": edges.tolist(),
            "counts": counts.tolist(),
        }

    if req.kind == "scatter":
        if len(req.features) < 2:
            raise HTTPException(400, "scatter needs ≥2 features")
        xc, yc = req.features[:2]
        cc = req.features[2] if len(req.features) >= 3 else None
        out = {
            "kind": "scatter",
            "x": pd.to_numeric(sub[xc], errors="coerce").tolist(),
            "y": pd.to_numeric(sub[yc], errors="coerce").tolist(),
            "x_label": xc,
            "y_label": yc,
        }
        if cc is not None:
            out["color"] = sub[cc].astype(str).tolist()
            out["color_label"] = cc
        return out

    if req.kind == "corr":
        nums = sub.apply(pd.to_numeric, errors="coerce")
        nums = nums.dropna(axis=1, how="all")
        if nums.shape[1] < 2:
            raise HTTPException(400, "corr needs ≥2 numeric features")
        corr = nums.corr().fillna(0.0)
        return {
            "kind": "corr",
            "labels": corr.columns.tolist(),
            "matrix": corr.to_numpy().tolist(),
        }

    if req.kind == "box":
        out_series: list[dict] = []
        for c in req.features:
            s = pd.to_numeric(sub[c], errors="coerce").dropna()
            out_series.append({"feature": c, "values": s.tolist()})
        return {"kind": "box", "series": out_series}

    if req.kind == "parallel":
        nums = sub.apply(pd.to_numeric, errors="coerce")
        return {
            "kind": "parallel",
            "features": nums.columns.tolist(),
            "rows": nums.fillna(0.0).to_numpy().tolist(),
        }

    if req.kind == "heatmap" or req.kind == "hexbin":
        if len(req.features) < 2:
            raise HTTPException(400, f"{req.kind} needs ≥2 features")
        xc, yc = req.features[:2]
        x = pd.to_numeric(sub[xc], errors="coerce")
        y = pd.to_numeric(sub[yc], errors="coerce")
        mask = x.notna() & y.notna()
        h, xe, ye = np.histogram2d(x[mask].to_numpy(), y[mask].to_numpy(), bins=req.bins)
        return {
            "kind": req.kind,
            "x_label": xc,
            "y_label": yc,
            "x_edges": xe.tolist(),
            "y_edges": ye.tolist(),
            "counts": h.tolist(),
        }

    if req.kind == "map":
        if len(req.features) < 2:
            raise HTTPException(400, "map needs lat,lon features")
        lat, lon = req.features[:2]
        return {
            "kind": "map",
            "lat": pd.to_numeric(sub[lat], errors="coerce").tolist(),
            "lon": pd.to_numeric(sub[lon], errors="coerce").tolist(),
        }

    raise HTTPException(400, f"Unknown chart kind {req.kind}")


@router.get("/suggest", response_model=list[ChartSuggestion])
def suggest(
    dataset_id: str,
    features: str = Query(..., description="Comma-separated feature names"),
) -> list[ChartSuggestion]:
    try:
        df = DATASETS.get(dataset_id)
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {dataset_id}")
    feats = [f.strip() for f in features.split(",") if f.strip()]
    missing = [f for f in feats if f not in df.columns]
    if missing:
        raise HTTPException(400, f"Unknown columns: {missing}")

    dtypes = {f: _classify(df[f]) for f in feats}
    numeric = [f for f, d in dtypes.items() if d in ("int", "float")]
    cat = [f for f, d in dtypes.items() if d in ("string", "category", "bool")]
    geo_pair = _detect_geo(feats)

    out: list[ChartSuggestion] = []
    if geo_pair:
        out.append(ChartSuggestion(kind="map", features=list(geo_pair), score=1.0, reason="lat/lon detected"))
    if len(numeric) == 1:
        out.append(ChartSuggestion(kind="histogram", features=numeric, score=0.95, reason="1 numeric → distribution"))
    if len(numeric) >= 2:
        out.append(ChartSuggestion(kind="scatter", features=numeric[:2], score=0.9, reason="2 numeric → relationship"))
        out.append(ChartSuggestion(kind="hexbin", features=numeric[:2], score=0.7, reason="2 numeric, dense → hex-bin"))
    if len(numeric) >= 3:
        out.append(ChartSuggestion(kind="corr", features=numeric, score=0.85, reason="≥3 numeric → correlation"))
        out.append(ChartSuggestion(kind="parallel", features=numeric, score=0.8, reason="≥3 numeric → parallel coords"))
    if cat and numeric:
        out.append(ChartSuggestion(kind="box", features=numeric, score=0.75, reason="numeric distribution by group"))
    if not out:
        out.append(ChartSuggestion(kind="histogram", features=feats[:1], score=0.3, reason="fallback"))
    out.sort(key=lambda s: s.score, reverse=True)
    return out


def _detect_geo(feats: list[str]) -> tuple[str, str] | None:
    lower = {f.lower(): f for f in feats}
    lats = [v for k, v in lower.items() if k in {"lat", "latitude"}]
    lons = [v for k, v in lower.items() if k in {"lon", "lng", "long", "longitude"}]
    if lats and lons:
        return (lats[0], lons[0])
    return None


_ = ChartKind  # re-export for typing tools
