"""CSV loader using pyarrow.csv for speed, returning a pandas DataFrame."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow.csv as pacsv


def load_csv(path: str | Path, delimiter: str = ",", has_header: bool = True) -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)
    read_opts = pacsv.ReadOptions(autogenerate_column_names=not has_header)
    parse_opts = pacsv.ParseOptions(delimiter=delimiter)
    table = pacsv.read_csv(p, read_options=read_opts, parse_options=parse_opts)
    return table.to_pandas(types_mapper=None)
