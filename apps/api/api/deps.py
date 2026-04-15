from __future__ import annotations

"""FastAPI dependencies — auth, admin guard."""
import os
import jwt
from fastapi import Request, HTTPException, Depends

JWT_SECRET = os.getenv("CUEBI_JWT_SECRET", "cuebi-dev-secret-change-in-prod")
ALGORITHM = "HS256"

# Fallback user for development mode (no token required)
_DEV_USER = {
    "user_id": "00000000-0000-0000-0000-000000000002",
    "email": "dev@cuemath.com",
    "name": "Dev User",
    "org_id": "00000000-0000-0000-0000-000000000001",
    "team_id": None,
    "role": "admin",
}


async def get_current_user(request: Request) -> dict:
    """Validate Bearer JWT and return the decoded user payload.

    In development (ENVIRONMENT=development), falls back to the dev seed user
    when no Authorization header is present — so the app works without Google SSO
    configured locally.
    """
    auth = request.headers.get("Authorization", "")

    if not auth.startswith("Bearer "):
        if os.getenv("ENVIRONMENT", "development") == "development":
            return _DEV_USER
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired — please log in again")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require the caller to have role='admin'."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
