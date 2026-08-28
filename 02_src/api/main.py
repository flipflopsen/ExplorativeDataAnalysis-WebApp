"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..compute.gpu_backend import probe
from .routers import (
    config_router,
    dataset_router,
    graph_router,
    import_router,
    stats_router,
    viz_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = REPO_ROOT / "04_visualization" / "dist"


def create_app() -> FastAPI:
    info = probe()
    log.info("Backend ready — compute=%s gpu=%s version=%s", info.name, info.gpu, info.version)

    app = FastAPI(title="EDA Web App", version="0.1.0")

    # Dev only — production serves frontend from same origin.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(import_router.router, prefix="/api/import", tags=["import"])
    app.include_router(dataset_router.router, prefix="/api/datasets", tags=["datasets"])
    app.include_router(graph_router.router, prefix="/api/graph", tags=["graph"])
    app.include_router(viz_router.router, prefix="/api/viz", tags=["viz"])
    app.include_router(config_router.router, prefix="/api", tags=["config"])
    app.include_router(stats_router.router, prefix="/api", tags=["stats"])

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok", "backend": info.name, "gpu": info.gpu, "version": info.version}

    if FRONTEND_DIST.exists():
        app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
        log.info("Serving built frontend from %s", FRONTEND_DIST)
    else:
        log.info("Frontend build not found at %s — run `npm run build` in 04_visualization/", FRONTEND_DIST)

    return app


app = create_app()
