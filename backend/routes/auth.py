"""Auth routes: register-org, login, refresh, logout, me, forgot/reset password."""
import os
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Response, Request, Depends
from bson import ObjectId
import jwt
import secrets

from db import get_db
from models import RegisterOrgRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, UserPublic
from security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, REFRESH_TOKEN_DAYS, ACCESS_TOKEN_MINUTES,
)
from deps import get_current_user, client_ip
from services.audit import log_security_event
from services.email import send_email, render_reset_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(
        key="access_token", value=access, httponly=True, secure=True,
        samesite="none", max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=True,
        samesite="none", max_age=REFRESH_TOKEN_DAYS * 86400, path="/",
    )


def _slugify(text: str) -> str:
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:60] or f"org-{uuid.uuid4().hex[:8]}"


async def _issue_tokens(user_doc: dict, response: Response):
    db = get_db()
    user_id = str(user_doc["_id"])
    access = create_access_token(user_id, user_doc["email"], user_doc["org_id"], user_doc["role"])
    jti = uuid.uuid4().hex
    refresh = create_refresh_token(user_id, jti)
    await db.refresh_tokens.insert_one({
        "jti": jti,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "revoked_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _set_auth_cookies(response, access, refresh)
    return access, refresh


def _shape_user(user: dict, org: dict | None = None) -> dict:
    return {
        "id": str(user["_id"]),
        "org_id": user["org_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "office_id": user.get("office_id"),
        "org_name": (org or {}).get("name"),
        "created_at": user.get("created_at"),
    }


@router.post("/register-org", response_model=UserPublic)
async def register_org(payload: RegisterOrgRequest, request: Request, response: Response):
    db = get_db()
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create org
    slug = _slugify(payload.org_name)
    while await db.organizations.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    org_doc = {
        "name": payload.org_name,
        "slug": slug,
        "plan": "free",
        "settings": {
            "session_duration_minutes": 60,
            "resume_window_hours": 10,
            "accuracy_tolerance_meters": 50,
            "max_speed_kmh": 200,
            "spoof_sensitivity": "medium",
            "notify_admin_on_spoof": True,
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
    }
    org_res = await db.organizations.insert_one(org_doc)
    org_id = str(org_res.inserted_id)

    user_doc = {
        "org_id": org_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.owner_name,
        "role": "org_owner",
        "office_id": None,
        "failed_login_count": 0,
        "locked_until": None,
        "last_login_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
    }
    user_res = await db.users.insert_one(user_doc)
    user_doc["_id"] = user_res.inserted_id
    await _issue_tokens(user_doc, response)
    return _shape_user(user_doc, org_doc)


@router.post("/login", response_model=UserPublic)
async def login(payload: LoginRequest, request: Request, response: Response):
    db = get_db()
    email = payload.email.lower().strip()
    ip = client_ip(request)
    identifier = f"{ip}:{email}"

    # Check lockout
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("locked_until"):
        lu = attempt["locked_until"]
        if isinstance(lu, str):
            lu = datetime.fromisoformat(lu)
        if lu > now:
            raise HTTPException(status_code=429, detail=f"Account locked. Try again after {int((lu - now).total_seconds() / 60) + 1} minutes.")

    user = await db.users.find_one({"email": email, "deleted_at": None})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        # Increment failed attempts
        count = (attempt or {}).get("count", 0) + 1
        update = {"count": count, "identifier": identifier, "last_attempt_at": now.isoformat()}
        if count >= MAX_FAILED_ATTEMPTS:
            update["locked_until"] = (now + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        await log_security_event(
            type_="failed_login", severity="low" if count < MAX_FAILED_ATTEMPTS else "medium",
            ip=ip, details={"email": email, "count": count},
            org_id=user["org_id"] if user else None, user_id=str(user["_id"]) if user else None,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear attempts
    await db.login_attempts.delete_one({"identifier": identifier})
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now.isoformat(), "failed_login_count": 0}})

    org = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
    await _issue_tokens(user, response)
    return _shape_user(user, org)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    db = get_db()
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    stored = await db.refresh_tokens.find_one({"jti": payload["jti"]})
    if not stored or stored.get("revoked_at"):
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or user.get("deleted_at"):
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate refresh token
    await db.refresh_tokens.update_one(
        {"jti": payload["jti"]},
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    await _issue_tokens(user, response)
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response, user: dict = Depends(get_current_user)):
    db = get_db()
    token = request.cookies.get("refresh_token")
    if token:
        try:
            payload = decode_token(token)
            await db.refresh_tokens.update_one(
                {"jti": payload.get("jti")},
                {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
            )
        except Exception:
            pass
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    db = get_db()
    org = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
    return {
        "id": user["id"],
        "org_id": user["org_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "office_id": user.get("office_id"),
        "org_name": (org or {}).get("name"),
        "created_at": user.get("created_at"),
    }


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, request: Request):
    db = get_db()
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email, "deleted_at": None})
    # Always return success to avoid leaking existence
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": str(user["_id"]),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
        reset_url = f"{frontend}/reset-password?token={token}"
        html = render_reset_email(reset_url, user.get("name", "there"))
        await send_email(email, "Reset your Geofence Console password", html)
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    db = get_db()
    rec = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or already used token")
    exp = rec["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    await db.users.update_one(
        {"_id": ObjectId(rec["user_id"])},
        {"$set": {"password_hash": hash_password(payload.password), "failed_login_count": 0, "locked_until": None}},
    )
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True}
