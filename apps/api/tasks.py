from __future__ import annotations

"""
CueBI — Celery Background Tasks
Schema ingestion, dbt Cloud auto-sync, and scheduled report execution.
"""

import asyncio
import os

from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("cuebi", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# ── Periodic task schedule ────────────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Poll dbt Cloud every 30 minutes for all connections with cloud config
    "dbt-cloud-sync-every-30min": {
        "task": "sync_all_dbt_cloud",
        "schedule": crontab(minute="*/30"),
    },
}


# ── Schema ingestion ──────────────────────────────────────────────────────────

@celery_app.task(name="sync_connection")
def sync_connection_task(connection_id: str):
    """
    Background schema sync: extract → chunk → embed → store.
    Runs inline in the API route for now; this task is the async path.
    """
    print(f"[Celery] sync_connection received for: {connection_id}")
    return {"status": "completed", "connection_id": connection_id}


# ── dbt Cloud auto-sync ───────────────────────────────────────────────────────

@celery_app.task(name="sync_all_dbt_cloud")
def sync_all_dbt_cloud_task():
    """
    Periodic task: sync all connections that have dbt Cloud configured.
    Fetches latest manifest from dbt Cloud API, re-embeds changed models.
    Runs every 30 minutes via Celery Beat.
    """
    asyncio.run(_sync_all_dbt_cloud_async())


async def _sync_all_dbt_cloud_async():
    """Async implementation of the dbt Cloud sweep."""
    from sqlalchemy import text
    from apps.api.api.db import async_session
    from apps.api.api.routes.dbt import sync_from_dbt_cloud
    from uuid import UUID

    async with async_session() as db:
        result = await db.execute(
            text("SELECT connection_id FROM dbt_configs WHERE dbt_type = 'cloud' AND sync_status != 'syncing'")
        )
        connection_ids = [str(row[0]) for row in result.fetchall()]

    for cid in connection_ids:
        try:
            print(f"[Celery] dbt Cloud auto-sync: {cid}")
            await sync_from_dbt_cloud(UUID(cid))
        except Exception as e:
            print(f"[Celery] dbt Cloud sync failed for {cid}: {e}")
