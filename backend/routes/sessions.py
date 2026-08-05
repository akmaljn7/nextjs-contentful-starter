"""Session state machine: start, ping, reset, live tracking.

Server-authoritative — all state transitions decided here from GPS pings.
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId

from db import get_db
from models import SessionStart, SessionPing, SessionAutoStart, ChallengeResponse
from deps import get_current_user, require_admin, client_ip
from services.geo import haversine_meters, analyze_ping
from services.audit import log_security_event
from services.email import send_email, render_alert_email
from services.ws_manager import manager as ws_manager
from services.photos import save_session_photo, has_photo
import os
import random
import uuid

logger = logging.getLogger(__name__)
STALE_PING_MS = 3 * 60 * 1000  # if no ping for 3 min, session is considered stale

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


async def _compute_schedule_duration_ms(db, user_doc: dict, org_settings: dict) -> tuple[int, str | None]:
    """Given the employee's schedule + org defaults, return (remaining_ms, error_or_None).

    Also checks for approved time-off covering today (UTC) — if found, denies with
    a specific reason. Time-off overrides all schedule modes.

    Returns:
        (duration_ms, None) — allowed, use duration_ms for session
        (0, "reason") — deny session start with reason
    """
    # Approved time-off overrides schedule (UTC date comparison).
    user_id = user_doc.get("id") or str(user_doc.get("_id", ""))
    today = datetime.now(timezone.utc).date().isoformat()
    off = await db.time_off_requests.find_one({
        "org_id": user_doc["org_id"],
        "user_id": user_id,
        "status": "approved",
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
    })
    if off:
        return 0, f"Approved time off today ({off.get('reason', 'no reason')}). Enjoy your day."

    schedule = user_doc.get("schedule") or {"mode": "any"}
    mode = schedule.get("mode", "any")

    if mode == "fixed_hours":
        hours = int(schedule.get("min_hours_per_day") or 6)
        return hours * 3600 * 1000, None

    if mode == "weekly_calendar":
        try:
            tz = ZoneInfo(schedule.get("timezone") or "UTC")
        except ZoneInfoNotFoundError:
            tz = ZoneInfo("UTC")
        now = datetime.now(tz)
        day_key = DAY_KEYS[now.weekday()]
        weekly = schedule.get("weekly_schedule") or {}
        day = weekly.get(day_key)
        if not day:
            return 0, "You are not scheduled to work today."
        try:
            oh, om = map(int, day["open"].split(":"))
            ch, cm = map(int, day["close"].split(":"))
        except Exception:
            return 0, "Invalid weekly schedule format."
        open_dt = now.replace(hour=oh, minute=om, second=0, microsecond=0)
        close_dt = now.replace(hour=ch, minute=cm, second=0, microsecond=0)
        if close_dt <= open_dt:
            return 0, "Invalid schedule: close time is before open time."
        if now < open_dt:
            return 0, f"Your shift starts at {day['open']} ({schedule.get('timezone') or 'UTC'})."
        if now >= close_dt:
            return 0, f"Your shift ended at {day['close']} ({schedule.get('timezone') or 'UTC'})."
        return int((close_dt - now).total_seconds() * 1000), None

    session_min = int(org_settings.get("session_duration_minutes", 60))
    return session_min * 60 * 1000, None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


async def _get_org_settings(db, org_id: str) -> dict:
    org = await db.organizations.find_one({"_id": ObjectId(org_id)})
    return (org or {}).get("settings", {})


def _sanitize_session(s: dict) -> dict:
    challenges = s.get("challenges") or []
    now_ms = _now_ms()
    active = next(
        (c for c in challenges if c.get("status") == "pending" and c.get("respond_by_ms", 0) > now_ms),
        None,
    )
    return {
        "id": str(s["_id"]),
        "user_id": s["user_id"],
        "office_id": s["office_id"],
        "org_id": s["org_id"],
        "center": {"lat": s["center"]["lat"], "lng": s["center"]["lng"], "radius_m": s["center"]["radius_m"]},
        "start_time": s["start_time"],
        "remaining_ms": s["remaining_ms"],
        "current_bout_start": s.get("current_bout_start"),
        "status": s["status"],
        "paused_at": s.get("paused_at"),
        "last_fix": s.get("last_fix"),
        "bout_count": s.get("bout_count", 0),
        "total_inside_ms": s.get("total_inside_ms", 0),
        "log": s.get("log", [])[-100:],
        "flagged": s.get("flagged", False),
        "has_photo": bool(s.get("has_photo", False)),
        "auto_started": bool(s.get("auto_started", False)),
        "challenges": [
            {"id": c["id"], "status": c.get("status"), "prompted_at_ms": c.get("prompted_at_ms"),
             "respond_by_ms": c.get("respond_by_ms"), "responded_at_ms": c.get("responded_at_ms")}
            for c in challenges
        ],
        "active_challenge": (
            {"id": active["id"], "respond_by_ms": active["respond_by_ms"]} if active else None
        ),
    }


def _plan_challenges(settings: dict, start_ms: int, duration_ms: int) -> list[dict]:
    """Return a list of planned challenge triggers for the whole session."""
    count = int(settings.get("selfie_challenges_per_shift", 0) or 0)
    if count <= 0 or duration_ms <= 0:
        return []
    mode = settings.get("selfie_mode", "random")
    end_ms = start_ms + duration_ms
    triggers: list[int] = []
    if mode == "fixed":
        # settings.selfie_fixed_times = ["HH:MM", ...] in UTC by default
        for hhmm in (settings.get("selfie_fixed_times") or [])[:count]:
            try:
                h, m = map(int, hhmm.split(":"))
            except Exception:
                continue
            today = datetime.now(timezone.utc).replace(hour=h, minute=m, second=0, microsecond=0)
            t = int(today.timestamp() * 1000)
            if start_ms <= t <= end_ms:
                triggers.append(t)
    if not triggers:
        # random: split shift into `count` equal slots, pick a random moment inside each (skip first & last 3 min)
        span = duration_ms
        buffer_ms = 3 * 60 * 1000
        for i in range(count):
            slot_start = start_ms + int(span * i / count) + buffer_ms
            slot_end = start_ms + int(span * (i + 1) / count) - buffer_ms
            if slot_end <= slot_start:
                continue
            triggers.append(random.randint(slot_start, slot_end))
    return [
        {"id": uuid.uuid4().hex[:12], "trigger_ms": t, "status": "planned",
         "prompted_at_ms": None, "respond_by_ms": None, "responded_at_ms": None,
         "photo_saved": False}
        for t in sorted(triggers)
    ]


async def _tick_challenge_lifecycle(db, session: dict, settings: dict, now_ms: int) -> bool:
    """Promote planned→pending and expire overdue challenges independent of pings.

    Called from /me (employee poll) and /live (admin poll) so a challenge can
    fire even when the client isn't sending pings (bad GPS, background tab, etc.).

    Mutates `session` in place and persists the change. Returns True if changed.
    """
    challenges = list(session.get("challenges") or [])
    if not challenges:
        return False
    resp_window_min = int(settings.get("selfie_response_window_minutes", 5))
    log_entries = list(session.get("log", []))
    flagged = session.get("flagged", False)
    changed = False
    for ch in challenges:
        st = ch.get("status")
        if st == "planned" and ch.get("trigger_ms", 0) <= now_ms:
            ch["status"] = "pending"
            ch["prompted_at_ms"] = now_ms
            ch["respond_by_ms"] = now_ms + resp_window_min * 60 * 1000
            log_entries.append({"event": "selfie_prompted", "ts_ms": now_ms, "challenge_id": ch["id"]})
            logger.info("selfie_prompted session=%s challenge=%s trigger_ms=%s",
                        session.get("_id"), ch["id"], ch.get("trigger_ms"))
            changed = True
        elif st == "pending" and ch.get("respond_by_ms", 0) < now_ms:
            ch["status"] = "expired"
            log_entries.append({"event": "selfie_expired", "ts_ms": now_ms, "challenge_id": ch["id"]})
            logger.warning("selfie_expired session=%s challenge=%s", session.get("_id"), ch["id"])
            flagged = True
            changed = True
    if changed:
        await db.active_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"challenges": challenges, "log": log_entries[-500:], "flagged": flagged}},
        )
        session["challenges"] = challenges
        session["log"] = log_entries[-500:]
        session["flagged"] = flagged
    return changed


async def _tick_stale_session(db, session: dict, settings: dict, now_ms: int):
    """Detect ghost sessions where the client stopped pinging.

    - active + no ping for STALE_PING_MS ⇒ mark paused
    - paused for > resume_window_hours ⇒ expire and write attendance

    Returns (still_alive, session, outcome_or_None).
    """
    last_fix = session.get("last_fix") or {}
    last_ts = last_fix.get("ts_ms") or session.get("start_time_ms") or now_ms
    idle_ms = now_ms - last_ts
    status = session.get("status")
    resume_window_h = int(settings.get("resume_window_hours", 10))
    resume_ms = resume_window_h * 3600 * 1000

    if status == "active" and idle_ms > STALE_PING_MS:
        paused_at = last_ts  # went stale at the last ping time
        log_entries = list(session.get("log", []))
        log_entries.append({"event": "stale_paused", "ts_ms": now_ms, "idle_ms": idle_ms})
        await db.active_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"status": "paused", "paused_at": paused_at, "log": log_entries[-500:]}},
        )
        session["status"] = "paused"
        session["paused_at"] = paused_at
        session["log"] = log_entries[-500:]
        status = "paused"
        logger.info("session_stale_paused session=%s user=%s idle_s=%s",
                    session.get("_id"), session.get("user_id"), int(idle_ms / 1000))

    if status == "paused":
        paused_at = session.get("paused_at") or last_ts
        if now_ms - paused_at > resume_ms:
            log_entries = list(session.get("log", []))
            log_entries.append({"event": "expired_stale", "ts_ms": now_ms})
            session["log"] = log_entries[-500:]
            await _write_attendance_record(db, session, "expired", now_ms)
            await db.active_sessions.delete_one({"_id": session["_id"]})
            logger.warning("session_expired_stale session=%s user=%s",
                           session.get("_id"), session.get("user_id"))
            return False, session, "expired"

    return True, session, None


async def _broadcast_session(db, session: dict, ended: bool = False, outcome: str | None = None):
    """Publish a session state change to admins connected via WebSocket."""
    emp = None
    try:
        emp = await db.users.find_one({"_id": ObjectId(session["user_id"])})
    except Exception:
        emp = None
    payload = {
        "type": "session.end" if ended else "session.update",
        "session": {
            **_sanitize_session(session),
            "employee_name": (emp or {}).get("name", ""),
            "employee_email": (emp or {}).get("email", ""),
        },
    }
    if outcome:
        payload["outcome"] = outcome
    await ws_manager.broadcast(session["org_id"], payload)


async def _write_attendance_record(db, session: dict, outcome: str, ended_at_ms: int):
    """Write immutable attendance record with hash chain."""
    total_inside = session.get("total_inside_ms", 0)
    last_record = await db.attendance_records.find_one(
        {"org_id": session["org_id"]},
        sort=[("ended_at", -1)],
    )
    prev_hash = (last_record or {}).get("record_hash", "0" * 64)
    payload = {
        "org_id": session["org_id"],
        "user_id": session["user_id"],
        "office_id": session["office_id"],
        "session_snapshot": {
            "start_time": session["start_time"],
            "center": session["center"],
            "log": session.get("log", []),
        },
        "total_inside_ms": total_inside,
        "bout_count": session.get("bout_count", 0),
        "started_at": session["start_time"],
        "ended_at": datetime.fromtimestamp(ended_at_ms / 1000, tz=timezone.utc).isoformat(),
        "outcome": outcome,
        "flagged": session.get("flagged", False),
        "prev_record_hash": prev_hash,
    }
    payload_str = json.dumps(payload, sort_keys=True, default=str)
    payload["record_hash"] = hashlib.sha256(payload_str.encode()).hexdigest()
    await db.attendance_records.insert_one(payload)


@router.post("/auto-start")
async def auto_start_session(payload: SessionAutoStart, request: Request, user: dict = Depends(get_current_user)):
    """Silently start a session when the employee's device detects they're inside the geofence.

    No photo required upfront — the first random selfie challenge acts as
    proof-of-presence during the shift.
    """
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Only employees can start sessions")
    db = get_db()
    settings = await _get_org_settings(db, user["org_id"])
    if not settings.get("auto_start_on_entry", True):
        raise HTTPException(status_code=400, detail="Auto-start is disabled for your org.")

    if not user.get("office_id"):
        raise HTTPException(status_code=400, detail="No office assigned")
    try:
        office = await db.offices.find_one({"_id": ObjectId(user["office_id"]), "org_id": user["org_id"]})
    except Exception:
        office = None
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    session_duration_ms, schedule_err = await _compute_schedule_duration_ms(db, user, settings)
    if schedule_err:
        raise HTTPException(status_code=403, detail=schedule_err)

    accuracy_tol = settings.get("accuracy_tolerance_meters", 50)
    if payload.accuracy > accuracy_tol:
        raise HTTPException(status_code=400, detail=f"GPS accuracy too low ({payload.accuracy:.0f}m).")
    office_lat = office["location"]["coordinates"][1]
    office_lng = office["location"]["coordinates"][0]
    dist = haversine_meters(payload.lat, payload.lng, office_lat, office_lng)
    if dist > office["radius_meters"]:
        raise HTTPException(status_code=403, detail=f"Not inside office ({int(dist)}m from center).")

    if await db.active_sessions.find_one({"user_id": user["id"]}):
        raise HTTPException(status_code=400, detail="Session already active.")

    now_ms = _now_ms()
    doc = {
        "org_id": user["org_id"], "user_id": user["id"], "office_id": user["office_id"],
        "center": {"lat": payload.lat, "lng": payload.lng, "radius_m": office["radius_meters"]},
        "start_time": _now_iso(), "start_time_ms": now_ms,
        "remaining_ms": session_duration_ms, "current_bout_start_ms": now_ms,
        "status": "active", "paused_at": None,
        "last_fix": {"lat": payload.lat, "lng": payload.lng, "accuracy": payload.accuracy, "ts_ms": now_ms},
        "bout_count": 1, "total_inside_ms": 0, "flagged": False,
        "device_fingerprint": payload.device_fingerprint, "auto_started": True,
        "challenges": _plan_challenges(settings, now_ms, session_duration_ms),
        "log": [{"event": "auto_start", "ts_ms": now_ms, "lat": payload.lat, "lng": payload.lng}],
    }
    res = await db.active_sessions.insert_one(doc)
    doc["_id"] = res.inserted_id
    await db.gps_pings.insert_one({
        "org_id": user["org_id"], "user_id": user["id"], "session_id": str(res.inserted_id),
        "ts": datetime.now(timezone.utc), "lat": payload.lat, "lng": payload.lng,
        "accuracy": payload.accuracy, "speed": None, "flagged": False,
    })
    await _broadcast_session(db, doc)
    return _sanitize_session(doc)


@router.post("/challenge/{challenge_id}/respond")
async def respond_challenge(challenge_id: str, payload: ChallengeResponse, user: dict = Depends(get_current_user)):
    """Employee uploads a selfie in response to an active challenge."""
    db = get_db()
    s = await db.active_sessions.find_one({"user_id": user["id"], "org_id": user["org_id"]})
    if not s:
        raise HTTPException(status_code=404, detail="No active session")
    now_ms = _now_ms()
    challenges = list(s.get("challenges") or [])
    ch = next((c for c in challenges if c.get("id") == challenge_id), None)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if ch.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is already {ch.get('status')}")
    if ch.get("respond_by_ms", 0) < now_ms:
        ch["status"] = "expired"
        await db.active_sessions.update_one({"_id": s["_id"]}, {"$set": {"challenges": challenges, "flagged": True}})
        raise HTTPException(status_code=400, detail="Response window expired")

    photo_key = f"{s['_id']}::{challenge_id}"
    ok = await save_session_photo(photo_key, user["org_id"], user["id"], payload.face_photo)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid photo")

    # Face match verification if the employee has enrolled a baseline
    baseline = user.get("face_baseline")
    match_result = None
    if baseline:
        from services.face_match import verify as verify_face
        match_result = verify_face(baseline, payload.face_photo)
        if not match_result["match"]:
            ch["status"] = "mismatch"
            ch["responded_at_ms"] = now_ms
            ch["photo_saved"] = True
            ch["similarity"] = match_result["similarity"]
            log_entries = list(s.get("log", []))
            log_entries.append({
                "event": "selfie_mismatch", "ts_ms": now_ms,
                "challenge_id": challenge_id, "similarity": match_result["similarity"],
            })
            await db.active_sessions.update_one(
                {"_id": s["_id"]},
                {"$set": {"challenges": challenges, "log": log_entries[-500:], "flagged": True}},
            )
            await log_security_event(
                "face_mismatch", "high", "",
                {"challenge_id": challenge_id, "session_id": str(s["_id"]),
                 "similarity": match_result["similarity"], "reason": match_result.get("reason")},
                org_id=user["org_id"], user_id=user["id"],
            )
            raise HTTPException(status_code=403, detail=f"Face does not match your enrolled baseline (similarity {match_result['similarity']:.2f}). Session flagged.")

    ch["status"] = "responded"
    ch["responded_at_ms"] = now_ms
    ch["photo_saved"] = True
    if match_result:
        ch["similarity"] = match_result["similarity"]
    log_entries = list(s.get("log", []))
    log_entries.append({"event": "selfie_responded", "ts_ms": now_ms, "challenge_id": challenge_id})
    await db.active_sessions.update_one(
        {"_id": s["_id"]},
        {"$set": {"challenges": challenges, "log": log_entries[-500:]}},
    )
    new_s = await db.active_sessions.find_one({"_id": s["_id"]})
    await _broadcast_session(db, new_s)
    return _sanitize_session(new_s)


@router.post("/start")
async def start_session(payload: SessionStart, request: Request, user: dict = Depends(get_current_user)):
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Only employees can start sessions")
    db = get_db()
    if not user.get("office_id"):
        raise HTTPException(status_code=400, detail="No office assigned")

    try:
        office = await db.offices.find_one({"_id": ObjectId(user["office_id"]), "org_id": user["org_id"]})
    except Exception:
        office = None
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    settings = await _get_org_settings(db, user["org_id"])
    accuracy_tol = settings.get("accuracy_tolerance_meters", 50)

    # Compute session duration from employee schedule (fallback: org default).
    session_duration_ms, schedule_err = await _compute_schedule_duration_ms(db, user, settings)
    if schedule_err:
        await log_security_event(
            "schedule_denied", "low", client_ip(request),
            {"reason": schedule_err, "schedule_mode": (user.get("schedule") or {}).get("mode", "any")},
            org_id=user["org_id"], user_id=user["id"],
        )
        raise HTTPException(status_code=403, detail=schedule_err)

    # Anti-spoof: accuracy check
    if payload.accuracy > accuracy_tol:
        await log_security_event(
            "low_accuracy_start", "medium", client_ip(request),
            {"accuracy": payload.accuracy, "tolerance": accuracy_tol},
            org_id=user["org_id"], user_id=user["id"],
        )
        raise HTTPException(status_code=400, detail=f"GPS accuracy too low ({payload.accuracy:.0f}m). Move to an open area.")

    # Geofence check vs assigned office
    office_lat = office["location"]["coordinates"][1]
    office_lng = office["location"]["coordinates"][0]
    dist = haversine_meters(payload.lat, payload.lng, office_lat, office_lng)
    if dist > office["radius_meters"]:
        await log_security_event(
            "geofence_denied", "low", client_ip(request),
            {"distance_m": dist, "radius_m": office["radius_meters"], "office_id": user["office_id"]},
            org_id=user["org_id"], user_id=user["id"],
        )
        raise HTTPException(status_code=403, detail=f"Signing denied — you are {int(dist)}m from the office (radius {office['radius_meters']}m).")

    # Any existing session for this user?
    existing = await db.active_sessions.find_one({"user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Session already active. Reset first.")

    now_ms = _now_ms()
    center = {"lat": payload.lat, "lng": payload.lng, "radius_m": office["radius_meters"]}
    doc = {
        "org_id": user["org_id"],
        "user_id": user["id"],
        "office_id": user["office_id"],
        "center": center,
        "start_time": _now_iso(),
        "start_time_ms": now_ms,
        "remaining_ms": session_duration_ms,
        "current_bout_start_ms": now_ms,
        "status": "active",
        "paused_at": None,
        "last_fix": {"lat": payload.lat, "lng": payload.lng, "accuracy": payload.accuracy, "ts_ms": now_ms},
        "bout_count": 1,
        "total_inside_ms": 0,
        "flagged": False,
        "device_fingerprint": payload.device_fingerprint,
        "auto_started": False,
        "challenges": _plan_challenges(settings, now_ms, session_duration_ms),
        "log": [{"event": "start", "ts_ms": now_ms, "lat": payload.lat, "lng": payload.lng}],
    }
    try:
        res = await db.active_sessions.insert_one(doc)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot start session: {e}")
    doc["_id"] = res.inserted_id
    # Persist the check-in face photo (best-effort — a decode failure isn't fatal)
    photo_ok = False
    if payload.face_photo:
        photo_ok = await save_session_photo(str(res.inserted_id), user["org_id"], user["id"], payload.face_photo)
        if photo_ok:
            doc["has_photo"] = True
            await db.active_sessions.update_one({"_id": res.inserted_id}, {"$set": {"has_photo": True}})

    # Store the ping
    await db.gps_pings.insert_one({
        "org_id": user["org_id"], "user_id": user["id"], "session_id": str(res.inserted_id),
        "ts": datetime.now(timezone.utc), "lat": payload.lat, "lng": payload.lng,
        "accuracy": payload.accuracy, "speed": None, "flagged": False,
    })
    await _broadcast_session(db, doc)
    return _sanitize_session(doc)


@router.post("/ping")
async def ping_session(payload: SessionPing, request: Request, user: dict = Depends(get_current_user)):
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Only employees can ping")
    db = get_db()
    s = await db.active_sessions.find_one({"user_id": user["id"], "org_id": user["org_id"]})
    if not s:
        raise HTTPException(status_code=404, detail="No active session")

    settings = await _get_org_settings(db, user["org_id"])
    resume_window_h = settings.get("resume_window_hours", 10)
    accuracy_tol = settings.get("accuracy_tolerance_meters", 50)
    max_speed = settings.get("max_speed_kmh", 200)

    now_ms = _now_ms()
    last = s.get("last_fix") or {}
    analysis = analyze_ping(
        payload.lat, payload.lng, payload.accuracy,
        last.get("lat"), last.get("lng"), last.get("ts_ms"),
        now_ms, accuracy_tol, max_speed,
    )

    # Compute new state
    dist_from_center = haversine_meters(payload.lat, payload.lng, s["center"]["lat"], s["center"]["lng"])
    inside = dist_from_center <= s["center"]["radius_m"]
    status = s["status"]
    remaining = s["remaining_ms"]
    bout_start = s.get("current_bout_start_ms", now_ms)
    bout_count = s.get("bout_count", 1)
    total_inside = s.get("total_inside_ms", 0)
    log_entries = list(s.get("log", []))
    paused_at = s.get("paused_at")
    flagged = s.get("flagged", False)

    # If low_accuracy → ignore this ping's spatial data but count time
    ignore_spatial = "low_accuracy" in analysis["flags"]
    if analysis["flags"]:
        flagged = True

    # Only count time as "inside" when the previous state was active AND the
    # current ping is still inside the geofence. Otherwise we'd bill outside-time
    # as work time on the interval where the employee actually crossed the boundary.
    if last.get("ts_ms") and status == "active" and (ignore_spatial or inside):
        dt = now_ms - last["ts_ms"]
        if dt > 0:
            remaining = max(0, remaining - dt)
            total_inside += dt

    outcome = None
    ended = False

    if remaining <= 0:
        # completed
        status = "completed"
        log_entries.append({"event": "completed", "ts_ms": now_ms})
        outcome = "completed"
        ended = True
    elif not ignore_spatial:
        if inside and status == "paused":
            # Check resume window
            if paused_at and (now_ms - paused_at) > resume_window_h * 3600 * 1000:
                status = "expired"
                log_entries.append({"event": "expired_resume_window", "ts_ms": now_ms})
                outcome = "expired"
                ended = True
            else:
                status = "active"
                bout_count += 1
                bout_start = now_ms
                paused_at = None
                log_entries.append({"event": "resume", "ts_ms": now_ms, "lat": payload.lat, "lng": payload.lng})
        elif not inside and status == "active":
            status = "paused"
            paused_at = now_ms
            log_entries.append({"event": "pause_exit", "ts_ms": now_ms, "lat": payload.lat, "lng": payload.lng, "distance_m": int(dist_from_center)})
        elif not inside and status == "paused":
            # Still outside — check if resume window elapsed
            if paused_at and (now_ms - paused_at) > resume_window_h * 3600 * 1000:
                status = "expired"
                log_entries.append({"event": "expired_resume_window", "ts_ms": now_ms})
                outcome = "expired"
                ended = True

    update = {
        "status": status,
        "remaining_ms": remaining,
        "current_bout_start_ms": bout_start,
        "bout_count": bout_count,
        "total_inside_ms": total_inside,
        "paused_at": paused_at,
        "last_fix": {"lat": payload.lat, "lng": payload.lng, "accuracy": payload.accuracy, "ts_ms": now_ms},
        "log": log_entries[-500:],
        "flagged": flagged,
    }

    # Selfie challenge lifecycle: trigger planned + expire overdue
    challenges = list(s.get("challenges") or [])
    resp_window_min = int(settings.get("selfie_response_window_minutes", 5))
    for ch in challenges:
        if ch.get("status") == "planned" and ch.get("trigger_ms", 0) <= now_ms:
            ch["status"] = "pending"
            ch["prompted_at_ms"] = now_ms
            ch["respond_by_ms"] = now_ms + resp_window_min * 60 * 1000
        elif ch.get("status") == "pending" and ch.get("respond_by_ms", 0) < now_ms:
            ch["status"] = "expired"
            flagged = True
            update["flagged"] = True
            log_entries.append({"event": "selfie_expired", "ts_ms": now_ms, "challenge_id": ch["id"]})
            await log_security_event(
                "selfie_missed", "high", client_ip(request),
                {"challenge_id": ch["id"], "session_id": str(s["_id"])},
                org_id=user["org_id"], user_id=user["id"],
            )
            owner = await db.users.find_one({"org_id": user["org_id"], "role": "org_owner"})
            if owner and settings.get("notify_admin_on_spoof", True):
                html = render_alert_email(
                    "Missed selfie check-in",
                    [f"Employee: {user['name']} ({user['email']})",
                     f"Response window: {resp_window_min} minutes",
                     "The employee did not respond to a random selfie challenge in time — session flagged."],
                )
                await send_email(owner["email"], "Geofence Console — missed selfie challenge", html)
    update["challenges"] = challenges
    update["log"] = log_entries[-500:]

    if analysis["flags"]:
        await log_security_event(
            "spoof_flag", "high" if "impossible_speed" in analysis["flags"] else "medium",
            client_ip(request),
            {"flags": analysis["flags"], "reason": analysis["reason"], "speed_kmh": analysis["speed_kmh"]},
            org_id=user["org_id"], user_id=user["id"],
        )
        settings_notify = settings.get("notify_admin_on_spoof", True)
        if settings_notify and "impossible_speed" in analysis["flags"]:
            # Notify org owner (best-effort, async)
            owner = await db.users.find_one({"org_id": user["org_id"], "role": "org_owner"})
            if owner:
                html = render_alert_email(
                    "Impossible movement detected",
                    [
                        f"Employee: {user['name']} ({user['email']})",
                        f"Reason: {analysis['reason']}",
                        f"Speed: {analysis['speed_kmh']:.1f} km/h" if analysis["speed_kmh"] else "",
                    ],
                )
                await send_email(owner["email"], "Geofence Console — spoof detection", html)

    # Store ping
    await db.gps_pings.insert_one({
        "org_id": user["org_id"], "user_id": user["id"], "session_id": str(s["_id"]),
        "ts": datetime.now(timezone.utc), "lat": payload.lat, "lng": payload.lng,
        "accuracy": payload.accuracy, "speed": analysis["speed_kmh"], "flagged": bool(analysis["flags"]),
    })

    if ended:
        # Move to attendance records + delete active
        final = {**s, **update}
        await _write_attendance_record(db, final, outcome, now_ms)
        await db.active_sessions.delete_one({"_id": s["_id"]})
        await _broadcast_session(db, final, ended=True, outcome=outcome)
        return {**_sanitize_session({**s, **update}), "ended": True, "outcome": outcome}

    await db.active_sessions.update_one({"_id": s["_id"]}, {"$set": update})
    merged = {**s, **update}
    await _broadcast_session(db, merged)
    return _sanitize_session(merged)


@router.post("/reset")
async def reset_session(user: dict = Depends(get_current_user)):
    db = get_db()
    s = await db.active_sessions.find_one({"user_id": user["id"], "org_id": user["org_id"]})
    if not s:
        return {"ok": True}
    await _write_attendance_record(db, s, "reset", _now_ms())
    await db.active_sessions.delete_one({"_id": s["_id"]})
    await _broadcast_session(db, s, ended=True, outcome="reset")
    return {"ok": True}


@router.get("/me")
async def my_session(user: dict = Depends(get_current_user)):
    db = get_db()
    s = await db.active_sessions.find_one({"user_id": user["id"], "org_id": user["org_id"]})
    if not s:
        return None
    settings = await _get_org_settings(db, user["org_id"])
    now_ms = _now_ms()
    # Fire due challenges even if no ping has arrived yet
    await _tick_challenge_lifecycle(db, s, settings, now_ms)
    # Stale/ghost session detection
    alive, s, outcome = await _tick_stale_session(db, s, settings, now_ms)
    if not alive:
        await _broadcast_session(db, s, ended=True, outcome=outcome)
        return None
    return _sanitize_session(s)


@router.get("/live")
async def live_sessions(user: dict = Depends(require_admin)):
    """All active sessions in the org (for admin dashboard).

    Also runs stale-detection and challenge-lifecycle ticks so that ghost
    sessions (client stopped pinging) don't linger and pending selfie
    challenges surface even when the employee tab is idle.
    """
    db = get_db()
    settings = await _get_org_settings(db, user["org_id"])
    now_ms = _now_ms()
    cur = db.active_sessions.find({"org_id": user["org_id"]})
    sessions = [s async for s in cur]
    result = []
    for s in sessions:
        await _tick_challenge_lifecycle(db, s, settings, now_ms)
        alive, s, outcome = await _tick_stale_session(db, s, settings, now_ms)
        if not alive:
            await _broadcast_session(db, s, ended=True, outcome=outcome)
            continue
        emp = await db.users.find_one({"_id": ObjectId(s["user_id"])})
        result.append({
            **_sanitize_session(s),
            "employee_name": (emp or {}).get("name", "Unknown"),
            "employee_email": (emp or {}).get("email", ""),
            "stale": (now_ms - (s.get("last_fix") or {}).get("ts_ms", now_ms)) > STALE_PING_MS,
        })
    return result


@router.post("/challenge-now/{user_id}")
async def trigger_challenge_now(user_id: str, request: Request, user: dict = Depends(require_admin)):
    """Admin-triggered on-demand selfie challenge for an active employee session."""
    db = get_db()
    s = await db.active_sessions.find_one({"user_id": user_id, "org_id": user["org_id"]})
    if not s:
        raise HTTPException(status_code=404, detail="No active session for this employee")
    settings = await _get_org_settings(db, user["org_id"])
    resp_window_min = int(settings.get("selfie_response_window_minutes", 5))
    now_ms = _now_ms()
    challenges = list(s.get("challenges") or [])
    # Refuse if there is already an unresponded pending challenge — avoid stacking
    open_ch = next((c for c in challenges
                    if c.get("status") == "pending" and c.get("respond_by_ms", 0) > now_ms), None)
    if open_ch:
        raise HTTPException(status_code=400, detail="Employee already has an open selfie challenge.")
    new_challenge = {
        "id": uuid.uuid4().hex[:12],
        "trigger_ms": now_ms,
        "status": "pending",
        "prompted_at_ms": now_ms,
        "respond_by_ms": now_ms + resp_window_min * 60 * 1000,
        "responded_at_ms": None,
        "photo_saved": False,
        "manual": True,
    }
    challenges.append(new_challenge)
    log_entries = list(s.get("log", []))
    log_entries.append({"event": "selfie_prompted_manual", "ts_ms": now_ms, "challenge_id": new_challenge["id"]})
    await db.active_sessions.update_one(
        {"_id": s["_id"]},
        {"$set": {"challenges": challenges, "log": log_entries[-500:]}},
    )
    new_s = await db.active_sessions.find_one({"_id": s["_id"]})
    await _broadcast_session(db, new_s)
    logger.info("manual_selfie_challenge admin=%s target_user=%s challenge=%s",
                user.get("email"), user_id, new_challenge["id"])
    from services.audit import log_admin_action
    await log_admin_action(
        user["org_id"], user["id"], "session.manual_challenge", "session", str(s["_id"]),
        after={"user_id": user_id, "challenge_id": new_challenge["id"]},
        ip=client_ip(request), user_agent=request.headers.get("user-agent", ""),
    )
    return _sanitize_session(new_s)


@router.post("/force-expire/{user_id}")
async def force_expire(user_id: str, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    s = await db.active_sessions.find_one({"user_id": user_id, "org_id": user["org_id"]})
    if not s:
        raise HTTPException(status_code=404, detail="No active session")
    await _write_attendance_record(db, s, "force_expired", _now_ms())
    await db.active_sessions.delete_one({"_id": s["_id"]})
    await _broadcast_session(db, s, ended=True, outcome="force_expired")
    from services.audit import log_admin_action
    await log_admin_action(
        user["org_id"], user["id"], "session.force_expire", "session", str(s["_id"]),
        before={"user_id": user_id}, ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    return {"ok": True}
