#!/usr/bin/env python3
"""
Hand-rolled, dependency-free validator for the diagram spec format.

Why this exists: specs are hand-authored or LLM-generated JSON. An invalid spec
used to crash the renderer with a raw Python traceback (e.g. ``KeyError: 'x'``
on a node missing a coordinate) or silently drop an edge that referenced a
missing node. This module validates the spec up front and reports precise,
human-readable errors — which node, which missing/mistyped field, which
dangling edge endpoint, which duplicate id — so authors can fix the JSON before
anything is rendered. The schema doubles as living documentation of the format.

Public API:
    validate(spec) -> list[str]
        Return a list of human-readable error messages (empty == valid).
    ValidationError
        Raised by validate_or_raise() with all messages joined.
    validate_or_raise(spec) -> None

Layout note: ``x``/``y``/``width``/``height`` are only *required* when the node
is not going to be auto-laid-out. ``validate()`` therefore accepts nodes that
omit coordinates (the layout pass fills them in); pass ``require_coords=True``
to enforce explicit coordinates for every node.
"""

from __future__ import annotations

from typing import Any

Number = (int, float)


class ValidationError(Exception):
    """Raised when a spec fails validation; ``messages`` holds each error."""

    def __init__(self, messages: list[str]) -> None:
        self.messages = messages
        super().__init__("\n".join(messages))


def _is_number(v: Any) -> bool:
    # bool is a subclass of int; reject it as a coordinate/size.
    return isinstance(v, Number) and not isinstance(v, bool)


def _check_box(
    obj: dict,
    where: str,
    errors: list[str],
    *,
    require_coords: bool,
) -> None:
    """Validate x/y/width/height fields on a node or zone."""
    for field in ("x", "y", "width", "height"):
        if field not in obj:
            if require_coords:
                errors.append(f"{where}: missing required field '{field}'")
            continue
        if not _is_number(obj[field]):
            errors.append(
                f"{where}: field '{field}' must be a number, "
                f"got {type(obj[field]).__name__} ({obj[field]!r})"
            )
    for field in ("width", "height"):
        v = obj.get(field)
        if _is_number(v) and v is not None and v <= 0:
            errors.append(f"{where}: field '{field}' must be positive, got {v}")


def validate(spec: Any, *, require_coords: bool = False) -> list[str]:
    """Return a list of human-readable validation errors (empty == valid).

    When ``require_coords`` is False (default), nodes may omit
    x/y/width/height because the auto-layout pass will supply them.
    """
    errors: list[str] = []

    if not isinstance(spec, dict):
        return [f"spec must be a JSON object, got {type(spec).__name__}"]

    # Optional scalar/string fields.
    if "title" in spec and not isinstance(spec["title"], str):
        errors.append("top-level 'title' must be a string")
    if "provider" in spec and not isinstance(spec["provider"], str):
        errors.append("top-level 'provider' must be a string")
    if "providers" in spec:
        if not isinstance(spec["providers"], list) or not all(
            isinstance(p, str) for p in spec["providers"]
        ):
            errors.append("top-level 'providers' must be a list of strings")

    if "canvas" in spec and not isinstance(spec["canvas"], dict):
        errors.append("'canvas' must be an object with width/height")

    # Nodes (required).
    nodes = spec.get("nodes")
    if nodes is None:
        errors.append("spec is missing required 'nodes' array")
        nodes = []
    elif not isinstance(nodes, list):
        errors.append("'nodes' must be an array")
        nodes = []

    seen_ids: set[str] = set()
    node_ids: set[str] = set()
    for i, n in enumerate(nodes):
        if not isinstance(n, dict):
            errors.append(f"nodes[{i}]: must be an object")
            continue
        nid = n.get("id")
        if nid is None:
            errors.append(f"nodes[{i}]: missing required field 'id'")
        elif not isinstance(nid, str):
            errors.append(f"nodes[{i}]: 'id' must be a string, got {type(nid).__name__}")
        else:
            if nid in seen_ids:
                errors.append(f"duplicate node id '{nid}'")
            seen_ids.add(nid)
            node_ids.add(nid)
        where = f"node '{nid}'" if isinstance(nid, str) else f"nodes[{i}]"
        _check_box(n, where, errors, require_coords=require_coords)
        if "card" in n and not isinstance(n["card"], bool):
            errors.append(f"{where}: 'card' must be a boolean")
        for field in ("title", "desc", "icon", "icon_url"):
            if field in n and not isinstance(n[field], str):
                errors.append(f"{where}: '{field}' must be a string")

    # Zones (optional).
    zones = spec.get("zones", [])
    if zones and not isinstance(zones, list):
        errors.append("'zones' must be an array")
        zones = []
    for i, z in enumerate(zones):
        if not isinstance(z, dict):
            errors.append(f"zones[{i}]: must be an object")
            continue
        zid = z.get("id")
        where = f"zone '{zid}'" if isinstance(zid, str) else f"zones[{i}]"
        # Zones always need explicit coordinates (they are never auto-laid-out).
        _check_box(z, where, errors, require_coords=True)

    # Edges (optional) — the key reliability fix: dangling endpoints.
    edges = spec.get("edges", [])
    if edges and not isinstance(edges, list):
        errors.append("'edges' must be an array")
        edges = []
    valid_dirs = {"to", "from", "both"}
    for i, e in enumerate(edges):
        if not isinstance(e, dict):
            errors.append(f"edges[{i}]: must be an object")
            continue
        for endpoint in ("from", "to"):
            ref = e.get(endpoint)
            if ref is None:
                errors.append(f"edges[{i}]: missing required field '{endpoint}'")
            elif not isinstance(ref, str):
                errors.append(f"edges[{i}]: '{endpoint}' must be a string")
            elif ref not in node_ids:
                errors.append(
                    f"edges[{i}]: dangling edge — '{endpoint}' references "
                    f"unknown node id '{ref}'"
                )
        if "dir" in e and e["dir"] not in valid_dirs:
            errors.append(
                f"edges[{i}]: 'dir' must be one of {sorted(valid_dirs)}, " f"got {e['dir']!r}"
            )

    # Badges (optional).
    badges = spec.get("badges", [])
    if badges and not isinstance(badges, list):
        errors.append("'badges' must be an array")
        badges = []
    for i, b in enumerate(badges):
        if not isinstance(b, dict):
            errors.append(f"badges[{i}]: must be an object")
            continue
        for field in ("n", "x", "y"):
            if field not in b:
                errors.append(f"badges[{i}]: missing required field '{field}'")
            elif not _is_number(b[field]):
                errors.append(f"badges[{i}]: '{field}' must be a number")

    return errors


def validate_or_raise(spec: Any, *, require_coords: bool = False) -> None:
    """Validate and raise :class:`ValidationError` if any errors are found."""
    errors = validate(spec, require_coords=require_coords)
    if errors:
        raise ValidationError(errors)
