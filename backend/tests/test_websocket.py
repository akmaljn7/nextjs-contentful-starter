"""WebSocket + real-time push tests for /api/ws/live (iteration 3)."""
import os
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
# Use localhost for WS to bypass any ingress WS issues; backend runs on 8001
WS_LOCAL = "ws://localhost:8001/api/ws/live"

OWNER_EMAIL = "akmaljn7@gmail.com"
OWNER_PW = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PW = "Employee123!"

OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS = 6.5244, 3.3792, 200
IN_LAT, IN_LNG = 6.5245, 3.3793


# ---------- helpers ----------

def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return s


def _access_token(sess):
    tok = sess.cookies.get("access_token")
    assert tok, "no access_token cookie"
    return tok


@pytest.fixture(scope="module")
def owner_sess():
    return _login(OWNER_EMAIL, OWNER_PW)


@pytest.fixture(scope="module")
def nigerian_setup(owner_sess):
    """Create Nigerian office and assign sample employee."""
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp
    emp_id = emp["id"]
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_WSLagos_{uuid.uuid4().hex[:6]}",
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


async def _recv_until(ws, predicate, timeout=5.0):
    """Read frames until predicate(msg_dict) is True or timeout."""
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


# ---------- Tests ----------

@pytest.mark.asyncio
async def test_ws_hello_with_valid_token(owner_sess):
    token = _access_token(owner_sess)
    async with websockets.connect(f"{WS_LOCAL}?token={token}") as ws:
        raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
        msg = json.loads(raw)
        assert msg.get("type") == "hello"
        assert isinstance(msg.get("org_id"), str) and msg["org_id"]


@pytest.mark.asyncio
async def test_ws_rejects_no_token():
    # No token → server sends error frame + close 4401
    try:
        async with websockets.connect(WS_LOCAL) as ws:
            raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            msg = json.loads(raw)
            assert msg.get("type") == "error"
            # Expect close shortly after
            with pytest.raises(Exception):
                for _ in range(5):
                    await asyncio.wait_for(ws.recv(), timeout=2.0)
    except websockets.exceptions.ConnectionClosed as e:
        assert e.code == 4401


@pytest.mark.asyncio
async def test_ws_rejects_employee_role(employee_sess):
    token = _access_token(employee_sess)
    closed_code = None
    try:
        async with websockets.connect(f"{WS_LOCAL}?token={token}") as ws:
            # Expect error frame then close 4401
            raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            msg = json.loads(raw)
            assert msg.get("type") == "error"
            try:
                await asyncio.wait_for(ws.recv(), timeout=3.0)
            except websockets.exceptions.ConnectionClosed as e:
                closed_code = e.code
    except websockets.exceptions.ConnectionClosed as e:
        closed_code = e.code
    assert closed_code == 4401, f"expected 4401, got {closed_code}"


@pytest.mark.asyncio
async def test_ws_push_on_session_start(owner_sess, employee_sess, nigerian_setup):
    # ensure no prior session
    employee_sess.post(f"{API}/sessions/reset")
    token = _access_token(owner_sess)
    async with websockets.connect(f"{WS_LOCAL}?token={token}") as ws:
        # consume hello
        hello = json.loads(await asyncio.wait_for(ws.recv(), timeout=5.0))
        assert hello["type"] == "hello"

        # Trigger session.start in a thread so WS reads concurrently
        loop = asyncio.get_event_loop()
        fut = loop.run_in_executor(
            None,
            lambda: employee_sess.post(
                f"{API}/sessions/start",
                json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10},
            ),
        )
        msg = await _recv_until(ws, lambda m: m.get("type") == "session.update", timeout=6.0)
        r = await fut
        assert r.status_code == 200, r.text
        assert msg, "did not receive session.update within 6s"
        assert msg["session"].get("employee_name") is not None
        assert msg["session"]["status"] == "active"


@pytest.mark.asyncio
async def test_ws_push_on_ping(owner_sess, employee_sess, nigerian_setup):
    # ensure active
    me = employee_sess.get(f"{API}/sessions/me").json()
    if not me:
        employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
    time.sleep(0.5)
    token = _access_token(owner_sess)
    async with websockets.connect(f"{WS_LOCAL}?token={token}") as ws:
        await asyncio.wait_for(ws.recv(), timeout=5.0)  # hello
        loop = asyncio.get_event_loop()
        fut = loop.run_in_executor(
            None,
            lambda: employee_sess.post(
                f"{API}/sessions/ping",
                json={"lat": IN_LAT + 0.00001, "lng": IN_LNG + 0.00001, "accuracy": 10},
            ),
        )
        msg = await _recv_until(ws, lambda m: m.get("type") == "session.update", timeout=6.0)
        r = await fut
        assert r.status_code == 200, r.text
        assert msg, "no session.update after ping"
        lf = msg["session"].get("last_fix") or {}
        assert lf.get("lat") is not None


@pytest.mark.asyncio
async def test_ws_push_on_reset(owner_sess, employee_sess, nigerian_setup):
    me = employee_sess.get(f"{API}/sessions/me").json()
    if not me:
        employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
    time.sleep(0.4)
    token = _access_token(owner_sess)
    async with websockets.connect(f"{WS_LOCAL}?token={token}") as ws:
        await asyncio.wait_for(ws.recv(), timeout=5.0)  # hello
        loop = asyncio.get_event_loop()
        fut = loop.run_in_executor(None, lambda: employee_sess.post(f"{API}/sessions/reset"))
        msg = await _recv_until(ws, lambda m: m.get("type") == "session.end", timeout=6.0)
        r = await fut
        assert r.status_code == 200
        assert msg, "no session.end after reset"
        assert msg.get("outcome") == "reset"


@pytest.mark.asyncio
async def test_ws_push_on_force_expire(owner_sess, employee_sess, nigerian_setup):
    employee_sess.post(f"{API}/sessions/reset")
    r = employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
    assert r.status_code == 200
    emp_id = nigerian_setup["emp_id"]
    token = _access_token(owner_sess)
    async with websockets.connect(f"{WS_LOCAL}?token={token}") as ws:
        await asyncio.wait_for(ws.recv(), timeout=5.0)  # hello
        loop = asyncio.get_event_loop()
        fut = loop.run_in_executor(
            None, lambda: owner_sess.post(f"{API}/sessions/force-expire/{emp_id}")
        )
        msg = await _recv_until(ws, lambda m: m.get("type") == "session.end", timeout=6.0)
        r2 = await fut
        assert r2.status_code == 200, r2.text
        assert msg, "no session.end after force-expire"
        assert msg.get("outcome") == "force_expired"


@pytest.mark.asyncio
async def test_ws_tenant_isolation(owner_sess, employee_sess, nigerian_setup):
    """New TEST_ org owner must NOT receive events from the primary org."""
    # Register a new org
    other_email = f"TEST_owner_{uuid.uuid4().hex[:8]}@example.com"
    other_pw = "TestPass123!"
    s_other = requests.Session()
    r = s_other.post(f"{API}/auth/register-org", json={
        "org_name": f"TEST_Iso_{uuid.uuid4().hex[:6]}",
        "owner_name": "Iso Owner",
        "email": other_email,
        "password": other_pw,
    })
    assert r.status_code == 200, r.text
    # Login to get cookie
    s_other = _login(other_email, other_pw)
    other_token = _access_token(s_other)

    # ensure no active session
    employee_sess.post(f"{API}/sessions/reset")

    async with websockets.connect(f"{WS_LOCAL}?token={other_token}") as ws:
        hello = json.loads(await asyncio.wait_for(ws.recv(), timeout=5.0))
        assert hello["type"] == "hello"
        other_org = hello["org_id"]

        # Trigger session activity in the primary org
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            None,
            lambda: employee_sess.post(
                f"{API}/sessions/start",
                json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10},
            ),
        )
        # Should NOT get any session.* frame within 3s
        leaked = await _recv_until(
            ws, lambda m: m.get("type", "").startswith("session."), timeout=3.0
        )
        assert leaked is None, f"Tenant isolation broken — got frame: {leaked}"
        # Confirm the other org id differs; just a sanity assertion
        assert other_org
    # cleanup: reset employee session
    employee_sess.post(f"{API}/sessions/reset")


# ---------- Regression: /api/sessions/live ----------

def test_live_endpoint_regression(owner_sess):
    # /api/sessions/live must return 200 with a list for an admin (shape check).
    live = owner_sess.get(f"{API}/sessions/live")
    assert live.status_code == 200
    data = live.json()
    assert isinstance(data, list)
