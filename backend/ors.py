from __future__ import annotations

import logging
import os
from typing import List

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"


class ORSError(RuntimeError):
    pass


@retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    retry=retry_if_exception_type(ORSError),
)
def get_duration_matrix(locations_lonlat: List[List[float]]) -> List[List[int]]:
    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        raise RuntimeError("ORS_API_KEY is required")

    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }

    body = {
        "locations": locations_lonlat,
        "metrics": ["duration"],
    }

    try:
        resp = requests.post(ORS_MATRIX_URL, json=body, headers=headers, timeout=30)
    except requests.RequestException as e:
        logger.warning("ORS request failed: %s", str(e))
        raise ORSError(str(e))

    if resp.status_code >= 500:
        logger.warning("ORS server error %s: %s", resp.status_code, resp.text[:500])
        raise ORSError(f"ORS server error {resp.status_code}")

    if resp.status_code == 429:
        logger.warning("ORS rate limited 429")
        raise ORSError("ORS rate limited")

    if resp.status_code >= 400:
        raise RuntimeError(f"ORS client error {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    durations = data.get("durations")
    if not durations:
        raise RuntimeError("ORS response missing 'durations'")

    matrix: List[List[int]] = []
    for row in durations:
        matrix.append([int(x) if x is not None else 10**9 for x in row])

    return matrix
