import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from ..base import NodeBase
from backend import db

logger = logging.getLogger(__name__)

class SaveResultsNode(NodeBase):
    """
    Nodo que guarda los resultados de la optimización
    en la base de datos para posterior consulta
    """
    
    __version__ = "1.0.0"
    __author__ = "Route Optimizer Team"
    
    @classmethod
    def get_dependencies(cls) -> List[str]:
        return ["postgresql", "psycopg2"]
    
    @classmethod
    def get_input_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "pending_route_id": {"type": "string"},
                "result": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "vehicles": {"type": "array"},
                        "unassigned": {"type": "array"}
                    }
                }
            },
            "required": ["pending_route_id", "result"]
        }
    
    @classmethod
    def get_output_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "saved_at": {"type": "string"},
                "route_id": {"type": "string"},
                "status": {"type": "string"}
            },
            "required": ["saved_at", "route_id", "status"]
        }
    
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta el guardado de resultados en BD"""
        pr_id = state["pending_route_id"]
        result = state["result"]
        
        # Extraer estado del resultado
        status = result.get("status", "unknown")
        
        # Enriquecer resultado con metadata
        enriched_result = {
            **result,
            "saved_at": datetime.utcnow().isoformat(),
            "node_version": self.__version__,
            "processing_complete": True
        }
        
        try:
            # Guardar en base de datos
            db.insert_optimized_route(
                pending_route_id=pr_id,
                status=status,
                result=enriched_result
            )
            
            logger.info(f"Results saved for route {pr_id}")
            
            # Si hay notificaciones configuradas, enviarlas
            if self.config.get("notify_on_save", False):
                await self._send_notifications(pr_id, status, result)
            
            return {
                "saved_at": enriched_result["saved_at"],
                "route_id": pr_id,
                "status": status,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Failed to save results for route {pr_id}: {str(e)}")
            
            # Marcar como fallido en BD
            try:
                db.mark_pending_failed(pr_id, f"Save error: {str(e)}")
            except:
                pass
            
            return {
                "saved_at": datetime.utcnow().isoformat(),
                "route_id": pr_id,
                "status": "error",
                "error": str(e),
                "success": False
            }
    
    async def _send_notifications(self, route_id: str, status: str, result: Dict[str, Any]):
        """Envía notificaciones sobre el resultado"""
        # Implementación futura: webhook, email, Slack, etc.
        notification_config = self.config.get("notifications", {})
        
        if notification_config.get("webhook_url"):
            import aiohttp
            async with aiohttp.ClientSession() as session:
                payload = {
                    "route_id": route_id,
                    "status": status,
                    "timestamp": datetime.utcnow().isoformat(),
                    "summary": {
                        "vehicles_assigned": len(result.get("vehicles", [])),
                        "unassigned_orders": len(result.get("unassigned", [])),
                        "total_distance": result.get("total_distance", 0)
                    }
                }
                
                try:
                    await session.post(
                        notification_config["webhook_url"],
                        json=payload
                    )
                    logger.info(f"Notification sent for route {route_id}")
                except Exception as e:
                    logger.warning(f"Failed to send notification: {str(e)}")
    
    def validate_input(self, state: Dict[str, Any]) -> bool:
        """Valida que los datos necesarios estén presentes"""
        return "pending_route_id" in state and "result" in state
