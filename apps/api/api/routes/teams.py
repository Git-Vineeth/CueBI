from __future__ import annotations

"""Teams API — member list, role management. Admin-only write operations."""
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy import text

from apps.api.api.db import async_session
from apps.api.api.deps import get_current_user, require_admin

router = APIRouter()

VALID_ROLES = ["admin", "analyst", "viewer"]


class RoleUpdate(BaseModel):
    role: str


@router.get("/members")
async def list_members(user: dict = Depends(require_admin)):
    """List all users in the org. Admin only."""
    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT u.id, u.email, u.name, u.role, u.status, u.avatar_url, u.created_at,
                       t.name as team_name
                FROM users u
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.org_id = :org_id ORDER BY u.created_at
            """),
            {"org_id": user["org_id"]},
        )
        return [dict(r) for r in result.mappings().all()]


@router.patch("/members/{user_id}/role")
async def update_role(user_id: UUID, body: RoleUpdate, user: dict = Depends(require_admin)):
    """Change a user's role. Admin only."""
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {VALID_ROLES}")

    async with async_session() as db:
        result = await db.execute(
            text("UPDATE users SET role = :role WHERE id = :id AND org_id = :org_id"),
            {"role": body.role, "id": str(user_id), "org_id": user["org_id"]},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
    return {"status": "updated", "user_id": str(user_id), "role": body.role}


@router.delete("/members/{user_id}")
async def remove_member(user_id: UUID, user: dict = Depends(require_admin)):
    """Disable a user (sets status=disabled rather than deleting). Admin only."""
    if str(user_id) == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")

    async with async_session() as db:
        result = await db.execute(
            text("UPDATE users SET status = 'disabled' WHERE id = :id AND org_id = :org_id"),
            {"id": str(user_id), "org_id": user["org_id"]},
        )
        await db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
    return {"status": "disabled"}


@router.get("/my/examples")
async def get_my_examples(request: Request):
    """Return the example questions for the calling user's team.
    Used by the chat home screen to show team-specific prompts.
    """
    user = await get_current_user(request)
    team_id = user.get("team_id")
    if not team_id:
        return []

    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT question FROM team_example_questions
                WHERE team_id = :team_id
                ORDER BY sort_order, created_at
                LIMIT 6
            """),
            {"team_id": team_id},
        )
        return [r["question"] for r in result.mappings().all()]
