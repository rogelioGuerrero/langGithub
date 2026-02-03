from .base import NodeBase, NodeRegistry, registry

# Importar nodos disponibles
from .database_fetch_node import DatabaseFetchNode
from .ors_matrix_node import ORSMatrixNode
from .or_tools_solver_node import ORToolsSolverNode
from .save_results_node import SaveResultsNode

# Registrar nodos automáticamente
registry.register(DatabaseFetchNode, "fetch_data")
registry.register(ORSMatrixNode, "get_matrix")
registry.register(ORToolsSolverNode, "solve_optimization")
registry.register(SaveResultsNode, "save_results")

__all__ = [
    'NodeBase',
    'NodeRegistry', 
    'registry',
    'DatabaseFetchNode',
    'ORSMatrixNode',
    'ORToolsSolverNode',
    'SaveResultsNode'
]
