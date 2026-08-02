"""Face-photo (session check-in photo) tests — iteration 4.

Covers:
- POST /api/sessions/start with valid face_photo → has_photo=true, GET photo returns image/jpeg
- POST /api/sessions/start WITHOUT face_photo → has_photo=false (backward compat)
- POST /api/sessions/start with malformed base64 → 200 & has_photo=false (best-effort)
- POST /api/sessions/start with sub-512B decoded photo → has_photo=false (sanity gate)
- GET /api/photos/session/{unknown} → 404
- GET /api/photos/session/{id} without auth → 401
- Tenant isolation: foreign-org owner cannot fetch photo (404)
- /api/sessions/live payload includes has_photo boolean
- WebSocket session.update payload includes has_photo=true after photo upload
- Geofence + accuracy checks still enforced when photo included
- Attendance hash-chain fields still present after photo session lifecycle
"""
import os
import base64
import json
import time
import uuid
import asyncio
import pytest
import requests
import websockets

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"
WS_LOCAL = "ws://localhost:8001/api/ws/live"

OWNER_EMAIL = "akmaljn7@gmail.com"
OWNER_PW = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PW = "Employee123!"

OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS = 6.5244, 3.3792, 200
IN_LAT, IN_LNG = 6.5245, 3.3793
OUT_LAT, OUT_LNG = 6.6244, 3.3792


# ---------- helpers ----------

def _tiny_jpeg_data_url() -> tuple[str, bytes]:
    """Build a valid >512B blob (SOI/APP0/EOI padded with zeros). Base64-encoded data URL."""
    header = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
                    0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
    body = header + (b"\x00" * 1024) + bytes([0xff, 0xd9])
    b64 = base64.b64encode(body).decode()
    return f"data:image/jpeg;base64,{b64}", body


def _small_valid_base64_under_512() -> str:
    # Only ~40 bytes decoded → under sanity gate
    raw = b"\xff\xd8\xff\xe0" + (b"\x01" * 20) + b"\xff\xd9"
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return s


def _access_token(sess):
    tok = sess.cookies.get("access_token")
    assert tok
    return tok


def _start_with_retry(sess, payload, retries=6):
    """Start a session, tolerating brief cross-worker contention on the shared employee."""
    for _ in range(retries):
        sess.post(f"{API}/sessions/reset")
        r = sess.post(f"{API}/sessions/start", json=payload)
        if r.status_code != 400 or "already active" not in r.text.lower():
            return r
        time.sleep(0.4)
    return r


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def owner_sess():
    return _login(OWNER_EMAIL, OWNER_PW)


@pytest.fixture(scope="module")
def nigerian_setup(owner_sess):
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp
    emp_id = emp["id"]
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_PhLagos_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    r2 = owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": office_id})
    assert r2.status_code == 200
    yield {"office_id": office_id, "emp_id": emp_id}
    try:
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


@pytest.fixture(scope="module")
def employee_sess(nigerian_setup):
    s = _login(EMP_EMAIL, EMP_PW)
    s.post(f"{API}/sessions/reset")
    return s


# ---------- Tests ----------

class TestPhotos:
    def test_start_with_valid_face_photo(self, employee_sess, owner_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        data_url, raw_bytes = _tiny_jpeg_data_url()
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
            "face_photo": data_url,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "active"
        assert body.get("has_photo") is True, f"has_photo missing/false: {body}"
        session_id = body["id"]

        # GET photo via owner (admin, same org)
        r2 = owner_sess.get(f"{API}/photos/session/{session_id}")
        assert r2.status_code == 200, r2.text
        assert "image/jpeg" in r2.headers.get("content-type", "")
        assert r2.content == raw_bytes, "photo bytes must round-trip exactly"

        employee_sess.post(f"{API}/sessions/reset")

    def test_start_without_face_photo(self, employee_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("has_photo") is False
        employee_sess.post(f"{API}/sessions/reset")

    def test_start_with_malformed_base64(self, employee_sess, owner_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
            "face_photo": "data:image/jpeg;base64,!!!bad_not_valid_b64!!!",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("has_photo") is False
        sid = body["id"]
        r2 = owner_sess.get(f"{API}/photos/session/{sid}")
        assert r2.status_code == 404
        employee_sess.post(f"{API}/sessions/reset")

    def test_start_with_undersized_photo(self, employee_sess, owner_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
            "face_photo": _small_valid_base64_under_512(),
        })
        assert r.status_code == 200, r.text
        assert r.json().get("has_photo") is False
        sid = r.json()["id"]
        r2 = owner_sess.get(f"{API}/photos/session/{sid}")
        assert r2.status_code == 404
        employee_sess.post(f"{API}/sessions/reset")


    # --- section ---
    def test_get_unknown_session_returns_404(self, owner_sess):
        r = owner_sess.get(f"{API}/photos/session/{uuid.uuid4().hex}")
        assert r.status_code == 404

    def test_get_photo_requires_auth(self, employee_sess, nigerian_setup):
        # First create a real photo-backed session
        employee_sess.post(f"{API}/sessions/reset")
        data_url, _ = _tiny_jpeg_data_url()
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10, "face_photo": data_url,
        })
        assert r.status_code == 200
        sid = r.json()["id"]

        # Unauthenticated fetch
        anon = requests.Session()
        r2 = anon.get(f"{API}/photos/session/{sid}")
        assert r2.status_code == 401, f"expected 401, got {r2.status_code} {r2.text}"
        employee_sess.post(f"{API}/sessions/reset")

    def test_tenant_isolation_photo(self, employee_sess, nigerian_setup):
        """Foreign-org owner must get 404 for another org's photo."""
        employee_sess.post(f"{API}/sessions/reset")
        data_url, _ = _tiny_jpeg_data_url()
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10, "face_photo": data_url,
        })
        assert r.status_code == 200
        sid = r.json()["id"]

        # Register a fresh org and login
        other_email = f"TEST_photo_iso_{uuid.uuid4().hex[:8]}@example.com"
        other_pw = "TestPass123!"
        s = requests.Session()
        rr = s.post(f"{API}/auth/register-org", json={
            "org_name": f"TEST_PhIso_{uuid.uuid4().hex[:6]}",
            "owner_name": "Iso", "email": other_email, "password": other_pw,
        })
        assert rr.status_code == 200, rr.text
        s2 = _login(other_email, other_pw)
        r2 = s2.get(f"{API}/photos/session/{sid}")
        assert r2.status_code == 404, f"tenant isolation broken: {r2.status_code} {r2.text}"

        employee_sess.post(f"{API}/sessions/reset")


    # --- section ---
    def test_live_endpoint_includes_has_photo(self, employee_sess, owner_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        data_url, _ = _tiny_jpeg_data_url()
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10, "face_photo": data_url,
        })
        assert r.status_code == 200

        live = owner_sess.get(f"{API}/sessions/live")
        assert live.status_code == 200
        rows = live.json()
        assert isinstance(rows, list) and rows
        row = next((x for x in rows if x["id"] == r.json()["id"]), None)
        assert row is not None
        assert "has_photo" in row and row["has_photo"] is True
        employee_sess.post(f"{API}/sessions/reset")

    def test_live_endpoint_has_photo_false_when_no_photo(self, employee_sess, owner_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200
        live = owner_sess.get(f"{API}/sessions/live")
        row = next((x for x in live.json() if x["id"] == r.json()["id"]), None)
        assert row is not None
        assert row.get("has_photo") is False
        employee_sess.post(f"{API}/sessions/reset")


    # --- section ---
    def test_photo_does_not_bypass_geofence(self, employee_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        data_url, _ = _tiny_jpeg_data_url()
        r = _start_with_retry(employee_sess, {
            "lat": OUT_LAT, "lng": OUT_LNG, "accuracy": 10, "face_photo": data_url,
        })
        assert r.status_code == 403

    def test_photo_does_not_bypass_accuracy(self, employee_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        data_url, _ = _tiny_jpeg_data_url()
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 9999, "face_photo": data_url,
        })
        assert r.status_code == 400


    # --- section ---
    def test_hash_chain_after_photo_session(self, employee_sess, owner_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        data_url, _ = _tiny_jpeg_data_url()
        r = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10, "face_photo": data_url,
        })
        assert r.status_code == 200
        r2 = employee_sess.post(f"{API}/sessions/reset")
        assert r2.status_code == 200
        recs = owner_sess.get(f"{API}/attendance/records").json()
        assert recs
        latest = recs[0]
        assert latest.get("record_hash")
        assert "prev_record_hash" in latest
        assert latest["outcome"] == "reset"

    @pytest.mark.asyncio
    async def test_ws_broadcast_includes_has_photo(self, owner_sess, employee_sess, nigerian_setup):
        employee_sess.post(f"{API}/sessions/reset")
        token = _access_token(owner_sess)
        data_url, _ = _tiny_jpeg_data_url()
        async with websockets.connect(f"{WS_LOCAL}?token={token}") as ws:
            hello = json.loads(await asyncio.wait_for(ws.recv(), timeout=5.0))
            assert hello["type"] == "hello"
            loop = asyncio.get_event_loop()
            fut = loop.run_in_executor(None, lambda: _start_with_retry(employee_sess,
                {"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10, "face_photo": data_url},
            ))
            msg = await _recv_until(ws, lambda m: m.get("type") == "session.update", timeout=8.0)
            r = await fut
            assert r.status_code == 200, r.text
            assert msg, "did not receive session.update"
            assert msg["session"].get("has_photo") is True, f"has_photo missing in WS payload: {msg}"
        employee_sess.post(f"{API}/sessions/reset")


# ---------- WebSocket has_photo verification helper ----------

async def _recv_until(ws, predicate, timeout=6.0):
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return None
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            return None
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        if predicate(msg):
            return msg
