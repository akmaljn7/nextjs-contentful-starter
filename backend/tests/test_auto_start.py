"""Iteration 8 — auto-start + selfie challenges backend tests."""
import base64
import io
import os
import struct
import time
import urllib.parse
import uuid

import pytest
import requests
from bson import ObjectId

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
OUT_LAT, OUT_LNG = 6.6244, 3.3792


def _jpeg_data_url(min_bytes: int = 1024) -> str:
    """Build a minimal but valid JPEG > min_bytes and return as data URL."""
    # Minimal JPEG header
    jpeg = bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000"
        "ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d"
        "1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432"
        "ffc00011080001000103012200021101031101ffc4001f0000010501010101010100"
        "0000000000000000010203040506070809000a0b"
        "ffc400b5100002010303020403050504040000017d01020300041105122131410613"
        "516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728"
        "292a3435363738393a434445464748494a535455565758595a636465666768696a"
        "737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aa"
        "b2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8"
        "e9eaf1f2f3f4f5f6f7f8f9fa"
        "ffc4001f0100030101010101010101010000000000000102030405060708090a0b"
        "ffc400b51100020102040403040705040400010277000102031104052131061241510761"
        "711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a"
        "35363738393a434445464748494a535455565758595a636465666768696a737475767778"
        "797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7"
        "b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6"
        "f7f8f9fa"
        "ffda000c03010002110311003f00fbd0"
    )
    # Pad with valid comment section to reach min_bytes
    if len(jpeg) < min_bytes:
        pad = min_bytes - len(jpeg) - 4
        if pad > 0:
            # insert a JPEG comment marker FFFE + length + payload right before EOI
            comment = b"\xff\xfe" + struct.pack(">H", pad + 2) + (b"A" * pad)
            jpeg = jpeg[:-2] + comment + b"\xff\xd9"  # append EOI
        else:
            jpeg = jpeg + b"\xff\xd9"
    else:
        jpeg = jpeg + b"\xff\xd9"
    b64 = base64.b64encode(jpeg).decode()
    return f"data:image/jpeg;base64,{b64}"


# --- Mongo direct access (motor) for patching challenges ---
def _mongo():
    from motor.motor_asyncio import AsyncIOMotorClient
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "geofence_console")
    return AsyncIOMotorClient(url)[dbname]


async def _mongo_patch_session(sid: str, patch: dict):
    db = _mongo()
    await db.active_sessions.update_one({"_id": ObjectId(sid)}, {"$set": patch})


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def owner_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def nigerian_office(owner_sess):
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "Sample employee must be seeded"
    emp_id = emp["id"]
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_Lagos_HQ_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    r2 = owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": office_id, "schedule": {"mode": "any"}})
    assert r2.status_code == 200, r2.text
    yield {"office_id": office_id, "emp_id": emp_id}
    try:
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


@pytest.fixture(scope="module")
def employee_sess(nigerian_office):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PW})
    assert r.status_code == 200, r.text
    s.post(f"{API}/sessions/reset")
    return s


@pytest.fixture(autouse=True)
def _reset_state(owner_sess, employee_sess, nigerian_office):
    """Before each test: reset session + restore settings + any-schedule."""
    employee_sess.post(f"{API}/sessions/reset")
    owner_sess.patch(f"{API}/org/settings", json={
        "auto_start_on_entry": True,
        "selfie_challenges_per_shift": 1,
        "selfie_response_window_minutes": 5,
        "selfie_mode": "random",
        "selfie_fixed_times": [],
        "accuracy_tolerance_meters": 50,
    })
    owner_sess.patch(f"{API}/employees/{nigerian_office['emp_id']}", json={"schedule": {"mode": "any"}})
    yield
    employee_sess.post(f"{API}/sessions/reset")


# ---------- Tests ----------

class TestAutoStartAndChallenges:

    def test_settings_persist(self, owner_sess):
        r = owner_sess.patch(f"{API}/org/settings", json={
            "selfie_challenges_per_shift": 3,
            "selfie_response_window_minutes": 7,
            "selfie_mode": "fixed",
            "selfie_fixed_times": ["09:00", "12:00"],
            "auto_start_on_entry": False,
        })
        assert r.status_code == 200, r.text
        got = owner_sess.get(f"{API}/org/settings").json().get("settings", {})
        assert got["selfie_challenges_per_shift"] == 3
        assert got["selfie_response_window_minutes"] == 7
        assert got["selfie_mode"] == "fixed"
        assert got["selfie_fixed_times"] == ["09:00", "12:00"]
        assert got["auto_start_on_entry"] is False

    def test_auto_start_disabled(self, owner_sess, employee_sess):
        owner_sess.patch(f"{API}/org/settings", json={"auto_start_on_entry": False})
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 400
        assert "Auto-start is disabled" in r.json().get("detail", "")

    def test_auto_start_outside_geofence(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": OUT_LAT, "lng": OUT_LNG, "accuracy": 10,
        })
        assert r.status_code == 403
        assert r.json()["detail"].startswith("Not inside office")

    def test_auto_start_low_accuracy(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 500,
        })
        assert r.status_code == 400
        assert "GPS accuracy too low" in r.json()["detail"]

    def test_auto_start_success_and_challenges_count(self, owner_sess, employee_sess):
        owner_sess.patch(f"{API}/org/settings", json={"selfie_challenges_per_shift": 2, "selfie_mode": "random"})
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["auto_started"] is True
        assert isinstance(data["challenges"], list)
        assert len(data["challenges"]) == 2, data

    def test_auto_start_already_active(self, employee_sess):
        r1 = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r1.status_code == 200
        r2 = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r2.status_code == 400
        assert "already active" in r2.json()["detail"].lower()

    def test_auto_start_time_off_blocks(self, owner_sess, employee_sess, nigerian_office):
        from datetime import date
        import asyncio
        today = date.today().isoformat()
        # Cleanup any leftover time-off doc for this user today
        async def _cleanup():
            await _mongo().time_off_requests.delete_many({
                "user_id": nigerian_office["emp_id"],
                "start_date": {"$lte": today}, "end_date": {"$gte": today},
            })
        asyncio.run(_cleanup())
        # Employee creates time-off
        r = employee_sess.post(f"{API}/time-off", json={
            "start_date": today, "end_date": today, "reason": "TEST_iter8",
        })
        assert r.status_code == 200, r.text
        req_id = r.json()["id"]
        # Owner approves
        ra = owner_sess.patch(f"{API}/time-off/{req_id}/approve", json={"notes": ""})
        assert ra.status_code == 200, ra.text
        try:
            r2 = employee_sess.post(f"{API}/sessions/auto-start", json={
                "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
            })
            assert r2.status_code == 403
            assert "time off" in r2.json()["detail"].lower()
        finally:
            asyncio.run(_cleanup())

    def test_challenge_triggers_via_ping(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        challenges = r.json()["challenges"]
        assert challenges, "must have challenges"
        ch_id = challenges[0]["id"]
        # Force trigger_ms into the past
        import asyncio
        past = int(time.time() * 1000) - 60_000
        asyncio.run(_mongo_patch_session(sid, {"challenges.0.trigger_ms": past}))
        # Ping
        p = employee_sess.post(f"{API}/sessions/ping", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert p.status_code == 200, p.text
        data = p.json()
        assert data.get("active_challenge"), data
        assert data["active_challenge"]["id"] == ch_id
        pending = next(c for c in data["challenges"] if c["id"] == ch_id)
        assert pending["status"] == "pending"
        assert pending["prompted_at_ms"] is not None
        assert pending["respond_by_ms"] is not None

    def test_challenge_respond_success_and_photo(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        ch_id = r.json()["challenges"][0]["id"]
        import asyncio
        past = int(time.time() * 1000) - 60_000
        asyncio.run(_mongo_patch_session(sid, {"challenges.0.trigger_ms": past}))
        employee_sess.post(f"{API}/sessions/ping", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})

        photo = _jpeg_data_url(1024)
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond", json={"face_photo": photo})
        assert rr.status_code == 200, rr.text
        data = rr.json()
        ch = next(c for c in data["challenges"] if c["id"] == ch_id)
        assert ch["status"] == "responded"
        assert data["active_challenge"] is None

        # Fetch photo
        key = f"{sid}::{ch_id}"
        enc = urllib.parse.quote(key, safe="")
        rp = employee_sess.get(f"{API}/photos/session/{enc}")
        assert rp.status_code == 200, rp.text
        assert rp.headers.get("content-type", "").startswith("image/jpeg")

    def test_challenge_respond_unknown_id(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200
        rr = employee_sess.post(f"{API}/sessions/challenge/deadbeefcafe/respond",
                                json={"face_photo": _jpeg_data_url(1024)})
        assert rr.status_code == 404

    def test_challenge_respond_after_deadline(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        ch_id = r.json()["challenges"][0]["id"]
        import asyncio
        past = int(time.time() * 1000) - 10 * 60_000
        # Force challenge into pending state with respond_by in the past
        asyncio.run(_mongo_patch_session(sid, {
            "challenges.0.status": "pending",
            "challenges.0.prompted_at_ms": past,
            "challenges.0.respond_by_ms": past + 60_000,
        }))
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": _jpeg_data_url(1024)})
        assert rr.status_code == 400
        assert "expired" in rr.json()["detail"].lower()
        me = employee_sess.get(f"{API}/sessions/me").json()
        assert me["flagged"] is True

    def test_challenge_expiry_via_ping_logs_event(self, owner_sess, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        ch_id = r.json()["challenges"][0]["id"]
        import asyncio
        past = int(time.time() * 1000) - 10 * 60_000
        asyncio.run(_mongo_patch_session(sid, {
            "challenges.0.status": "pending",
            "challenges.0.prompted_at_ms": past,
            "challenges.0.respond_by_ms": past + 60_000,
        }))
        p = employee_sess.post(f"{API}/sessions/ping", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert p.status_code == 200, p.text
        data = p.json()
        expired_ch = next(c for c in data["challenges"] if c["id"] == ch_id)
        assert expired_ch["status"] == "expired"
        assert data["flagged"] is True
        # Verify security event via mongo
        async def _check():
            doc = await _mongo().security_events.find_one(
                {"type": "selfie_missed"}, sort=[("ts", -1)]
            )
            return doc
        ev = asyncio.run(_check())
        assert ev is not None
        assert ev.get("severity") == "high"

    def test_fixed_mode_uses_configured_time(self, owner_sess, employee_sess):
        # Configure fixed time = now UTC HH:MM (within +/- 30min)
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        # Pick a HH:MM ~10 min from now so it falls inside a 60min shift
        hhmm = now.strftime("%H:%M")
        owner_sess.patch(f"{API}/org/settings", json={
            "selfie_mode": "fixed",
            "selfie_fixed_times": [hhmm],
            "selfie_challenges_per_shift": 1,
            "session_duration_minutes": 60,
        })
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200, r.text
        assert len(r.json()["challenges"]) == 1

    def test_regression_manual_start_and_challenges(self, owner_sess, employee_sess):
        owner_sess.patch(f"{API}/org/settings", json={"selfie_challenges_per_shift": 2})
        r = employee_sess.post(f"{API}/sessions/start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
            "face_photo": _jpeg_data_url(1024),
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["auto_started"] is False
        assert len(data["challenges"]) == 2
        assert data["has_photo"] is True

    def test_regression_manual_start_outside(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/start", json={
            "lat": OUT_LAT, "lng": OUT_LNG, "accuracy": 10,
            "face_photo": _jpeg_data_url(1024),
        })
        assert r.status_code == 403
