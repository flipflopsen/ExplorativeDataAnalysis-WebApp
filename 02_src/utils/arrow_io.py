"""Apache Arrow IPC helpers."""
from __future__ import annotations

import io

import pandas as pd
import pyarrow as pa
import pyarrow.ipc as ipc


def df_to_arrow_bytes(df: pd.DataFrame) -> bytes:
    """Serialize a DataFrame to an Arrow IPC stream (zero-copy on read)."""
    table = pa.Table.from_pandas(df, preserve_index=False)
    sink = io.BytesIO()
    with ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return sink.getvalue()


ARROW_MEDIA_TYPE = "application/vnd.apache.arrow.stream"
