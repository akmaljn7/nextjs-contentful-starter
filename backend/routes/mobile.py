"""Mobile app endpoints (Phase 0).

Additive-only. Existing web dashboard and session/state-machine logic are
untouched — the mobile geofence-event endpoint routes into the same
auto-start / ping helpers used by the web PWA.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from db import get_db
from deps import get_current_user, client_ip
from models import (
    MobileDeviceRegister,
    MobileGeofenceEvent,
    MobileBulkSync,
    MobileHeartbeat,
    MobileAttestation,
    MobileLocationFix,
    MobileLocationBulk,
    MobileDeviceBind,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mobile", tags=["mobile"])


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Coverage-gap detection: a run of missing fixes means the app stopped running
# (phone powered off / app killed). Gaps longer than this while a session is
# active are flagged and NOT counted as work time.
COVERAGE_GAP_MS = 10 * 60 * 1000
# If battery just before the gap was below this, the shutdown was probably a
# dead battery (benign) rather than an intentional power-off (suspicious).
BATTERY_DEAD_THRESHOLD = 0.20


def _coverage_gap_entry(gap_id: str, from_ms: int, to_ms: int, battery_before, battery_after) -> dict:
    return {
        "event": "coverage_gap",
        "id": gap_id,
        "from_ms": from_ms,
        "to_ms": to_ms,
        "gap_ms": to_ms - from_ms,
        "battery_before": battery_before,
        "battery_after": battery_after,
        "likely_battery_died": bool(battery_before is not None and battery_before < BATTERY_DEAD_THRESHOLD),
        "status": "pending",
        "ts_ms": to_ms,
    }


# ---------------------------------------------------------------------------
# Device registration
# ---------------------------------------------------------------------------
@router.post("/register-device")
async def register_device(
    payload: MobileDeviceRegister,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Idempotent upsert. Called on login and on push-token refresh."""
    db = get_db()
    now_iso = _now_iso()
    filt = {"user_id": user["id"], "device_id": payload.device_id}
    doc = {
        "org_id": user["org_id"],
        "user_id": user["id"],
        "device_id": payload.device_id,
        "platform": payload.platform,
        "push_token": payload.push_token,
        "app_version": payload.app_version,
        "os_version": payload.os_version,
        "tz": payload.tz,
        "locale": payload.locale,
        "model": payload.model,
        "last_seen_at": now_iso,
        "ip": client_ip(request),
        "user_agent": request.headers.get("user-agent", "")[:200],
        "deleted_at": None,
    }
    res = await db.mobile_devices.update_one(
        filt,
        {"$set": doc, "$setOnInsert": {"created_at": now_iso}},
        upsert=True,
    )
    logger.info(
        "mobile_device_registered user=%s device=%s platform=%s upserted=%s push_token=%s",
        user.get("email"), payload.device_id, payload.platform,
        bool(res.upserted_id), "yes" if payload.push_token else "no",
    )
    return {"ok": True, "created": bool(res.upserted_id)}


@router.delete("/register-device/{device_id}")
async def unregister_device(device_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    r = await db.mobile_devices.update_one(
        {"user_id": user["id"], "device_id": device_id},
        {"$set": {"deleted_at": _now_iso(), "push_token": None}},
    )
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Device not registered")
    logger.info("mobile_device_unregistered user=%s device=%s", user.get("email"), device_id)
    return {"ok": True}


@router.get("/devices")
async def list_my_devices(user: dict = Depends(get_current_user)):
    db = get_db()
    out = []
    async for d in db.mobile_devices.find(
        {"user_id": user["id"], "deleted_at": None},
        {"push_token": 0, "user_agent": 0, "ip": 0},
    ):
        d["id"] = str(d.pop("_id"))
        out.append(d)
    return out


# ---------------------------------------------------------------------------
# Geofence events (single + bulk sync)
# ---------------------------------------------------------------------------
async def _dedupe_and_store_event(
    db, user: dict, event: MobileGeofenceEvent
) -> tuple[str, dict]:
    """Store event with idempotency; return (status, doc).

    status ∈ {"new", "duplicate"}. Uses client_event_id as unique key so
    retries from an offline queue are safe. Uses insert-then-catch-dup for
    race safety instead of check-then-insert.
    """
    now_dt = datetime.now(timezone.utc)
    doc = {
        "org_id": user["org_id"],
        "user_id": user["id"],
        "device_id": event.device_id,
        "client_event_id": event.client_event_id,
        "type": event.type,
        "ts_ms": event.ts_ms,
        "office_id": event.office_id,
        "lat": event.lat,
        "lng": event.lng,
        "accuracy": event.accuracy,
        "mock_location": event.mock_location,
        "from_boot": event.from_boot,
        "battery": event.battery,
        "attestation": event.attestation,
        "received_at": now_dt.isoformat(),
        "received_at_dt": now_dt,  # datetime → TTL index actually fires
        "processed_at": None,
        "session_outcome": None,
    }
    try:
        res = await db.mobile_events.insert_one(doc)
        doc["_id"] = res.inserted_id
        return "new", doc
    except DuplicateKeyError:
        existing = await db.mobile_events.find_one({
            "user_id": user["id"],
            "client_event_id": event.client_event_id,
        })
        return "duplicate", (existing or doc)


async def _apply_geofence_event(db, user: dict, event: MobileGeofenceEvent) -> dict:
    """Route mobile event into the existing session state machine.

    Design decision: mobile events are semantically equivalent to a
    high-accuracy /ping (for `exit`) or /auto-start (for `enter`), but with
    the event's own timestamp instead of "now" so an indoor-delayed
    notification doesn't distort attendance times.
    """
    # Import lazily to avoid circular imports at boot time
    from routes.sessions import (
        _sync_session_center_from_office, _get_org_settings, _plan_challenges,
        _write_attendance_record, _broadcast_session, _compute_schedule_duration_ms,
    )
    from services.audit import log_security_event
    from services.geo import haversine_meters

    # Fetch the office and current session
    try:
        office = await db.offices.find_one({"_id": ObjectId(event.office_id), "org_id": user["org_id"]})
    except Exception:
        office = None
    if not office:
        raise HTTPException(status_code=400, detail="Unknown office for this org")
    office_lat = office["location"]["coordinates"][1]
    office_lng = office["location"]["coordinates"][0]

    # Flag mock location as soft security event (Phase 6 will make this stricter)
    if event.mock_location:
        await log_security_event(
            type_="mock_location_flag",
            severity="high",
            ip="",
            details={
                "type": event.type, "device_id": event.device_id,
                "client_event_id": event.client_event_id,
                "lat": event.lat, "lng": event.lng, "office_id": event.office_id,
            },
            org_id=user["org_id"],
            user_id=user["id"],
        )
        logger.warning("mock_location_detected user=%s event=%s", user.get("email"), event.client_event_id)

    session = await db.active_sessions.find_one({"user_id": user["id"], "org_id": user["org_id"]})

    if event.type == "enter" or event.type == "cold_start_reconcile":
        # If there is no active session AND the device is inside the geofence,
        # synthesize an auto-start. Uses event.ts_ms as the effective start
        # time (not "now"), so indoor delivery lag doesn't shift the record.
        dist_from_center = haversine_meters(event.lat, event.lng, office_lat, office_lng)
        if not session and dist_from_center <= office["radius_meters"]:
            settings = await _get_org_settings(db, user["org_id"])
            user_doc = await db.users.find_one({"_id": ObjectId(user["id"])})
            user_doc["id"] = str(user_doc["_id"])
            duration_ms, deny_reason = await _compute_schedule_duration_ms(db, user_doc, settings)
            if deny_reason:
                logger.info("mobile_enter_denied user=%s reason=%s", user.get("email"), deny_reason)
                return {"outcome": "denied", "reason": deny_reason}
            challenges = _plan_challenges(settings, event.ts_ms, duration_ms)
            doc = {
                "org_id": user["org_id"],
                "user_id": user["id"],
                "office_id": str(office["_id"]),
                "center": {"lat": office_lat, "lng": office_lng, "radius_m": office["radius_meters"]},
                "start_time": datetime.fromtimestamp(event.ts_ms / 1000, tz=timezone.utc).isoformat(),
                "start_time_ms": event.ts_ms,
                "remaining_ms": duration_ms,
                "total_inside_ms": 0,
                "current_bout_start_ms": event.ts_ms,
                "bout_count": 1,
                "status": "active",
                "flagged": False,
                "paused_at": None,
                "challenges": challenges,
                "last_fix": {"lat": event.lat, "lng": event.lng, "accuracy": event.accuracy, "ts_ms": event.ts_ms},
                "log": [{"event": "auto_start_mobile", "ts_ms": event.ts_ms,
                         "client_event_id": event.client_event_id, "from_boot": event.from_boot}],
                "source": "mobile",
            }
            res = await db.active_sessions.insert_one(doc)
            doc["_id"] = res.inserted_id
            await _broadcast_session(db, doc)
            logger.info("mobile_auto_start user=%s office=%s at=%s from_boot=%s",
                        user.get("email"), office["name"], event.ts_ms, event.from_boot)
            return {"outcome": "session_started", "session": {"id": str(doc["_id"]), "status": "active"}}

        # Already active — treat as a resume ping
        if session:
            await _sync_session_center_from_office(db, session)
            # If paused → resume (write log entry, flip status)
            if session.get("status") == "paused":
                await db.active_sessions.update_one(
                    {"_id": session["_id"]},
                    {"$set": {"status": "active", "current_bout_start_ms": event.ts_ms,
                              "last_fix": {"lat": event.lat, "lng": event.lng,
                                           "accuracy": event.accuracy, "ts_ms": event.ts_ms}},
                     "$inc": {"bout_count": 1},
                     "$push": {"log": {"event": "resume_mobile", "ts_ms": event.ts_ms,
                                       "client_event_id": event.client_event_id}}},
                )
                new_s = await db.active_sessions.find_one({"_id": session["_id"]})
                await _broadcast_session(db, new_s)
                logger.info("mobile_resume user=%s session=%s", user.get("email"), session["_id"])
                return {"outcome": "session_resumed", "session": {"id": str(session["_id"]), "status": "active"}}
            # Already active — just refresh last_fix
            await db.active_sessions.update_one(
                {"_id": session["_id"]},
                {"$set": {"last_fix": {"lat": event.lat, "lng": event.lng,
                                       "accuracy": event.accuracy, "ts_ms": event.ts_ms}}},
            )
            return {"outcome": "already_active", "session": {"id": str(session["_id"]), "status": "active"}}

        return {"outcome": "ignored_outside_geofence"}

    if event.type == "exit":
        if not session:
            return {"outcome": "no_active_session"}
        await _sync_session_center_from_office(db, session)
        settings = await _get_org_settings(db, user["org_id"])
        if session.get("status") == "active":
            if session.get("last_live_ts_ms"):
                # Live tracking is running and accrues time INCREMENTALLY, so
                # this exit is only a state flip — adding bout time here would
                # double-count. (Pure geofence-only sessions fall through to
                # the bout-based branch below.)
                total_inside = session.get("total_inside_ms", 0)
                remaining = session.get("remaining_ms", 0)
                bout_ms = 0
            else:
                # Compute bout duration and add to total_inside_ms
                bout_start = session.get("current_bout_start_ms", event.ts_ms)
                bout_ms = max(0, event.ts_ms - bout_start)
                total_inside = session.get("total_inside_ms", 0) + bout_ms
                remaining = max(0, session.get("remaining_ms", 0) - bout_ms)
            update = {
                "status": "paused",
                "paused_at": event.ts_ms,
                "total_inside_ms": total_inside,
                "remaining_ms": remaining,
                "last_fix": {"lat": event.lat, "lng": event.lng,
                             "accuracy": event.accuracy, "ts_ms": event.ts_ms},
            }
            await db.active_sessions.update_one(
                {"_id": session["_id"]},
                {"$set": update,
                 "$push": {"log": {"event": "pause_mobile", "ts_ms": event.ts_ms,
                                   "bout_ms": bout_ms,
                                   "client_event_id": event.client_event_id}}},
            )
            # If remaining hit 0, complete
            if remaining <= 0:
                new_s = await db.active_sessions.find_one({"_id": session["_id"]})
                await _write_attendance_record(db, new_s, "completed", event.ts_ms)
                await db.active_sessions.delete_one({"_id": session["_id"]})
                await _broadcast_session(db, new_s, ended=True, outcome="completed")
                logger.info("mobile_completed user=%s session=%s", user.get("email"), session["_id"])
                return {"outcome": "session_completed"}
            new_s = await db.active_sessions.find_one({"_id": session["_id"]})
            await _broadcast_session(db, new_s)
            logger.info("mobile_paused user=%s session=%s", user.get("email"), session["_id"])
            return {"outcome": "session_paused", "session": {"id": str(session["_id"]), "status": "paused"}}
        # Already paused — no-op
        return {"outcome": "already_paused"}

    return {"outcome": "unknown_event_type"}


@router.post("/geofence-event")
async def geofence_event(
    payload: MobileGeofenceEvent,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    status, doc = await _dedupe_and_store_event(db, user, payload)
    if status == "duplicate":
        logger.info("mobile_event_dedup user=%s cid=%s", user.get("email"), payload.client_event_id)
        return {"ok": True, "duplicate": True, "outcome": doc.get("session_outcome")}
    outcome = await _apply_geofence_event(db, user, payload)
    await db.mobile_events.update_one(
        {"_id": doc["_id"]},
        {"$set": {"processed_at": _now_iso(), "session_outcome": outcome.get("outcome")}},
    )
    return {"ok": True, "duplicate": False, **outcome}


@router.post("/sync")
async def bulk_sync(
    payload: MobileBulkSync,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Drain the offline queue in one call.

    Events are processed in chronological order (by ts_ms) so pauses/resumes
    replay coherently. Each event is idempotent via client_event_id.
    """
    db = get_db()
    ordered = sorted(payload.events, key=lambda e: e.ts_ms)
    processed: List[dict] = []
    dupes = 0
    for ev in ordered:
        status, doc = await _dedupe_and_store_event(db, user, ev)
        if status == "duplicate":
            dupes += 1
            processed.append({"client_event_id": ev.client_event_id, "duplicate": True,
                              "outcome": doc.get("session_outcome")})
            continue
        try:
            outcome = await _apply_geofence_event(db, user, ev)
        except HTTPException as e:
            outcome = {"outcome": "error", "detail": e.detail}
        await db.mobile_events.update_one(
            {"_id": doc["_id"]},
            {"$set": {"processed_at": _now_iso(), "session_outcome": outcome.get("outcome")}},
        )
        processed.append({"client_event_id": ev.client_event_id, "duplicate": False, **outcome})
    logger.info("mobile_bulk_sync user=%s count=%s dupes=%s",
                user.get("email"), len(payload.events), dupes)
    return {"ok": True, "processed": processed, "dupes": dupes}


# ---------------------------------------------------------------------------
# Device binding — tie an employee's account to one phone
# ---------------------------------------------------------------------------
@router.post("/device/bind")
async def device_bind(payload: MobileDeviceBind, request: Request, user: dict = Depends(get_current_user)):
    """Called on login. First device auto-binds; a different device creates a
    pending request that a manager must approve before the app unlocks."""
    db = get_db()
    udoc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not udoc or udoc.get("role") != "employee":
        return {"status": "authorized"}  # admins/owner are not device-bound
    bound = udoc.get("bound_device_id")
    did = payload.device_id
    if not bound:
        await db.users.update_one({"_id": udoc["_id"]}, {"$set": {"bound_device_id": did}})
        logger.info("device_bound_first user=%s device=%s", user.get("email"), did)
        return {"status": "authorized", "first_bind": True}
    if bound == did:
        return {"status": "authorized"}
    req = await db.device_requests.find_one(
        {"org_id": user["org_id"], "user_id": user["id"], "device_id": did},
        sort=[("created_at", -1)],
    )
    if req and req.get("status") == "approved":
        await db.users.update_one({"_id": udoc["_id"]}, {"$set": {"bound_device_id": did}})
        return {"status": "authorized"}
    if req and req.get("status") == "rejected":
        return {"status": "rejected"}
    if not req or req.get("status") not in ("pending",):
        await db.device_requests.insert_one({
            "id": uuid.uuid4().hex[:12], "org_id": user["org_id"], "user_id": user["id"],
            "device_id": did, "platform": payload.platform, "model": payload.model,
            "status": "pending", "created_at": _now_iso(),
            "reviewed_by": None, "reviewed_at": None,
        })
        logger.warning("device_request_created user=%s device=%s", user.get("email"), did)
    return {"status": "pending"}


@router.get("/device/status")
async def device_status(device_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    udoc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not udoc or udoc.get("role") != "employee":
        return {"status": "authorized"}
    bound = udoc.get("bound_device_id")
    if not bound or bound == device_id:
        return {"status": "authorized"}
    req = await db.device_requests.find_one(
        {"org_id": user["org_id"], "user_id": user["id"], "device_id": device_id},
        sort=[("created_at", -1)],
    )
    if req and req.get("status") == "approved":
        await db.users.update_one({"_id": udoc["_id"]}, {"$set": {"bound_device_id": device_id}})
        return {"status": "authorized"}
    if req and req.get("status") == "rejected":
        return {"status": "rejected"}
    return {"status": "pending"}


# ---------------------------------------------------------------------------
# Continuous background location (WhatsApp-style live tracking)
# ---------------------------------------------------------------------------
async def _apply_location_fix(db, user: dict, fix: MobileLocationFix) -> dict:
    """Ingest one continuous background-location fix and drive session state.

    Unlike native geofence enter/exit events (which never fire while a phone
    sleeps in a pocket on Samsung), the mobile foreground-service streams a
    fix every ~15s. So we decide inside/outside on EVERY fix here:

      * no session + inside (accuracy OK) -> auto-start
      * active + definitely outside        -> pause
      * active + inside/ambiguous          -> accrue time (like a ping)
      * paused + inside                    -> resume
      * paused + outside                   -> keep paused, just move the pin

    Every branch broadcasts the session so the admin live-map pin moves in
    real time. Also ticks the selfie-challenge lifecycle so selfies still fire.
    """
    from routes.sessions import (
        _sync_session_center_from_office, _get_org_settings, _plan_challenges,
        _write_attendance_record, _broadcast_session, _compute_schedule_duration_ms,
        _tick_challenge_lifecycle,
    )
    from services.audit import log_security_event
    from services.geo import haversine_meters

    user_doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    office_id = (user_doc or {}).get("office_id")
    if not office_id:
        return {"outcome": "no_office"}
    try:
        office = await db.offices.find_one({"_id": ObjectId(office_id), "org_id": user["org_id"]})
    except Exception:
        office = None
    if not office:
        return {"outcome": "no_office"}

    settings = await _get_org_settings(db, user["org_id"])
    now_ms = fix.ts_ms or _now_ms()
    office_lat = office["location"]["coordinates"][1]
    office_lng = office["location"]["coordinates"][0]
    radius = office["radius_meters"]
    accuracy_tol = settings.get("accuracy_tolerance_meters", 50)

    if fix.mock_location:
        await log_security_event(
            type_="mock_location_flag", severity="high", ip="",
            details={"source": "live_location", "device_id": fix.device_id,
                     "lat": fix.lat, "lng": fix.lng, "office_id": office_id},
            org_id=user["org_id"], user_id=user["id"],
        )

    last_fix = {"lat": fix.lat, "lng": fix.lng, "accuracy": fix.accuracy, "ts_ms": now_ms}
    session = await db.active_sessions.find_one({"user_id": user["id"], "org_id": user["org_id"]})

    # Idempotency watermark — skip any fix at/behind the newest one we've
    # already applied. Makes offline-batch replay (and lost-response retries)
    # perfectly safe: a resent batch never double-counts time or bouts.
    if session and session.get("last_live_ts_ms") and now_ms <= session["last_live_ts_ms"]:
        return {"outcome": "stale_replay"}

    # ---- No active session: auto-start if firmly inside with good accuracy ----
    if not session:
        dist = haversine_meters(fix.lat, fix.lng, office_lat, office_lng)
        if dist <= radius and fix.accuracy <= accuracy_tol:
            if not settings.get("auto_start_on_entry", True):
                return {"outcome": "auto_start_disabled"}
            duration_ms, deny_reason = await _compute_schedule_duration_ms(db, user_doc | {"id": user["id"]}, settings)
            if deny_reason:
                return {"outcome": "denied", "reason": deny_reason}
            challenges = _plan_challenges(settings, now_ms, duration_ms)
            doc = {
                "org_id": user["org_id"], "user_id": user["id"], "office_id": str(office["_id"]),
                "center": {"lat": office_lat, "lng": office_lng, "radius_m": radius},
                "start_time": datetime.fromtimestamp(now_ms / 1000, tz=timezone.utc).isoformat(),
                "start_time_ms": now_ms, "remaining_ms": duration_ms, "total_inside_ms": 0,
                "current_bout_start_ms": now_ms, "bout_count": 1, "status": "active",
                "flagged": False, "paused_at": None, "challenges": challenges,
                "last_fix": last_fix, "auto_started": True, "source": "live_location",
                "last_live_ts_ms": now_ms, "last_battery": fix.battery,
                "log": [{"event": "auto_start_live", "ts_ms": now_ms, "lat": fix.lat, "lng": fix.lng}],
            }
            res = await db.active_sessions.insert_one(doc)
            doc["_id"] = res.inserted_id
            await _broadcast_session(db, doc)
            logger.info("live_auto_start user=%s office=%s", user.get("email"), office["name"])
            return {"outcome": "session_started", "status": "active"}
        return {"outcome": "outside_no_session", "dist_m": int(dist)}

    # ---- Active session exists: recompute against the current office center ----
    await _sync_session_center_from_office(db, session)

    # Coverage-gap detection — did the device go dark (phone off / app killed)?
    # Key strictly off last_live_ts_ms so the FIRST live fix on a session that
    # was created elsewhere (e.g. web/geofence) never registers a false gap.
    prev_ts = session.get("last_live_ts_ms")
    gap_ms = (now_ms - prev_ts) if prev_ts else 0
    gap_detected = gap_ms > COVERAGE_GAP_MS
    if gap_detected:
        gid = uuid.uuid4().hex[:12]
        ge = _coverage_gap_entry(gid, prev_ts, now_ms, session.get("last_battery"), fix.battery)
        await db.active_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"flagged": True}, "$push": {"log": ge}},
        )
        session["flagged"] = True
        # Durable record so admins can review/approve/reject even after the
        # session ends, and so a colleague can attach a reason to it.
        await db.coverage_gaps.insert_one({
            "id": gid,
            "org_id": user["org_id"],
            "user_id": user["id"],
            "session_id": str(session["_id"]),
            "from_ms": prev_ts,
            "to_ms": now_ms,
            "gap_ms": gap_ms,
            "battery_before": session.get("last_battery"),
            "battery_after": fix.battery,
            "likely_battery_died": ge["likely_battery_died"],
            "status": "pending",
            "reason_note": None,
            "reason_by": None,
            "reason_at": None,
            "has_photo": False,
            "selfie_match": None,
            "selfie_similarity": None,
            "reviewed_by": None,
            "reviewed_at": None,
            "created_at": _now_iso(),
        })
        logger.warning(
            "coverage_gap session=%s user=%s gap_min=%.1f battery_before=%s likely_died=%s gap_id=%s",
            session["_id"], user.get("email"), gap_ms / 60000,
            session.get("last_battery"), ge["likely_battery_died"], gid,
        )

    center = session["center"]
    radius = center["radius_m"]
    dist = haversine_meters(fix.lat, fix.lng, center["lat"], center["lng"])
    inside = dist <= radius
    definitely_outside = dist > (radius + max(fix.accuracy or 0.0, 0.0))
    status = session.get("status")
    last = session.get("last_fix") or {}

    # Persist ping (best-effort, for history/anti-spoof trail)
    await db.gps_pings.insert_one({
        "org_id": user["org_id"], "user_id": user["id"], "session_id": str(session["_id"]),
        "ts": datetime.now(timezone.utc), "lat": fix.lat, "lng": fix.lng,
        "accuracy": fix.accuracy, "speed": fix.speed, "flagged": False, "source": "live",
    })

    if status == "active":
        if definitely_outside:
            # Crossing OUT. Time is accrued INCREMENTALLY on each inside fix
            # (see the else-branch below), so we must NOT add the whole bout
            # again here — that double-counts. Just flip to paused. This mirrors
            # the canonical /ping model in sessions.py.
            update = {"status": "paused", "paused_at": now_ms, "last_fix": last_fix,
                      "last_live_ts_ms": now_ms, "last_battery": fix.battery}
            await db.active_sessions.update_one(
                {"_id": session["_id"]},
                {"$set": update, "$push": {"log": {"event": "pause_live", "ts_ms": now_ms,
                                                    "distance_m": int(dist)}}},
            )
            new_s = await db.active_sessions.find_one({"_id": session["_id"]})
            await _broadcast_session(db, new_s)
            return {"outcome": "session_paused", "status": "paused"}
        # still inside (or ambiguous accuracy) -> accrue time incrementally,
        # EXCEPT across a coverage gap (device was dark — don't count it).
        remaining = session.get("remaining_ms", 0)
        total_inside = session.get("total_inside_ms", 0)
        if last.get("ts_ms") and inside and not gap_detected:
            dt = now_ms - last["ts_ms"]
            if dt > 0:
                remaining = max(0, remaining - dt)
                total_inside += dt
        update = {"remaining_ms": remaining, "total_inside_ms": total_inside, "last_fix": last_fix,
                  "last_live_ts_ms": now_ms, "last_battery": fix.battery}
        await db.active_sessions.update_one({"_id": session["_id"]}, {"$set": update})
        merged = {**session, **update}
        if remaining <= 0:
            await _write_attendance_record(db, merged, "completed", now_ms)
            await db.active_sessions.delete_one({"_id": session["_id"]})
            await _broadcast_session(db, merged, ended=True, outcome="completed")
            return {"outcome": "session_completed"}
        await _tick_challenge_lifecycle(db, merged, settings, now_ms)
        await _broadcast_session(db, merged)
        return {"outcome": "active", "status": "active"}

    if status == "paused":
        if inside:
            resume_window_h = int(settings.get("resume_window_hours", 10))
            paused_at = session.get("paused_at")
            if paused_at and (now_ms - paused_at) > resume_window_h * 3600 * 1000:
                await _write_attendance_record(db, session, "expired", now_ms)
                await db.active_sessions.delete_one({"_id": session["_id"]})
                await _broadcast_session(db, session, ended=True, outcome="expired")
                return {"outcome": "session_expired"}
            update = {"status": "active", "current_bout_start_ms": now_ms, "paused_at": None,
                      "last_fix": last_fix, "last_live_ts_ms": now_ms, "last_battery": fix.battery}
            await db.active_sessions.update_one(
                {"_id": session["_id"]},
                {"$set": update, "$inc": {"bout_count": 1},
                 "$push": {"log": {"event": "resume_live", "ts_ms": now_ms}}},
            )
            new_s = await db.active_sessions.find_one({"_id": session["_id"]})
            await _broadcast_session(db, new_s)
            return {"outcome": "session_resumed", "status": "active"}
        # still outside — just move the pin so the admin sees live movement
        await db.active_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"last_fix": last_fix, "last_live_ts_ms": now_ms, "last_battery": fix.battery}},
        )
        merged = {**session, "last_fix": last_fix}
        await _broadcast_session(db, merged)
        return {"outcome": "still_paused", "status": "paused"}

    return {"outcome": "noop"}


@router.post("/location")
async def location_fix(
    payload: MobileLocationFix,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Continuous background-location ingest for WhatsApp-style live tracking."""
    db = get_db()
    # Keep the device's last_seen fresh so the OFFLINE badge stays accurate
    await db.mobile_devices.update_one(
        {"user_id": user["id"], "device_id": payload.device_id, "deleted_at": None},
        {"$set": {"last_seen_at": _now_iso(), "last_seen_ts_ms": payload.ts_ms}},
    )
    outcome = await _apply_location_fix(db, user, payload)
    return {"ok": True, **outcome}


@router.post("/location-sync")
async def location_sync(
    payload: MobileLocationBulk,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Bulk replay of offline-buffered live-location fixes.

    Fixes captured while the device had no internet (e.g. walked in/out with
    the phone offline) are drained here when connectivity returns, so the
    in/out transitions and movement reconstruct on the admin side. Processed
    oldest-first; time accrual is idempotent so retries are safe.
    """
    db = get_db()
    ordered = sorted(payload.fixes, key=lambda f: f.ts_ms)
    latest = ordered[-1]
    await db.mobile_devices.update_one(
        {"user_id": user["id"], "device_id": latest.device_id, "deleted_at": None},
        {"$set": {"last_seen_at": _now_iso(), "last_seen_ts_ms": latest.ts_ms}},
    )
    outcomes: List[str] = []
    for f in ordered:
        try:
            out = await _apply_location_fix(db, user, f)
        except HTTPException as e:
            out = {"outcome": "error", "detail": e.detail}
        outcomes.append(out.get("outcome"))
    logger.info("mobile_location_sync user=%s count=%s", user.get("email"), len(ordered))
    return {"ok": True, "processed": len(ordered), "outcomes": outcomes}


# ---------------------------------------------------------------------------
# Heartbeat — used for OFFLINE DEVICE badge on admin dashboard
# ---------------------------------------------------------------------------
@router.post("/heartbeat")
async def heartbeat(
    payload: MobileHeartbeat,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    update = {
        "last_seen_at": _now_iso(),
        "last_seen_ts_ms": payload.ts_ms,
        "battery": payload.battery,
        "permission_state": payload.permission_state,
        "last_geofence_event_ms": payload.last_geofence_event_ms,
    }
    r = await db.mobile_devices.update_one(
        {"user_id": user["id"], "device_id": payload.device_id, "deleted_at": None},
        {"$set": update},
    )
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Device not registered — call /register-device first")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Attestation (Phase 6) — Play Integrity / App Attest verification stub
# ---------------------------------------------------------------------------
def _validate_attestation_structure(platform: str, token: str) -> tuple[str, str | None]:
    """Cheap structural verification. Returns (verdict, reason_if_suspicious).

    verdict ∈ {"ok", "invalid_structure", "stub_accepted"}.
    - Real Play Integrity tokens are three-segment JWS (header.payload.sig).
    - Real App Attest assertions are base64-encoded CBOR blobs.
    - Anything matching our own dev-stub format ("stub-<nonce>-<hex>") is
      accepted but tagged so we know we haven't verified crypto yet.
    """
    if not token or len(token) < 8:
        return "invalid_structure", "empty_or_too_short"
    if token.startswith("stub-"):
        return "stub_accepted", None
    if platform == "android":
        # JWS = 3 base64url segments separated by dots
        parts = token.split(".")
        if len(parts) == 3 and all(len(p) > 0 for p in parts):
            return "ok", None
        return "invalid_structure", "not_a_jws"
    if platform == "ios":
        # App Attest assertions are base64 (roughly). Accept anything > 32
        # base64-ish chars; real verify happens later.
        import re
        if re.fullmatch(r"[A-Za-z0-9+/=_\-]{32,}", token):
            return "ok", None
        return "invalid_structure", "not_base64"
    return "invalid_structure", "unknown_platform"


@router.post("/attestation")
async def submit_attestation(
    payload: MobileAttestation,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Record + soft-verify a Play Integrity / App Attest token.

    Verification is structural for now (stub). This endpoint is here so the
    mobile client integration is complete and future phases can flip to real
    crypto verification with zero client changes.

    A failed verification logs a `high`-severity security_event but does NOT
    block the request — anti-spoof is `soft` per the MOBILE_ARCHITECTURE doc.
    """
    from services.audit import log_security_event
    db = get_db()

    # Device must be registered first (matches heartbeat semantics)
    dev = await db.mobile_devices.find_one({
        "user_id": user["id"], "device_id": payload.device_id, "deleted_at": None,
    })
    if not dev:
        raise HTTPException(status_code=404, detail="Device not registered — call /register-device first")

    verdict, reason = _validate_attestation_structure(payload.platform, payload.token)

    truncated_token = payload.token if len(payload.token) < 200 else (payload.token[:180] + "...")
    now_ms = _now_ms()
    await db.mobile_devices.update_one(
        {"_id": dev["_id"]},
        {"$set": {
            "attestation_verdict": verdict,
            "attestation_ts_ms": now_ms,
            "attestation_ts": _now_iso(),
            "attestation_reason": reason,
            "attestation_nonce": payload.nonce,
            "attestation_token_preview": truncated_token,
            "attestation_platform": payload.platform,
            "attestation_client_event_id": payload.client_event_id,
        }},
    )

    if verdict == "invalid_structure":
        await log_security_event(
            type_="attestation_invalid",
            severity="high",
            ip=client_ip(request),
            details={
                "device_id": payload.device_id, "platform": payload.platform,
                "reason": reason, "nonce": payload.nonce,
                "client_event_id": payload.client_event_id,
            },
            org_id=user["org_id"], user_id=user["id"],
        )
        logger.warning(
            "attestation_invalid user=%s device=%s platform=%s reason=%s",
            user.get("email"), payload.device_id, payload.platform, reason,
        )
    else:
        logger.info(
            "attestation_recorded user=%s device=%s platform=%s verdict=%s",
            user.get("email"), payload.device_id, payload.platform, verdict,
        )

    return {"ok": True, "verdict": verdict, "ts_ms": now_ms}


# ---------------------------------------------------------------------------
# Session state on-demand for cold-start reconciliation
# ---------------------------------------------------------------------------
@router.get("/reconcile")
async def reconcile_state(user: dict = Depends(get_current_user)):
    """Return the state the app needs on cold-start to reconcile.

    Includes: user's assigned office, active session snapshot (if any), last
    processed mobile event, and current org selfie config.
    """
    db = get_db()
    user_doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    office = None
    if user_doc and user_doc.get("office_id"):
        try:
            o = await db.offices.find_one({"_id": ObjectId(user_doc["office_id"]),
                                           "org_id": user["org_id"]})
            if o:
                office = {
                    "id": str(o["_id"]),
                    "name": o["name"],
                    "lat": o["location"]["coordinates"][1],
                    "lng": o["location"]["coordinates"][0],
                    "radius_meters": o["radius_meters"],
                }
        except Exception:
            office = None
    session = await db.active_sessions.find_one({"user_id": user["id"], "org_id": user["org_id"]})
    session_view = None
    if session:
        session_view = {
            "id": str(session["_id"]),
            "status": session["status"],
            "start_time_ms": session.get("start_time_ms"),
            "remaining_ms": session.get("remaining_ms"),
            "center": session.get("center"),
            "flagged": session.get("flagged", False),
        }
    last_event = await db.mobile_events.find_one(
        {"user_id": user["id"]},
        sort=[("ts_ms", -1)],
    )
    last_event_view = None
    if last_event:
        last_event_view = {
            "type": last_event["type"],
            "ts_ms": last_event["ts_ms"],
            "client_event_id": last_event["client_event_id"],
            "outcome": last_event.get("session_outcome"),
        }
    return {
        "office": office,
        "session": session_view,
        "last_event": last_event_view,
        "server_ts_ms": _now_ms(),
    }
