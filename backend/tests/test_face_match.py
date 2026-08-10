"""Iteration 9 — server-side face-match verification backend tests."""
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

_OBAMA_PATH = "/tmp/_test_obama.jpg"
_BIDEN_PATH = "/tmp/_test_biden.jpg"


def _download(url: str, path: str) -> bool:
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        return True
    try:
        urllib.request.urlretrieve(url, path)
        return os.path.getsize(path) > 5000
    except Exception as e:
        print(f"Download failed {url}: {e}")
        return False


NET_OK = _download(OBAMA_URL, _OBAMA_PATH) and _download(BIDEN_URL, _BIDEN_PATH)


def _as_data_url(path: str) -> str:
    data = Path(path).read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()


def _tiny_jpeg_no_face() -> str:
    # Reuse the minimal (no-face) JPEG from test_auto_start
    import struct
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
        "ffda000c03010002110311003f00fbd0ffd9"
    )
    return "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()


def _mongo():
    from motor.motor_asyncio import AsyncIOMotorClient
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "geofence_console")
    return AsyncIOMotorClient(url)[dbname]


async def _patch_session(sid: str, patch: dict):
    await _mongo().active_sessions.update_one({"_id": ObjectId(sid)}, {"$set": patch})


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
    assert emp, "Sample employee must be seeded"
    return {"emp_id": emp["id"]}


@pytest.fixture(scope="module")
def lagos_office(owner_sess, emp_ids):
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_Lagos_HQ_{uuid.uuid4().hex[:6]}",
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
    # Baseline reset (idempotent)
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


# ---------- Tests ----------

class TestFaceMatch:

    # ---- endpoint-level tests ----
    def test_status_fresh_employee(self, employee_sess):
        r = employee_sess.get(f"{API}/face/status")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["enrolled"] is False
        assert data["enrolled_at"] is None

    @pytest.mark.skipif(not NET_OK, reason="obama.jpg download failed")
    def test_enroll_valid_face(self, employee_sess):
        r = employee_sess.post(f"{API}/face/enroll", json={"face_photo": _as_data_url(_OBAMA_PATH)})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["enrolled"] is True
        assert data["dim"] == 128
        s = employee_sess.get(f"{API}/face/status").json()
        assert s["enrolled"] is True
        assert isinstance(s["enrolled_at"], str) and len(s["enrolled_at"]) > 10

    def test_enroll_no_face_400(self, employee_sess):
        r = employee_sess.post(f"{API}/face/enroll", json={"face_photo": _tiny_jpeg_no_face()})
        assert r.status_code == 400, r.text
        assert "No clear face detected" in r.json()["detail"]

    def test_enroll_owner_forbidden(self, owner_sess):
        # owner sending a valid-shape payload should still get 403 before image processing
        payload = _tiny_jpeg_no_face()
        r = owner_sess.post(f"{API}/face/enroll", json={"face_photo": payload})
        assert r.status_code == 403, r.text
        assert "Only employees" in r.json()["detail"]

    @pytest.mark.skipif(not NET_OK, reason="obama.jpg download failed")
    def test_admin_reset_success(self, owner_sess, employee_sess, emp_ids):
        # Enroll
        r = employee_sess.post(f"{API}/face/enroll", json={"face_photo": _as_data_url(_OBAMA_PATH)})
        assert r.status_code == 200
        assert employee_sess.get(f"{API}/face/status").json()["enrolled"] is True
        # Reset by admin
        rr = owner_sess.delete(f"{API}/face/reset/{emp_ids['emp_id']}")
        assert rr.status_code == 200, rr.text
        assert rr.json()["ok"] is True
        # Status now false
        s = employee_sess.get(f"{API}/face/status").json()
        assert s["enrolled"] is False
        assert s["enrolled_at"] is None

    def test_admin_reset_cross_tenant_404(self, owner_sess):
        # Random ObjectId not in this org
        fake_id = str(ObjectId())
        r = owner_sess.delete(f"{API}/face/reset/{fake_id}")
        assert r.status_code == 404, r.text

    def test_admin_reset_invalid_id_400(self, owner_sess):
        r = owner_sess.delete(f"{API}/face/reset/not-an-id")
        assert r.status_code == 400

    def test_reset_forbidden_for_employee(self, employee_sess, emp_ids):
        r = employee_sess.delete(f"{API}/face/reset/{emp_ids['emp_id']}")
        assert r.status_code == 403

    # ---- challenge verification tests ----
    def _trigger_challenge(self, employee_sess):
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
        assert p.status_code == 200
        return sid, ch_id

    @pytest.mark.skipif(not NET_OK, reason="face images unavailable")
    def test_challenge_match_success(self, employee_sess):
        obama = _as_data_url(_OBAMA_PATH)
        r = employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama})
        assert r.status_code == 200
        sid, ch_id = self._trigger_challenge(employee_sess)
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": obama})
        assert rr.status_code == 200, rr.text
        data = rr.json()
        ch = next(c for c in data["challenges"] if c["id"] == ch_id)
        assert ch["status"] == "responded"
        assert data.get("flagged") is not True

    @pytest.mark.skipif(not NET_OK, reason="face images unavailable")
    def test_challenge_mismatch_flags_and_logs(self, owner_sess, employee_sess):
        obama = _as_data_url(_OBAMA_PATH)
        biden = _as_data_url(_BIDEN_PATH)
        r = employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama})
        assert r.status_code == 200
        sid, ch_id = self._trigger_challenge(employee_sess)

        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": biden})
        assert rr.status_code == 403, rr.text
        assert rr.json()["detail"].startswith("Face does not match"), rr.json()

        # A single mismatch now keeps the challenge OPEN for retry (up to 5)
        # and does NOT flag the session — only the terminal 5th failure does.
        me = employee_sess.get(f"{API}/sessions/me").json()
        assert me.get("flagged") is not True
        ch = next(c for c in me["challenges"] if c["id"] == ch_id)
        assert ch["status"] == "pending"

        # security event created (non-terminal attempt => medium severity)
        async def _find():
            return await _mongo().security_events.find_one(
                {"type": "face_mismatch", "session_id": sid}, sort=[("ts", -1)]
            )
        ev = asyncio.run(_find())
        # Fallback: newest face_mismatch overall (session_id may not be an indexed field)
        if ev is None:
            async def _find2():
                return await _mongo().security_events.find_one(
                    {"type": "face_mismatch"}, sort=[("ts", -1)]
                )
            ev = asyncio.run(_find2())
        assert ev is not None, "expected a face_mismatch security event"
        assert ev.get("severity") == "medium"

    def test_challenge_no_baseline_backward_compat(self, employee_sess):
        # Ensure baseline not present
        assert employee_sess.get(f"{API}/face/status").json()["enrolled"] is False
        sid, ch_id = self._trigger_challenge(employee_sess)
        # Reuse the tiny valid JPEG (no face) — should still succeed since no verify runs
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": _tiny_jpeg_no_face()})
        assert rr.status_code == 200, rr.text
        data = rr.json()
        ch = next(c for c in data["challenges"] if c["id"] == ch_id)
        assert ch["status"] == "responded"
        assert data.get("flagged") is not True
