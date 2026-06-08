#!/usr/bin/env python3
"""
Optional pure-Python auto-layout so specs don't need hand-computed coordinates.

Why this exists: every node in the examples carries explicit x/y/width/height,
which is tedious and error-prone for humans and LLMs and easily produces
overlaps. This module assigns positions for nodes that omit coordinates by:

  * a layered (hierarchical) pass over the edge DAG — successive layers are
    placed left-to-right so an A->B->C chain reads in reading order, and
  * a grid fallback for nodes with no edges (disconnected components),

then runs a light overlap-avoidance sweep so computed boxes never intersect.

Backward compatibility is the contract: a node that already specifies *all* of
x/y/width/height is treated as fixed and left exactly where the author put it.
Only nodes missing any coordinate are laid out. No third-party dependencies, so
it runs offline in CI.

Public API:
    apply_layout(spec) -> spec   (mutates and returns spec; nodes gain coords)
    needs_layout(spec) -> bool
"""

from __future__ import annotations

import math
from collections import defaultdict, deque

DEFAULT_WIDTH = 230
DEFAULT_HEIGHT = 84
ORIGIN_X = 60
ORIGIN_Y = 80
LAYER_GAP = 140  # horizontal gap between layers (plus node width)
ROW_GAP = 40  # vertical gap between nodes in the same layer
MIN_GAP = 24  # minimum gap enforced by overlap avoidance


def _coord_fields_present(node: dict) -> bool:
    return all(k in node for k in ("x", "y", "width", "height"))


def needs_layout(spec: dict) -> bool:
    """True if any node is missing one or more coordinate fields."""
    return any(not _coord_fields_present(n) for n in spec.get("nodes", []))


def _ensure_size(node: dict) -> None:
    card = node.get("card", True)
    if "width" not in node:
        node["width"] = DEFAULT_WIDTH if card else 64
    if "height" not in node:
        node["height"] = DEFAULT_HEIGHT if card else 64


def _layer_assignment(node_ids: list[str], edges: list[dict]) -> dict[str, int]:
    """Longest-path layering of the DAG formed by edges.

    Each node's layer is the length of the longest directed path ending at it,
    so an edge always points from a lower layer to a higher one (for acyclic
    inputs). Nodes with no incoming/outgoing edges land in layer 0.
    """
    succ: dict[str, list[str]] = defaultdict(list)
    indeg: dict[str, int] = {nid: 0 for nid in node_ids}
    id_set = set(node_ids)
    for e in edges:
        a, b = e.get("from"), e.get("to")
        if a in id_set and b in id_set and a != b:
            succ[a].append(b)
            indeg[b] += 1

    layer: dict[str, int] = {nid: 0 for nid in node_ids}
    queue = deque(nid for nid in node_ids if indeg[nid] == 0)
    remaining = dict(indeg)
    seen = 0
    while queue:
        u = queue.popleft()
        seen += 1
        for v in succ[u]:
            if layer[u] + 1 > layer[v]:
                layer[v] = layer[u] + 1
            remaining[v] -= 1
            if remaining[v] == 0:
                queue.append(v)
    # If a cycle prevented full processing, the partial layering is still a
    # reasonable placement; every node already has a layer assigned.
    return layer


def _resolve_overlaps(boxes: list[dict]) -> None:
    """Nudge computed boxes downward until none overlap (stable for fixed ones).

    Only boxes flagged ``_computed`` may move; fixed (author-supplied) boxes are
    obstacles. We sweep repeatedly because moving one box can create a new
    overlap; the grid/layer seeding keeps this to a few passes in practice.
    """

    def overlap(a: dict, b: dict) -> bool:
        return not (
            a["x"] + a["width"] + MIN_GAP <= b["x"]
            or b["x"] + b["width"] + MIN_GAP <= a["x"]
            or a["y"] + a["height"] + MIN_GAP <= b["y"]
            or b["y"] + b["height"] + MIN_GAP <= a["y"]
        )

    for _ in range(len(boxes) * len(boxes) + 1):
        moved = False
        for i, a in enumerate(boxes):
            for b in boxes[i + 1 :]:
                if not overlap(a, b):
                    continue
                mover = b if b.get("_computed") else (a if a.get("_computed") else None)
                if mover is None:
                    continue  # two fixed boxes overlap — author's choice, leave it
                other = a if mover is b else b
                mover["y"] = other["y"] + other["height"] + MIN_GAP
                moved = True
        if not moved:
            break


def apply_layout(spec: dict) -> dict:
    """Assign coordinates to nodes that omit them; return the spec.

    Fixed nodes (all four coordinate fields present) are never moved. Computed
    nodes are placed by a layered pass over the edge graph, with disconnected
    nodes packed into a grid, then de-overlapped.
    """
    nodes = spec.get("nodes", [])
    if not nodes:
        return spec

    edges = spec.get("edges", [])
    by_id = {n["id"]: n for n in nodes if isinstance(n.get("id"), str)}
    id_set = set(by_id)

    computed = [n for n in nodes if not _coord_fields_present(n)]
    for n in computed:
        _ensure_size(n)

    # Split computed nodes into "connected" (touch an edge) and "loose".
    connected_ids = set()
    for e in edges:
        a, b = e.get("from"), e.get("to")
        if a in id_set:
            connected_ids.add(a)
        if b in id_set:
            connected_ids.add(b)

    computed_connected = [n for n in computed if n["id"] in connected_ids]
    computed_loose = [n for n in computed if n["id"] not in connected_ids]

    # --- layered placement for connected computed nodes ---
    if computed_connected:
        layer = _layer_assignment(list(by_id), edges)
        layers: dict[int, list[dict]] = defaultdict(list)
        for n in computed_connected:
            layers[layer.get(n["id"], 0)].append(n)

        x_cursor = ORIGIN_X
        for li in sorted(layers):
            col = layers[li]
            col_w = max(n["width"] for n in col)
            y_cursor = ORIGIN_Y
            for n in col:
                n["x"] = x_cursor
                n["y"] = y_cursor
                y_cursor += n["height"] + ROW_GAP
            x_cursor += col_w + LAYER_GAP

    # --- grid fallback for disconnected computed nodes ---
    if computed_loose:
        cols = max(1, int(math.ceil(math.sqrt(len(computed_loose)))))
        cell_w = max(n["width"] for n in computed_loose) + LAYER_GAP
        cell_h = max(n["height"] for n in computed_loose) + ROW_GAP
        # Start the grid below/right of everything placed so far.
        placed = [n for n in nodes if _coord_fields_present(n) and n not in computed_loose]
        base_y = ORIGIN_Y
        if placed:
            base_y = max(n["y"] + n["height"] for n in placed) + ROW_GAP + MIN_GAP
        for idx, n in enumerate(computed_loose):
            r, c = divmod(idx, cols)
            n["x"] = ORIGIN_X + c * cell_w
            n["y"] = base_y + r * cell_h

    # --- overlap avoidance over the whole set ---
    for n in computed:
        n["_computed"] = True
    _resolve_overlaps(nodes)
    for n in computed:
        n.pop("_computed", None)

    return spec
