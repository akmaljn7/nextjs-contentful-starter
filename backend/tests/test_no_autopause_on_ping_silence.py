"""Iteration 22 — regression tests for the no-auto-pause-on-ping-silence fix.

Native geofences fire only ENTER/EXIT — they never send periodic pings. A phone
sleeping in a pocket inside the office is legitimately still active. Server
must NOT auto-pause based on ping silence. It must still safety-net expire
after the full resume window (default 10h) as an orphan-cleanup.
"""
import os
import time
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
import requests
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

OWNER_EMAIL = "akmaljn7@gmail.com"
OWNER_PW = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PW = "Employee123!"

OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS = 6.5244, 3.3792, 300
IN_LAT, IN_LNG = 6.5245, 3.3793


def _mongo():
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "geofence_console")
    return AsyncIOMotorClient(url)[dbname]


@pytest.fixture(scope="module")
def owner_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def employee_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def office_and_emp(owner_sess):
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "Sample employee must be seeded"
    emp_id = emp["id"]
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_NoAutoPause_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    org_id = emp["org_id"]
    r2 = owner_sess.patch(f"{API}/employees/{emp_id}",
                          json={"office_id": office_id, "schedule": {"mode": "any"}})
    assert r2.status_code == 200, r2.text
    yield {"office_id": office_id, "emp_id": emp_id, "org_id": org_id}
    try:
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


def _insert_active_session(office_and_emp, last_fix_offset_ms: int) -> str:
    """Insert an active session directly into Mongo with a backdated last_fix.ts_ms.

    Returns the session id as string. Uses a fresh user_id so it doesn't
    collide with the real employee's session state.
    """
    async def _do():
        db = _mongo()
        # Reset any lingering session for the real employee to keep the test isolated
        await db.active_sessions.delete_many({"user_id": office_and_emp["emp_id"]})
        now_ms = int(time.time() * 1000)
        past_ms = now_ms - last_fix_offset_ms
        doc = {
            "org_id": office_and_emp["org_id"],
            "user_id": office_and_emp["emp_id"],
            "office_id": office_and_emp["office_id"],
            "center": {"lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_m": OFFICE_RADIUS},
            "start_time": datetime.fromtimestamp(past_ms / 1000, tz=timezone.utc).isoformat(),
            "start_time_ms": past_ms,
            "remaining_ms": 6 * 3600 * 1000,
            "current_bout_start_ms": past_ms,
            "status": "active",
            "paused_at": None,
            "last_fix": {"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10, "ts_ms": past_ms},
            "bout_count": 1,
            "total_inside_ms": 0,
            "flagged": False,
            "device_fingerprint": "TEST_no_autopause",
            "auto_started": True,
            "challenges": [],
            "log": [{"event": "auto_start", "ts_ms": past_ms}],
        }
        res = await db.active_sessions.insert_one(doc)
        return str(res.inserted_id)
    return asyncio.run(_do())


def _cleanup(office_and_emp):
    async def _do():
        db = _mongo()
        await db.active_sessions.delete_many({"user_id": office_and_emp["emp_id"]})
    asyncio.run(_do())


class TestNoAutoPauseOnPingSilence:
    """The core fix: silence != exit."""

    def test_session_does_not_auto_pause_on_ping_silence(self, owner_sess, office_and_emp):
        # last_fix 10 min old — well past the old 3-min STALE_PING_MS threshold.
        sid = _insert_active_session(office_and_emp, last_fix_offset_ms=10 * 60 * 1000)
        try:
            r = owner_sess.get(f"{API}/sessions/live")
            assert r.status_code == 200, r.text
            sessions = r.json()
            mine = next((s for s in sessions if s["id"] == sid), None)
            assert mine is not None, f"session {sid} disappeared from live: {sessions}"
            assert mine["status"] == "active", (
                f"session was auto-paused on ping silence — got status={mine['status']}"
            )
            # UI-only 'stale' badge must be present as a boolean and true (10 min > 30-min? no, 10 < 30)
            assert "stale" in mine
            assert isinstance(mine["stale"], bool)
            # 10 min < 30-min STALE_PING_MS → not yet stale
            assert mine["stale"] is False
        finally:
            _cleanup(office_and_emp)

    def test_session_still_expires_after_full_resume_window(self, owner_sess, office_and_emp):
        # last_fix 12h old — beyond default 10h resume window → safety-net expire.
        sid = _insert_active_session(office_and_emp, last_fix_offset_ms=12 * 3600 * 1000)
        try:
            r = owner_sess.get(f"{API}/sessions/live")
            assert r.status_code == 200, r.text
            sessions = r.json()
            # Session should be gone from live (expired + attendance record written)
            still_there = [s for s in sessions if s["id"] == sid]
            assert not still_there, f"orphan session was not expired: {still_there}"

            # Verify attendance record with outcome=expired was written
            async def _find_att():
                db = _mongo()
                # Small buffer for DB propagation just in case
                for _ in range(5):
                    doc = await db.attendance_records.find_one(
                        {"user_id": office_and_emp["emp_id"], "outcome": "expired"},
                        sort=[("ended_at", -1)],
                    )
                    if doc:
                        return doc
                    await asyncio.sleep(0.2)
                return None
            att = asyncio.run(_find_att())
            assert att is not None, "expired attendance record not written"

            # And the active_sessions row must be gone
            async def _find_active():
                db = _mongo()
                return await db.active_sessions.find_one({"_id": ObjectId(sid)})
            assert asyncio.run(_find_active()) is None, "active_sessions row still present"
        finally:
            _cleanup(office_and_emp)

