"""In-memory dataset registry with optional Parquet persistence.

Single-user local app → simple dict keyed by ``dataset_id``. Datasets are
also written to ``01_data/processed/<id>.parquet`` so they survive restarts.
"""
from __future__ import annotations

import logging
import uuid
from collections import OrderedDict
from pathlib import Path
from threading import RLock
from typing import Any

import pandas as pd

log = logging.getLogger(__name__)

# Resolve repo root: this file lives at <repo>/02_src/utils/cache.py
REPO_ROOT = Path(__file__).resolve().parents[2]
PROCESSED_DIR = REPO_ROOT / "01_data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


class DatasetCache:
    def __init__(self, max_in_memory: int = 8) -> None:
        self._frames: "OrderedDict[str, pd.DataFrame]" = OrderedDict()
        self._meta: dict[str, dict[str, Any]] = {}
        self._max = max_in_memory
        self._lock = RLock()

    def new_id(self) -> str:
        return uuid.uuid4().hex[:12]

    def put(self, dataset_id: str, frame: pd.DataFrame, meta: dict[str, Any]) -> None:
        with self._lock:
            self._frames[dataset_id] = frame
            self._frames.move_to_end(dataset_id)
            self._meta[dataset_id] = meta
            self._evict_if_needed()
            self._persist(dataset_id, frame)

    def get(self, dataset_id: str) -> pd.DataFrame:
        with self._lock:
            if dataset_id in self._frames:
                self._frames.move_to_end(dataset_id)
                return self._frames[dataset_id]
            # Try Parquet recovery
            path = PROCESSED_DIR / f"{dataset_id}.parquet"
            if path.exists():
                frame = pd.read_parquet(path)
                self._frames[dataset_id] = frame
                self._evict_if_needed()
                return frame
            raise KeyError(dataset_id)

    def meta(self, dataset_id: str) -> dict[str, Any]:
        with self._lock:
            if dataset_id not in self._meta:
                raise KeyError(dataset_id)
            return self._meta[dataset_id]

    def list_ids(self) -> list[str]:
        with self._lock:
            return list(self._meta.keys())

    def _evict_if_needed(self) -> None:
        while len(self._frames) > self._max:
            evicted, _ = self._frames.popitem(last=False)
            log.info("Evicted dataset %s from memory (still on disk)", evicted)

    def _persist(self, dataset_id: str, frame: pd.DataFrame) -> None:
        try:
            frame.to_parquet(PROCESSED_DIR / f"{dataset_id}.parquet", index=False)
        except Exception as exc:  # noqa: BLE001
            log.warning("Could not persist dataset %s: %s", dataset_id, exc)


# Module-level singleton
DATASETS = DatasetCache()
GRAPHS: dict[str, dict[str, Any]] = {}  # graph_id -> {spec, nodes, edges}
