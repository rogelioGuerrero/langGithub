from __future__ import annotations

import json
import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

import psycopg2
from psycopg2.pool import ThreadedConnectionPool

logger = logging.getLogger(__name__)

_pool: Optional[ThreadedConnectionPool] = None


def init_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is not None:
        return _pool

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    _pool = ThreadedConnectionPool(minconn=1, maxconn=5, dsn=database_url)
    logger.info("DB pool initialized")
    return _pool


@contextmanager
def get_conn() -> Iterator[Any]:
    pool = init_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


def fetch_one_pending_route(pending_route_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    query = """
    select id::text as id, payload
    from pending_routes
    where status = 'pending'
    {id_filter}
    order by created_at asc
    for update skip locked
    limit 1
    """

    with get_conn() as conn:
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                id_filter = ""
                params = []
                if pending_route_id:
                    id_filter = "and id = %s"
                    params.append(pending_route_id)

                cur.execute(query.format(id_filter=id_filter), params)
                row = cur.fetchone()
                if not row:
                    conn.commit()
                    return None

                pr_id, payload = row

                cur.execute(
                    "update pending_routes set status='processing', error=null where id=%s",
                    (pr_id,),
                )
                conn.commit()
                return {"id": pr_id, "payload": payload}
        except Exception:
            conn.rollback()
            raise


def mark_pending_failed(pending_route_id: str, error: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update pending_routes set status='failed', error=%s where id=%s",
                (error[:2000], pending_route_id),
            )
        conn.commit()


def insert_optimized_route(pending_route_id: str, status: str, result: Dict[str, Any]) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into optimized_routes (pending_route_id, status, result)
                values (%s, %s, %s::jsonb)
                """,
                (pending_route_id, status, json.dumps(result)),
            )

            cur.execute(
                "update pending_routes set status='done', error=null where id=%s",
                (pending_route_id,),
            )
        conn.commit()


def load_vehicles_from_db() -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select id, capacity_weight, capacity_volume, skills from vehicles order by id"
            )
            rows = cur.fetchall()

    vehicles: list[dict[str, Any]] = []
    for (vid, w, v, skills) in rows:
        vehicles.append(
            {
                "id_vehicle": str(vid),
                "capacity_weight": float(w),
                "capacity_volume": float(v),
                "skills": list(skills or []),
            }
        )
    return vehicles
