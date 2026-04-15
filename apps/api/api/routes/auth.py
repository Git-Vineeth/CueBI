from __future__ import annotations

"""Auth API — Google OAuth login endpoint + JWT issuance.

Flow:
  1. Frontend (NextAuth) completes Google OAuth.
  2. NextAuth signIn callback calls POST /api/auth/google-login with email + google_id.
  3. This endpoint checks the user is pre-provisioned (invite-first model).
  4. Returns a signed CueBI JWT containing user_id, team_id, org_id, role.
  5. NextAuth stores this JWT in the session; frontend attaches it as Bearer token.
"""
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
import jwt

from apps.api.api.db import async_session
from apps.api.api.deps import JWT_SECRET, ALGORITHM, get_current_user

router = APIRouter()

TOKEN_TTL_HOURS = 24
ALLOWED_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "cuemath.com")


class GoogleLoginRequest(BaseModel):
    email: str
    google_id: str
    name: str | None = None
    picture: str | None = None


def _make_jwt(user: dict) -> str:
    payload = {
        "user_id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "org_id": str(user["org_id"]),
        "team_id": str(user["team_id"]) if user["team_id"] else None,
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


@router.post("/google-login")
async def google_login(req: GoogleLoginRequest):
    """Called by NextAuth after Google OAuth.

    Returns a signed CueBI JWT if the user is pre-provisioned.
    Raises 403 with a descriptive detail code if access is denied.
    """
    domain = req.email.split("@")[-1] if "@" in req.email else ""
    if domain != ALLOWED_DOMAIN:
        raise HTTPException(status_code=403, detail="access_denied")

    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT id, email, name, org_id, role, team_id, status
                FROM users WHERE email = :email
            """),
            {"email": req.email},
        )
        user = result.mappings().first()

    if not user:
        raise HTTPException(status_code=403, detail="not_provisioned")

    if user["status"] == "disabled":
        raise HTTPException(status_code=403, detail="account_disabled")

    # Persist Google ID and avatar on first/subsequent logins
    async with async_session() as db:
        await db.execute(
            text("""
                UPDATE users
                SET google_id = :gid,
                    avatar_url = :pic,
                    status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
                WHERE id = :id
            """),
            {"gid": req.google_id, "pic": req.picture, "id": str(user["id"])},
        )
        await db.commit()

    token = _make_jwt(user)
    return {
        "access_token": token,
        "user": {
            "user_id": str(user["id"]),
            "email": user["email"],
            "name": user["name"],
            "org_id": str(user["org_id"]),
            "team_id": str(user["team_id"]) if user["team_id"] else None,
            "role": user["role"],
        },
    }


@router.get("/me")
async def get_me(request: Request):
    """Return the current user's profile from their JWT."""
    user = await get_current_user(request)
    return user


@router.post("/dev-login")
async def dev_login():
    """Development-only: returns a JWT for dev@cuemath.com without Google OAuth.
    Disabled in production (ENVIRONMENT != development).
    """
    if os.getenv("ENVIRONMENT", "development") != "development":
        raise HTTPException(status_code=404, detail="Not found")

    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT id, email, name, org_id, role, team_id, status
                FROM users WHERE email = 'dev@cuemath.com'
            """),
        )
        user = result.mappings().first()

    if not user:
        raise HTTPException(status_code=404, detail="Dev user not found — run init.sql seed")

    token = _make_jwt(user)
    return {"access_token": token}
