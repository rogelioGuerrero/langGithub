import os
import json
import psycopg2
from datetime import datetime, timezone, timedelta

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL required")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Insertar vehículos si no existen
cur.execute("""
    insert into vehicles (id, capacity_weight, capacity_volume, skills)
    values 
        ('VAN-1', 800, 4, '["refrigerado"]'),
        ('TRUCK-1', 4000, 20, '["camion_grande"]')
    on conflict (id) do nothing
""")

# Crear un pending_route de prueba
now = datetime.now(timezone.utc)
later = now + timedelta(hours=8)

test_payload = {
    "depot": {
        "lat": -34.6037,
        "lon": -58.3816,
        "ventana_inicio": now.isoformat(),
        "ventana_fin": later.isoformat(),
    },
    "vehicles": [
        {
            "id_vehicle": "VAN-1",
            "capacity_weight": 800,
            "capacity_volume": 4,
            "skills": ["refrigerado"],
        },
        {
            "id_vehicle": "TRUCK-1",
            "capacity_weight": 4000,
            "capacity_volume": 20,
            "skills": ["camion_grande"],
        },
    ],
    "orders": [
        {
            "id_pedido": "P-1001",
            "lat": -34.6158,
            "lon": -58.4333,
            "peso": 120,
            "volumen": 0.5,
            "ventana_inicio": (now + timedelta(hours=1)).isoformat(),
            "ventana_fin": (now + timedelta(hours=4)).isoformat(),
            "skills_required": ["refrigerado"],
        },
        {
            "id_pedido": "P-1002",
            "lat": -34.5875,
            "lon": -58.3974,
            "peso": 900,
            "volumen": 2.0,
            "ventana_inicio": (now + timedelta(hours=2)).isoformat(),
            "ventana_fin": (now + timedelta(hours=6)).isoformat(),
            "skills_required": ["camion_grande"],
        },
        {
            "id_pedido": "P-1003",
            "lat": -34.5999,
            "lon": -58.4015,
            "peso": 300,
            "volumen": 1.5,
            "ventana_inicio": (now + timedelta(hours=1)).isoformat(),
            "ventana_fin": (now + timedelta(hours=5)).isoformat(),
            "skills_required": [],
        },
    ],
}

cur.execute("""
    insert into pending_routes (status, payload)
    values ('pending', %s::jsonb)
    returning id::text
""", (json.dumps(test_payload),))

pending_id = cur.fetchone()[0]
conn.commit()

print(f"✅ Datos de prueba insertados")
print(f"📌 pending_route_id: {pending_id}")
print(f"📊 Vehículos: 2")
print(f"📦 Pedidos: 3")

cur.close()
conn.close()
