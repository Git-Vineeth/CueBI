from __future__ import annotations

"""Admin API — team management, user provisioning, schema access control.

All endpoints require role='admin'. Admins (the data team) use this to:
  - Create teams (Finance, Marketing, Ops, etc.)
  - Pre-provision users into teams (invite-first model — no email sent, user logs in via Google)
  - Grant schema access per team (which DB tables each team can query)
  - Seed example questions per team (shown on the chat home screen)
  - View org-wide usage stats
"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from apps.api.api.deps import require_admin

router = APIRouter()

CUEMATH_ORG_ID = "00000000-0000-0000-0000-000000000001"


# ── Teams ─────────────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str
    description: str | None = None


@router.get("/teams")
async def list_teams(user: dict = Depends(require_admin)):
    """List all teams with member count and schema access count."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT t.id, t.name, t.description, t.created_at,
                       COUNT(DISTINCT u.id)   AS member_count,
                       COUNT(DISTINCT tsa.id) AS schema_count
                FROM teams t
                LEFT JOIN users u   ON u.team_id = t.id
                LEFT JOIN team_schema_access tsa ON tsa.team_id = t.id
                WHERE t.org_id = :org_id
                GROUP BY t.id, t.name, t.description, t.created_at
                ORDER BY t.created_at
            """),
            {"org_id": CUEMATH_ORG_ID},
        )
        return [dict(r) for r in result.mappings().all()]


@router.post("/teams")
async def create_team(body: TeamCreate, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                INSERT INTO teams (org_id, name, description)
                VALUES (:org_id, :name, :description)
                RETURNING id, name, description, created_at
            """),
            {"org_id": CUEMATH_ORG_ID, "name": body.name, "description": body.description},
        )
        await db.commit()
        return dict(result.mappings().first())


@router.delete("/teams/{team_id}")
async def delete_team(team_id: UUID, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("DELETE FROM teams WHERE id = :id AND org_id = :org_id"),
            {"id": str(team_id), "org_id": CUEMATH_ORG_ID},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Team not found")
    return {"deleted": True}


# ── Team Members (pre-provision users) ────────────────────────────────────────

class ProvisionUser(BaseModel):
    email: str
    name: str | None = None
    role: str = "analyst"  # analyst | viewer | admin


@router.get("/teams/{team_id}/members")
async def list_team_members(team_id: UUID, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT id, email, name, role, status, avatar_url, created_at
                FROM users WHERE team_id = :team_id
                ORDER BY created_at
            """),
            {"team_id": str(team_id)},
        )
        return [dict(r) for r in result.mappings().all()]


@router.post("/teams/{team_id}/members")
async def provision_member(team_id: UUID, body: ProvisionUser, user: dict = Depends(require_admin)):
    """Pre-provision a user into a team.

    If the user record already exists (maybe from another team), move them to this team.
    If not, create a new 'invited' user. No email is sent — admin tells the user verbally.
    The user logs in via Google SSO; login succeeds when their email is found in the DB.
    """
    # Verify team belongs to our org
    async with async_session() as db:
        team = await db.execute(
            text("SELECT id FROM teams WHERE id = :id AND org_id = :org_id"),
            {"id": str(team_id), "org_id": CUEMATH_ORG_ID},
        )
        if not team.first():
            raise HTTPException(status_code=404, detail="Team not found")

        # Check if user already exists in DB
        existing = await db.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": body.email},
        )
        existing_row = existing.mappings().first()

        if existing_row:
            await db.execute(
                text("UPDATE users SET team_id = :team_id, role = :role WHERE id = :id"),
                {"team_id": str(team_id), "role": body.role, "id": str(existing_row["id"])},
            )
            await db.commit()
            return {"status": "updated", "email": body.email, "team_id": str(team_id)}

        # New user — create as 'invited' (becomes 'active' on first Google login)
        result = await db.execute(
            text("""
                INSERT INTO users (email, name, org_id, role, team_id, status)
                VALUES (:email, :name, :org_id, :role, :team_id, 'invited')
                RETURNING id, email, name, role, status, created_at
            """),
            {
                "email": body.email,
                "name": body.name or body.email.split("@")[0],
                "org_id": CUEMATH_ORG_ID,
                "role": body.role,
                "team_id": str(team_id),
            },
        )
        await db.commit()
        return dict(result.mappings().first())


@router.delete("/teams/{team_id}/members/{user_id}")
async def remove_from_team(team_id: UUID, user_id: UUID, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("UPDATE users SET team_id = NULL WHERE id = :id AND team_id = :team_id"),
            {"id": str(user_id), "team_id": str(team_id)},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found in this team")
    return {"removed": True}


# ── Schema Access ─────────────────────────────────────────────────────────────

class SchemaAccessCreate(BaseModel):
    table_name: str  # raw table name as stored in Qdrant payload, e.g. "dim_students"


@router.get("/teams/{team_id}/schemas")
async def list_team_schemas(team_id: UUID, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT id, table_name, created_at
                FROM team_schema_access
                WHERE team_id = :team_id
                ORDER BY table_name
            """),
            {"team_id": str(team_id)},
        )
        return [dict(r) for r in result.mappings().all()]


@router.post("/teams/{team_id}/schemas")
async def add_schema_access(team_id: UUID, body: SchemaAccessCreate, user: dict = Depends(require_admin)):
    async with async_session() as db:
        try:
            result = await db.execute(
                text("""
                    INSERT INTO team_schema_access (team_id, table_name)
                    VALUES (:team_id, :table_name)
                    RETURNING id, table_name, created_at
                """),
                {"team_id": str(team_id), "table_name": body.table_name},
            )
            await db.commit()
            return dict(result.mappings().first())
        except Exception:
            raise HTTPException(status_code=400, detail="Table already granted to this team")


@router.delete("/teams/{team_id}/schemas/{access_id}")
async def remove_schema_access(team_id: UUID, access_id: UUID, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("DELETE FROM team_schema_access WHERE id = :id AND team_id = :team_id"),
            {"id": str(access_id), "team_id": str(team_id)},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Access rule not found")
    return {"deleted": True}


# ── Example Questions ─────────────────────────────────────────────────────────

class ExampleCreate(BaseModel):
    question: str
    sort_order: int = 0


@router.get("/teams/{team_id}/examples")
async def list_examples(team_id: UUID, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT id, question, sort_order, created_at
                FROM team_example_questions
                WHERE team_id = :team_id
                ORDER BY sort_order, created_at
            """),
            {"team_id": str(team_id)},
        )
        return [dict(r) for r in result.mappings().all()]


@router.post("/teams/{team_id}/examples")
async def add_example(team_id: UUID, body: ExampleCreate, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                INSERT INTO team_example_questions (team_id, question, sort_order)
                VALUES (:team_id, :question, :sort_order)
                RETURNING id, question, sort_order, created_at
            """),
            {"team_id": str(team_id), "question": body.question, "sort_order": body.sort_order},
        )
        await db.commit()
        return dict(result.mappings().first())


@router.delete("/teams/{team_id}/examples/{example_id}")
async def delete_example(team_id: UUID, example_id: UUID, user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("DELETE FROM team_example_questions WHERE id = :id AND team_id = :team_id"),
            {"id": str(example_id), "team_id": str(team_id)},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Example not found")
    return {"deleted": True}


# ── All Users ─────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_all_users(user: dict = Depends(require_admin)):
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT u.id, u.email, u.name, u.role, u.status, u.avatar_url, u.created_at,
                       t.id AS team_id, t.name AS team_name
                FROM users u
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.org_id = :org_id
                ORDER BY u.created_at DESC
            """),
            {"org_id": CUEMATH_ORG_ID},
        )
        return [dict(r) for r in result.mappings().all()]


# ── Usage Stats ───────────────────────────────────────────────────────────────

@router.get("/usage")
async def usage_stats(user: dict = Depends(require_admin)):
    """Query volume and success rate by team."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT
                    t.name                                              AS team_name,
                    COUNT(q.id)                                         AS total_queries,
                    COUNT(CASE WHEN q.status = 'success' THEN 1 END)   AS success_count,
                    COUNT(CASE WHEN q.status = 'error'   THEN 1 END)   AS error_count,
                    ROUND(AVG(q.duration_ms))                           AS avg_duration_ms,
                    MAX(q.created_at)                                   AS last_query_at
                FROM teams t
                LEFT JOIN users u ON u.team_id = t.id
                LEFT JOIN queries q ON q.user_id = u.id
                WHERE t.org_id = :org_id
                GROUP BY t.id, t.name
                ORDER BY total_queries DESC NULLS LAST
            """),
            {"org_id": CUEMATH_ORG_ID},
        )
        return [dict(r) for r in result.mappings().all()]


# ── Available Tables (for schema access picker) ───────────────────────────────

@router.get("/connections/{connection_id}/tables")
async def list_available_tables(connection_id: str, user: dict = Depends(require_admin)):
    """List all tables synced for a connection — used by admin to pick which
    tables to grant to a team."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT DISTINCT table_name, dbt_model_schema
                FROM schema_metadata
                WHERE connection_id = :cid
                ORDER BY table_name
            """),
            {"cid": connection_id},
        )
        return [dict(r) for r in result.mappings().all()]
