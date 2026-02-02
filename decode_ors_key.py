import base64
import requests
import json

# Decode the ORS key
encoded_key = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjFmZTAxMmU1MDk1NzRmMTY5NTJjM2U5Nzc4NDlhM2M2IiwiaCI6Im11cm11cjY0In0="
decoded_key = base64.b64decode(encoded_key).decode('utf-8')

print(f"Decoded ORS key: {decoded_key}")
print("-" * 50)

# Test with matrix endpoint (what we use)
print("Testing Matrix API...")
matrix_url = "https://api.openrouteservice.org/v2/matrix/driving-car"
headers = {
    "Authorization": decoded_key,
    "Content-Type": "application/json"
}

locations = [
    [-58.3816, -34.6037],  # Depot
    [-58.4333, -34.6158],  # P-1001
]

body = {"locations": locations, "metrics": ["duration"]}

resp = requests.post(matrix_url, json=body, headers=headers)
print(f"Matrix API Status: {resp.status_code}")
if resp.status_code != 200:
    print(f"Response: {resp.text[:200]}")

# Test with optimization endpoint (just to check)
print("\nTesting Optimization API...")
opt_url = "https://api.openrouteservice.org/optimization"
opt_body = {
    "jobs": [
        {"id": 1, "location": [-58.4333, -34.6158], "service": 300},
        {"id": 2, "location": [-58.3974, -34.5875], "service": 300}
    ],
    "vehicles": [{"id": 1, "start": [-58.3816, -34.6037], "capacity": [5]}],
    "matrix": {
        "durations": [[0, 600], [600, 0]]
    }
}

opt_resp = requests.post(opt_url, json=opt_body, headers=headers)
print(f"Optimization API Status: {opt_resp.status_code}")
if opt_resp.status_code != 200:
    print(f"Response: {opt_resp.text[:200]}")
