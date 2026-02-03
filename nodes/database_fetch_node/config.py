from typing import Dict, Any, Optional

class DatabaseFetchConfig:
    """Configuración para el nodo de obtención de base de datos"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Configuración de base de datos
        self.database_url = self.config.get("database_url") or os.environ.get("DATABASE_URL")
        self.connection_timeout = self.config.get("connection_timeout", 30)
        self.max_retries = self.config.get("max_retries", 3)
        
        # Configuración de queries
        self.batch_size = self.config.get("batch_size", 100)
        self.include_completed = self.config.get("include_completed", False)
        
        # Validaciones
        if not self.database_url:
            raise ValueError("Database URL is required")
