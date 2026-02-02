import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Any

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from backend import db
from backend.logging_utils import setup_logging
from backend.models import PendingPayload, Vehicle
from backend.ors import get_duration_matrix
from backend.ors_directions import get_duration_matrix_via_directions
from backend.ors_fallback import get_duration_matrix_fallback
from backend.solver import Node, VehicleSpec, solve_cvrptw

logger = logging.getLogger(__name__)

class OptimizerState(Dict[str, Any]):
    """State for the LangGraph workflow"""
    pending_route_id: str
    payload: Dict[str, Any]
    parsed: PendingPayload
    vehicles: List[Vehicle]
    locations: List[List[float]]
    duration_matrix: List[List[int]]
    depot_node: Node
    order_nodes: List[Node]
    vehicle_specs: List[VehicleSpec]
    result: Dict[str, Any]
    error: str
    strategy: str  # 'ors_matrix', 'ors_directions', 'fallback'
    quality_score: float


def validate_input(state: OptimizerState) -> OptimizerState:
    """Validate input data"""
    logger.info("Validating input data")
    
    try:
        parsed = PendingPayload.model_validate(state["payload"])
        state["parsed"] = parsed
        
        # Basic validations
        if not parsed.orders:
            raise ValueError("No orders provided")
        
        if not parsed.vehicles:
            # Load from DB if not provided
            vehicles_payload = [Vehicle.model_validate(v) for v in db.load_vehicles_from_db()]
            if not vehicles_payload:
                raise ValueError("No vehicles provided")
            parsed.vehicles = vehicles_payload
        
        # Check if coordinates are valid
        for order in parsed.orders:
            if not (-90 <= order.lat <= 90) or not (-180 <= order.lon <= 180):
                raise ValueError(f"Invalid coordinates for order {order.id_pedido}")
        
        logger.info(f"Validation passed: {len(parsed.orders)} orders, {len(parsed.vehicles)} vehicles")
        return state
        
    except Exception as e:
        state["error"] = str(e)
        logger.error(f"Validation failed: {e}")
        return state


def analyze_context(state: OptimizerState) -> OptimizerState:
    """Analyze context to choose best strategy"""
    logger.info("Analyzing context to choose optimization strategy")
    
    parsed = state["parsed"]
    order_count = len(parsed.orders)
    vehicle_count = len(parsed.vehicles)
    
    # Choose strategy based on problem size and conditions
    if order_count <= 10:
        state["strategy"] = "ors_matrix"  # Use matrix API for small problems
    elif order_count <= 50:
        state["strategy"] = "ors_directions"  # Use directions for medium
    else:
        state["strategy"] = "fallback"  # Use fallback for large problems
    
    # Check time of day for traffic considerations
    current_hour = datetime.now().hour
    if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
        logger.info("Rush hour detected - may need to adjust expectations")
    
    logger.info(f"Selected strategy: {state['strategy']}")
    return state


def get_distances(state: OptimizerState) -> OptimizerState:
    """Get distance matrix using selected strategy"""
    logger.info(f"Getting distance matrix using {state['strategy']} strategy")
    
    try:
        if state["strategy"] == "ors_matrix":
            state["duration_matrix"] = get_duration_matrix(state["locations"])
        elif state["strategy"] == "ors_directions":
            state["duration_matrix"] = get_duration_matrix_via_directions(state["locations"])
        else:
            state["duration_matrix"] = get_duration_matrix_fallback(state["locations"])
        
        logger.info(f"Got {len(state['duration_matrix'])}x{len(state['duration_matrix'][0])} matrix")
        return state
        
    except Exception as e:
        logger.warning(f"Strategy {state['strategy']} failed: {e}")
        
        # Try fallback
        try:
            state["duration_matrix"] = get_duration_matrix_fallback(state["locations"])
            state["strategy"] = "fallback"
            logger.info("Using fallback matrix")
            return state
        except Exception as e2:
            state["error"] = f"All strategies failed: {e2}"
            return state


def prepare_solver_data(state: OptimizerState) -> OptimizerState:
    """Prepare data for the solver"""
    logger.info("Preparing solver data")
    
    parsed = state["parsed"]
    
    # Depot node
    state["depot_node"] = Node(
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
    
    # Order nodes
    state["order_nodes"] = []
    for o in parsed.orders:
        state["order_nodes"].append(
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
    
    # Vehicle specs
    state["vehicle_specs"] = []
    for v in parsed.vehicles:
        state["vehicle_specs"].append(
            VehicleSpec(
                id_vehicle=str(v.id_vehicle),
                capacity_weight=int(round(float(v.capacity_weight) * 1000)),
                capacity_volume=int(round(float(v.capacity_volume) * 1000)),
                skills=list(v.skills or []),
            )
        )
    
    return state


def solve_optimization(state: OptimizerState) -> OptimizerState:
    """Solve the CVRPTW problem"""
    logger.info("Solving CVRPTW optimization")
    
    try:
        result = solve_cvrptw(
            pending_route_id=state["pending_route_id"],
            depot=state["depot_node"],
            orders=state["order_nodes"],
            vehicles=state["vehicle_specs"],
            duration_matrix=state["duration_matrix"],
            reference_time_iso=datetime.now(timezone.utc).isoformat(),
            service_time_seconds=0,
            time_limit_seconds=30,
        )
        
        state["result"] = result
        state["quality_score"] = calculate_quality_score(result)
        logger.info(f"Optimization complete with score: {state['quality_score']}")
        return state
        
    except Exception as e:
        state["error"] = f"Solver failed: {e}"
        logger.exception("Solver failed")
        return state


def validate_solution(state: OptimizerState) -> OptimizerState:
    """Validate and potentially improve the solution"""
    logger.info("Validating solution quality")
    
    result = state["result"]
    
    # Basic checks
    if not result or result.get("status") != "ok":
        state["error"] = "Invalid solution status"
        return state
    
    # Check if all orders are assigned
    unassigned = result.get("unassigned", [])
    if unassigned:
        logger.warning(f"Unassigned orders: {unassigned}")
    
    # Check total distance/time
    total_time = 0
    for vehicle in result.get("vehicles", []):
        if vehicle.get("stops"):
            last_stop = vehicle["stops"][-1]
            total_time = max(total_time, last_stop.get("time_arrival", 0))
    
    logger.info(f"Total route time: {total_time}s ({total_time/60:.1f} minutes)")
    
    # If solution is poor quality, try alternative
    if state["quality_score"] < 0.5 and state["strategy"] != "fallback":
        logger.info("Solution quality low, trying alternative approach")
        # Could implement alternative strategies here
    
    return state


def calculate_quality_score(result: Dict[str, Any]) -> float:
    """Calculate a quality score for the solution"""
    if not result or result.get("status") != "ok":
        return 0.0
    
    score = 1.0
    
    # Penalize unassigned orders
    unassigned = result.get("unassigned", [])
    if unassigned:
        score -= len(unassigned) * 0.2
    
    # Bonus for balanced vehicle usage
    vehicles = result.get("vehicles", [])
    if vehicles:
        loads = [v.get("stops", []) for v in vehicles]
        balance = 1.0 - (max(len(l) for l in loads) - min(len(l) for l in loads)) / max(len(l) for l in loads)
        score *= (0.5 + 0.5 * balance)
    
    return max(0.0, min(1.0, score))


def save_result(state: OptimizerState) -> OptimizerState:
    """Save the result to database"""
    logger.info("Saving optimization result")
    
    try:
        db.insert_optimized_route(
            pending_route_id=state["pending_route_id"],
            status=state["result"].get("status", "unknown"),
            result=state["result"]
        )
        
        # Also save metadata about the optimization
        metadata = {
            "strategy": state["strategy"],
            "quality_score": state["quality_score"],
            "orders_count": len(state["order_nodes"]),
            "vehicles_count": len(state["vehicle_specs"]),
        }
        
        logger.info(f"Result saved with metadata: {metadata}")
        return state
        
    except Exception as e:
        state["error"] = f"Failed to save result: {e}"
        logger.exception("Failed to save result")
        return state


def handle_error(state: OptimizerState) -> OptimizerState:
    """Handle errors in the workflow"""
    error = state.get("error", "Unknown error")
    logger.error(f"Workflow error: {error}")
    
    try:
        db.mark_pending_failed(state["pending_route_id"], error)
    except Exception as e:
        logger.error(f"Failed to mark as failed: {e}")
    
    return state


def create_langgraph_workflow() -> StateGraph:
    """Create the LangGraph workflow"""
    workflow = StateGraph(OptimizerState)
    
    # Add nodes
    workflow.add_node("validate", validate_input)
    workflow.add_node("analyze", analyze_context)
    workflow.add_node("distances", get_distances)
    workflow.add_node("prepare", prepare_solver_data)
    workflow.add_node("solve", solve_optimization)
    workflow.add_node("validate_solution", validate_solution)
    workflow.add_node("save", save_result)
    workflow.add_node("error", handle_error)
    
    # Add edges
    workflow.set_entry_point("validate")
    workflow.add_edge("validate", "analyze")
    workflow.add_edge("analyze", "distances")
    workflow.add_edge("distances", "prepare")
    workflow.add_edge("prepare", "solve")
    workflow.add_edge("solve", "validate_solution")
    workflow.add_edge("validate_solution", "save")
    workflow.add_edge("save", END)
    
    # Add conditional edges for error handling
    workflow.add_conditional_edges(
        "validate",
        lambda x: "error" if x.get("error") else "continue",
        {
            "error": "error",
            "continue": "analyze"
        }
    )
    
    workflow.add_conditional_edges(
        "distances",
        lambda x: "error" if x.get("error") else "continue",
        {
            "error": "error",
            "continue": "prepare"
        }
    )
    
    workflow.add_conditional_edges(
        "solve",
        lambda x: "error" if x.get("error") else "continue",
        {
            "error": "error",
            "continue": "validate_solution"
        }
    )
    
    workflow.add_conditional_edges(
        "save",
        lambda x: "error" if x.get("error") else "continue",
        {
            "error": "error",
            "continue": END
        }
    )
    
    # Add memory for persistence
    memory = MemorySaver()
    
    return workflow.compile(checkpointer=memory)


def main() -> None:
    """Main entry point"""
    setup_logging()
    logger.info("Starting LangGraph optimizer")
    
    pending_route_id = os.environ.get("PENDING_ROUTE_ID")
    if not pending_route_id:
        logger.error("PENDING_ROUTE_ID is required")
        return
    
    # Fetch pending route
    row = db.fetch_one_pending_route(pending_route_id=pending_route_id)
    if not row:
        logger.error(f"No pending route found with id={pending_route_id}")
        return
    
    # Create workflow
    workflow = create_langgraph_workflow()
    
    # Initial state
    initial_state = OptimizerState({
        "pending_route_id": row["id"],
        "payload": row["payload"],
        "error": None,
    })
    
    # Run workflow
    try:
        result = workflow.invoke(initial_state)
        
        if result.get("error"):
            logger.error(f"Workflow failed: {result['error']}")
        else:
            logger.info("Workflow completed successfully")
            logger.info(f"Strategy used: {result.get('strategy')}")
            logger.info(f"Quality score: {result.get('quality_score')}")
            
    except Exception as e:
        logger.exception("Workflow execution failed")


if __name__ == "__main__":
    main()
