from __future__ import annotations

"""Dashboard API — pin queries as dashboard cards, list pinned, re-run them.
Pinned queries are scoped to the user's team (team members share a dashboard).
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from apps.api.api.deps import get_current_user

router = APIRouter()


class PinRequest(BaseModel):
    query_id: str
    name: str = ""


@router.post("/pin")
async def pin_query(req: PinRequest, request: Request):
    """Pin a query result to the team's dashboard."""
    user = await get_current_user(request)
    org_id = user["org_id"]
    team_id = user.get("team_id")

    async with async_session() as db:
        # Verify query belongs to the caller's org/team
        result = await db.execute(
            text("""
                SELECT id, question FROM queries
                WHERE id = :id AND org_id = :org_id
                  AND (:team_id IS NULL OR team_id = :team_id OR team_id IS NULL)
            """),
            {"id": req.query_id, "org_id": org_id, "team_id": team_id},
        )
        query_row = result.mappings().first()
        if not query_row:
            raise HTTPException(status_code=404, detail="Query not found")

        name = req.name or query_row["question"][:100]

        existing = await db.execute(
            text("SELECT id FROM saved_questions WHERE query_id = :qid AND org_id = :org_id"),
            {"qid": req.query_id, "org_id": org_id},
        )
        if existing.first():
            raise HTTPException(status_code=400, detail="Already pinned")

        result = await db.execute(
            text("""
                INSERT INTO saved_questions (org_id, team_id, query_id, name, is_pinned)
                VALUES (:org_id, :team_id, :qid, :name, true)
                RETURNING id
            """),
            {"org_id": org_id, "team_id": team_id, "qid": req.query_id, "name": name},
        )
        await db.commit()
        pin_id = str(result.scalars().first())

    return {"id": pin_id, "query_id": req.query_id, "name": name, "is_pinned": True}


@router.delete("/pin/{query_id}")
async def unpin_query(query_id: str, request: Request):
    """Unpin a query from the dashboard."""
    user = await get_current_user(request)
    async with async_session() as db:
        result = await db.execute(
            text("DELETE FROM saved_questions WHERE query_id = :qid AND org_id = :org_id"),
            {"qid": query_id, "org_id": user["org_id"]},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pin not found")
    return {"status": "unpinned", "query_id": query_id}


@router.get("/pinned")
async def list_pinned(request: Request):
    """List all pinned dashboard queries for the caller's team."""
    user = await get_current_user(request)
    org_id = user["org_id"]
    team_id = user.get("team_id")

    async with async_session() as db:
        # Team members see their team's pins; admins without team see all org pins
        if team_id:
            result = await db.execute(
                text("""
                    SELECT sq.id as pin_id, sq.name, sq.query_id, sq.created_at as pinned_at,
                           q.question, q.generated_sql, q.result_row_count, q.duration_ms,
                           q.chart_type, q.summary, q.llm_provider, q.connection_id
                    FROM saved_questions sq
                    JOIN queries q ON sq.query_id = q.id
                    WHERE sq.org_id = :org_id AND sq.team_id = :team_id AND sq.is_pinned = true
                    ORDER BY sq.created_at DESC
                """),
                {"org_id": org_id, "team_id": team_id},
            )
        else:
            result = await db.execute(
                text("""
                    SELECT sq.id as pin_id, sq.name, sq.query_id, sq.created_at as pinned_at,
                           q.question, q.generated_sql, q.result_row_count, q.duration_ms,
                           q.chart_type, q.summary, q.llm_provider, q.connection_id
                    FROM saved_questions sq
                    JOIN queries q ON sq.query_id = q.id
                    WHERE sq.org_id = :org_id AND sq.is_pinned = true
                    ORDER BY sq.created_at DESC
                """),
                {"org_id": org_id},
            )
        rows = result.mappings().all()
        return [dict(r) for r in rows]
