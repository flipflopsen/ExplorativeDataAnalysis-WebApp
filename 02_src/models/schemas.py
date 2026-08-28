"""Shared Pydantic schemas for the EDA web app."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

DType = Literal["int", "float", "bool", "string", "datetime", "category", "other"]


class ColumnInfo(BaseModel):
    name: str
    dtype: DType
    n_unique: int | None = None
    n_null: int | None = None
    sample: list[Any] | None = None


class DatasetInfo(BaseModel):
    dataset_id: str
    source: str  # "csv" | "json" | "sql"
    origin: str  # filename, URL, or table reference
    n_rows: int
    n_cols: int
    columns: list[ColumnInfo]


class ImportCsvRequest(BaseModel):
    path: str | None = None
    delimiter: str = ","
    has_header: bool = True


class ImportJsonRequest(BaseModel):
    path: str | None = None
    record_path: str | None = None  # for nested JSON
    lines: bool = False  # JSON Lines (NDJSON)


class ImportSqlRequest(BaseModel):
    url: str = Field(..., description="SQLAlchemy URL, e.g. sqlite:///path.db")
    table: str | None = None
    query: str | None = None


# ----- Graph spec -----

EdgeRuleKind = Literal["shared_key", "knn", "similarity", "explicit"]


class EdgeRule(BaseModel):
    kind: EdgeRuleKind
    # shared_key
    key_column: str | None = None
    max_pairs_per_group: int = 200  # cardinality cap
    # knn
    feature_columns: list[str] | None = None
    k: int = 8
    # similarity
    threshold: float = 0.8
    metric: Literal["cosine", "jaccard"] = "cosine"
    # explicit
    edge_dataset_id: str | None = None
    src_column: str | None = None
    dst_column: str | None = None
    weight_column: str | None = None


class GraphSpec(BaseModel):
    dataset_id: str
    rules: list[EdgeRule]
    max_nodes: int = 100_000  # safety cap; subsamples deterministically


class GraphInfo(BaseModel):
    graph_id: str
    dataset_id: str
    n_nodes: int
    n_edges: int
    suggested_layout: Literal["client_force", "server_force_atlas2", "spring"]


class GraphTopology(BaseModel):
    nodes: list[int]
    edges: list[tuple[int, int, float]]  # (src, dst, weight)
    edge_rules: list[int] = []  # rule index per edge (parallel to edges)
    rule_labels: list[str] = []  # human label per rule index


# ----- Visualization -----

ChartKind = Literal[
    "histogram", "scatter", "hexbin", "heatmap", "parallel", "box", "corr", "map"
]


class VizAggregateRequest(BaseModel):
    dataset_id: str
    node_ids: list[int] | None = None  # None = all rows
    features: list[str]
    kind: ChartKind
    bins: int = 30


class ChartSuggestion(BaseModel):
    kind: ChartKind
    features: list[str]
    score: float
    reason: str
