.PHONY: install install-python install-frontend dev dev-backend dev-frontend build run clean

VENV := .venv

# Cross-platform (Linux/macOS vs Windows) settings.
ifeq ($(OS),Windows_NT)
	RMDIR := rmdir /s /q
	RM_VENV := if exist "$(VENV)" $(RMDIR) "$(VENV)"
	RM_NODE_MODULES := if exist "04_visualization\node_modules" $(RMDIR) "04_visualization\node_modules"
	RM_DIST := if exist "04_visualization\dist" $(RMDIR) "04_visualization\dist"
else
	RM_VENV := rm -rf "$(VENV)"
	RM_NODE_MODULES := rm -rf "04_visualization/node_modules"
	RM_DIST := rm -rf "04_visualization/dist"
endif

install: install-python install-frontend

# uv creates/reuses $(VENV) and installs project dependencies from pyproject.toml.
install-python:
	uv sync

install-frontend:
	cd 04_visualization && npm install

dev-backend:
	uv run python app.py

dev-frontend:
	cd 04_visualization && npm run dev

# Run both with: `make -j 2 dev`
dev: dev-backend dev-frontend

build:
	cd 04_visualization && npm run build

run: build
	uv run python app.py

clean:
	$(RM_VENV)
	$(RM_NODE_MODULES)
	$(RM_DIST)
