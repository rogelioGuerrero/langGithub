import requests
import json

# Common ORS test keys (you should replace with your actual key)
test_keys = [
    "5b3ce3597851110001cf6248f0c4b6f7b1d447c5a1a9f6b5d9c3c2e8",  # Original
    # Add your new key here
]

url = "https://api.openrouteservice.org/v2/matrix/driving-car"

locations = [
    [-58.3816, -34.6037],  # Depot
    [-58.4333, -34.6158],  # P-1001
    [-58.3974, -34.5875],  # P-1002
]

body = {
    "locations": locations,
    "metrics": ["duration"]
}

print("🧪 Testing ORS API keys...")
print("-" * 50)

for i, api_key in enumerate(test_keys):
    print(f"\nTesting key {i+1}: {api_key[:20]}...")
    
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    try:
        resp = requests.post(url, json=body, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            print("✅ SUCCESS! This key works!")
            data = resp.json()
            durations = data.get("durations", [])
            print(f"   Matrix: {len(durations)}x{len(durations[0]) if durations else 0}")
            print(f"   Sample: {durations[0][:2] if durations else 'N/A'}")
            break
        else:
            print(f"❌ Failed with {resp.status_code}")
            if resp.status_code == 403:
                print("   Access disallowed - key may be invalid or expired")
            elif resp.status_code == 429:
                print("   Rate limited - too many requests")
    except Exception as e:
        print(f"❌ Exception: {e}")
