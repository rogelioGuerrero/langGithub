import logging
from typing import Dict, Any, List, Optional
import asyncio
from datetime import datetime

from ..base import NodeBase
from backend.ors import get_duration_matrix

logger = logging.getLogger(__name__)

class ORSMatrixNode(NodeBase):
    """
    Nodo que obtiene la matriz de distancias y tiempos 
    desde OpenRouteService para optimización de rutas
    """
    
    __version__ = "1.0.0"
    __author__ = "Route Optimizer Team"
    
    @classmethod
    def get_dependencies(cls) -> List[str]:
        return ["openrouteservice", "requests"]
    
    @classmethod
    def get_input_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "depot": {
                    "type": "object",
                    "properties": {
                        "lat": {"type": "number"},
                        "lon": {"type": "number"}
                    },
                    "required": ["lat", "lon"]
                },
                "orders": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "lat": {"type": "number"},
                            "lon": {"type": "number"}
                        },
                        "required": ["lat", "lon"]
                    }
                }
            },
            "required": ["depot", "orders"]
        }
    
    @classmethod
    def get_output_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "locations_lonlat": {
                    "type": "array",
                    "description": "Lista de coordenadas [lon, lat]"
                },
                "duration_matrix": {
                    "type": "array",
                    "description": "Matriz de duraciones en segundos"
                },
                "distance_matrix": {
                    "type": "array",
                    "description": "Matriz de distancias en metros"
                }
            },
            "required": ["locations_lonlat", "duration_matrix"]
        }
    
    def _build_locations_list(self, depot: Dict[str, Any], orders: List[Dict[str, Any]]) -> List[List[float]]:
        """Construye la lista de ubicaciones para ORS"""
        locations = []
        
        # Agregar depot primero
        locations.append([float(depot["lon"]), float(depot["lat"])])
        
        # Agregar cada orden
        for order in orders:
            locations.append([float(order["lon"]), float(order["lat"])])
        
        return locations
    
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta la obtención de la matriz de ORS"""
        depot = state["depot"]
        orders = state["orders"]
        
        # Construir lista de ubicaciones
        locations_lonlat = self._build_locations_list(depot, orders)
        
        logger.info(f"Requesting ORS matrix for {len(locations_lonlat)} locations")
        
        try:
            # Obtener matriz de duraciones
            duration_matrix = await asyncio.to_thread(
                get_duration_matrix, 
                locations_lonlat
            )
            
            logger.info("ORS matrix received successfully")
            
            # Calcular matriz de distancias si se necesita
            # (ORS devuelve duraciones, las distancias pueden aproximarse)
            
            return {
                "locations_lonlat": locations_lonlat,
                "duration_matrix": duration_matrix,
                "matrix_timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get ORS matrix: {str(e)}")
            
            # Fallback: matriz euclidiana aproximada
            logger.warning("Using fallback euclidean distance matrix")
            return self._fallback_matrix(locations_lonlat)
    
    def _fallback_matrix(self, locations: List[List[float]]) -> Dict[str, Any]:
        """Genera matriz de fallback basada en distancias euclidianas"""
        import math
        
        n = len(locations)
        matrix = [[0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    # Distancia euclidiana en metros (aproximado)
                    lat1, lon1 = locations[i][1], locations[i][0]
                    lat2, lon2 = locations[j][1], locations[j][0]
                    
                    # Conversión aproximada a metros
                    lat_diff = (lat2 - lat1) * 111320  # 1 grado ≈ 111.32 km
                    lon_diff = (lon2 - lon1) * 111320 * math.cos(math.radians(lat1))
                    
                    distance = math.sqrt(lat_diff**2 + lon_diff**2)
                    # Asumir velocidad promedio de 30 km/h = 8.33 m/s
                    duration = int(distance / 8.33)
                    
                    matrix[i][j] = duration
        
        return {
            "locations_lonlat": locations,
            "duration_matrix": matrix,
            "fallback_used": True,
            "matrix_timestamp": datetime.utcnow().isoformat()
        }
    
    def validate_input(self, state: Dict[str, Any]) -> bool:
        """Valida que los datos de entrada sean correctos"""
        if "depot" not in state or "orders" not in state:
            return False
        
        depot = state["depot"]
        orders = state["orders"]
        
        # Validar depot
        if not all(key in depot for key in ["lat", "lon"]):
            return False
        
        # Validar órdenes
        for order in orders:
            if not all(key in order for key in ["lat", "lon"]):
                return False
        
        return True
