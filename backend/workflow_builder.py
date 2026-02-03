"""
Construye workflows de LangGraph usando nodos desacoplados
"""
import os
import logging
from typing import Dict, Any, List, Optional, Callable
from langgraph.graph import StateGraph, END

from nodes import NodeBase, registry

logger = logging.getLogger(__name__)

class WorkflowBuilder:
    """Constructor de workflows usando nodos registrados"""
    
    def __init__(self):
        self.graph = None
        self.nodes: Dict[str, NodeBase] = {}
        self.edges: List[tuple] = []
        self.conditional_edges: List[tuple] = []
    
    def add_node(self, name: str, node_name: str, config: Optional[Dict[str, Any]] = None):
        """Agrega un nodo al workflow"""
        node = registry.create_node(node_name, config)
        self.nodes[name] = node
        return self
    
    def add_edge(self, from_node: str, to_node: str):
        """Agrega una conexión entre nodos"""
        self.edges.append((from_node, to_node))
        return self
    
    def add_conditional_edge(
        self, 
        from_node: str, 
        condition: Callable[[Dict[str, Any]], str],
        node_mapping: Dict[str, str]
    ):
        """Agrega una conexión condicional"""
        self.conditional_edges.append((from_node, condition, node_mapping))
        return self
    
    def set_entry_point(self, node_name: str):
        """Define el punto de entrada del workflow"""
        self.entry_point = node_name
        return self
    
    def build(self, state_type: type):
        """Construye el grafo de LangGraph"""
        if not hasattr(self, 'entry_point'):
            raise ValueError("Entry point must be set")
        
        # Crear el grafo
        self.graph = StateGraph(state_type)
        
        # Agregar nodos
        for name, node in self.nodes.items():
            self.graph.add_node(name, node)
        
        # Configurar punto de entrada
        self.graph.set_entry_point(self.entry_point)
        
        # Agregar edges
        for from_node, to_node in self.edges:
            self.graph.add_edge(from_node, to_node)
        
        # Agregar edges condicionales
        for from_node, condition, mapping in self.conditional_edges:
            self.graph.add_conditional_edges(from_node, condition, mapping)
        
        return self.graph.compile()

def build_standard_optimization_workflow():
    """Construye el workflow estándar de optimización"""
    builder = WorkflowBuilder()
    
    # Configuración desde variables de entorno
    node_configs = {
        "fetch_data": {
            "database_url": os.environ.get("DATABASE_URL"),
            "batch_size": int(os.environ.get("BATCH_SIZE", "100"))
        },
        "get_matrix": {
            "ors_api_key": os.environ.get("ORS_API_KEY"),
            "fallback_enabled": True
        },
        "solve_optimization": {
            "time_limit_seconds": int(os.environ.get("SOLVER_TIME_LIMIT_SECONDS", "30")),
            "service_time_seconds": int(os.environ.get("SERVICE_TIME_SECONDS", "0"))
        },
        "save_results": {
            "notify_on_save": os.environ.get("NOTIFY_ON_SAVE", "false").lower() == "true",
            "notifications": {
                "webhook_url": os.environ.get("WEBHOOK_URL")
            }
        }
    }
    
    # Construir workflow
    builder.set_entry_point("fetch_tasks") \
           .add_node("fetch_tasks", "fetch_data", node_configs["fetch_data"]) \
           .add_node("get_matrix", "get_matrix", node_configs["get_matrix"]) \
           .add_node("solve_optimization", "solve_optimization", node_configs["solve_optimization"]) \
           .add_node("save_results", "save_results", node_configs["save_results"]) \
           .add_edge("fetch_tasks", "get_matrix") \
           .add_edge("get_matrix", "solve_optimization") \
           .add_edge("solve_optimization", "save_results") \
           .add_edge("save_results", END)
    
    # Agregar edge condicional para manejar casos sin trabajo
    def has_work(state: Dict[str, Any]) -> str:
        return "get_matrix" if state.get("pending_route_id") else END
    
    builder.add_conditional_edge("fetch_tasks", has_work, {"get_matrix": "get_matrix", END: END})
    
    # Definir tipo de estado
    from typing import TypedDict
    
    class OptimizationState(TypedDict, total=False):
        pending_route_id: str
        payload: Dict[str, Any]
        depot: Dict[str, Any]
        orders: List[Dict[str, Any]]
        vehicles: List[Dict[str, Any]]
        locations_lonlat: List[List[float]]
        duration_matrix: List[List[int]]
        reference_time_iso: str
        result: Dict[str, Any]
    
    return builder.build(OptimizationState)

def build_multi_customer_workflow():
    """Workflow mejorado para múltiples clientes"""
    builder = WorkflowBuilder()
    
    # Nodos adicionales para multi-cliente
    builder.set_entry_point("ingest_orders") \
           .add_node("ingest_orders", "ingest_customer_orders") \
           .add_node("validate_orders", "validate_order_data") \
           .add_node("cluster_by_zone", "cluster_orders_by_zone") \
           .add_node("assign_vehicles", "assign_vehicles_to_clusters") \
           .add_node("optimize_clusters", "parallel_optimize") \
           .add_node("merge_routes", "merge_optimized_routes") \
           .add_node("notify_customers", "send_customer_notifications") \
           .add_node("notify_drivers", "send_driver_notifications")
    
    # Lógica de branching basada en volumen de pedidos
    def check_volume(state: Dict[str, Any]) -> str:
        order_count = len(state.get("orders", []))
        if order_count > 50:
            return "cluster_by_zone"
        elif order_count > 10:
            return "assign_vehicles"
        else:
            return "optimize_direct"
    
    builder.add_conditional_edge(
        "validate_orders",
        check_volume,
        {
            "cluster_by_zone": "cluster_by_zone",
            "assign_vehicles": "assign_vehicles",
            "optimize_direct": "optimize_clusters"
        }
    )
    
    # ... más configuración
    
    return builder
