# DataAnalysis — EDA Web App

GPU-accelerated, local-only exploratory data analysis web app. Import CSV / JSON
/ SQL, visualize rows as an interactive **entity graph**, lasso-select clusters,
and render charts (histogram, scatter, hex-bin, parallel coords, correlation
heatmap, box, map) over the selected rows.

## Stack

- **Backend** — FastAPI + Pydantic (Python 3.12). Compute dispatcher routes to
  RAPIDS **cuDF/cuML/cuGraph** when present, otherwise **polars** → **pandas**.
  Tables transit over HTTP as **Apache Arrow IPC** for zero-copy decode.
- **Frontend** — React 18 + TypeScript + Vite. Graph rendered with
  [**Cosmograph**](https://cosmograph.app/) (WebGL, GPU force layout, scales to
  ~1M nodes). Charts via Plotly WebGL.
- **Layout** — `02_src/` Python package (loaded under the alias `edaapp` because
  Python identifiers cannot start with a digit). All UI lives in
  `04_visualization/`. The plan is in `00_plans/WebApp_Plan.md`.

## Install

Requires [`uv`](https://docs.astral.sh/uv/) (Python package manager) and
Node.js/npm (frontend). The `Makefile` works on both Linux/macOS and Windows.

```bash
make install     # uv sync creates .venv + installs Python deps, npm installs frontend deps
```

Python dependencies are declared in `pyproject.toml` (managed by `uv`);
`requirements.txt` has been removed. `uv sync` provisions `fastapi`,
`uvicorn`, `pydantic`, `polars`, `pyarrow`, `sqlalchemy`, and the
data-science stack (`pandas`, `numpy`, `scikit-learn`, `matplotlib`,
`seaborn`, `jupyter`) needed by `02_src/api/main.py` and the compute
dispatcher.

Optional GPU stack (NVIDIA + CUDA 12):

```bash
uv pip install --extra-index-url=https://pypi.nvidia.com -e ".[gpu]"
```

## Run (development)

Two terminals — or `make -j 2 dev`:

```bash
make dev-backend     # uvicorn on http://127.0.0.1:8000
make dev-frontend    # vite on    http://127.0.0.1:5173  (proxies /api)
```

Open <http://127.0.0.1:5173>.

## Run (production-style, single port)

```bash
make run             # builds the UI into 04_visualization/dist and serves it
                     # alongside the API at http://127.0.0.1:8000
```

## Probe the compute backend

```bash
uv run python -c "import sys, importlib.util, pathlib as p; \
  s = importlib.util.spec_from_file_location('edaapp', p.Path('02_src/__init__.py'), submodule_search_locations=['02_src']); \
  m = importlib.util.module_from_spec(s); sys.modules['edaapp']=m; s.loader.exec_module(m); \
  from edaapp.compute.gpu_backend import probe; print(probe())"
```

## Repository layout

```
00_plans/        Design notes (WebApp_Plan.md)
01_data/         raw/, processed/ (Parquet cache), databases/
02_src/          Python backend  → loaded as `edaapp`
04_visualization/ React + TS + Vite frontend
app.py           Root launcher (registers 02_src as `edaapp`, runs uvicorn)
Makefile         install / dev / build / run targets
```

## Security note

The server binds to `127.0.0.1` only — datasets are held in process memory and
must never be exposed on a LAN without auth.

## Known limitations

- **Observed:** `main.py` and `main_analysis.py` at the repository root are
  standalone scripts (a generic pandas/scikit-learn demo and a SQLite ETL
  example) unrelated to the FastAPI/React application described above; they
  are not invoked by `app.py`, the `Makefile`, or `02_src/`.
- **Observed:** `03_notebooks/exploration`, `03_notebooks/modeling`, `04_docs/`,
  and the root-level `utils/` directory are empty placeholders.
- **Observed:** `CreateDirs.sh` contains a hard-coded personal path in a comment
  (`/home/flip/Uni/DataAnalysis`); it is not required by any other script.
- **Observed:** Two distinct `project_data.db` SQLite files exist
  (`project_data.db` at the repository root, populated by `main_analysis.py`,
  and an empty placeholder at `01_data/databases/project_data.db` created by
  `CreateDirs.sh`); both are excluded via `.gitignore`.
- No automated tests were identified in the repository.
