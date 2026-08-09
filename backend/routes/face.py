"""Face enrollment + admin re-enroll endpoints."""
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from bson import ObjectId

from db import get_db
from deps import get_current_user, require_admin
from services.face_match import extract_embedding

router = APIRouter(prefix="/api/face", tags=["face"])


class EnrollPayload(BaseModel):
    face_photo: str = Field(min_length=100, max_length=6_000_000)


@router.post("/enroll")
async def enroll(payload: EnrollPayload, user: dict = Depends(get_current_user)):
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Only employees enroll their own face")
    # Offload CPU-bound dlib work off the event loop.
    emb = await asyncio.to_thread(extract_embedding, payload.face_photo)
    if not emb:
        raise HTTPException(status_code=400, detail="No clear face detected — try again in better lighting")
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {
            "face_baseline": emb,
            "face_enrolled_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"enrolled": True, "dim": len(emb)}


@router.get("/status")
async def status(user: dict = Depends(get_current_user)):
    db = get_db()
    u = await db.users.find_one({"_id": ObjectId(user["id"])}, {"face_baseline": 1, "face_enrolled_at": 1})
    return {
        "enrolled": bool(u and u.get("face_baseline")),
        "enrolled_at": (u or {}).get("face_enrolled_at"),
    }


@router.delete("/reset/{user_id}")
async def admin_reset(user_id: str, admin: dict = Depends(require_admin)):
    """Admin resets an employee's enrollment so they can re-submit a new baseline."""
    from services.audit import log_admin_action, log_security_event
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    r = await db.users.update_one(
        {"_id": oid, "org_id": admin["org_id"]},
        {"$unset": {"face_baseline": "", "face_enrolled_at": ""}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    await log_admin_action(
        admin["org_id"], admin["id"], "face.reset", "employee", user_id,
        ip="", user_agent="",
    )
    await log_security_event(
        "face_baseline_reset", "medium", "",
        {"target_user_id": user_id, "actor_id": admin["id"]},
        org_id=admin["org_id"], user_id=user_id,
    )
    return {"ok": True}
