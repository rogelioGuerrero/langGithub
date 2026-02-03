from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class NodeBase(ABC):
    """Clase base para todos los nodos del sistema"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.name = self.__class__.__name__
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
    
    @classmethod
    def get_node_info(cls) -> Dict[str, Any]:
        """Información del nodo para registro y descubrimiento"""
        return {
            "name": cls.__name__,
            "module": cls.__module__,
            "description": cls.__doc__ or "Sin descripción",
            "version": getattr(cls, "__version__", "1.0.0"),
            "author": getattr(cls, "__author__", "System"),
            "dependencies": cls.get_dependencies(),
            "input_schema": cls.get_input_schema(),
            "output_schema": cls.get_output_schema()
        }
    
    @classmethod
    def get_dependencies(cls) -> List[str]:
        """Dependencias externas del nodo"""
        return []
    
    @classmethod
    def get_input_schema(cls) -> Dict[str, Any]:
        """Schema de entrada del nodo"""
        return {"type": "object", "properties": {}}
    
    @classmethod
    def get_output_schema(cls) -> Dict[str, Any]:
        """Schema de salida del nodo"""
        return {"type": "object", "properties": {}}
    
    @abstractmethod
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ejecuta la lógica del nodo
        
        Args:
            state: Estado actual del workflow
            
        Returns:
            Estado actualizado con los resultados del nodo
        """
        pass
    
    async def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Wrapper para ejecución con logging y métricas"""
        self.start_time = datetime.utcnow()
        logger.info(f"Starting node {self.name}")
        
        try:
            result = await self.execute(state)
            self.end_time = datetime.utcnow()
            
            execution_time = (self.end_time - self.start_time).total_seconds()
            logger.info(f"Node {self.name} completed in {execution_time:.2f}s")
            
            return result
        except Exception as e:
            self.end_time = datetime.utcnow()
            logger.error(f"Node {self.name} failed: {str(e)}")
            raise
    
    def validate_input(self, state: Dict[str, Any]) -> bool:
        """Valida que el estado cumpla con el schema de entrada"""
        # Implementación básica, puede ser sobreescrita
        return True
    
    def transform_output(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Transforma la salida si es necesario"""
        return state

class NodeRegistry:
    """Registro centralizado de nodos"""
    
    def __init__(self):
        self._nodes: Dict[str, NodeBase] = {}
        self._node_classes: Dict[str, type] = {}
    
    def register(self, node_class: type, alias: Optional[str] = None):
        """Registra una clase de nodo"""
        name = alias or node_class.__name__
        self._node_classes[name] = node_class
        logger.info(f"Registered node: {name}")
    
    def create_node(self, name: str, config: Optional[Dict[str, Any]] = None) -> NodeBase:
        """Crea una instancia de un nodo registrado"""
        if name not in self._node_classes:
            raise ValueError(f"Node {name} not registered")
        
        node_class = self._node_classes[name]
        return node_class(config)
    
    def list_nodes(self) -> List[Dict[str, Any]]:
        """Lista todos los nodos registrados con su información"""
        return [
            node_class.get_node_info() 
            for node_class in self._node_classes.values()
        ]
    
    def get_node_info(self, name: str) -> Dict[str, Any]:
        """Obtiene información de un nodo específico"""
        if name not in self._node_classes:
            raise ValueError(f"Node {name} not registered")
        return self._node_classes[name].get_node_info()

# Registro global de nodos
registry = NodeRegistry()
