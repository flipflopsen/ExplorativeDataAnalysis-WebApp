"""Graph build & topology endpoints."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException

from ...graph.edge_builders import build_edges
from ...graph.layout import suggest_layout
from ...models.schemas import GraphInfo, GraphSpec, GraphTopology
from ...utils.cache import DATASETS, GRAPHS

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/build", response_model=GraphInfo)
def build_graph(spec: GraphSpec) -> GraphInfo:
    try:
        df = DATASETS.get(spec.dataset_id)
    except KeyError:
        raise HTTPException(404, f"Unknown dataset {spec.dataset_id}")

    # Deterministic subsample if oversized
    if df.shape[0] > spec.max_nodes:
        df = df.sample(n=spec.max_nodes, random_state=0).reset_index(drop=True)

    all_edges: list[tuple[int, int, float, int]] = []  # (a, b, w, rule_idx)
    rule_labels: list[str] = []
    for rule_idx, rule in enumerate(spec.rules):
        rule_labels.append(_rule_label(rule))
        if rule.kind == "explicit":
            if not rule.edge_dataset_id or not rule.src_column or not rule.dst_column:
                raise HTTPException(400, "explicit rule needs edge_dataset_id, src_column, dst_column")
            try:
                edf = DATASETS.get(rule.edge_dataset_id)
            except KeyError:
                raise HTTPException(404, f"Unknown edge dataset {rule.edge_dataset_id}")
            for col in (rule.src_column, rule.dst_column):
                if col not in edf.columns:
                    raise HTTPException(400, f"edge dataset missing column {col}")
            w_col = rule.weight_column if rule.weight_column in edf.columns else None
            for _, row in edf.iterrows():
                a = int(row[rule.src_column])
                b = int(row[rule.dst_column])
                w = float(row[w_col]) if w_col else 1.0
                if a == b:
                    continue
                all_edges.append((min(a, b), max(a, b), w, rule_idx))
        else:
            try:
                for a, b, w in build_edges(df, rule):
                    all_edges.append((a, b, w, rule_idx))
            except ValueError as exc:
                raise HTTPException(400, str(exc)) from exc

    # Dedupe (keep max weight per pair; remember winning rule)
    dedup: dict[tuple[int, int], tuple[float, int]] = {}
    for a, b, w, ridx in all_edges:
        key = (a, b)
        if key not in dedup or w > dedup[key][0]:
            dedup[key] = (w, ridx)
    edges = [(a, b, w) for (a, b), (w, _) in dedup.items()]
    edge_rules = [ridx for (_, ridx) in dedup.values()]

    n_nodes = int(df.shape[0])
    graph_id = uuid.uuid4().hex[:12]
    layout = suggest_layout(n_nodes, len(edges))

    GRAPHS[graph_id] = {
        "dataset_id": spec.dataset_id,
        "nodes": list(range(n_nodes)),
        "edges": edges,
        "edge_rules": edge_rules,
        "rule_labels": rule_labels,
        "layout": layout,
    }
    log.info("Built graph %s: %d nodes, %d edges, layout=%s", graph_id, n_nodes, len(edges), layout)

    return GraphInfo(
        graph_id=graph_id,
        dataset_id=spec.dataset_id,
        n_nodes=n_nodes,
        n_edges=len(edges),
        suggested_layout=layout,
    )


@router.get("/{graph_id}/topology", response_model=GraphTopology)
def get_topology(graph_id: str) -> GraphTopology:
    g = GRAPHS.get(graph_id)
    if g is None:
        raise HTTPException(404, f"Unknown graph {graph_id}")
    return GraphTopology(
        nodes=g["nodes"],
        edges=g["edges"],
        edge_rules=g.get("edge_rules", []),
        rule_labels=g.get("rule_labels", []),
    )


def _rule_label(rule) -> str:
    if rule.kind == "shared_key":
        return f"key:{rule.key_column}"
    if rule.kind == "knn":
        feats = ",".join(rule.feature_columns or [])
        return f"knn[{feats}]"
    if rule.kind == "similarity":
        feats = ",".join(rule.feature_columns or [])
        return f"sim[{feats}]"
    if rule.kind == "explicit":
        return f"edges:{rule.edge_dataset_id}"
    return str(rule.kind)
