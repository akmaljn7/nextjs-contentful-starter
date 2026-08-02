"""Auth + RBAC dependencies."""
from typing import Optional
from fastapi import Request, HTTPException, Depends
from bson import ObjectId
import jwt

from db import get_db
from security import decode_token


async def get_current_user(request: Request) -> dict:
    """Extract JWT from cookie or Authorization header, verify, and load user."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid user")
    if not user or user.get("deleted_at"):
        raise HTTPException(status_code=401, detail="User not found")

    user["id"] = str(user.pop("_id"))
    user.pop("password_hash", None)
    return user


def require_roles(*roles: str):
    """Dependency factory that enforces role membership."""
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles and user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return _check


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("org_owner", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"
