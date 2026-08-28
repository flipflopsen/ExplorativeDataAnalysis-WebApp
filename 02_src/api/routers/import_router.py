"""Import endpoints for CSV, JSON, and SQL sources."""
from __future__ import annotations

import logging
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from ...io.csv_loader import load_csv
from ...io.json_loader import load_json
from ...io.sql_loader import load_sql, test_connection
from ...models.schemas import (
    DatasetInfo,
    ImportCsvRequest,
    ImportJsonRequest,
    ImportSqlRequest,
)
from ...utils.cache import DATASETS
from ...utils.schema_infer import describe_columns

log = logging.getLogger(__name__)
router = APIRouter()


def _register(frame, source: str, origin: str) -> DatasetInfo:
    dataset_id = DATASETS.new_id()
    cols = describe_columns(frame)
    info = DatasetInfo(
        dataset_id=dataset_id,
        source=source,
        origin=origin,
        n_rows=int(frame.shape[0]),
        n_cols=int(frame.shape[1]),
        columns=cols,
    )
    DATASETS.put(dataset_id, frame, info.model_dump())
    log.info("Imported %s (%s): %d rows × %d cols → %s", source, origin, info.n_rows, info.n_cols, dataset_id)
    return info


@router.post("/csv", response_model=DatasetInfo)
async def import_csv(
    req: ImportCsvRequest | None = None,
    file: UploadFile | None = File(None),
) -> DatasetInfo:
    req = req or ImportCsvRequest()
    try:
        if file is not None:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = Path(tmp.name)
            try:
                frame = load_csv(tmp_path, delimiter=req.delimiter, has_header=req.has_header)
            finally:
                tmp_path.unlink(missing_ok=True)
            origin = file.filename or "uploaded.csv"
        elif req.path:
            frame = load_csv(req.path, delimiter=req.delimiter, has_header=req.has_header)
            origin = req.path
        else:
            raise HTTPException(400, "Provide either a file upload or `path`.")
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"CSV load failed: {exc}") from exc
    return _register(frame, "csv", origin)


@router.post("/json", response_model=DatasetInfo)
async def import_json(
    req: ImportJsonRequest | None = None,
    file: UploadFile | None = File(None),
) -> DatasetInfo:
    req = req or ImportJsonRequest()
    try:
        if file is not None:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
                shutil.copyfileobj(file.file, tmp)
                tmp_path = Path(tmp.name)
            try:
                frame = load_json(tmp_path, record_path=req.record_path, lines=req.lines)
            finally:
                tmp_path.unlink(missing_ok=True)
            origin = file.filename or "uploaded.json"
        elif req.path:
            frame = load_json(req.path, record_path=req.record_path, lines=req.lines)
            origin = req.path
        else:
            raise HTTPException(400, "Provide either a file upload or `path`.")
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"JSON load failed: {exc}") from exc
    return _register(frame, "json", origin)


@router.post("/sql", response_model=DatasetInfo)
def import_sql(req: ImportSqlRequest) -> DatasetInfo:
    try:
        frame = load_sql(req.url, table=req.table, query=req.query)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"SQL load failed: {exc}") from exc
    origin = req.table or (req.query or "")[:80]
    return _register(frame, "sql", f"{req.url} :: {origin}")


@router.post("/sql/test")
def sql_test(req: ImportSqlRequest) -> dict:
    try:
        test_connection(req.url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Connection failed: {exc}") from exc
    return {"ok": True}
