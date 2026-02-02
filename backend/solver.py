from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

logger = logging.getLogger(__name__)


@dataclass
class Node:
    kind: str  # depot | order
    id: str
    lat: float
    lon: float
    weight: float = 0.0
    volume: float = 0.0
    tw_start: int = 0
    tw_end: int = 0
    skills_required: Optional[List[str]] = None


@dataclass
class VehicleSpec:
    id_vehicle: str
    capacity_weight: int
    capacity_volume: int
    skills: List[str]


def _to_int_capacity(x: float) -> int:
    return int(round(x * 1000))


def _vehicle_can_do(order_skills: List[str], vehicle_skills: List[str]) -> bool:
    if not order_skills:
        return True
    vs = set(vehicle_skills or [])
    return all(s in vs for s in order_skills)


def solve_cvrptw(
    pending_route_id: str,
    depot: Node,
    orders: List[Node],
    vehicles: List[VehicleSpec],
    duration_matrix: List[List[int]],
    reference_time_iso: str,
    service_time_seconds: int = 0,
    time_limit_seconds: int = 30,
) -> Dict[str, Any]:
    if not orders:
        return {
            "pending_route_id": pending_route_id,
            "reference_time": reference_time_iso,
            "vehicles": [],
            "unassigned": [],
        }

    all_nodes = [depot] + orders
    num_locations = len(all_nodes)
    num_vehicles = len(vehicles)

    if len(duration_matrix) != num_locations:
        raise RuntimeError("duration_matrix size mismatch")

    manager = pywrapcp.RoutingIndexManager(num_locations, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        base = duration_matrix[from_node][to_node]
        if from_node != 0:
            base += service_time_seconds
        return int(base)

    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    demand_w = [_to_int_capacity(n.weight) for n in all_nodes]
    demand_v = [_to_int_capacity(n.volume) for n in all_nodes]

    def demand_w_cb(from_index: int) -> int:
        node = manager.IndexToNode(from_index)
        return int(demand_w[node])

    def demand_v_cb(from_index: int) -> int:
        node = manager.IndexToNode(from_index)
        return int(demand_v[node])

    demand_w_index = routing.RegisterUnaryTransitCallback(demand_w_cb)
    demand_v_index = routing.RegisterUnaryTransitCallback(demand_v_cb)

    routing.AddDimensionWithVehicleCapacity(
        demand_w_index,
        0,
        [v.capacity_weight for v in vehicles],
        True,
        "Weight",
    )
    routing.AddDimensionWithVehicleCapacity(
        demand_v_index,
        0,
        [v.capacity_volume for v in vehicles],
        True,
        "Volume",
    )

    routing.AddDimension(
        transit_callback_index,
        60 * 60 * 24,
        60 * 60 * 24,
        False,
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")

    # Time windows
    for loc_idx, node in enumerate(all_nodes):
        index = manager.NodeToIndex(loc_idx)
        time_dim.CumulVar(index).SetRange(int(node.tw_start), int(node.tw_end))

    # Skills restriction per order
    for i, order in enumerate(orders, start=1):
        req = order.skills_required or []
        if not req:
            continue
        allowed = [vi for vi, v in enumerate(vehicles) if _vehicle_can_do(req, v.skills)]
        if not allowed:
            logger.warning("No vehicle can satisfy skills for order %s req=%s", order.id, req)
            continue
        routing.SetAllowedVehiclesForIndex(allowed, manager.NodeToIndex(i))

    # Allow dropping orders with penalty (keeps solver feasible)
    penalty = 10_000_000
    for i in range(1, num_locations):
        routing.AddDisjunction([manager.NodeToIndex(i)], penalty)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.seconds = int(time_limit_seconds)

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        return {
            "pending_route_id": pending_route_id,
            "reference_time": reference_time_iso,
            "status": "no_solution",
            "vehicles": [],
            "unassigned": [o.id for o in orders],
        }

    def _get_load(dim_name: str, index: int) -> int:
        dim = routing.GetDimensionOrDie(dim_name)
        return int(solution.Value(dim.CumulVar(index)))

    routes: List[Dict[str, Any]] = []
    unassigned: List[str] = []

    for node_idx in range(1, num_locations):
        if solution.Value(routing.NextVar(manager.NodeToIndex(node_idx))) == manager.NodeToIndex(node_idx):
            unassigned.append(all_nodes[node_idx].id)

    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        vehicle_spec = vehicles[vehicle_id]

        stops: List[Dict[str, Any]] = []
        while not routing.IsEnd(index):
            node = all_nodes[manager.IndexToNode(index)]
            stops.append(
                {
                    "kind": node.kind,
                    "id": node.id,
                    "lat": node.lat,
                    "lon": node.lon,
                    "time_arrival": int(solution.Value(time_dim.CumulVar(index))),
                    "load_weight": _get_load("Weight", index),
                    "load_volume": _get_load("Volume", index),
                }
            )
            index = solution.Value(routing.NextVar(index))

        # End node
        node = all_nodes[manager.IndexToNode(index)]
        stops.append(
            {
                "kind": node.kind,
                "id": node.id,
                "lat": node.lat,
                "lon": node.lon,
                "time_arrival": int(solution.Value(time_dim.CumulVar(index))),
                "load_weight": _get_load("Weight", index),
                "load_volume": _get_load("Volume", index),
            }
        )

        if len(stops) <= 2:
            continue

        routes.append(
            {
                "id_vehicle": vehicle_spec.id_vehicle,
                "skills": vehicle_spec.skills,
                "capacity_weight": vehicle_spec.capacity_weight,
                "capacity_volume": vehicle_spec.capacity_volume,
                "stops": stops,
            }
        )

    return {
        "pending_route_id": pending_route_id,
        "reference_time": reference_time_iso,
        "status": "ok",
        "vehicles": routes,
        "unassigned": unassigned,
    }
