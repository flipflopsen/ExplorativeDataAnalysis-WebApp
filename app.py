"""Root-level launcher.

Registers the ``02_src`` directory as the importable package ``edaapp`` (since
Python identifiers cannot start with a digit) and starts the FastAPI server
bound to loopback only.

Run with: ``python app.py``
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PKG_DIR = ROOT / "02_src"


def _register_package() -> None:
    spec = importlib.util.spec_from_file_location(
        "edaapp",
        PKG_DIR / "__init__.py",
        submodule_search_locations=[str(PKG_DIR)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load package from {PKG_DIR}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["edaapp"] = module
    spec.loader.exec_module(module)


_register_package()


def main() -> None:
    import uvicorn

    uvicorn.run(
        "edaapp.api.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
