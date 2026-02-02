from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from dateutil import parser as dtparser
from langgraph.graph import StateGraph, END

from backend import db
from backend.logging_utils import setup_logging
from backend.models import PendingPayload, Vehicle
from backend.ors import get_duration_matrix
from backend.solver import Node, VehicleSpec, solve_cvrptw

logger = logging.getLogger(__name__)


class OptimizerState(TypedDict, total=False):
    pending_route_id: str
    payload: Dict[str, Any]
    depot: Dict[str, Any]
    orders: List[Dict[str, Any]]
    vehicles: List[Dict[str, Any]]
    locations_lonlat: List[List[float]]
    duration_matrix: List[List[int]]
    reference_time_iso: str
    result: Dict[str, Any]


def _parse_payload(raw_payload: Dict[str, Any]) -> PendingPayload:
    return PendingPayload.model_validate(raw_payload)


def _get_reference_time(depot: Any, orders: Any) -> datetime:
    candidates: List[datetime] = []
    if depot.ventana_inicio is not None:
        candidates.append(depot.ventana_inicio)
    for o in orders:
        candidates.append(o.ventana_inicio)
    t0 = min(candidates) if candidates else datetime.now(timezone.utc)
    if t0.tzinfo is None:
        t0 = t0.replace(tzinfo=timezone.utc)
    return t0


def fetch_pending_tasks(state: OptimizerState) -> OptimizerState:
    pending_route_id = os.environ.get("PENDING_ROUTE_ID") or None

    row = db.fetch_one_pending_route(pending_route_id=pending_route_id)
    if not row:
        logger.info("No pending routes")
        return {}

    pr_id = row["id"]
    payload = row["payload"]

    parsed = _parse_payload(payload)

    vehicles_payload = parsed.vehicles
    if not vehicles_payload:
        vehicles_payload = [Vehicle.model_validate(v) for v in db.load_vehicles_from_db()]

    if not vehicles_payload:
        raise RuntimeError("No vehicles provided (payload.vehicles empty and vehicles table empty)")

    t0 = _get_reference_time(parsed.depot, parsed.orders)
    reference_time_iso = t0.isoformat()

    state_out: OptimizerState = {
        "pending_route_id": pr_id,
        "payload": payload,
        "depot": parsed.depot.model_dump(mode="json"),
        "orders": [o.model_dump(mode="json") for o in parsed.orders],
        "vehicles": [v.model_dump(mode="json") for v in vehicles_payload],
        "reference_time_iso": reference_time_iso,
    }
    logger.info("Fetched pending_route_id=%s orders=%s vehicles=%s", pr_id, len(parsed.orders), len(vehicles_payload))
    return state_out


def get_matrix_node(state: OptimizerState) -> OptimizerState:
    depot = state["depot"]
    orders = state["orders"]

    locations_lonlat: List[List[float]] = []
    locations_lonlat.append([float(depot["lon"]), float(depot["lat"])])
    for o in orders:
        locations_lonlat.append([float(o["lon"]), float(o["lat"])])

    logger.info("Requesting ORS matrix size=%sx%s", len(locations_lonlat), len(locations_lonlat))
    duration_matrix = get_duration_matrix(locations_lonlat)

    logger.info("ORS matrix received")
    return {
        "locations_lonlat": locations_lonlat,
        "duration_matrix": duration_matrix,
    }


def solve_optimization_node(state: OptimizerState) -> OptimizerState:
    pr_id = state["pending_route_id"]
    depot = state["depot"]
    orders = state["orders"]
    vehicles = state["vehicles"]
    duration_matrix = state["duration_matrix"]

    ref = dtparser.isoparse(state["reference_time_iso"])

    def to_offset_seconds(dt_str: str) -> int:
        dt = dtparser.isoparse(dt_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int((dt - ref).total_seconds())

    depot_tw_start = 0
    depot_tw_end = 60 * 60 * 24
    if depot.get("ventana_inicio"):
        depot_tw_start = to_offset_seconds(depot["ventana_inicio"])
    if depot.get("ventana_fin"):
        depot_tw_end = to_offset_seconds(depot["ventana_fin"])

    depot_node = Node(
        kind="depot",
        id="depot",
        lat=float(depot["lat"]),
        lon=float(depot["lon"]),
        weight=0.0,
        volume=0.0,
        tw_start=depot_tw_start,
        tw_end=depot_tw_end,
        skills_required=[],
    )

    order_nodes: List[Node] = []
    for o in orders:
        order_nodes.append(
            Node(
                kind="order",
                id=str(o["id_pedido"]),
                lat=float(o["lat"]),
                lon=float(o["lon"]),
                weight=float(o.get("peso") or 0.0),
                volume=float(o.get("volumen") or 0.0),
                tw_start=to_offset_seconds(o["ventana_inicio"]),
                tw_end=to_offset_seconds(o["ventana_fin"]),
                skills_required=list(o.get("skills_required") or []),
            )
        )

    vehicle_specs: List[VehicleSpec] = []
    for v in vehicles:
        vehicle_specs.append(
            VehicleSpec(
                id_vehicle=str(v["id_vehicle"]),
                capacity_weight=int(round(float(v["capacity_weight"]) * 1000)),
                capacity_volume=int(round(float(v["capacity_volume"]) * 1000)),
                skills=list(v.get("skills") or []),
            )

    service_time_seconds = int(os.environ.get("SERVICE_TIME_SECONDS", "0"))
    time_limit_seconds = int(os.environ.get("SOLVER_TIME_LIMIT_SECONDS", "30"))

    logger.info("Solving CVRPTW pending_route_id=%s", pr_id)
    result = solve_cvrptw(
        pending_route_id=pr_id,
        depot=depot_node,
        orders=order_nodes,
        vehicles=vehicle_specs,
        duration_matrix=duration_matrix,
        reference_time_iso=state["reference_time_iso"],
        service_time_seconds=service_time_seconds,
        time_limit_seconds=time_limit_seconds,
    )

    logger.info("Solver done status=%s unassigned=%s", result.get("status"), len(result.get("unassigned", [])))
    return {"result": result}


def save_results_node(state: OptimizerState) -> OptimizerState:
    pr_id = state["pending_route_id"]
    result = state["result"]

    status = result.get("status", "unknown")
    db.insert_optimized_route(pending_route_id=pr_id, status=status, result=result)
    logger.info("Saved optimized route pending_route_id=%s", pr_id)
    return {}


def build_graph():
    g = StateGraph(OptimizerState)

    g.add_node("fetch_pending_tasks", fetch_pending_tasks)
    g.add_node("get_matrix", get_matrix_node)
    g.add_node("solve_optimization", solve_optimization_node)
    g.add_node("save_results", save_results_node)

    def has_work(state: OptimizerState) -> str:
        return "get_matrix" if state.get("pending_route_id") else END

    g.set_entry_point("fetch_pending_tasks")
    g.add_conditional_edges("fetch_pending_tasks", has_work)
    g.add_edge("get_matrix", "solve_optimization")
    g.add_edge("solve_optimization", "save_results")
    g.add_edge("save_results", END)

    return g.compile()


def main() -> None:
    setup_logging()

    logger.info("Starting optimizer")
    graph = build_graph()

    try:
        graph.invoke({})
    except Exception as e:
        pending_route_id = os.environ.get("PENDING_ROUTE_ID")
        if pending_route_id:
            logger.exception("Optimizer failed pending_route_id=%s", pending_route_id)
            db.mark_pending_failed(pending_route_id, str(e))
        raise


if __name__ == "__main__":
    main()
