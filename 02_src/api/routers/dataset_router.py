"""Dataset metadata & row access."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response

from ...models.schemas import DatasetInfo
from ...utils.arrow_io import ARROW_MEDIA_TYPE, df_to_arrow_bytes
from ...utils.cache import DATASETS

router = APIRouter()


@router.get("", response_model=list[DatasetInfo])
def list_datasets() -> list[DatasetInfo]:
    out: list[DatasetInfo] = []
    for ds_id in DATASETS.list_ids():
        out.append(DatasetInfo(**DATASETS.meta(ds_id)))
    return out


@router.get("/{dataset_id}", response_model=DatasetInfo)
def get_dataset(dataset_id: str) -> DatasetInfo:
    try:
        return DatasetInfo(**DATASETS.meta(dataset_id))
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {dataset_id}")


@router.get("/{dataset_id}/rows")
def get_rows(
    dataset_id: str,
    cols: str | None = Query(default=None, description="Comma-separated column list"),
    limit: int = Query(default=1000, ge=1, le=200_000),
    offset: int = Query(default=0, ge=0),
) -> Response:
    try:
        df = DATASETS.get(dataset_id)
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {dataset_id}")
    if cols:
        wanted = [c.strip() for c in cols.split(",") if c.strip()]
        missing = [c for c in wanted if c not in df.columns]
        if missing:
            raise HTTPException(400, f"Unknown columns: {missing}")
        df = df[wanted]
    sub = df.iloc[offset : offset + limit].reset_index(drop=True)
    return Response(content=df_to_arrow_bytes(sub), media_type=ARROW_MEDIA_TYPE)
