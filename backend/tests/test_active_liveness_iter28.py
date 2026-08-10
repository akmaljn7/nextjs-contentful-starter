"""Iteration 28 — active liveness + auto-timeout + missed-selfie flag.

Covers:
 * ACTIVE LIVENESS 2-frame contract (400 no-attempt when frames missing)
 * ACTIVE LIVENESS failure counts toward the 5-cap (same-neutral-image blink)
 * Match-first: mismatch still runs BEFORE the liveness gate
 * AUTO-TIMEOUT endpoint (window guard, expiry, security event, idempotent)
 * MISSED-SELFIE FLAG surfaced via /sessions/me and /sessions/live
 * SERVER TICK expiry -> logs 'selfie_missed' security event
 * liveness_action surfaced on active_challenge for /me and /live
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


def _download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        return True
    try:
        urllib.request.urlretrieve(url, path)
        return os.path.getsize(path) > 5000
    except Exception as e:
        print(f"Download failed {url}: {e}")
        return False


NET_OK = _download(OBAMA_URL, _OBAMA) and _download(BIDEN_URL, _BIDEN)


def _as_data_url(path):
    return "data:image/jpeg;base64," + base64.b64encode(Path(path).read_bytes()).decode()


def _mongo():
    from motor.motor_asyncio import AsyncIOMotorClient
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "geofence_console")
    return AsyncIOMotorClient(url)[dbname]


async def _patch_session(sid, patch):
    await _mongo().active_sessions.update_one({"_id": ObjectId(sid)}, {"$set": patch})


async def _get_session_doc(sid):
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
    assert emp
    return {"emp_id": emp["id"]}


@pytest.fixture(scope="module")
def lagos_office(owner_sess, emp_ids):
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_iter28_{uuid.uuid4().hex[:6]}",
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
    # active_liveness=TRUE for iteration 28 tests
    owner_sess.patch(f"{API}/org/settings", json={
        "auto_start_on_entry": True,
        "selfie_challenges_per_shift": 1,
        "selfie_response_window_minutes": 5,
        "selfie_mode": "random",
        "selfie_fixed_times": [],
        "accuracy_tolerance_meters": 50,
        "active_liveness": True,
    })
    owner_sess.patch(f"{API}/employees/{emp_ids['emp_id']}", json={"schedule": {"mode": "any"}})
    yield
    employee_sess.post(f"{API}/sessions/reset")
    owner_sess.delete(f"{API}/face/reset/{emp_ids['emp_id']}")


def _trigger_challenge(employee_sess):
    r = employee_sess.post(f"{API}/sessions/auto-start",
                           json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    ch_id = r.json()["challenges"][0]["id"]
    past = int(time.time() * 1000) - 60_000
    asyncio.run(_patch_session(sid, {"challenges.0.trigger_ms": past}))
    p = employee_sess.post(f"{API}/sessions/ping",
                           json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
    assert p.status_code == 200
    return sid, ch_id


# ---------- Active Liveness ----------

@pytest.mark.skipif(not NET_OK, reason="face images unavailable")
class TestActiveLiveness2FrameContract:
    """Missing liveness_frame/liveness_action with baseline+enforced must 400,
    and it must NOT consume an attempt."""

    def test_missing_liveness_frame_returns_400_no_attempt(self, employee_sess):
        obama = _as_data_url(_OBAMA)
        assert employee_sess.post(f"{API}/face/enroll",
                                  json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": obama})
        assert rr.status_code == 400, rr.text
        assert "Liveness check required" in rr.json()["detail"]

        doc = asyncio.run(_get_session_doc(sid))
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch.get("status") == "pending", db_ch
        assert int(db_ch.get("attempts", 0)) == 0, db_ch


@pytest.mark.skipif(not NET_OK, reason="face images unavailable")
class TestActiveLivenessFailureCap:
    """A liveness-fail (same neutral image as both frames, blink) counts as 1
    attempt; 5 such failures terminally mark 'missed' + flagged + security event."""

    def test_liveness_fail_counts_as_attempt(self, employee_sess):
        obama = _as_data_url(_OBAMA)
        assert employee_sess.post(f"{API}/face/enroll",
                                  json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": obama,
                                      "liveness_frame": obama,
                                      "liveness_action": "blink"})
        assert rr.status_code == 403, rr.text
        d = rr.json()["detail"]
        assert "Liveness" in d or "liveness" in d, d
        assert f"Attempt 1 of {MAX_ATTEMPTS}" in d, d

        doc = asyncio.run(_get_session_doc(sid))
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch.get("status") == "pending"
        assert db_ch.get("attempts") == 1

    def test_five_liveness_fails_terminal(self, employee_sess):
        obama = _as_data_url(_OBAMA)
        assert employee_sess.post(f"{API}/face/enroll",
                                  json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        for i in range(1, MAX_ATTEMPTS):
            rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                    json={"face_photo": obama,
                                          "liveness_frame": obama,
                                          "liveness_action": "blink"})
            assert rr.status_code == 403, (i, rr.text)

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": obama,
                                      "liveness_frame": obama,
                                      "liveness_action": "blink"})
        assert rr.status_code == 403
        d = rr.json()["detail"]
        assert "missed" in d.lower(), d

        doc = asyncio.run(_get_session_doc(sid))
        assert doc.get("flagged") is True
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch["status"] == "missed"
        assert db_ch.get("attempts") == MAX_ATTEMPTS

        # missed-selfie flag exposed via /sessions/me
        me = employee_sess.get(f"{API}/sessions/me").json()
        assert me.get("missed_selfie") is True
        assert me.get("missed_selfie_kind") == "failed"
        assert me.get("missed_selfie_count") >= 1

        # Terminal security event
        async def _find():
            return await _mongo().security_events.find_one(
                {"type": "liveness_failed", "details.terminal": True},
                sort=[("ts", -1)],
            )
        ev = asyncio.run(_find())
        assert ev is not None
        assert ev.get("severity") == "high"


@pytest.mark.skipif(not NET_OK, reason="face images unavailable")
class TestMatchFirstBeforeLiveness:
    """Wrong-person neutral frame -> face mismatch (not liveness reason)."""

    def test_mismatch_reported_first(self, employee_sess):
        obama = _as_data_url(_OBAMA)
        biden = _as_data_url(_BIDEN)
        assert employee_sess.post(f"{API}/face/enroll",
                                  json={"face_photo": obama}).status_code == 200
        sid, ch_id = _trigger_challenge(employee_sess)

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": biden,
                                      "liveness_frame": biden,
                                      "liveness_action": "blink"})
        assert rr.status_code == 403, rr.text
        assert "Face does not match" in rr.json()["detail"], rr.json()

        doc = asyncio.run(_get_session_doc(sid))
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch.get("attempts") == 1
        assert db_ch.get("status") == "pending"


# ---------- Auto-Timeout ----------

class TestAutoTimeout:

    def test_timeout_window_not_expired_400(self, employee_sess):
        sid, ch_id = _trigger_challenge(employee_sess)
        # Response window is 5 minutes in the future
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/timeout")
        assert rr.status_code == 400, rr.text
        assert "has not expired" in rr.json()["detail"]

    def test_timeout_after_window_expires(self, employee_sess):
        sid, ch_id = _trigger_challenge(employee_sess)
        past = int(time.time() * 1000) - 60_000
        asyncio.run(_patch_session(sid, {"challenges.0.respond_by_ms": past}))

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/timeout")
        assert rr.status_code == 200, rr.text
        data = rr.json()
        assert data.get("flagged") is True
        assert data.get("missed_selfie") is True
        assert data.get("missed_selfie_kind") == "ignored"

        doc = asyncio.run(_get_session_doc(sid))
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch["status"] == "expired"

        # Security event
        async def _find():
            return await _mongo().security_events.find_one(
                {"type": "selfie_missed", "details.challenge_id": ch_id,
                 "details.reason": "ignored"},
                sort=[("ts", -1)],
            )
        ev = asyncio.run(_find())
        assert ev is not None
        assert ev.get("severity") == "high"

        # Idempotent
        rr2 = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/timeout")
        assert rr2.status_code == 200, rr2.text
        assert rr2.json().get("missed_selfie") is True

    def test_timeout_missing_challenge_404(self, employee_sess):
        r = employee_sess.post(f"{API}/sessions/auto-start",
                               json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r.status_code == 200
        rr = employee_sess.post(f"{API}/sessions/challenge/does_not_exist/timeout")
        assert rr.status_code == 404


# ---------- Server tick expiry ----------

class TestServerTickExpiry:
    def test_tick_expires_and_logs_security_event(self, employee_sess):
        sid, ch_id = _trigger_challenge(employee_sess)
        past = int(time.time() * 1000) - 60_000
        asyncio.run(_patch_session(sid, {"challenges.0.respond_by_ms": past}))

        # /sessions/me runs _tick_challenge_lifecycle
        me = employee_sess.get(f"{API}/sessions/me").json()
        assert me.get("flagged") is True, me
        assert me.get("missed_selfie") is True
        assert me.get("missed_selfie_kind") == "ignored"

        doc = asyncio.run(_get_session_doc(sid))
        db_ch = next(c for c in doc["challenges"] if c["id"] == ch_id)
        assert db_ch["status"] == "expired"

        async def _find():
            return await _mongo().security_events.find_one(
                {"type": "selfie_missed", "details.challenge_id": ch_id,
                 "details.reason": "ignored"},
                sort=[("ts", -1)],
            )
        ev = asyncio.run(_find())
        assert ev is not None
        assert ev.get("severity") == "high"


# ---------- liveness_action surfacing ----------

class TestLivenessActionSurfaced:
    VALID = {"blink", "turn_left", "turn_right"}

    def test_liveness_action_in_me_active_challenge(self, employee_sess):
        sid, ch_id = _trigger_challenge(employee_sess)
        me = employee_sess.get(f"{API}/sessions/me").json()
        active = me.get("active_challenge")
        assert active is not None, me
        assert active.get("liveness_action") in self.VALID, active

    def test_liveness_action_in_live_and_challenge_now(self, owner_sess, employee_sess, emp_ids):
        r = employee_sess.post(f"{API}/sessions/auto-start",
                               json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r.status_code == 200
        # challenge-now creates a pending challenge with a liveness_action
        rr = owner_sess.post(f"{API}/sessions/challenge-now/{emp_ids['emp_id']}")
        assert rr.status_code == 200, rr.text
        active = rr.json().get("active_challenge")
        assert active is not None
        assert active.get("liveness_action") in self.VALID

        # /sessions/live also surfaces it
        live = owner_sess.get(f"{API}/sessions/live").json()
        # find our session
        row = next((s for s in live if s["user_id"] == emp_ids["emp_id"]), None)
        assert row is not None
        assert row.get("active_challenge") is not None
        assert row["active_challenge"].get("liveness_action") in self.VALID


# ---------- Direct analyze_frames sanity ----------

class TestAnalyzeFramesDirect:
    """Import the analyzer and call it with the same-image blink to confirm
    it returns passed=False (this is the deterministic 5-cap driver)."""

    def test_same_neutral_image_blink_fails(self):
        import sys
        sys.path.insert(0, "/app/backend")
        if not NET_OK:
            pytest.skip("images unavailable")
        from services.active_liveness import analyze_frames
        obama = _as_data_url(_OBAMA)
        out = analyze_frames(None, obama, obama, "blink")
        assert out["passed"] is False
        assert out.get("reason") in ("no_blink_detected", "eyes_not_open_in_first_frame")
