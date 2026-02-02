import logging
import math
import os
from typing import List

logger = logging.getLogger(__name__)


def haversine(lon1, lat1, lon2, lat2):
    """Calculate the great circle distance between two points on earth."""
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    km = 6371 * c
    return km


def get_duration_matrix_fallback(locations_lonlat: List[List[float]]) -> List[List[int]]:
    """Fallback duration matrix using haversine distance (assuming 50 km/h avg speed)."""
    logger.warning("Using fallback duration matrix (haversine distance)")
    n = len(locations_lonlat)
    matrix = [[0] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i != j:
                km = haversine(locations_lonlat[i][0], locations_lonlat[i][1],
                              locations_lonlat[j][0], locations_lonlat[j][1])
                # Assume 50 km/h average speed
                seconds = int((km / 50) * 3600)
                matrix[i][j] = seconds
    
    return matrix
