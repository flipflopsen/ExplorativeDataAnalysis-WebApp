"""Column dtype inference and metadata helpers."""
from __future__ import annotations

from typing import Any

import pandas as pd
from pandas.api import types as ptypes

from ..models.schemas import ColumnInfo, DType


def _classify(series: pd.Series) -> DType:
    if ptypes.is_bool_dtype(series):
        return "bool"
    if ptypes.is_integer_dtype(series):
        return "int"
    if ptypes.is_float_dtype(series):
        return "float"
    if ptypes.is_datetime64_any_dtype(series):
        return "datetime"
    if isinstance(series.dtype, pd.CategoricalDtype):
        return "category"
    if ptypes.is_string_dtype(series) or ptypes.is_object_dtype(series):
        return "string"
    return "other"


def describe_columns(df: pd.DataFrame, sample_size: int = 3) -> list[ColumnInfo]:
    out: list[ColumnInfo] = []
    for col in df.columns:
        s = df[col]
        try:
            n_unique = int(s.nunique(dropna=True))
        except Exception:
            n_unique = None
        sample: list[Any] = []
        for v in s.dropna().head(sample_size).tolist():
            try:
                # Ensure JSON-serializable
                sample.append(v.item() if hasattr(v, "item") else v)
            except Exception:
                sample.append(str(v))
        out.append(
            ColumnInfo(
                name=str(col),
                dtype=_classify(s),
                n_unique=n_unique,
                n_null=int(s.isna().sum()),
                sample=sample,
            )
        )
    return out
