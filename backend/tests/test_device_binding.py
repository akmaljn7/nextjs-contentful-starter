"""Tests for device binding state machine + logout lock (iteration_24)."""
import os
import re
import pytest
import requests


def _base_url() -> str:
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    assert url, "REACT_APP_BACKEND_URL missing"
    return url.rstrip("/")


BASE_URL = _base_url()
ADMIN = {"email": "akmaljn7@gmail.com", "password": "GeofenceAdmin123!"}
EMP = {"email": "employee@example.com", "password": "Employee123!"}
EMP_ID = "6a6f63fda37a01476b2c4cca"
import uuid as _uuid
_RUN = _uuid.uuid4().hex[:6].upper()
DEV_A = f"DEV-TEST-A1-{_RUN}"
DEV_B = f"DEV-TEST-B2-{_RUN}"
DEV_C = f"DEV-TEST-C3-{_RUN}"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def emp_token():
    return _login(EMP)


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module", autouse=True)
def _reset_pre(admin_token):
    # Ensure clean state before tests
    requests.post(f"{BASE_URL}/api/employees/{EMP_ID}/reset-device", headers=_h(admin_token), timeout=30)
    requests.patch(f"{BASE_URL}/api/employees/{EMP_ID}", headers=_h(admin_token),
                   json={"logout_enabled": False}, timeout=30)
    yield
    # Cleanup after: reset device + lock logout
    requests.post(f"{BASE_URL}/api/employees/{EMP_ID}/reset-device", headers=_h(admin_token), timeout=30)
    requests.patch(f"{BASE_URL}/api/employees/{EMP_ID}", headers=_h(admin_token),
                   json={"logout_enabled": False}, timeout=30)


# ---------------------------------------------------------------------------
# 1) Device binding state machine
# ---------------------------------------------------------------------------
class TestDeviceBinding:
    def test_first_bind_authorizes(self, emp_token):
        r = requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(emp_token),
                          json={"device_id": DEV_A, "platform": "android"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "authorized"
        assert data.get("first_bind") is True

    def test_same_device_still_authorized(self, emp_token):
        r = requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(emp_token),
                          json={"device_id": DEV_A, "platform": "android"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "authorized"
        # first_bind should NOT be true this time
        assert not data.get("first_bind")

    def test_different_device_creates_pending(self, emp_token):
        r = requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(emp_token),
                          json={"device_id": DEV_B, "platform": "android"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending"

    def test_status_returns_pending_for_new_device(self, emp_token):
        r = requests.get(f"{BASE_URL}/api/mobile/device/status",
                         params={"device_id": DEV_B}, headers=_h(emp_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "pending"


# ---------------------------------------------------------------------------
# 2) Admin device request review
# ---------------------------------------------------------------------------
class TestAdminReview:
    def test_list_pending_shows_request(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/employees/device-requests", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        match = [x for x in items if x.get("device_id") == DEV_B]
        assert match, f"Pending request for {DEV_B} not found. Got: {items}"
        req = match[0]
        assert req.get("employee_name")
        assert req.get("current_bound_device_id") == DEV_A
        # Persist request id for next test
        pytest.request_id = req["id"]

    def test_approve_sets_binding(self, admin_token, emp_token):
        rid = getattr(pytest, "request_id", None)
        assert rid, "prior test failed to set request_id"
        r = requests.post(f"{BASE_URL}/api/employees/device-requests/{rid}/approve",
                          headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        # Verify binding: same device_id now authorized
        b = requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(emp_token),
                          json={"device_id": DEV_B, "platform": "android"}, timeout=30)
        assert b.status_code == 200
        assert b.json()["status"] == "authorized"
        # device/status also authorized
        s = requests.get(f"{BASE_URL}/api/mobile/device/status",
                        params={"device_id": DEV_B}, headers=_h(emp_token), timeout=30)
        assert s.json()["status"] == "authorized"

    def test_approve_again_409(self, admin_token):
        rid = getattr(pytest, "request_id", None)
        assert rid
        r = requests.post(f"{BASE_URL}/api/employees/device-requests/{rid}/approve",
                          headers=_h(admin_token), timeout=30)
        assert r.status_code == 409, r.text

    def test_reject_fresh_request(self, admin_token, emp_token):
        # Create a NEW pending request for a fresh device
        r = requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(emp_token),
                          json={"device_id": DEV_C, "platform": "android"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "pending"
        # Find that request
        lst = requests.get(f"{BASE_URL}/api/employees/device-requests", headers=_h(admin_token), timeout=30).json()
        match = [x for x in lst if x.get("device_id") == DEV_C]
        assert match
        rid_c = match[0]["id"]
        # Reject
        rj = requests.post(f"{BASE_URL}/api/employees/device-requests/{rid_c}/reject",
                           headers=_h(admin_token), timeout=30)
        assert rj.status_code == 200
        # device/status for DEV_C returns 'rejected'
        s = requests.get(f"{BASE_URL}/api/mobile/device/status",
                        params={"device_id": DEV_C}, headers=_h(emp_token), timeout=30)
        assert s.json()["status"] == "rejected"


# ---------------------------------------------------------------------------
# 3) Reset device
# ---------------------------------------------------------------------------
class TestResetDevice:
    def test_reset_clears_binding_and_cancels_pending(self, admin_token, emp_token):
        # Create a pending req for a fresh device
        requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(emp_token),
                      json={"device_id": "DEV-TEST-D4", "platform": "android"}, timeout=30)
        # Reset
        r = requests.post(f"{BASE_URL}/api/employees/{EMP_ID}/reset-device",
                          headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        # Brand new device should auto-bind with first_bind True
        b = requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(emp_token),
                          json={"device_id": "DEV-TEST-E5", "platform": "android"}, timeout=30)
        assert b.status_code == 200
        data = b.json()
        assert data["status"] == "authorized"
        assert data.get("first_bind") is True
        # No pending requests for DEV-TEST-D4 anymore (cancelled)
        lst = requests.get(f"{BASE_URL}/api/employees/device-requests", headers=_h(admin_token), timeout=30).json()
        assert not [x for x in lst if x.get("device_id") == "DEV-TEST-D4"], "pending request should be cancelled"


# ---------------------------------------------------------------------------
# 4) Logout lock + owner bypass
# ---------------------------------------------------------------------------
class TestLogoutLock:
    def test_toggle_logout_enabled(self, admin_token, emp_token):
        # Set true
        r = requests.patch(f"{BASE_URL}/api/employees/{EMP_ID}", headers=_h(admin_token),
                           json={"logout_enabled": True}, timeout=30)
        assert r.status_code == 200
        assert r.json()["logout_enabled"] is True
        # /me reflects it
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(emp_token), timeout=30).json()
        assert me.get("logout_enabled") is True
        # Set false
        r2 = requests.patch(f"{BASE_URL}/api/employees/{EMP_ID}", headers=_h(admin_token),
                            json={"logout_enabled": False}, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["logout_enabled"] is False
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(emp_token), timeout=30).json()
        assert me2.get("logout_enabled") is False

    def test_owner_bypass_device_binding(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/mobile/device/bind", headers=_h(admin_token),
                          json={"device_id": "OWNER-DEV-ANY", "platform": "android"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "authorized"


# ---------------------------------------------------------------------------
# 5) Regression: employees list contains bound_device_id + logout_enabled
# ---------------------------------------------------------------------------
def test_employees_list_shape(admin_token):
    r = requests.get(f"{BASE_URL}/api/employees", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    emps = r.json()
    target = [e for e in emps if e["id"] == EMP_ID]
    assert target, "employee not in list"
    e = target[0]
    assert "bound_device_id" in e
    assert "logout_enabled" in e
