from __future__ import annotations

"""Scheduled Reports & Alerts API."""
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from apps.api.api.deps import get_current_user, require_admin

router = APIRouter()


# ── Scheduled Reports ──────────────────────────────────────────────────────────

class ScheduleCreate(BaseModel):
    name: str
    query_id: str
    cron_expression: str
    recipients: list[str] = []
    format: str = "csv"
    timezone: str = "UTC"
    is_active: bool = True


@router.post("/schedules")
async def create_schedule(req: ScheduleCreate, user: dict = Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            text("SELECT id, connection_id FROM queries WHERE id = :id"),
            {"id": req.query_id},
        )
        query_row = result.mappings().first()
        if not query_row:
            raise HTTPException(status_code=404, detail="Query not found. Run the query first, then schedule it.")

        result = await db.execute(
            text("""
                INSERT INTO scheduled_reports
                    (org_id, name, query_id, connection_id, cron_expression, recipients, format, timezone, is_active)
                VALUES (:org_id, :name, :qid, :cid, :cron, :recipients, :fmt, :tz, :active)
                RETURNING id, name, cron_expression, is_active, created_at
            """),
            {
                "org_id": user["org_id"], "name": req.name, "qid": req.query_id,
                "cid": str(query_row["connection_id"]),
                "cron": req.cron_expression, "recipients": req.recipients,
                "fmt": req.format, "tz": req.timezone, "active": req.is_active,
            },
        )
        await db.commit()
        return dict(result.mappings().first())


@router.get("/schedules")
async def list_schedules(user: dict = Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT sr.id, sr.name, sr.cron_expression, sr.format, sr.timezone, sr.is_active,
                       sr.last_run_at, sr.created_at, q.question
                FROM scheduled_reports sr
                JOIN queries q ON sr.query_id = q.id
                WHERE sr.org_id = :org_id
                ORDER BY sr.created_at DESC
            """),
            {"org_id": user["org_id"]},
        )
        return [dict(r) for r in result.mappings().all()]


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: UUID, user: dict = Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            text("DELETE FROM scheduled_reports WHERE id = :id AND org_id = :org_id"),
            {"id": str(schedule_id), "org_id": user["org_id"]},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "deleted"}


@router.patch("/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: UUID, user: dict = Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                UPDATE scheduled_reports SET is_active = NOT is_active
                WHERE id = :id AND org_id = :org_id RETURNING is_active
            """),
            {"id": str(schedule_id), "org_id": user["org_id"]},
        )
        await db.commit()
        row = result.scalars().first()
        if row is None:
            raise HTTPException(status_code=404, detail="Schedule not found")
    return {"is_active": row}


# ── Alerts ─────────────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    name: str
    query_id: str
    condition: str
    threshold: float
    column_name: str
    check_interval_minutes: int = 60
    notify_emails: list[str] = []
    notify_webhook: str = ""
    is_active: bool = True


@router.post("/alerts")
async def create_alert(req: AlertCreate, user: dict = Depends(get_current_user)):
    valid_conditions = ["less_than", "greater_than", "equals", "not_equals"]
    if req.condition not in valid_conditions:
        raise HTTPException(status_code=400, detail=f"Condition must be one of: {valid_conditions}")

    async with async_session() as db:
        result = await db.execute(
            text("SELECT id, connection_id FROM queries WHERE id = :id"),
            {"id": req.query_id},
        )
        query_row = result.mappings().first()
        if not query_row:
            raise HTTPException(status_code=404, detail="Query not found")

        result = await db.execute(
            text("""
                INSERT INTO alerts
                    (org_id, name, query_id, connection_id, condition, threshold, column_name,
                     check_interval_minutes, notify_emails, notify_webhook, is_active)
                VALUES (:org_id, :name, :qid, :cid, :condition, :threshold, :col,
                        :interval, :emails, :webhook, :active)
                RETURNING id, name, condition, threshold, column_name, is_active, created_at
            """),
            {
                "org_id": user["org_id"], "name": req.name, "qid": req.query_id,
                "cid": str(query_row["connection_id"]),
                "condition": req.condition, "threshold": req.threshold,
                "col": req.column_name, "interval": req.check_interval_minutes,
                "emails": req.notify_emails, "webhook": req.notify_webhook,
                "active": req.is_active,
            },
        )
        await db.commit()
        return dict(result.mappings().first())


@router.get("/alerts")
async def list_alerts(user: dict = Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT a.id, a.name, a.condition, a.threshold, a.column_name,
                       a.check_interval_minutes, a.is_active, a.last_triggered_at,
                       a.created_at, q.question
                FROM alerts a
                JOIN queries q ON a.query_id = q.id
                WHERE a.org_id = :org_id
                ORDER BY a.created_at DESC
            """),
            {"org_id": user["org_id"]},
        )
        return [dict(r) for r in result.mappings().all()]


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: UUID, user: dict = Depends(get_current_user)):
    async with async_session() as db:
        result = await db.execute(
            text("DELETE FROM alerts WHERE id = :id AND org_id = :org_id"),
            {"id": str(alert_id), "org_id": user["org_id"]},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "deleted"}
