import requests
import json
import os

# Test ORS API with your key from GitHub Secrets
api_key = os.environ.get("ORS_API_KEY", "5b3ce3597851110001cf6248f0c4b6f7b1d447c5a1a9f6b5d9c3c2e8")
url = "https://api.openrouteservice.org/v2/matrix/driving-car"

headers = {
    "Authorization": api_key,
    "Content-Type": "application/json"
}

# Test locations (Buenos Aires)
locations = [
    [-58.3816, -34.6037],  # Depot
    [-58.4333, -34.6158],  # P-1001
    [-58.3974, -34.5875],  # P-1002
    [-58.4015, -34.5999],  # P-1003
]

body = {
    "locations": locations,
    "metrics": ["duration"]
}

print("🧪 Testing ORS Matrix API")
print(f"API Key: {api_key[:20]}...")
print(f"Locations: {len(locations)} points")
print("-" * 50)

try:
    resp = requests.post(url, json=body, headers=headers, timeout=30)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        durations = data.get("durations", [])
        print("✅ ORS API working!")
        print(f"Matrix size: {len(durations)}x{len(durations[0]) if durations else 0}")
        print("\nSample durations (seconds):")
        for i, row in enumerate(durations[:3]):
            print(f"  From {i}: {row[:3]}")
        print("\n✅ Using ORS API for real travel times!")
    else:
        print(f"❌ Failed: {resp.text}")
        
except Exception as e:
    print(f"❌ Exception: {e}")
