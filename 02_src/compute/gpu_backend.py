"""GPU/CPU backend dispatcher.

At import time, probe for the RAPIDS cudf stack. If present, prefer GPU
DataFrames; otherwise fall back to polars (fast, multithreaded) and finally
pandas. All higher-level code should call :func:`to_frame` / :func:`active`
rather than importing pandas/cudf directly.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Literal

log = logging.getLogger(__name__)

Backend = Literal["cudf", "polars", "pandas"]


@dataclass(frozen=True)
class BackendInfo:
    name: Backend
    gpu: bool
    version: str


def _probe() -> BackendInfo:
    try:
        import cudf  # type: ignore

        return BackendInfo("cudf", gpu=True, version=getattr(cudf, "__version__", "?"))
    except Exception as exc:  # noqa: BLE001
        log.info("cudf unavailable (%s); trying polars", exc.__class__.__name__)

    try:
        import polars as pl

        return BackendInfo("polars", gpu=False, version=pl.__version__)
    except Exception as exc:  # noqa: BLE001
        log.info("polars unavailable (%s); falling back to pandas", exc.__class__.__name__)

    import pandas as pd

    return BackendInfo("pandas", gpu=False, version=pd.__version__)


INFO: BackendInfo = _probe()


def probe() -> BackendInfo:
    """Return the active backend info (cached at import)."""
    return INFO


def active() -> Backend:
    return INFO.name


def to_pandas(frame: Any):
    """Best-effort conversion of any supported frame to pandas.DataFrame.

    Used at API boundaries that need stable, well-known semantics (e.g. Arrow
    conversion, sklearn fallback).
    """
    import pandas as pd

    if isinstance(frame, pd.DataFrame):
        return frame
    # polars
    if hasattr(frame, "to_pandas"):
        try:
            return frame.to_pandas()
        except Exception:  # noqa: BLE001
            pass
    # cudf
    try:
        import cudf  # type: ignore

        if isinstance(frame, cudf.DataFrame):
            return frame.to_pandas()
    except Exception:  # noqa: BLE001
        pass
    raise TypeError(f"Unsupported frame type: {type(frame)!r}")


def knn_indices(features, k: int):
    """K-nearest-neighbour indices for each row.

    Returns an (n_rows, k) ndarray of integer indices (excluding self).
    Uses cuML on GPU if available, else scikit-learn.
    """
    import numpy as np

    X = _as_float_matrix(features)
    n = X.shape[0]
    k_eff = min(k + 1, n)

    if INFO.name == "cudf":
        try:
            from cuml.neighbors import NearestNeighbors  # type: ignore

            nn = NearestNeighbors(n_neighbors=k_eff)
            nn.fit(X)
            _, idx = nn.kneighbors(X)
            idx = np.asarray(idx)
        except Exception as exc:  # noqa: BLE001
            log.warning("cuml KNN failed (%s); using sklearn", exc)
            idx = _sklearn_knn(X, k_eff)
    else:
        idx = _sklearn_knn(X, k_eff)

    # Strip self-edges (first column when present)
    if idx.shape[1] > k:
        idx = idx[:, 1 : k + 1]
    return idx


def _sklearn_knn(X, k_eff: int):
    import numpy as np
    from sklearn.neighbors import NearestNeighbors

    nn = NearestNeighbors(n_neighbors=k_eff, algorithm="auto")
    nn.fit(X)
    _, idx = nn.kneighbors(X)
    return np.asarray(idx)


def _as_float_matrix(features):
    import numpy as np
    import pandas as pd

    if isinstance(features, np.ndarray):
        arr = features
    elif isinstance(features, pd.DataFrame):
        arr = features.to_numpy(dtype="float64", copy=False)
    elif hasattr(features, "to_numpy"):
        arr = features.to_numpy()
    else:
        arr = np.asarray(features)
    if arr.ndim == 1:
        arr = arr.reshape(-1, 1)
    # Replace NaN/inf so sklearn doesn't reject.
    import numpy as np

    return np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0).astype("float64", copy=False)
