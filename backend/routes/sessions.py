"""Session state machine: start, ping, reset, live tracking.

Server-authoritative — all state transitions decided here from GPS pings.
"""
import hashlib
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId

from db import get_db
from models import SessionStart, SessionPing
from deps import get_current_user, require_admin, client_ip
from services.geo import haversine_meters, analyze_ping
from services.audit import log_security_event
from services.email import send_email, render_alert_email
from services.ws_manager import manager as ws_manager
from services.photos import save_session_photo, has_photo
import os

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _compute_schedule_duration_ms(user_doc: dict, org_settings: dict) -> tuple[int, str | None]:
    """Given the employee's schedule + org defaults, return (remaining_ms, error_or_None).

    Returns:
        (duration_ms, None) — allowed, use duration_ms for session
        (0, "reason") — deny session start with reason
    """
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
    }


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
    session_duration_ms, schedule_err = _compute_schedule_duration_ms(user, settings)
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
    return _sanitize_session(s)


@router.get("/live")
async def live_sessions(user: dict = Depends(require_admin)):
    """All active sessions in the org (for admin dashboard)."""
    db = get_db()
    cur = db.active_sessions.find({"org_id": user["org_id"]})
    result = []
    async for s in cur:
        emp = await db.users.find_one({"_id": ObjectId(s["user_id"])})
        result.append({
            **_sanitize_session(s),
            "employee_name": (emp or {}).get("name", "Unknown"),
            "employee_email": (emp or {}).get("email", ""),
        })
    return result


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
