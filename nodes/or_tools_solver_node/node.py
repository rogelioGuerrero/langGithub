import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from dateutil import parser as dtparser

from ..base import NodeBase
from backend.solver import Node, VehicleSpec, solve_cvrptw

logger = logging.getLogger(__name__)

class ORToolsSolverNode(NodeBase):
    """
    Nodo que resuelve el problema de optimización de rutas
    utilizando OR-Tools de Google
    """
    
    __version__ = "1.0.0"
    __author__ = "Route Optimizer Team"
    
    @classmethod
    def get_dependencies(cls) -> List[str]:
        return ["ortools>=9.0.0", "python-dateutil"]
    
    @classmethod
    def get_input_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "pending_route_id": {"type": "string"},
                "depot": {"type": "object"},
                "orders": {"type": "array"},
                "vehicles": {"type": "array"},
                "duration_matrix": {"type": "array"},
                "reference_time_iso": {"type": "string"}
            },
            "required": ["pending_route_id", "depot", "orders", "vehicles", "duration_matrix"]
        }
    
    @classmethod
    def get_output_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "result": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "vehicles": {"type": "array"},
                        "unassigned": {"type": "array"},
                        "total_distance": {"type": "number"},
                        "total_time": {"type": "number"}
                    }
                }
            },
            "required": ["result"]
        }
    
    def _to_offset_seconds(self, dt_str: str, reference: datetime) -> int:
        """Convierte una fecha a segundos desde el tiempo de referencia"""
        dt = dtparser.isoparse(dt_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int((dt - reference).total_seconds())
    
    def _build_depot_node(self, depot: Dict[str, Any], reference: datetime) -> Node:
        """Construye el nodo del depósito"""
        depot_tw_start = 0
        depot_tw_end = 60 * 60 * 24  # 24 horas por defecto
        
        if depot.get("ventana_inicio"):
            depot_tw_start = self._to_offset_seconds(depot["ventana_inicio"], reference)
        if depot.get("ventana_fin"):
            depot_tw_end = self._to_offset_seconds(depot["ventana_fin"], reference)
        
        return Node(
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
    
    def _build_order_nodes(self, orders: List[Dict[str, Any]], reference: datetime) -> List[Node]:
        """Construye los nodos de órdenes"""
        order_nodes = []
        
        for order in orders:
            node = Node(
                kind="order",
                id=str(order["id_pedido"]),
                lat=float(order["lat"]),
                lon=float(order["lon"]),
                weight=float(order.get("peso") or 0.0),
                volume=float(order.get("volumen") or 0.0),
                tw_start=self._to_offset_seconds(order["ventana_inicio"], reference),
                tw_end=self._to_offset_seconds(order["ventana_fin"], reference),
                skills_required=list(order.get("skills_required") or []),
            )
            order_nodes.append(node)
        
        return order_nodes
    
    def _build_vehicle_specs(self, vehicles: List[Dict[str, Any]]) -> List[VehicleSpec]:
        """Construye las especificaciones de vehículos"""
        vehicle_specs = []
        
        for vehicle in vehicles:
            spec = VehicleSpec(
                id_vehicle=str(vehicle["id_vehicle"]),
                capacity_weight=int(round(float(vehicle["capacity_weight"]) * 1000)),
                capacity_volume=int(round(float(vehicle["capacity_volume"]) * 1000)),
                skills=list(vehicle.get("skills") or []),
            )
            vehicle_specs.append(spec)
        
        return vehicle_specs
    
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta el solver de OR-Tools"""
        pr_id = state["pending_route_id"]
        depot = state["depot"]
        orders = state["orders"]
        vehicles = state["vehicles"]
        duration_matrix = state["duration_matrix"]
        
        # Parsear tiempo de referencia
        reference = dtparser.isoparse(state["reference_time_iso"])
        
        # Construir estructuras para el solver
        depot_node = self._build_depot_node(depot, reference)
        order_nodes = self._build_order_nodes(orders, reference)
        vehicle_specs = self._build_vehicle_specs(vehicles)
        
        # Obtener parámetros de configuración
        service_time_seconds = int(
            os.environ.get("SERVICE_TIME_SECONDS", "0") or 
            self.config.get("service_time_seconds", "0")
        )
        time_limit_seconds = int(
            os.environ.get("SOLVER_TIME_LIMIT_SECONDS", "30") or 
            self.config.get("time_limit_seconds", "30")
        )
        
        logger.info(f"Solving CVRPTW for route {pr_id}")
        
        try:
            # Ejecutar solver
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
            
            logger.info(
                f"Solver completed: status={result.get('status')}, "
                f"unassigned={len(result.get('unassigned', []))}"
            )
            
            # Enriquecer resultado con métricas
            if result.get("status") == "optimal" or result.get("status") == "feasible":
                result["solver_metadata"] = {
                    "solver": "ortools",
                    "time_limit": time_limit_seconds,
                    "service_time": service_time_seconds,
                    "solved_at": datetime.utcnow().isoformat(),
                    "total_orders": len(orders),
                    "total_vehicles": len(vehicles)
                }
            
            return {"result": result}
            
        except Exception as e:
            logger.error(f"Solver failed for route {pr_id}: {str(e)}")
            # Retornar resultado de error
            return {
                "result": {
                    "status": "error",
                    "error": str(e),
                    "pending_route_id": pr_id
                }
            }
    
    def validate_input(self, state: Dict[str, Any]) -> bool:
        """Valida que todos los datos requeridos estén presentes"""
        required = ["pending_route_id", "depot", "orders", "vehicles", "duration_matrix"]
        return all(key in state for key in required)
