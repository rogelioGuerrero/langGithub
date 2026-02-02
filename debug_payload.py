import json
import requests

# Simulate the payload that the new UI sends
payload = {
    "depot": {
        "lat": -34.6037,
        "lon": -58.3816,
        "ventana_inicio": "2026-02-02T09:00:00.000Z",
        "ventana_fin": "2026-02-02T17:00:00.000Z"
    },
    "vehicles": [
        {
            "id_vehicle": "VAN-1",
            "capacity_weight": 800,
            "capacity_volume": 4.0,
            "skills": []
        },
        {
            "id_vehicle": "TRUCK-1",
            "capacity_weight": 4000,
            "capacity_volume": 20.0,
            "skills": []
        }
    ],
    "orders": [
        {
            "id_pedido": "P-1",
            "lat": -34.6158,
            "lon": -58.4333,
            "peso": 100,
            "volumen": 0.5,
            "ventana_inicio": "2026-02-02T09:00:00.000Z",
            "ventana_fin": "2026-02-02T17:00:00.000Z",
            "skills_required": []
        }
    ]
}

print("🧪 Testing payload structure...")
print(json.dumps(payload, indent=2))
print("-" * 50)

# Test locally first (if you have netlify-cli running)
try:
    resp = requests.post('http://localhost:8888/api/dispatch', json=payload)
    print(f"Local Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except:
    print("Local Netlify not running")

# Test against deployed Netlify
print("\nTesting deployed Netlify...")
try:
    resp = requests.post('https://langgithub.netlify.app/api/dispatch', json=payload)
    print(f"Deployed Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Error: {e}")
