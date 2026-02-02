import os
import json
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL required")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Verificar el último resultado
cur.execute("""
    select pr.id::text, pr.status, or_.status, or_.result
    from pending_routes pr
    left join optimized_routes or_ on pr.id = or_.pending_route_id
    order by pr.created_at desc
    limit 1
""")

row = cur.fetchone()
if row:
    pr_id, pr_status, opt_status, result = row
    print(f"📌 pending_route_id: {pr_id}")
    print(f"📊 pending_routes.status: {pr_status}")
    print(f"✅ optimized_routes.status: {opt_status}")
    if result:
        result_data = result if isinstance(result, dict) else json.loads(result)
        print(f"🚛 Vehicles assigned: {len(result_data.get('vehicles', []))}")
        print(f"📦 Unassigned orders: {result_data.get('unassigned', [])}")
        print("\n📍 Routes:")
        for v in result_data.get('vehicles', []):
            print(f"\nVehicle {v['id_vehicle']} (skills: {v['skills']}):")
            for stop in v['stops']:
                if stop['kind'] == 'depot':
                    print(f"  🏢 Depot - Arrival: {stop['time_arrival']}s")
                else:
                    print(f"  📦 {stop['id']} - Arrival: {stop['time_arrival']}s, Load: {stop['load_weight']/1000:.1f}kg, {stop['load_volume']/1000:.1f}m³")
else:
    print("No results found")

cur.close()
conn.close()
