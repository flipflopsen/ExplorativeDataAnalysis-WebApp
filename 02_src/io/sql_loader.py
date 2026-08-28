"""SQL loader via SQLAlchemy."""
from __future__ import annotations

import pandas as pd
from sqlalchemy import create_engine, text


def load_sql(url: str, table: str | None = None, query: str | None = None) -> pd.DataFrame:
    if not table and not query:
        raise ValueError("Provide either `table` or `query`.")
    engine = create_engine(url)
    with engine.connect() as conn:
        if query:
            return pd.read_sql_query(text(query), conn)
        # SECURITY: identifier comes from local user; basic sanitization only.
        if not table.replace("_", "").isalnum():
            raise ValueError(f"Invalid table name: {table!r}")
        return pd.read_sql_query(text(f'SELECT * FROM "{table}"'), conn)


def test_connection(url: str) -> bool:
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True
