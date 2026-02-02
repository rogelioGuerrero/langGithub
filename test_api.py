import requests
import json
import time

# Test data
payload = {
    "depot": {
        "lat": -34.6037,
        "lon": -58.3816,
        "ventana_inicio": "2026-02-02T08:00:00-03:00",
        "ventana_fin": "2026-02-02T20:00:00-03:00",
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
            "ventana_inicio": "2026-02-02T09:00:00-03:00",
            "ventana_fin": "2026-02-02T12:00:00-03:00",
            "skills_required": ["refrigerado"],
        },
        {
            "id_pedido": "P-1002",
            "lat": -34.5875,
            "lon": -58.3974,
            "peso": 900,
            "volumen": 2.0,
            "ventana_inicio": "2026-02-02T10:00:00-03:00",
            "ventana_fin": "2026-02-02T16:00:00-03:00",
            "skills_required": ["camion_grande"],
        },
    ],
}

print("🚀 Testing Route Optimizer API")
print("=" * 50)

# 1. Create pending route (simulate dispatch)
print("\n1️⃣ Creating pending route...")
dispatch_resp = requests.post('http://localhost:5173/api/dispatch', json=payload)
if dispatch_resp.status_code == 404:
    print("❌ Netlify functions not running. Start with 'npm run dev' or deploy to Netlify.")
    exit(1)

dispatch_data = dispatch_resp.json()
print(f"✅ pending_route_id: {dispatch_data['pending_route_id']}")
print(f"📡 github_dispatch: {dispatch_data['github_dispatch']}")

# 2. Poll for result
pending_id = dispatch_data['pending_route_id']
print(f"\n2️⃣ Polling for result (id: {pending_id})...")

for i in range(30):
    result_resp = requests.get(f'http://localhost:5173/api/result?id={pending_id}')
    if result_resp.status_code == 404:
        print(f"   ⏳ Attempt {i+1}/30: Not ready yet...")
        time.sleep(2)
    else:
        result_data = result_resp.json()
        print(f"✅ Result found!")
        print(f"   Status: {result_data.get('status')}")
        print(f"   Vehicles: {len(result_data.get('result', {}).get('vehicles', []))}")
        print(f"   Unassigned: {result_data.get('result', {}).get('unassigned', [])}")
        break
else:
    print("⏰ Timeout: No result after 60 seconds")
