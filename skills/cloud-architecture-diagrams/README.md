# cloud-architecture-diagrams

Build editable cloud architecture diagrams (Azure / Microsoft, AWS / Amazon,
GCP / Google) using official vendor icons, emitting **both** an editable
`.excalidraw` (JSON) and an editable `.drawio` (mxGraph XML) with real icons
embedded and clean labeled arrows.

## Requirements

**Python 3.10+** is required. The scripts use PEP 604 union syntax
(e.g. `str | None`), which raises `TypeError` at import time on Python 3.9.
`requires-python = ">=3.10"` is pinned in `pyproject.toml`.

## Quick start

```bash
# Render a spec to <prefix>.excalidraw and <prefix>.drawio
python scripts/build_diagram.py assets/spec-example.json --out-prefix mydiagram

# Validate a spec without rendering (clear errors, non-zero exit on failure)
python scripts/build_diagram.py mydiagram.json --validate

# Let the layout engine place nodes that omit coordinates
python scripts/build_diagram.py mydiagram.json --layout --out-prefix mydiagram
```

See `references/spec-format.md` for the full spec format, validation rules, and
the auto-layout behavior.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/build_diagram.py` | Spec → `.excalidraw` + `.drawio`. Flags: `--validate`, `--layout`, `--drawio-shapes`, `--only`. |
| `scripts/spec_schema.py` | Dependency-free spec validator (`validate`, `validate_or_raise`). |
| `scripts/layout.py` | Optional auto-layout (layered DAG + grid fallback, overlap avoidance). |
| `scripts/find_icon.py` | Score/search the bundled icon index for a service name. |

## Development

Dev tooling: `ruff`, `black`, `mypy`, `pytest` (see `[project.optional-dependencies].dev`).

```bash
python -m pip install -e ".[dev]"     # or: pip install ruff black mypy pytest pre-commit
ruff check scripts tests
black --check scripts tests
mypy scripts
python -m pytest tests/ -v
```

A `.pre-commit-config.yaml` at the repo root wires lint + format + type-check to
run at commit time. Install the hooks with `pre-commit install`.

CI runs the same gates plus the test suite on a Python 3.10–3.12 matrix on every
push and pull request, and on a daily schedule — see
`.github/workflows/daily-ci.yml`.
