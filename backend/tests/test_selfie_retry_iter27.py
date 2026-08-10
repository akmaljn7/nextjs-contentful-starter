"""Iteration 27 — selfie retry / MAX_SELFIE_ATTEMPTS behaviour.

Verifies the fix for the "single mismatched selfie permanently locked the
challenge" bug. On a face-mismatch (or liveness fail), the challenge should
stay pending for up to MAX_SELFIE_ATTEMPTS=5 attempts. Only the 5th failure
terminally marks the challenge 'missed' and flags the session.
"""
import asyncio
import base64
import os
import time
import urllib.request
import uuid
from pathlib import Path

import pytest
import requests
from bson import ObjectId

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
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

OBAMA_URL = "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/obama.jpg"
BIDEN_URL = "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/biden.jpg"
_OBAMA = "/tmp/_test_obama.jpg"
_BIDEN = "/tmp/_test_biden.jpg"

MAX_ATTEMPTS = 5


def _download(url: str, path: str) -> bool:
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        return True
    try:
        urllib.request.urlretrieve(url, path)
        return os.path.getsize(path) > 5000
    except Exception as e:
        print(f"Download failed {url}: {e}")
        return False


NET_OK = _download(OBAMA_URL, _OBAMA) and _download(BIDEN_URL, _BIDEN)


def _as_data_url(path: str) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(Path(path).read_bytes()).decode()


def _mongo():
    from motor.motor_asyncio import AsyncIOMotorClient
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "geofence_console")
    return AsyncIOMotorClient(url)[dbname]


async def _patch_session(sid: str, patch: dict):
    await _mongo().active_sessions.update_one({"_id": ObjectId(sid)}, {"$set": patch})


async def _get_session_doc(sid: str):
    return await _mongo().active_sessions.find_one({"_id": ObjectId(sid)})


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def owner_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def emp_ids(owner_sess):
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "sample employee must be seeded"
    return {"emp_id": emp["id"]}


@pytest.fixture(scope="module")
def lagos_office(owner_sess, emp_ids):
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_iter27_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    owner_sess.patch(f"{API}/employees/{emp_ids['emp_id']}",
                     json={"office_id": office_id, "schedule": {"mode": "any"}})
    yield {"office_id": office_id}
    try:
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


@pytest.fixture(scope="module")
def employee_sess(lagos_office):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PW})
    assert r.status_code == 200, r.text
    s.post(f"{API}/sessions/reset")
    return s


@pytest.fixture(autouse=True)
def _reset(owner_sess, employee_sess, emp_ids):
    owner_sess.delete(f"{API}/face/reset/{emp_ids['emp_id']}")
    employee_sess.post(f"{API}/sessions/reset")
    owner_sess.patch(f"{API}/org/settings", json={
        "auto_start_on_entry": True,
        "selfie_challenges_per_shift": 1,
        "selfie_response_window_minutes": 5,
        "selfie_mode": "random",
        "selfie_fixed_times": [],
        "accuracy_tolerance_meters": 50,
    })
    owner_sess.patch(f"{API}/employees/{emp_ids['emp_id']}", json={"schedule": {"mode": "any"}})
    yield
    employee_sess.post(f"{API}/sessions/reset")
    owner_sess.delete(f"{API}/face/reset/{emp_ids['emp_id']}")


def _trigger_challenge(employee_sess):
    r = employee_sess.post(f"{API}/sessions/auto-start", json={
        "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
    })
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    ch_id = r.json()["challenges"][0]["id"]
    past = int(time.time() * 1000) - 60_000
    asyncio.run(_patch_session(sid, {"challenges.0.trigger_ms": past}))
    p = employee_sess.post(f"{API}/sessions/ping",
                           json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
    assert p.status_code == 200, p.text
    return sid, ch_id


# ---------- Tests ----------

@pytest.mark.skipif(not NET_OK, reason="face images unavailable")
class TestSelfieRetry:

    def test_single_mismatch_keeps_challenge_pending(self, employee_sess):
        """1st mismatch: 403 with 'attempts left', challenge still pending, not flagged."""
        obama = _as_data_url(_OBAMA)
        biden = _as_data_url(_BIDEN)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": biden})
        assert rr.status_code == 403, rr.text
        detail = rr.json()["detail"]
        assert "Face does not match" in detail, detail
        assert f"Attempt 1 of {MAX_ATTEMPTS}" in detail, detail
        assert f"{MAX_ATTEMPTS - 1} left" in detail, detail

        me = employee_sess.get(f"{API}/sessions/me").json()
        ch = next(c for c in me["challenges"] if c["id"] == ch_id)
        assert ch["status"] == "pending", ch
        assert me.get("flagged") is not True, me

        # Verify attempt counter persisted
        doc = asyncio.run(_get_session_doc(sid))
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch.get("attempts") == 1
        assert db_ch.get("status") == "pending"

    def test_five_mismatches_terminal_missed_and_flagged(self, owner_sess, employee_sess):
        obama = _as_data_url(_OBAMA)
        biden = _as_data_url(_BIDEN)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        # Attempts 1..4 keep pending
        for i in range(1, MAX_ATTEMPTS):
            rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                    json={"face_photo": biden})
            assert rr.status_code == 403, (i, rr.text)
            d = rr.json()["detail"]
            assert f"Attempt {i} of {MAX_ATTEMPTS}" in d, (i, d)
            me = employee_sess.get(f"{API}/sessions/me").json()
            ch = next(c for c in me["challenges"] if c["id"] == ch_id)
            assert ch["status"] == "pending", (i, ch)
            assert me.get("flagged") is not True, (i, me)

        # Attempt 5 — terminal
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": biden})
        assert rr.status_code == 403, rr.text
        d = rr.json()["detail"]
        assert f"{MAX_ATTEMPTS} attempts" in d, d
        assert "missed" in d.lower(), d

        # Session flagged + challenge missed
        # /sessions/me deletes ended session? no, still active; just check state
        doc = asyncio.run(_get_session_doc(sid))
        assert doc.get("flagged") is True, doc
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch["status"] == "missed", db_ch
        assert db_ch.get("attempts") == MAX_ATTEMPTS

        # 6th attempt -> 400 "already missed"
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": biden})
        assert rr.status_code == 400, rr.text
        assert "already missed" in rr.json()["detail"].lower(), rr.json()

        # Security event: expect a high-severity face_mismatch (terminal) recorded
        async def _find_terminal():
            return await _mongo().security_events.find_one(
                {"type": "face_mismatch", "details.terminal": True},
                sort=[("ts", -1)],
            )
        ev = asyncio.run(_find_terminal())
        assert ev is not None, "expected terminal face_mismatch security event"
        assert ev.get("severity") == "high"

    def test_match_after_prior_mismatch_succeeds(self, employee_sess):
        """A successful selfie after a few mismatches should transition to responded."""
        obama = _as_data_url(_OBAMA)
        biden = _as_data_url(_BIDEN)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        # 2 mismatches
        for i in range(2):
            rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                    json={"face_photo": biden})
            assert rr.status_code == 403, rr.text

        # Now a matching selfie
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": obama})
        assert rr.status_code == 200, rr.text
        data = rr.json()
        ch = next(c for c in data["challenges"] if c["id"] == ch_id)
        assert ch["status"] == "responded"

    def test_response_window_expired_marks_expired(self, employee_sess):
        obama = _as_data_url(_OBAMA)
        biden = _as_data_url(_BIDEN)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        # Force respond_by_ms to be in the past
        past = int(time.time() * 1000) - 60_000
        asyncio.run(_patch_session(sid, {"challenges.0.respond_by_ms": past}))

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": biden})
        assert rr.status_code == 400, rr.text
        assert "Response window expired" in rr.json()["detail"], rr.json()

        doc = asyncio.run(_get_session_doc(sid))
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch["status"] == "expired"


class TestRegression:
    """Happy-path + manual challenge-now regression."""

    def test_happy_path_no_baseline(self, employee_sess):
        """Employee w/o baseline should still be able to respond to a challenge (no face check)."""
        # employee has no baseline (autouse reset)
        assert employee_sess.get(f"{API}/face/status").json()["enrolled"] is False
        sid, ch_id = _trigger_challenge(employee_sess)
        # Any small JPEG payload passes decode inside save_session_photo, no face check runs.
        # Use a real image so save_session_photo happily stores it.
        img = _as_data_url(_OBAMA) if NET_OK else "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xd9").decode()
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": img})
        assert rr.status_code == 200, rr.text
        ch = next(c for c in rr.json()["challenges"] if c["id"] == ch_id)
        assert ch["status"] == "responded"

    def test_admin_challenge_now_creates_pending(self, owner_sess, employee_sess, emp_ids):
        # Start a session first
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200, r.text
        # Trigger manual challenge
        rr = owner_sess.post(f"{API}/sessions/challenge-now/{emp_ids['emp_id']}")
        assert rr.status_code == 200, rr.text
        data = rr.json()
        active = data.get("active_challenge")
        assert active is not None, data
        pending = [c for c in data["challenges"] if c["status"] == "pending"]
        assert len(pending) >= 1
