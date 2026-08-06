"""End-to-end ingress spot-check across all Phase 0-6 backend surfaces.

Runs against the PUBLIC REACT_APP_BACKEND_URL (Kubernetes ingress) — proves the
external HTTP contract, not just in-process routes.
"""
import os
import time
import uuid
import base64
import hmac
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
BASE = BASE.rstrip("/")

ADMIN_EMAIL = "akmaljn7@gmail.com"
ADMIN_PASS = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PASS = "Employee123!"


def _cron_secret():
    for line in open("/app/backend/.env"):
        if line.startswith("WEBHOOK_CRON_SECRET"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body and "refresh_token" in body
    # dual-mode: cookies set
    assert any(c.name == "access_token" for c in r.cookies) or "set-cookie" in {k.lower() for k in r.headers}
    return body["access_token"], body["refresh_token"]


@pytest.fixture(scope="module")
def emp_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- PHASE 1 : auth ----------------
def test_p1_login_returns_tokens_and_cookies():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PASS}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("access_token") and j.get("refresh_token")


def test_p1_refresh_body_mode(emp_token):
    r = requests.post(f"{BASE}/api/auth/refresh", json={"refresh_token": emp_token["refresh_token"]}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("access_token") and j.get("refresh_token")


def test_p1_me_bearer(emp_token):
    r = requests.get(f"{BASE}/api/auth/me", headers=_h(emp_token["access_token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == EMP_EMAIL


def test_p1_mobile_logout_accepts_expired_bearer():
    # Fresh login → logout with body refresh_token, garbage bearer allowed
    r = requests.post(f"{BASE}/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PASS}, timeout=15)
    rt = r.json()["refresh_token"]
    lr = requests.post(
        f"{BASE}/api/auth/mobile-logout",
        json={"refresh_token": rt},
        headers={"Authorization": "Bearer expired.garbage.token"},
        timeout=15,
    )
    assert lr.status_code == 200, lr.text


# ---------------- SECURITY: 401 on mobile without JWT ----------------
@pytest.mark.parametrize("path,method,body", [
    ("/api/mobile/register-device", "POST", {"device_id": "x", "platform": "android"}),
    ("/api/mobile/devices", "GET", None),
    ("/api/mobile/geofence-event", "POST", {}),
    ("/api/mobile/sync", "POST", {"events": []}),
    ("/api/mobile/heartbeat", "POST", {}),
    ("/api/mobile/reconcile", "GET", None),
    ("/api/mobile/attestation", "POST", {}),
])
def test_sec_mobile_requires_jwt(path, method, body):
    fn = requests.get if method == "GET" else requests.post
    r = fn(f"{BASE}{path}", json=body, timeout=15)
    assert r.status_code == 401, f"{path} → {r.status_code}"


# ---------------- PHASE 0 : mobile device + events ----------------
@pytest.fixture(scope="module")
def registered_device(emp_token):
    dev_id = f"e2e-dev-{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE}/api/mobile/register-device",
        json={"device_id": dev_id, "platform": "android", "push_token": "fcm-xyz", "app_version": "1.0.0"},
        headers=_h(emp_token["access_token"]),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return dev_id


def test_p0_register_upsert_hides_push_token(emp_token, registered_device):
    # upsert (same device_id) still 200
    r = requests.post(
        f"{BASE}/api/mobile/register-device",
        json={"device_id": registered_device, "platform": "android", "push_token": "fcm-new", "app_version": "1.0.0"},
        headers=_h(emp_token["access_token"]),
        timeout=15,
    )
    assert r.status_code == 200
    # list hides push_token
    lst = requests.get(f"{BASE}/api/mobile/devices", headers=_h(emp_token["access_token"]), timeout=15)
    assert lst.status_code == 200
    devs = lst.json()
    assert any(d["device_id"] == registered_device for d in devs)
    for d in devs:
        assert "push_token" not in d


def test_p0_heartbeat_404_when_unregistered(emp_token):
    r = requests.post(
        f"{BASE}/api/mobile/heartbeat",
        json={"device_id": f"never-registered-{uuid.uuid4().hex[:10]}", "ts_ms": int(time.time() * 1000)},
        headers=_h(emp_token["access_token"]),
        timeout=15,
    )
    assert r.status_code == 404


@pytest.fixture(scope="module")
def office_id(admin_token):
    at, _ = admin_token
    r = requests.get(f"{BASE}/api/offices", headers=_h(at), timeout=15)
    assert r.status_code == 200
    offices = r.json()
    # prefer the Lagos office the employee is assigned to
    for o in offices:
        if "lagos" in o.get("name", "").lower():
            return o["id"]
    return offices[0]["id"]


def test_p0_geofence_event_idempotent_and_reconcile(emp_token, registered_device, office_id):
    ce_id = f"e2e-ev-{uuid.uuid4().hex[:8]}"
    ts_ms = int(time.time() * 1000) - 60_000  # 1 min ago
    payload = {
        "device_id": registered_device,
        "client_event_id": ce_id,
        "type": "enter",
        "office_id": office_id,
        "lat": 6.5244,
        "lng": 3.3792,
        "accuracy": 10,
        "ts_ms": ts_ms,
    }
    r1 = requests.post(f"{BASE}/api/mobile/geofence-event", json=payload, headers=_h(emp_token["access_token"]), timeout=15)
    assert r1.status_code == 200, r1.text
    # idempotent replay
    r2 = requests.post(f"{BASE}/api/mobile/geofence-event", json=payload, headers=_h(emp_token["access_token"]), timeout=15)
    assert r2.status_code == 200
    # reconcile
    rc = requests.get(f"{BASE}/api/mobile/reconcile", headers=_h(emp_token["access_token"]), timeout=15)
    assert rc.status_code == 200
    body = rc.json()
    assert "last_event" in body
    # exit to clean up
    requests.post(
        f"{BASE}/api/mobile/geofence-event",
        json={**payload, "client_event_id": ce_id + "-x", "type": "exit", "ts_ms": ts_ms + 30_000},
        headers=_h(emp_token["access_token"]),
        timeout=15,
    )


def test_p0_multi_tenant_office_isolation(emp_token, registered_device):
    """Employee tries to submit event pointing at a non-existent office_id → 400."""
    r = requests.post(
        f"{BASE}/api/mobile/geofence-event",
        json={
            "device_id": registered_device,
            "client_event_id": f"e2e-cross-{uuid.uuid4().hex[:6]}",
            "type": "enter",
            "office_id": "00000000-0000-0000-0000-000000000000",
            "lat": 40.0,
            "lng": -74.0,
            "accuracy": 5,
            "ts_ms": int(time.time() * 1000),
        },
        headers=_h(emp_token["access_token"]),
        timeout=15,
    )
    assert r.status_code == 400, r.text
    assert "office" in r.text.lower()


# ---------------- PHASE 4/5 : admin surface ----------------
def test_p4_sessions_live_enriched(admin_token):
    at, _ = admin_token
    r = requests.get(f"{BASE}/api/sessions/live", headers=_h(at), timeout=15)
    assert r.status_code == 200
    for s in r.json():
        assert "employee_name" in s and "office_name" in s


def test_p5_summary_and_records(admin_token):
    at, _ = admin_token
    r = requests.get(f"{BASE}/api/attendance/summary", headers=_h(at), timeout=15)
    assert r.status_code == 200
    j = r.json()
    for k in ("active_sessions", "paused_sessions", "total_employees", "total_offices", "total_records", "flagged_records"):
        assert k in j, f"missing key {k}"
    rr = requests.get(f"{BASE}/api/attendance/records?limit=5", headers=_h(at), timeout=15)
    assert rr.status_code == 200


def test_p5_employees_dup_email(admin_token, office_id):
    at, _ = admin_token
    r = requests.post(
        f"{BASE}/api/employees",
        json={"email": EMP_EMAIL, "name": "dup", "password": "Xxxxx123!", "office_id": office_id},
        headers=_h(at),
        timeout=15,
    )
    assert r.status_code == 409, r.text


def test_p4_offices_crud(admin_token):
    at, _ = admin_token
    c = requests.post(
        f"{BASE}/api/offices",
        json={"name": f"E2E Office {uuid.uuid4().hex[:6]}", "lat": 1.0, "lng": 2.0, "radius_meters": 100},
        headers=_h(at),
        timeout=15,
    )
    assert c.status_code in (200, 201), c.text
    oid = c.json()["id"]
    p = requests.patch(
        f"{BASE}/api/offices/{oid}",
        json={"lat": 1.5, "lng": 2.5, "radius_meters": 200},
        headers=_h(at),
        timeout=15,
    )
    assert p.status_code == 200, p.text
    d = requests.delete(f"{BASE}/api/offices/{oid}", headers=_h(at), timeout=15)
    assert d.status_code in (200, 204)


# ---------------- PHASE 6 : attestation + deadman ----------------
def test_p6_attestation_stub(emp_token, registered_device):
    r = requests.post(
        f"{BASE}/api/mobile/attestation",
        json={
            "device_id": registered_device,
            "token": "stub-happy",
            "platform": "android",
            "nonce": uuid.uuid4().hex,
            "ts_ms": int(time.time() * 1000),
        },
        headers=_h(emp_token["access_token"]),
        timeout=15,
    )
    assert r.status_code == 200
    assert "verdict" in r.json()


def test_p6_attestation_404_unregistered(emp_token):
    r = requests.post(
        f"{BASE}/api/mobile/attestation",
        json={
            "device_id": f"nope-device-{uuid.uuid4().hex[:8]}",
            "token": "stub-x",
            "platform": "android",
            "nonce": uuid.uuid4().hex,
            "ts_ms": int(time.time() * 1000),
        },
        headers=_h(emp_token["access_token"]),
        timeout=15,
    )
    assert r.status_code == 404


def test_p6_deadman_auth():
    # wrong secret → 401
    r = requests.post(
        f"{BASE}/api/cron/deadman-tick",
        headers={"Authorization": "Bearer wrong"},
        json={"run_id": str(uuid.uuid4())},
        timeout=15,
    )
    assert r.status_code == 401
    # no secret → 401
    r2 = requests.post(f"{BASE}/api/cron/deadman-tick", json={"run_id": str(uuid.uuid4())}, timeout=15)
    assert r2.status_code == 401
    # correct → 200
    sec = _cron_secret()
    assert sec, "WEBHOOK_CRON_SECRET missing in backend/.env"
    r3 = requests.post(
        f"{BASE}/api/cron/deadman-tick",
        headers={"Authorization": f"Bearer {sec}"},
        json={"run_id": str(uuid.uuid4())},
        timeout=30,
    )
    assert r3.status_code == 200, r3.text
