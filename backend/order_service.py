"""
Servicio para gestión de pedidos de clientes
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

# Modelos Pydantic
class CustomerOrder(BaseModel):
    customerName: str
    customerPhone: str
    customerEmail: Optional[EmailStr] = None
    address: str
    lat: float
    lon: float
    packageName: Optional[str] = ""
    weight: float = 1.0
    volume: float = 0.1
    deliveryDate: str
    timeWindow: str
    specialInstructions: Optional[str] = ""
    photos: List[str] = []

class OrderResponse(BaseModel):
    id: str
    status: str
    trackingUrl: str
    createdAt: str
    message: str

class TrackingInfo(BaseModel):
    id: str
    status: str
    customerName: str
    customerPhone: str
    address: str
    deliveryDate: str
    timeWindow: str
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    estimatedArrival: Optional[str] = None
    currentLocation: Optional[Dict[str, float]] = None
    route: Optional[Dict[str, Any]] = None
    createdAt: str
    updatedAt: str

class OrderService:
    def __init__(self):
        self.db_url = os.environ.get("DATABASE_URL")
        self.base_url = os.environ.get("BASE_URL", "http://localhost:5173")
    
    def get_db_connection(self):
        """Obtiene conexión a la base de datos"""
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
    
    def generate_order_id(self) -> str:
        """Genera un ID único para el pedido"""
        timestamp = datetime.now().strftime("%Y%m%d")
        random_part = str(uuid.uuid4())[:8].upper()
        return f"ORD-{timestamp}-{random_part}"
    
    def create_order(self, order_data: CustomerOrder) -> OrderResponse:
        """Crea un nuevo pedido en la base de datos"""
        order_id = self.generate_order_id()
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    # Insertar en tabla de pedidos
                    cur.execute("""
                        INSERT INTO customer_orders (
                            id, customer_name, customer_phone, customer_email,
                            address, lat, lon, package_name, weight, volume,
                            delivery_date, time_window, special_instructions,
                            photos, status, created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        order_id,
                        order_data.customerName,
                        order_data.customerPhone,
                        order_data.customerEmail,
                        order_data.address,
                        order_data.lat,
                        order_data.lon,
                        order_data.packageName,
                        order_data.weight,
                        order_data.volume,
                        order_data.deliveryDate,
                        order_data.timeWindow,
                        order_data.specialInstructions,
                        order_data.photos,  # JSON array
                        "pending",
                        datetime.now(timezone.utc),
                        datetime.now(timezone.utc)
                    ))
                    
                    conn.commit()
            
            # Crear respuesta
            tracking_url = f"{self.base_url}/track/{order_id}"
            
            logger.info(f"Order created: {order_id} for {order_data.customerName}")
            
            return OrderResponse(
                id=order_id,
                status="pending",
                trackingUrl=tracking_url,
                createdAt=datetime.now(timezone.utc).isoformat(),
                message=f"Pedido creado exitosamente. ID de seguimiento: {order_id}"
            )
            
        except Exception as e:
            logger.error(f"Error creating order: {str(e)}")
            raise HTTPException(status_code=500, detail="Error al crear el pedido")
    
    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene un pedido por su ID"""
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM customer_orders WHERE id = %s
                    """, (order_id,))
                    
                    result = cur.fetchone()
                    if result:
                        return dict(result)
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting order {order_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error al obtener el pedido")
    
    def update_order(self, order_id: str, order_data: CustomerOrder) -> OrderResponse:
        """Actualiza un pedido existente"""
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE customer_orders SET
                            customer_name = %s, customer_phone = %s, customer_email = %s,
                            address = %s, lat = %s, lon = %s, package_name = %s,
                            weight = %s, volume = %s, delivery_date = %s,
                            time_window = %s, special_instructions = %s,
                            photos = %s, updated_at = %s
                        WHERE id = %s
                    """, (
                        order_data.customerName,
                        order_data.customerPhone,
                        order_data.customerEmail,
                        order_data.address,
                        order_data.lat,
                        order_data.lon,
                        order_data.packageName,
                        order_data.weight,
                        order_data.volume,
                        order_data.deliveryDate,
                        order_data.timeWindow,
                        order_data.specialInstructions,
                        order_data.photos,
                        datetime.now(timezone.utc),
                        order_id
                    ))
                    
                    if cur.rowcount == 0:
                        raise HTTPException(status_code=404, detail="Pedido no encontrado")
                    
                    conn.commit()
            
            tracking_url = f"{self.base_url}/track/{order_id}"
            
            return OrderResponse(
                id=order_id,
                status="updated",
                trackingUrl=tracking_url,
                createdAt=datetime.now(timezone.utc).isoformat(),
                message=f"Pedido actualizado exitosamente"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating order {order_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error al actualizar el pedido")
    
    def get_tracking_info(self, order_id: str) -> TrackingInfo:
        """Obtiene información de seguimiento de un pedido"""
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT 
                            id, status, customer_name, customer_phone,
                            address, delivery_date, time_window,
                            driver_name, driver_phone, estimated_arrival,
                            created_at, updated_at
                        FROM customer_orders 
                        WHERE id = %s
                    """, (order_id,))
                    
                    result = cur.fetchone()
                    if not result:
                        raise HTTPException(status_code=404, detail="Pedido no encontrado")
                    
                    order_data = dict(result)
                    
                    # Obtener información de ruta si está asignada
                    route_info = None
                    if order_data["status"] in ["assigned", "in_progress"]:
                        cur.execute("""
                            SELECT vehicle_id, stops, estimated_arrival
                            FROM optimized_routes 
                            WHERE order_ids::jsonb ? %s
                            LIMIT 1
                        """, (order_id,))
                        
                        route_result = cur.fetchone()
                        if route_result:
                            route_info = dict(route_result)
                    
                    return TrackingInfo(
                        id=order_data["id"],
                        status=order_data["status"],
                        customerName=order_data["customer_name"],
                        customerPhone=order_data["customer_phone"],
                        address=order_data["address"],
                        deliveryDate=order_data["delivery_date"],
                        timeWindow=order_data["time_window"],
                        driverName=order_data.get("driver_name"),
                        driverPhone=order_data.get("driver_phone"),
                        estimatedArrival=order_data.get("estimated_arrival"),
                        route=route_info,
                        createdAt=order_data["created_at"].isoformat(),
                        updatedAt=order_data["updated_at"].isoformat()
                    )
                    
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting tracking info for {order_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error al obtener información de seguimiento")
    
    def update_order_status(self, order_id: str, status: str, driver_info: Optional[Dict[str, str]] = None):
        """Actualiza el estado de un pedido"""
        valid_statuses = ["pending", "confirmed", "assigned", "in_progress", "delivered", "cancelled"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Estado inválido")
        
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    update_fields = ["status = %s", "updated_at = %s"]
                    update_values = [status, datetime.now(timezone.utc)]
                    
                    if driver_info and status == "assigned":
                        update_fields.extend(["driver_name = %s", "driver_phone = %s"])
                        update_values.extend([driver_info.get("name"), driver_info.get("phone")])
                    
                    if status == "in_progress":
                        update_fields.append("estimated_arrival = %s")
                        # Calcular llegada estimada (ejemplo: 2 horas desde ahora)
                        eta = datetime.now(timezone.utc).replace(hour=datetime.now().hour + 2)
                        update_values.append(eta)
                    
                    update_values.append(order_id)
                    
                    cur.execute(f"""
                        UPDATE customer_orders SET
                            {', '.join(update_fields)}
                        WHERE id = %s
                    """, update_values)
                    
                    if cur.rowcount == 0:
                        raise HTTPException(status_code=404, detail="Pedido no encontrado")
                    
                    conn.commit()
            
            logger.info(f"Order {order_id} status updated to {status}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating order status {order_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Error al actualizar estado del pedido")
    
    def get_pending_orders(self) -> List[Dict[str, Any]]:
        """Obtiene todos los pedidos pendientes para optimización"""
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT * FROM customer_orders 
                        WHERE status = 'confirmed' 
                        ORDER BY delivery_date, time_window
                    """)
                    
                    results = cur.fetchall()
                    return [dict(row) for row in results]
                    
        except Exception as e:
            logger.error(f"Error getting pending orders: {str(e)}")
            raise HTTPException(status_code=500, detail="Error al obtener pedidos pendientes")

# Instancia global del servicio
order_service = OrderService()
