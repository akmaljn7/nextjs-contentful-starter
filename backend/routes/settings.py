"""Org settings (get/update)."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from bson import ObjectId

from db import get_db
from models import OrgSettingsUpdate
from deps import require_admin, get_current_user, client_ip
from services.audit import log_admin_action

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/org", tags=["org"])

SELFIE_KEYS = {"selfie_challenges_per_shift", "selfie_response_window_minutes",
               "selfie_mode", "selfie_fixed_times"}


@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    db = get_db()
    org = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
    return {"id": user["org_id"], "name": org.get("name"), "slug": org.get("slug"), "settings": org.get("settings", {})}


@router.patch("/settings")
async def update_settings(payload: OrgSettingsUpdate, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    changed = payload.model_dump(exclude_unset=True)
    updates = {f"settings.{k}": v for k, v in changed.items()}
    if updates:
        before = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
        await db.organizations.update_one({"_id": ObjectId(user["org_id"])}, {"$set": updates})
        after = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
        await log_admin_action(
            user["org_id"], user["id"], "org.settings.update", "org", user["org_id"],
            before=(before or {}).get("settings", {}), after=(after or {}).get("settings", {}),
            ip=client_ip(request), user_agent=request.headers.get("user-agent", ""),
        )
        logger.info("org_settings_update admin=%s changed=%s",
                    user.get("email"), list(changed.keys()))

        # If selfie configuration changed, re-plan the remaining challenges
        # for every active session in this org so a newly set fixed time
        # (or an increased challenge count) takes effect immediately.
        if SELFIE_KEYS & set(changed.keys()):
            from routes.sessions import _plan_challenges, _broadcast_session
            settings_after = (after or {}).get("settings", {})
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            n_replanned = 0
            async for s in db.active_sessions.find({"org_id": user["org_id"]}):
                preserved = [c for c in (s.get("challenges") or []) if c.get("status") != "planned"]
                start_ms = s.get("start_time_ms") or now_ms
                # Plan remaining challenges for the rest of the shift
                new_planned = _plan_challenges(settings_after, now_ms, max(0, s.get("remaining_ms", 0)))
                merged = preserved + new_planned
                await db.active_sessions.update_one({"_id": s["_id"]}, {"$set": {"challenges": merged}})
                s["challenges"] = merged
                await _broadcast_session(db, s)
                n_replanned += 1
            if n_replanned:
                logger.info("org_settings_replanned_sessions org=%s count=%s",
                            user["org_id"], n_replanned)
    org = await db.organizations.find_one({"_id": ObjectId(user["org_id"])})
    return {"settings": org.get("settings", {})}
