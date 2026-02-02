import logging
import requests
from typing import List, Tuple
import itertools
import time

logger = logging.getLogger(__name__)

def get_duration_matrix_via_directions(locations_lonlat: List[List[float]]) -> List[List[int]]:
    """
    Build duration matrix using ORS Directions API
    Since matrix API doesn't work with this key, we'll use pairwise directions
    """
    logger.info("Building duration matrix via ORS Directions API (pairwise calls)")
    
    api_key = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjFmZTAxMmU1MDk1NzRmMTY5NTJjM2U5Nzc4NDlhM2M2IiwiaCI6Im11cm11cjY0In0="
    n = len(locations_lonlat)
    matrix = [[0] * n for _ in range(n)]
    
    base_url = "https://api.openrouteservice.org/v2/directions/driving-car"
    
    # Get durations for all pairs
    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = 0
            else:
                # Format: lon,lat
                start = f"{locations_lonlat[i][0]},{locations_lonlat[i][1]}"
                end = f"{locations_lonlat[j][0]},{locations_lonlat[j][1]}"
                
                url = f"{base_url}?api_key={api_key}&start={start}&end={end}"
                
                try:
                    resp = requests.get(url, timeout=5)
                    if resp.status_code == 200:
                        data = resp.json()
                        # Get duration from the first route's first segment
                        duration = data['features'][0]['properties']['segments'][0]['duration']
                        matrix[i][j] = int(duration)
                        logger.debug(f"Duration {i}->{j}: {duration}s")
                    else:
                        logger.warning(f"ORS directions failed {i}->{j}: {resp.status_code}")
                        # Fallback to haversine
                        from backend.ors_fallback import haversine
                        km = haversine(locations_lonlat[i][0], locations_lonlat[i][1],
                                      locations_lonlat[j][0], locations_lonlat[j][1])
                        matrix[i][j] = int((km / 50) * 3600)  # 50 km/h avg
                    
                    # Small delay to avoid rate limiting
                    time.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Error getting direction {i}->{j}: {e}")
                    # Fallback
                    from backend.ors_fallback import haversine
                    km = haversine(locations_lonlat[i][0], locations_lonlat[i][1],
                                  locations_lonlat[j][0], locations_lonlat[j][1])
                    matrix[i][j] = int((km / 50) * 3600)
    
    logger.info(f"✅ Built {n}x{n} duration matrix via ORS Directions")
    return matrix
