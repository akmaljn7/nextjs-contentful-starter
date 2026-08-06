"""Mobile app endpoints (Phase 0).

Additive-only. Existing web dashboard and session/state-machine logic are
untouched — the mobile geofence-event endpoint routes into the same
auto-start / ping helpers used by the web PWA.
"""
import logging
from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from db import get_db
from deps import get_current_user, client_ip
from models import (
    MobileDeviceRegister,
    MobileGeofenceEvent,
    MobileBulkSync,
    MobileHeartbeat,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mobile", tags=["mobile"])


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    retries from an offline queue are safe.
    """
    existing = await db.mobile_events.find_one({
        "user_id": user["id"],
        "client_event_id": event.client_event_id,
    })
    if existing:
        return "duplicate", existing
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
        "received_at": _now_iso(),
        "processed_at": None,
        "session_outcome": None,
    }
    await db.mobile_events.insert_one(doc)
    return "new", doc


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
