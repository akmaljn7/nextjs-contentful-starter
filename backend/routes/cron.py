"""Platform cron webhook endpoints.

The Emergent platform dispatches a POST to these routes on the schedule
defined in `.emergent/crons.yml`. The webhook must:

  1. Auth via `Authorization: Bearer $WEBHOOK_CRON_SECRET` (constant-time)
  2. Ack 2xx immediately (BackgroundTasks) — the dispatcher only waits ~5s
  3. Actual work happens in the background so the HTTP call returns fast
"""
import hmac
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cron", tags=["cron"])

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Employees who haven't been seen for this long during their scheduled work
# window get a silent-push deadman poke. Tuned to be > 3× the heartbeat
# interval (5 min) plus one geofence-notification delivery slack (~5 min)
# so a healthy phone is never poked unnecessarily.
DEADMAN_SILENT_MS = 20 * 60 * 1000

# Don't spam the same device more than once every DEADMAN_COOLDOWN_MS
DEADMAN_COOLDOWN_MS = 30 * 60 * 1000


def _auth_or_raise(request: Request) -> None:
    """Constant-time bearer check against WEBHOOK_CRON_SECRET."""
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not secret:
        logger.error("cron_webhook_missing_secret")
        raise HTTPException(status_code=500, detail="Server not configured")
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer")
    token = auth[7:]
    if not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Invalid credentials")


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _employee_is_scheduled_now(user_doc: dict) -> bool:
    """Return True if the user's schedule says they should be at work right now.

    Users with schedule.mode == 'any' are treated as always in-scope (silent
    push is cheap and the schedule is genuinely open-ended). fixed_hours and
    weekly_calendar consult the user's timezone.
    """
    schedule = user_doc.get("schedule") or {"mode": "any"}
    mode = schedule.get("mode", "any")
    if mode == "any":
        # Cheap heuristic: consider "any"-schedule users in-scope from
        # 06:00-22:00 local so we don't wake devices in the middle of the night.
        try:
            tz = ZoneInfo(schedule.get("timezone") or "UTC")
        except ZoneInfoNotFoundError:
            tz = ZoneInfo("UTC")
        h = datetime.now(tz).hour
        return 6 <= h < 22
    if mode == "fixed_hours":
        # No specific window — treat like 'any' but during business hours only
        try:
            tz = ZoneInfo(schedule.get("timezone") or "UTC")
        except ZoneInfoNotFoundError:
            tz = ZoneInfo("UTC")
        h = datetime.now(tz).hour
        return 6 <= h < 22
    if mode == "weekly_calendar":
        try:
            tz = ZoneInfo(schedule.get("timezone") or "UTC")
        except ZoneInfoNotFoundError:
            tz = ZoneInfo("UTC")
        now = datetime.now(tz)
        day = (schedule.get("weekly_schedule") or {}).get(DAY_KEYS[now.weekday()])
        if not day:
            return False
        try:
            oh, om = map(int, day["open"].split(":"))
            ch, cm = map(int, day["close"].split(":"))
        except Exception:
            return False
        open_dt = now.replace(hour=oh, minute=om, second=0, microsecond=0)
        close_dt = now.replace(hour=ch, minute=cm, second=0, microsecond=0)
        return open_dt <= now < close_dt
    return False


async def _run_deadman_sweep(run_id: Optional[str] = None) -> dict:
    """Look for scheduled-but-silent employees and send them a silent push wake.

    Silent-push criteria (all must hold):
      1. Employee has an office assigned
      2. Employee is currently within their scheduled work window
      3. Employee has NO active_sessions row (nothing running)
      4. Employee's most recent mobile_devices.last_seen_at is older than
         DEADMAN_SILENT_MS OR no heartbeat ever recorded
      5. Not already poked in the last DEADMAN_COOLDOWN_MS (per device)

    Silent pushes are free — the client wakes up, drains its queue, and
    reconciles state. If the phone is genuinely off / uninstalled / permission
    revoked, nothing happens and it costs one FCM message.
    """
    db = get_db()
    from services.push import send_push
    now_ms = _now_ms()
    silent_cutoff_iso = datetime.fromtimestamp(
        (now_ms - DEADMAN_SILENT_MS) / 1000, tz=timezone.utc
    ).isoformat()

    stats = {"scanned": 0, "eligible": 0, "poked": 0, "skipped_cooldown": 0}

    # Scan every employee across every org. In a big multi-tenant deploy this
    # would benefit from a Mongo aggregation; at current scale ( <10k users )
    # the simple loop is fine and easier to reason about.
    cursor = db.users.find({"role": "employee", "deleted_at": {"$in": [None, False]}})
    async for user_doc in cursor:
        stats["scanned"] += 1
        user_id = str(user_doc["_id"])
        if not user_doc.get("office_id"):
            continue
        if not _employee_is_scheduled_now(user_doc):
            continue
        # Skip if they have an active session (mobile is doing its job)
        active = await db.active_sessions.find_one(
            {"user_id": user_id, "org_id": user_doc.get("org_id")},
        )
        if active:
            continue
        # Find each device for this user. Anything seen recently → healthy.
        found_healthy = False
        candidates: list[dict] = []
        async for dev in db.mobile_devices.find({
            "user_id": user_id, "deleted_at": None, "push_token": {"$ne": None},
        }):
            last_seen = dev.get("last_seen_at")
            if last_seen and last_seen > silent_cutoff_iso:
                found_healthy = True
                break
            candidates.append(dev)
        if found_healthy or not candidates:
            continue
        stats["eligible"] += 1
        # Cooldown per device
        for dev in candidates:
            last_deadman = dev.get("last_deadman_poke_ms") or 0
            if now_ms - last_deadman < DEADMAN_COOLDOWN_MS:
                stats["skipped_cooldown"] += 1
                continue
            res = await send_push(
                push_token=dev["push_token"],
                title="", body="", silent=True,
                data={
                    "kind": "deadman_wake",
                    "reason": "no_geofence_event_in_window",
                    "user_id": user_id,
                    "office_id": str(user_doc.get("office_id", "")),
                    "ts_ms": str(now_ms),
                },
            )
            await db.mobile_devices.update_one(
                {"_id": dev["_id"]},
                {"$set": {
                    "last_deadman_poke_ms": now_ms,
                    "last_deadman_result": res.get("reason") or ("ok" if res.get("ok") else "err"),
                }},
            )
            if res.get("ok"):
                stats["poked"] += 1
                logger.info(
                    "deadman_pushed user=%s device=%s run=%s",
                    user_doc.get("email"), dev.get("device_id"), run_id,
                )
            else:
                logger.warning(
                    "deadman_push_failed user=%s device=%s reason=%s",
                    user_doc.get("email"), dev.get("device_id"), res.get("reason"),
                )
    logger.info("deadman_sweep_done run=%s stats=%s", run_id, stats)
    # Record run in cron_runs collection so we have a history / can debug idempotency
    await db.cron_runs.insert_one({
        "name": "deadman-tick",
        "run_id": run_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "stats": stats,
    })
    return stats


# Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
@router.post("/deadman-tick")
async def deadman_tick(request: Request, background_tasks: BackgroundTasks):
    """Silent-push wake for scheduled-but-silent employees.

    Runs every 15 minutes. See `_run_deadman_sweep` for the eligibility
    predicate.
    """
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _auth_or_raise(request)
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    run_id = (
        request.headers.get("x-webhook-id")
        or body.get("run_id")
        or f"local-{_now_ms()}"
    )
    # Idempotency guard: refuse to run the same run_id twice back-to-back.
    db = get_db()
    dup = await db.cron_runs.find_one({"name": "deadman-tick", "run_id": run_id})
    if dup:
        logger.info("deadman_tick_duplicate run=%s", run_id)
        return {"ok": True, "duplicate": True, "run_id": run_id}
    background_tasks.add_task(_run_deadman_sweep, run_id)
    return {"ok": True, "accepted": True, "run_id": run_id}
