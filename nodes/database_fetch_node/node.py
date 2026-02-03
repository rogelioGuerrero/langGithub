import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from ..base import NodeBase
from backend import db
from backend.models import PendingPayload, Vehicle

logger = logging.getLogger(__name__)

class DatabaseFetchNode(NodeBase):
    """
    Nodo que obtiene tareas pendientes de la base de datos
    para su procesamiento en el pipeline de optimización
    """
    
    __version__ = "1.0.0"
    __author__ = "Route Optimizer Team"
    
    @classmethod
    def get_dependencies(cls) -> List[str]:
        return ["postgresql", "psycopg2", "pydantic"]
    
    @classmethod
    def get_input_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "pending_route_id": {
                    "type": "string",
                    "description": "ID opcional de ruta específica a procesar"
                }
            }
        }
    
    @classmethod
    def get_output_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "pending_route_id": {"type": "string"},
                "payload": {"type": "object"},
                "depot": {"type": "object"},
                "orders": {"type": "array"},
                "vehicles": {"type": "array"},
                "reference_time_iso": {"type": "string"}
            },
            "required": ["pending_route_id", "payload", "depot", "orders", "vehicles"]
        }
    
    def _parse_payload(self, raw_payload: Dict[str, Any]) -> PendingPayload:
        """Parsea el payload usando el modelo Pydantic"""
        return PendingPayload.model_validate(raw_payload)
    
    def _get_reference_time(self, depot: Any, orders: Any) -> datetime:
        """Obtiene el tiempo de referencia para las ventanas horarias"""
        candidates: List[datetime] = []
        if depot.ventana_inicio is not None:
            candidates.append(depot.ventana_inicio)
        for o in orders:
            candidates.append(o.ventana_inicio)
        t0 = min(candidates) if candidates else datetime.now(timezone.utc)
        if t0.tzinfo is None:
            t0 = t0.replace(tzinfo=timezone.utc)
        return t0
    
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta la obtención de datos de la BD"""
        pending_route_id = (
            state.get("pending_route_id") or 
            os.environ.get("PENDING_ROUTE_ID") or 
            None
        )
        
        # Obtener ruta pendiente
        row = db.fetch_one_pending_route(pending_route_id=pending_route_id)
        if not row:
            logger.info("No pending routes found")
            return {}
        
        pr_id = row["id"]
        payload = row["payload"]
        
        # Parsear payload
        parsed = self._parse_payload(payload)
        
        # Obtener vehículos (del payload o BD)
        vehicles_payload = parsed.vehicles
        if not vehicles_payload:
            vehicles_payload = [Vehicle.model_validate(v) for v in db.load_vehicles_from_db()]
        
        if not vehicles_payload:
            raise RuntimeError("No vehicles available")
        
        # Calcular tiempo de referencia
        t0 = self._get_reference_time(parsed.depot, parsed.orders)
        reference_time_iso = t0.isoformat()
        
        # Construir estado de salida
        state_out = {
            "pending_route_id": pr_id,
            "payload": payload,
            "depot": parsed.depot.model_dump(mode="json"),
            "orders": [o.model_dump(mode="json") for o in parsed.orders],
            "vehicles": [v.model_dump(mode="json") for v in vehicles_payload],
            "reference_time_iso": reference_time_iso,
        }
        
        logger.info(
            f"Fetched data: route_id={pr_id}, "
            f"orders={len(parsed.orders)}, "
            f"vehicles={len(vehicles_payload)}"
        )
        
        return state_out
    
    def validate_input(self, state: Dict[str, Any]) -> bool:
        """Valida que no se requiera input específico"""
        return True  # Este nodo puede iniciar sin input
