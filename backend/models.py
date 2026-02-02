from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class Order(BaseModel):
    id_pedido: str
    lat: float
    lon: float
    peso: float = 0.0
    volumen: float = 0.0
    ventana_inicio: datetime
    ventana_fin: datetime
    skills_required: List[str] = Field(default_factory=list)


class Depot(BaseModel):
    lat: float
    lon: float
    ventana_inicio: Optional[datetime] = None
    ventana_fin: Optional[datetime] = None


class Vehicle(BaseModel):
    id_vehicle: str
    capacity_weight: float
    capacity_volume: float
    skills: List[str] = Field(default_factory=list)


class PendingPayload(BaseModel):
    depot: Depot
    orders: List[Order]
    vehicles: Optional[List[Vehicle]] = None


class OptimizationResult(BaseModel):
    pending_route_id: str
    status: str
    result: dict[str, Any]
