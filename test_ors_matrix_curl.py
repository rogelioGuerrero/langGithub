import requests
import json

# Test ORS Matrix API exactly like your curl
api_key = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjFmZTAxMmU1MDk1NzRmMTY5NTJjM2U5Nzc4NDlhM2M2IiwiaCI6Im11cm11cjY0In0="
url = "https://api.openrouteservice.org/v2/matrix/driving-car"

headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
    'Authorization': api_key
}

# Use your example locations first
body = {
    "locations": [
        [9.70093, 48.477473],
        [9.207916, 49.153868],
        [37.573242, 55.801281],
        [115.663757, 38.106467]
    ]
}

print("🧪 Testing ORS Matrix API with exact curl format...")
print("-" * 50)

resp = requests.post(url, headers=headers, json=body)
print(f"Status: {resp.status_code}")

if resp.status_code == 200:
    data = resp.json()
    durations = data.get("durations", [])
    print("✅ SUCCESS with example locations!")
    print(f"Matrix: {len(durations)}x{len(durations[0])}")
    print("Sample durations:")
    for i in range(min(2, len(durations))):
        print(f"  Row {i}: {durations[i][:2]}")
    
    # Now test with Buenos Aires locations
    print("\n" + "="*50)
    print("Testing with Buenos Aires locations...")
    
    ba_body = {
        "locations": [
            [-58.3816, -34.6037],  # Depot
            [-58.4333, -34.6158],  # P-1001
            [-58.3974, -34.5875],  # P-1002
            [-58.4015, -34.5999],  # P-1003
        ]
    }
    
    ba_resp = requests.post(url, headers=headers, json=ba_body)
    print(f"BA Status: {ba_resp.status_code}")
    
    if ba_resp.status_code == 200:
        ba_data = ba_resp.json()
        ba_durations = ba_data.get("durations", [])
        print("✅ Buenos Aires matrix works!")
        print(f"Matrix: {len(ba_durations)}x{len(ba_durations[0])}")
        print("Sample BA durations:")
        for i in range(min(2, len(ba_durations))):
            print(f"  Row {i}: {ba_durations[i][:2]}")
    else:
        print(f"❌ BA failed: {ba_resp.text[:300]}")
else:
    print(f"❌ Failed: {resp.text[:500]}")
