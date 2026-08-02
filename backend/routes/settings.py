"""Org settings (get/update)."""
from fastapi import APIRouter, Depends, Request
from bson import ObjectId

from db import get_db
from models import OrgSettingsUpdate
from deps import require_admin, get_current_user, client_ip
from services.audit import log_admin_action

router = APIRouter(prefix="/api/org", tags=["org"])


@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    db = get_db()
    org = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
    return {"id": user["org_id"], "name": org.get("name"), "slug": org.get("slug"), "settings": org.get("settings", {})}


@router.patch("/settings")
async def update_settings(payload: OrgSettingsUpdate, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    updates = {}
    for k, v in payload.model_dump(exclude_unset=True).items():
        updates[f"settings.{k}"] = v
    if updates:
        before = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
        await db.organizations.update_one({"_id": ObjectId(user["org_id"])}, {"$set": updates})
        after = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
        await log_admin_action(
            user["org_id"], user["id"], "org.settings.update", "org", user["org_id"],
            before=(before or {}).get("settings", {}), after=(after or {}).get("settings", {}),
            ip=client_ip(request), user_agent=request.headers.get("user-agent", ""),
        )
    org = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
    return {"settings": org.get("settings", {})}
