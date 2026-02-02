import json
import logging
import os
from datetime import datetime, timezone

from backend import db
from backend.logging_utils import setup_logging
from backend.models import PendingPayload, Vehicle
from backend.ors import get_duration_matrix
from backend.ors_fallback import get_duration_matrix_fallback
from backend.solver import Node, VehicleSpec, solve_cvrptw

logger = logging.getLogger(__name__)


def main() -> None:
    setup_logging()
    logger.info("Starting optimizer (simple)")

    pending_route_id = os.environ.get("PENDING_ROUTE_ID")
    if not pending_route_id:
        logger.error("PENDING_ROUTE_ID is required")
        return

    row = db.fetch_one_pending_route(pending_route_id=pending_route_id)
    if not row:
        logger.error("No pending route found with id=%s", pending_route_id)
        return

    pr_id = row["id"]
    payload = row["payload"]
    logger.info("Processing pending_route_id=%s", pr_id)

    try:
        parsed = PendingPayload.model_validate(payload)

        vehicles_payload = parsed.vehicles
        if not vehicles_payload:
            vehicles_payload = [Vehicle.model_validate(v) for v in db.load_vehicles_from_db()]

        if not vehicles_payload:
            raise RuntimeError("No vehicles provided")

        # Build locations list
        locations_lonlat = [[float(parsed.depot.lon), float(parsed.depot.lat)]]
        for o in parsed.orders:
            locations_lonlat.append([float(o.lon), float(o.lat)])

        logger.info("Requesting ORS matrix size=%sx%s", len(locations_lonlat), len(locations_lonlat))
        try:
            duration_matrix = get_duration_matrix(locations_lonlat)
        except Exception as e:
            logger.warning("ORS failed: %s", e)
            duration_matrix = get_duration_matrix_fallback(locations_lonlat)

        # Prepare solver data
        depot_node = Node(
            kind="depot",
            id="depot",
            lat=float(parsed.depot.lat),
            lon=float(parsed.depot.lon),
            weight=0.0,
            volume=0.0,
            tw_start=0,
            tw_end=86400,
            skills_required=[],
        )

        order_nodes = []
        for o in parsed.orders:
            order_nodes.append(
                Node(
                    kind="order",
                    id=str(o.id_pedido),
                    lat=float(o.lat),
                    lon=float(o.lon),
                    weight=float(o.peso or 0.0),
                    volume=float(o.volumen or 0.0),
                    tw_start=0,
                    tw_end=86400,
                    skills_required=list(o.skills_required or []),
                )
            )

        vehicle_specs = []
        for v in vehicles_payload:
            vehicle_specs.append(
                VehicleSpec(
                    id_vehicle=str(v.id_vehicle),
                    capacity_weight=int(round(float(v.capacity_weight) * 1000)),
                    capacity_volume=int(round(float(v.capacity_volume) * 1000)),
                    skills=list(v.skills or []),
                )
            )

        # Solve
        logger.info("Solving CVRPTW")
        result = solve_cvrptw(
            pending_route_id=pr_id,
            depot=depot_node,
            orders=order_nodes,
            vehicles=vehicle_specs,
            duration_matrix=duration_matrix,
            reference_time_iso=datetime.now(timezone.utc).isoformat(),
            service_time_seconds=0,
            time_limit_seconds=30,
        )

        logger.info("Solver done status=%s", result.get("status"))
        db.insert_optimized_route(pending_route_id=pr_id, status=result.get("status", "unknown"), result=result)

    except Exception as e:
        logger.exception("Optimizer failed pending_route_id=%s", pr_id)
        db.mark_pending_failed(pr_id, str(e))


if __name__ == "__main__":
    main()
