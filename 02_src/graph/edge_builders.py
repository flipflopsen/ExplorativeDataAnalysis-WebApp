"""Edge construction strategies for the entity graph.

All builders accept a pandas DataFrame and return a list of
(src_idx, dst_idx, weight) tuples with src_idx < dst_idx (undirected).
"""
from __future__ import annotations

import itertools
import logging
from typing import Iterable

import numpy as np
import pandas as pd

from ..compute import gpu_backend
from ..models.schemas import EdgeRule

log = logging.getLogger(__name__)

Edge = tuple[int, int, float]


def build_edges(df: pd.DataFrame, rule: EdgeRule) -> list[Edge]:
    if rule.kind == "shared_key":
        return _shared_key(df, rule)
    if rule.kind == "knn":
        return _knn(df, rule)
    if rule.kind == "similarity":
        return _similarity(df, rule)
    if rule.kind == "explicit":
        raise NotImplementedError("explicit edges resolved by router, not here")
    raise ValueError(f"Unknown rule kind: {rule.kind}")


def _shared_key(df: pd.DataFrame, rule: EdgeRule) -> list[Edge]:
    if not rule.key_column or rule.key_column not in df.columns:
        raise ValueError(f"shared_key requires existing key_column, got {rule.key_column!r}")
    cap = max(2, rule.max_pairs_per_group)
    edges: list[Edge] = []
    groups = df.groupby(rule.key_column, dropna=True, sort=False).indices
    for _, idx_arr in groups.items():
        if len(idx_arr) < 2:
            continue
        # Cap dense cliques: keep first `cap` members, fully connect them.
        members = list(idx_arr[: int(np.ceil(np.sqrt(2 * cap)))])
        for a, b in itertools.combinations(members, 2):
            edges.append((int(min(a, b)), int(max(a, b)), 1.0))
            if len(edges) >= 5_000_000:  # global safety net
                log.warning("shared_key edge cap hit (5M); truncating")
                return edges
    return _dedupe(edges)


def _knn(df: pd.DataFrame, rule: EdgeRule) -> list[Edge]:
    cols = rule.feature_columns or []
    missing = [c for c in cols if c not in df.columns]
    if not cols or missing:
        raise ValueError(f"knn requires existing feature_columns, missing={missing}")
    sub = df[cols].select_dtypes(include="number")
    if sub.shape[1] == 0:
        raise ValueError("knn requires numeric feature_columns")
    idx = gpu_backend.knn_indices(sub, rule.k)
    n = idx.shape[0]
    edges: list[Edge] = []
    for i in range(n):
        for j in idx[i]:
            j = int(j)
            if j == i:
                continue
            a, b = (i, j) if i < j else (j, i)
            edges.append((a, b, 1.0))
    return _dedupe(edges)


def _similarity(df: pd.DataFrame, rule: EdgeRule) -> list[Edge]:
    cols = rule.feature_columns or []
    if not cols:
        raise ValueError("similarity requires feature_columns")
    sub = df[cols].select_dtypes(include="number")
    if sub.shape[1] == 0:
        raise ValueError("similarity (cosine) requires numeric feature_columns")
    X = np.nan_to_num(sub.to_numpy(dtype="float64", copy=False))
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    Xn = X / norms
    # For very large n this O(n^2) is prohibitive; gate at 5k rows.
    n = Xn.shape[0]
    if n > 5000:
        raise ValueError(f"similarity rule restricted to ≤5000 rows (got {n}); use knn instead")
    sims = Xn @ Xn.T
    iu, ju = np.triu_indices(n, k=1)
    mask = sims[iu, ju] >= rule.threshold
    return [(int(a), int(b), float(sims[a, b])) for a, b in zip(iu[mask], ju[mask])]


def _dedupe(edges: Iterable[Edge]) -> list[Edge]:
    seen: dict[tuple[int, int], float] = {}
    for a, b, w in edges:
        key = (a, b)
        # Keep max weight on duplicates
        if key not in seen or w > seen[key]:
            seen[key] = w
    return [(a, b, w) for (a, b), w in seen.items()]
