"""Proxy actions via a colleague's phone — for employees whose own phone is
dead/off. The lending user is authenticated; the ABSENT employee is identified
by email/id and proven present by a live selfie that must match their enrolled
face baseline. Location proof comes from the lending device's GPS (must be
inside the absent employee's office geofence).

Every proxy action is labelled (`proxy_by`) and surfaced to admins.
"""
import logging
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from db import get_db
from deps import get_current_user, client_ip
from models import ColleagueCheckin, ColleagueSelfie, ColleagueGapReason
from services.geo import haversine_meters
from services.photos import save_session_photo
from services.audit import log_security_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/colleague", tags=["colleague"])


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _resolve_target(db, org_id: str, email_or_id: str):
    q = email_or_id.strip().lower()
    target = await db.users.find_one({"org_id": org_id, "email": q, "deleted_at": None})
    if not target:
        try:
            target = await db.users.find_one(
                {"_id": ObjectId(email_or_id.strip()), "org_id": org_id, "deleted_at": None}
            )
        except Exception:
            target = None
    return target


@router.post("/checkin")
async def colleague_checkin(payload: ColleagueCheckin, request: Request, user: dict = Depends(get_current_user)):
    from routes.sessions import (
        _get_org_settings, _plan_challenges, _broadcast_session, _compute_schedule_duration_ms,
    )
    db = get_db()
    target = await _resolve_target(db, user["org_id"], payload.email_or_id)
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found in your organization")
    target_id = str(target["_id"])
    if target_id == user["id"]:
        raise HTTPException(status_code=400, detail="Use your own device to check yourself in")
    if target.get("role") != "employee":
        raise HTTPException(status_code=400, detail="Only employees can be checked in")
    if not target.get("face_baseline"):
        raise HTTPException(status_code=400, detail="This employee hasn't enrolled their face yet — proxy check-in is blocked")
    office_id = target.get("office_id")
    if not office_id:
        raise HTTPException(status_code=400, detail="Employee has no assigned office")
    try:
        office = await db.offices.find_one({"_id": ObjectId(office_id), "org_id": user["org_id"]})
    except Exception:
        office = None
    if not office:
        raise HTTPException(status_code=404, detail="Employee's office not found")

    settings = await _get_org_settings(db, user["org_id"])
    accuracy_tol = settings.get("accuracy_tolerance_meters", 50)
    if payload.accuracy > accuracy_tol:
        raise HTTPException(status_code=400, detail=f"GPS accuracy too low ({payload.accuracy:.0f}m). Move to an open area.")
    office_lat = office["location"]["coordinates"][1]
    office_lng = office["location"]["coordinates"][0]
    dist = haversine_meters(payload.lat, payload.lng, office_lat, office_lng)
    if dist > office["radius_meters"]:
        raise HTTPException(status_code=403, detail=f"You must be inside {target['name']}'s office to check them in ({int(dist)}m from center).")

    tdoc = {**target, "id": target_id}
    duration_ms, deny = await _compute_schedule_duration_ms(db, tdoc, settings)
    if deny:
        raise HTTPException(status_code=403, detail=deny)

    now_ms = _now_ms()
    resp_window = int(settings.get("selfie_response_window_minutes", 5))
    challenge = {
        "id": uuid.uuid4().hex[:12], "trigger_ms": now_ms, "status": "pending",
        "prompted_at_ms": now_ms, "respond_by_ms": now_ms + resp_window * 60 * 1000,
        "responded_at_ms": None, "photo_saved": False, "manual": True, "proxy": True,
    }
    last_fix = {"lat": payload.lat, "lng": payload.lng, "accuracy": payload.accuracy, "ts_ms": now_ms}
    existing = await db.active_sessions.find_one({"user_id": target_id, "org_id": user["org_id"]})
    if existing:
        challenges = list(existing.get("challenges") or [])
        challenges.append(challenge)
        await db.active_sessions.update_one(
            {"_id": existing["_id"]},
            {"$set": {"challenges": challenges},
             "$push": {"log": {"event": "proxy_checkin", "ts_ms": now_ms, "by": user.get("email"),
                               "reason": payload.reason, "challenge_id": challenge["id"]}}},
        )
        s = await db.active_sessions.find_one({"_id": existing["_id"]})
        await _broadcast_session(db, s)
        session_id = str(existing["_id"])
    else:
        challenges = _plan_challenges(settings, now_ms, duration_ms)
        challenges.append(challenge)
        doc = {
            "org_id": user["org_id"], "user_id": target_id, "office_id": office_id,
            "center": {"lat": office_lat, "lng": office_lng, "radius_m": office["radius_meters"]},
            "start_time": _now_iso(), "start_time_ms": now_ms, "remaining_ms": duration_ms,
            "total_inside_ms": 0, "current_bout_start_ms": now_ms, "bout_count": 1,
            "status": "active", "flagged": False, "paused_at": None, "challenges": challenges,
            "last_fix": last_fix, "last_live_ts_ms": now_ms, "auto_started": True,
            "source": "proxy_checkin", "proxy_by": user.get("email"), "proxy_reason": payload.reason,
            "log": [{"event": "proxy_checkin", "ts_ms": now_ms, "by": user.get("email"),
                     "reason": payload.reason, "challenge_id": challenge["id"], "lat": payload.lat, "lng": payload.lng}],
        }
        res = await db.active_sessions.insert_one(doc)
        doc["_id"] = res.inserted_id
        await _broadcast_session(db, doc)
        session_id = str(res.inserted_id)

    logger.info("proxy_checkin by=%s target=%s session=%s", user.get("email"), target.get("email"), session_id)
    return {"ok": True, "session_id": session_id, "challenge_id": challenge["id"],
            "target_name": target.get("name"), "target_email": target.get("email")}


@router.post("/selfie")
async def colleague_selfie(payload: ColleagueSelfie, request: Request, user: dict = Depends(get_current_user)):
    from routes.sessions import _broadcast_session
    from services.face_match import verify as verify_face
    db = get_db()
    target = await _resolve_target(db, user["org_id"], payload.email_or_id)
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")
    baseline = target.get("face_baseline")
    if not baseline:
        raise HTTPException(status_code=400, detail="This employee hasn't enrolled their face yet")
    target_id = str(target["_id"])
    s = await db.active_sessions.find_one({"user_id": target_id, "org_id": user["org_id"]})
    if not s:
        raise HTTPException(status_code=404, detail="No active session — check the employee in first")
    now_ms = _now_ms()
    challenges = list(s.get("challenges") or [])
    ch = None
    if payload.challenge_id:
        ch = next((c for c in challenges if c.get("id") == payload.challenge_id), None)
    if not ch:
        ch = next((c for c in challenges if c.get("status") == "pending" and c.get("respond_by_ms", 0) > now_ms), None)
    if not ch:
        raise HTTPException(status_code=404, detail="No pending selfie request for this employee")
    if ch.get("respond_by_ms", 0) < now_ms:
        ch["status"] = "expired"
        await db.active_sessions.update_one({"_id": s["_id"]}, {"$set": {"challenges": challenges, "flagged": True}})
        raise HTTPException(status_code=400, detail="Selfie window expired")

    result = verify_face(baseline, payload.face_photo)
    await save_session_photo(f"{s['_id']}::{ch['id']}", user["org_id"], target_id, payload.face_photo)
    log_entries = list(s.get("log", []))
    ch["responded_at_ms"] = now_ms
    ch["photo_saved"] = True
    ch["similarity"] = result["similarity"]
    ch["proxy_by"] = user.get("email")
    if not result["match"]:
        ch["status"] = "mismatch"
        log_entries.append({"event": "proxy_selfie_mismatch", "ts_ms": now_ms, "challenge_id": ch["id"],
                            "by": user.get("email"), "similarity": result["similarity"]})
        await db.active_sessions.update_one(
            {"_id": s["_id"]}, {"$set": {"challenges": challenges, "log": log_entries[-500:], "flagged": True}},
        )
        await log_security_event(
            "face_mismatch", "high", client_ip(request),
            {"challenge_id": ch["id"], "session_id": str(s["_id"]), "proxy_by": user.get("email"),
             "similarity": result["similarity"], "reason": result.get("reason")},
            org_id=user["org_id"], user_id=target_id,
        )
        new_s = await db.active_sessions.find_one({"_id": s["_id"]})
        await _broadcast_session(db, new_s)
        raise HTTPException(status_code=403, detail=f"Face does not match {target['name']}'s enrolled photo (similarity {result['similarity']:.2f}).")

    ch["status"] = "responded"
    log_entries.append({"event": "proxy_selfie_responded", "ts_ms": now_ms, "challenge_id": ch["id"],
                        "by": user.get("email"), "similarity": result["similarity"]})
    await db.active_sessions.update_one(
        {"_id": s["_id"]}, {"$set": {"challenges": challenges, "log": log_entries[-500:]}},
    )
    new_s = await db.active_sessions.find_one({"_id": s["_id"]})
    await _broadcast_session(db, new_s)
    logger.info("proxy_selfie_ok by=%s target=%s sim=%.2f", user.get("email"), target.get("email"), result["similarity"])
    return {"ok": True, "similarity": result["similarity"], "target_name": target.get("name")}


@router.post("/gap-reason")
async def colleague_gap_reason(payload: ColleagueGapReason, request: Request, user: dict = Depends(get_current_user)):
    from services.face_match import verify as verify_face
    db = get_db()
    target = await _resolve_target(db, user["org_id"], payload.email_or_id)
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")
    target_id = str(target["_id"])
    if payload.gap_id:
        gap = await db.coverage_gaps.find_one({"org_id": user["org_id"], "id": payload.gap_id})
    else:
        gap = await db.coverage_gaps.find_one(
            {"org_id": user["org_id"], "user_id": target_id, "status": "pending"},
            sort=[("created_at", -1)],
        )
    if not gap:
        raise HTTPException(status_code=404, detail="No pending coverage gap found for this employee")

    selfie_match = None
    similarity = None
    if payload.face_photo:
        await save_session_photo(f"gap::{gap['id']}", user["org_id"], target_id, payload.face_photo)
        if target.get("face_baseline"):
            r = verify_face(target["face_baseline"], payload.face_photo)
            selfie_match = r["match"]
            similarity = r["similarity"]

    await db.coverage_gaps.update_one(
        {"_id": gap["_id"]},
        {"$set": {
            "reason_note": payload.note, "reason_by": user.get("email"), "reason_at": _now_iso(),
            "has_photo": bool(payload.face_photo), "selfie_match": selfie_match,
            "selfie_similarity": similarity,
        }},
    )
    logger.info("gap_reason by=%s target=%s gap=%s selfie_match=%s",
                user.get("email"), target.get("email"), gap["id"], selfie_match)
    return {"ok": True, "gap_id": gap["id"], "selfie_match": selfie_match, "similarity": similarity}
