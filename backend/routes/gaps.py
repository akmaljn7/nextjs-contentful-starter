"""Admin review of coverage gaps — approve (count the time) or reject (absent).

Coverage gaps are created by the live-location ingest when a device goes dark
for longer than the threshold while a session is active. A colleague can attach
a reason (+ verified selfie) via /api/colleague/gap-reason. Admins approve or
reject here.
"""
import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from db import get_db
from deps import require_admin, client_ip
from services.photos import get_photo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gaps", tags=["gaps"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_gaps(status: str = "pending", user: dict = Depends(require_admin)):
    db = get_db()
    q = {"org_id": user["org_id"]}
    if status and status != "all":
        q["status"] = status
    gaps = []
    async for g in db.coverage_gaps.find(q, sort=[("created_at", -1)]).limit(200):
        try:
            emp = await db.users.find_one({"_id": ObjectId(g["user_id"])}, {"name": 1, "email": 1})
        except Exception:
            emp = None
        gaps.append({
            "id": g["id"],
            "user_id": g["user_id"],
            "employee_name": (emp or {}).get("name", "Unknown"),
            "employee_email": (emp or {}).get("email", ""),
            "from_ms": g.get("from_ms"),
            "to_ms": g.get("to_ms"),
            "gap_ms": g.get("gap_ms"),
            "battery_before": g.get("battery_before"),
            "battery_after": g.get("battery_after"),
            "likely_battery_died": g.get("likely_battery_died"),
            "status": g.get("status"),
            "reason_note": g.get("reason_note"),
            "reason_by": g.get("reason_by"),
            "reason_at": g.get("reason_at"),
            "has_photo": g.get("has_photo", False),
            "selfie_match": g.get("selfie_match"),
            "selfie_similarity": g.get("selfie_similarity"),
            "reviewed_by": g.get("reviewed_by"),
            "reviewed_at": g.get("reviewed_at"),
            "created_at": g.get("created_at"),
        })
    return gaps


async def _decide(db, org_id, gap_id, decision, admin) -> dict:
    gap = await db.coverage_gaps.find_one({"org_id": org_id, "id": gap_id})
    if not gap:
        raise HTTPException(status_code=404, detail="Gap not found")
    if gap.get("status") in ("approved", "rejected"):
        raise HTTPException(status_code=409, detail=f"Gap already {gap['status']}")
    await db.coverage_gaps.update_one(
        {"_id": gap["_id"]},
        {"$set": {"status": decision, "reviewed_by": admin.get("email"), "reviewed_at": _now_iso()}},
    )
    # If APPROVED and the session is still active, re-credit the excluded time.
    if decision == "approved":
        try:
            s = await db.active_sessions.find_one({"_id": ObjectId(gap["session_id"])})
        except Exception:
            s = None
        if s:
            gap_ms = int(gap.get("gap_ms", 0))
            await db.active_sessions.update_one(
                {"_id": s["_id"]},
                {"$inc": {"total_inside_ms": gap_ms, "remaining_ms": gap_ms},
                 "$push": {"log": {"event": "gap_approved", "ts_ms": int(datetime.now(timezone.utc).timestamp() * 1000),
                                   "gap_id": gap_id, "by": admin.get("email"), "credited_ms": gap_ms}}},
            )
    return {"ok": True, "gap_id": gap_id, "status": decision}


@router.post("/{gap_id}/approve")
async def approve_gap(gap_id: str, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    from services.audit import log_admin_action
    out = await _decide(db, user["org_id"], gap_id, "approved", user)
    await log_admin_action(user["org_id"], user["id"], "gap.approve", "coverage_gap", gap_id,
                           ip=client_ip(request), user_agent=request.headers.get("user-agent", ""))
    logger.info("gap_approved admin=%s gap=%s", user.get("email"), gap_id)
    return out


@router.post("/{gap_id}/reject")
async def reject_gap(gap_id: str, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    from services.audit import log_admin_action
    out = await _decide(db, user["org_id"], gap_id, "rejected", user)
    await log_admin_action(user["org_id"], user["id"], "gap.reject", "coverage_gap", gap_id,
                           ip=client_ip(request), user_agent=request.headers.get("user-agent", ""))
    logger.info("gap_rejected admin=%s gap=%s", user.get("email"), gap_id)
    return out


@router.get("/{gap_id}/photo")
async def gap_photo(gap_id: str, user: dict = Depends(require_admin)):
    result = await get_photo(f"gap::{gap_id}", user["org_id"])
    if not result:
        raise HTTPException(status_code=404, detail="No photo for this gap")
    body, mime = result
    return Response(content=body, media_type=mime, headers={"Cache-Control": "private, max-age=300"})
