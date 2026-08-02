"""End-to-end backend tests for Geofence Attendance Console."""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback: read frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

OWNER_EMAIL = "akmaljn7@gmail.com"
OWNER_PW = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PW = "Employee123!"

# Office seeded at 40.7580, -73.9855 radius 150m
IN_LAT, IN_LNG = 40.7580, -73.9855
OUT_LAT, OUT_LNG = 40.7700, -73.9855  # ~1300m north

# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def owner_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="session")
def employee_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PW})
    assert r.status_code == 200, r.text
    # ensure no leftover session
    s.post(f"{API}/sessions/reset")
    return s


# ---------- API Root ----------

def test_api_root():
    r = requests.get(f"{API}")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth: register-org, login, me, logout, refresh ----------

class TestAuth:
    def test_login_owner_and_me(self, owner_sess):
        assert "access_token" in owner_sess.cookies.get_dict()
        assert "refresh_token" in owner_sess.cookies.get_dict()
        me = owner_sess.get(f"{API}/auth/me")
        assert me.status_code == 200
        data = me.json()
        assert data["email"] == OWNER_EMAIL
        assert data["role"] == "org_owner"
        assert data["org_name"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrongwrong123"})
        assert r.status_code in (401, 429)

    def test_register_org_new(self):
        s = requests.Session()
        email = f"TEST_owner_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register-org", json={
            "org_name": f"TEST_Org_{uuid.uuid4().hex[:6]}",
            "owner_name": "Test Owner",
            "email": email,
            "password": "TestPass123!",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"].lower() == email.lower()
        assert data["role"] == "org_owner"
        assert data["org_name"]
        assert "access_token" in s.cookies.get_dict()
        assert "refresh_token" in s.cookies.get_dict()
        # /me works
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["email"].lower() == email.lower()

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register-org", json={
            "org_name": "Dup", "owner_name": "Dup", "email": OWNER_EMAIL, "password": "Whatever123!"
        })
        assert r.status_code == 400

    def test_refresh_rotates_token(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
        assert r.status_code == 200
        old_refresh = s.cookies.get("refresh_token")
        time.sleep(1.1)  # ensure JWT exp claim changes
        r2 = s.post(f"{API}/auth/refresh")
        assert r2.status_code == 200, r2.text
        new_refresh = s.cookies.get("refresh_token")
        new_access = s.cookies.get("access_token")
        assert new_refresh and new_refresh != old_refresh
        assert new_access
        # Old refresh should be revoked
        s2 = requests.Session()
        s2.cookies.set("refresh_token", old_refresh)
        r3 = s2.post(f"{API}/auth/refresh")
        assert r3.status_code == 401

    def test_logout_clears_cookies(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # cookies cleared server-side; /me should fail without access_token
        s.cookies.clear()
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 401

    def test_forgot_password_unknown(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": f"unknown_{uuid.uuid4().hex[:6]}@example.com"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_forgot_password_known(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": OWNER_EMAIL})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid_" + uuid.uuid4().hex, "password": "NewPass123!"})
        assert r.status_code == 400

    def test_lockout_after_5_failed(self):
        # Use a dedicated unique email so we don't lock the real owner
        email = f"TEST_lockout_{uuid.uuid4().hex[:8]}@example.com"
        # Create user via register-org
        s = requests.Session()
        r = s.post(f"{API}/auth/register-org", json={
            "org_name": f"TEST_Lock_{uuid.uuid4().hex[:6]}",
            "owner_name": "LT", "email": email, "password": "Correct123!"
        })
        assert r.status_code == 200
        # 5 wrong attempts
        last = None
        for _ in range(5):
            last = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongwrong"})
        # Next should be 429
        r6 = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongwrong"})
        assert r6.status_code == 429, f"expected 429 got {r6.status_code} {r6.text}"
        assert "locked" in r6.json().get("detail", "").lower()


# ---------- Offices ----------

class TestOffices:
    def test_list_offices_owner(self, owner_sess):
        r = owner_sess.get(f"{API}/offices")
        assert r.status_code == 200
        offices = r.json()
        assert any(o["name"] == "HQ — Times Square" for o in offices)

    def test_employee_cannot_create_office(self, employee_sess):
        r = employee_sess.post(f"{API}/offices", json={
            "name": "Nope", "lat": 40.0, "lng": -73.0, "radius_meters": 100
        })
        assert r.status_code == 403

    def test_office_crud_and_tenant_isolation(self, owner_sess):
        # Create in owner org
        r = owner_sess.post(f"{API}/offices", json={
            "name": f"TEST_Office_{uuid.uuid4().hex[:6]}",
            "lat": 34.05, "lng": -118.25, "radius_meters": 200,
        })
        assert r.status_code == 200
        oid = r.json()["id"]
        # Patch
        r2 = owner_sess.patch(f"{API}/offices/{oid}", json={"radius_meters": 250, "name": "TEST_Office_renamed"})
        assert r2.status_code == 200
        assert r2.json()["radius_meters"] == 250
        assert r2.json()["name"] == "TEST_Office_renamed"
        # Tenant isolation: register a new org, list offices; must not see oid
        s2 = requests.Session()
        s2.post(f"{API}/auth/register-org", json={
            "org_name": f"TEST_IsoOrg_{uuid.uuid4().hex[:6]}", "owner_name": "iso",
            "email": f"TEST_iso_{uuid.uuid4().hex[:8]}@example.com", "password": "Isolate123!"
        })
        r3 = s2.get(f"{API}/offices")
        assert r3.status_code == 200
        ids = [o["id"] for o in r3.json()]
        assert oid not in ids
        # Other org can't patch/delete
        r4 = s2.patch(f"{API}/offices/{oid}", json={"name": "hax"})
        assert r4.status_code == 404
        r5 = s2.delete(f"{API}/offices/{oid}")
        assert r5.status_code == 404
        # Delete by owner
        r6 = owner_sess.delete(f"{API}/offices/{oid}")
        assert r6.status_code == 200


# ---------- Employees ----------

class TestEmployees:
    def test_employee_cannot_list(self, employee_sess):
        r = employee_sess.get(f"{API}/employees")
        assert r.status_code == 403

    def test_owner_can_list(self, owner_sess):
        r = owner_sess.get(f"{API}/employees")
        assert r.status_code == 200

    def test_create_update_delete_employee(self, owner_sess):
        # need an office id
        offices = owner_sess.get(f"{API}/offices").json()
        assert offices
        oid = offices[0]["id"]
        email = f"TEST_emp_{uuid.uuid4().hex[:6]}@example.com"
        r = owner_sess.post(f"{API}/employees", json={
            "name": "TEST Emp", "email": email, "password": "EmpPass123!", "office_id": oid
        })
        assert r.status_code == 200, r.text
        emp_id = r.json()["id"]
        # Duplicate email
        r2 = owner_sess.post(f"{API}/employees", json={
            "name": "Dup", "email": email, "password": "DupPass123!", "office_id": oid
        })
        assert r2.status_code == 400
        # Invalid office
        r3 = owner_sess.post(f"{API}/employees", json={
            "name": "BadOff", "email": f"TEST_bo_{uuid.uuid4().hex[:6]}@example.com",
            "password": "Bad12345!", "office_id": "507f1f77bcf86cd799439011"
        })
        assert r3.status_code == 400
        # Create a second office for reassignment
        r_off = owner_sess.post(f"{API}/offices", json={"name": "TEST_Off2", "lat": 1, "lng": 1, "radius_meters": 100})
        oid2 = r_off.json()["id"]
        r4 = owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": oid2})
        assert r4.status_code == 200
        assert r4.json()["office_id"] == oid2
        # Delete (soft)
        r5 = owner_sess.delete(f"{API}/employees/{emp_id}")
        assert r5.status_code == 200
        # confirm no longer listed
        listed = owner_sess.get(f"{API}/employees").json()
        assert not any(e["id"] == emp_id for e in listed)
        # cleanup
        owner_sess.delete(f"{API}/offices/{oid2}")


# ---------- Sessions ----------

class TestSessions:
    def test_start_low_accuracy_rejected(self, employee_sess):
        employee_sess.post(f"{API}/sessions/reset")
        r = employee_sess.post(f"{API}/sessions/start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 500
        })
        assert r.status_code == 400
        assert "accuracy" in r.json().get("detail", "").lower()

    def test_start_outside_geofence(self, employee_sess):
        employee_sess.post(f"{API}/sessions/reset")
        r = employee_sess.post(f"{API}/sessions/start", json={
            "lat": OUT_LAT, "lng": OUT_LNG, "accuracy": 10
        })
        assert r.status_code == 403
        assert "Signing denied" in r.json().get("detail", "")

    def test_start_success_and_duplicate(self, employee_sess):
        employee_sess.post(f"{API}/sessions/reset")
        r = employee_sess.post(f"{API}/sessions/start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "active"
        assert data["remaining_ms"] == 3600000
        assert data["center"]["radius_m"] == 150
        # Duplicate
        r2 = employee_sess.post(f"{API}/sessions/start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10
        })
        assert r2.status_code == 400

    def test_admin_cannot_start(self, owner_sess):
        r = owner_sess.post(f"{API}/sessions/start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10
        })
        assert r.status_code == 403

    def test_ping_pause_and_resume(self, employee_sess):
        # Ensure active session exists
        me = employee_sess.get(f"{API}/sessions/me").json()
        if not me:
            employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        time.sleep(0.5)
        # Ping outside -> should pause
        r = employee_sess.post(f"{API}/sessions/ping", json={"lat": OUT_LAT, "lng": OUT_LNG, "accuracy": 10})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "paused"
        # Ping inside -> resume
        time.sleep(0.5)
        r2 = employee_sess.post(f"{API}/sessions/ping", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 200
        assert r2.json()["status"] == "active"
        assert r2.json()["bout_count"] >= 2

    def test_reset_writes_record(self, employee_sess):
        # ensure a session exists
        me = employee_sess.get(f"{API}/sessions/me").json()
        if not me:
            employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        r = employee_sess.post(f"{API}/sessions/reset")
        assert r.status_code == 200
        # attendance record with outcome=reset exists
        recs = employee_sess.get(f"{API}/attendance/records").json()
        assert any(rec["outcome"] == "reset" for rec in recs)


# ---------- Attendance + hash chain ----------

class TestAttendance:
    def test_records_tenant_scope(self, owner_sess, employee_sess):
        r = owner_sess.get(f"{API}/attendance/records")
        assert r.status_code == 200
        owner_records = r.json()
        # All records belong to owner org
        me_owner = owner_sess.get(f"{API}/auth/me").json()
        for rec in owner_records:
            assert rec["org_id"] == me_owner["org_id"]
        # Employee sees only own
        r2 = employee_sess.get(f"{API}/attendance/records")
        assert r2.status_code == 200
        me_emp = employee_sess.get(f"{API}/auth/me").json()
        for rec in r2.json():
            assert rec["user_id"] == me_emp["id"]

    def test_hash_chain(self, employee_sess, owner_sess):
        # Ensure at least 2 records exist for the org (owner view)
        for _ in range(2):
            employee_sess.post(f"{API}/sessions/reset")  # clear
            s = employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
            assert s.status_code == 200
            employee_sess.post(f"{API}/sessions/reset")
        recs = owner_sess.get(f"{API}/attendance/records").json()
        assert len(recs) >= 2
        # sorted by ended_at desc; verify chain: rec[i].prev == rec[i+1].hash
        for i in range(len(recs) - 1):
            assert recs[i]["record_hash"] != ""
            assert recs[i]["prev_record_hash"] == recs[i + 1]["record_hash"]

    def test_csv_export(self, owner_sess):
        r = owner_sess.get(f"{API}/attendance/export.csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        assert "employee" in r.text.splitlines()[0]

    def test_pdf_export(self, owner_sess):
        r = owner_sess.get(f"{API}/attendance/export.pdf")
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content.startswith(b"%PDF")

    def test_employee_cannot_export(self, employee_sess):
        r = employee_sess.get(f"{API}/attendance/export.csv")
        assert r.status_code == 403


# ---------- Audit + Security events ----------

class TestAuditSecurity:
    def test_audit_admin(self, owner_sess):
        r = owner_sess.get(f"{API}/audit-log")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_employee_forbidden(self, employee_sess):
        r = employee_sess.get(f"{API}/audit-log")
        assert r.status_code == 403

    def test_security_events_admin(self, owner_sess):
        r = owner_sess.get(f"{API}/security-events")
        assert r.status_code == 200
        # We triggered failed logins + geofence denied earlier
        types = {e["type"] for e in r.json()}
        assert types & {"failed_login", "geofence_denied", "low_accuracy_start"}

    def test_security_events_employee_forbidden(self, employee_sess):
        r = employee_sess.get(f"{API}/security-events")
        assert r.status_code == 403


# ---------- Org settings ----------

class TestSettings:
    def test_get_settings(self, owner_sess):
        r = owner_sess.get(f"{API}/org/settings")
        assert r.status_code == 200
        assert "settings" in r.json()

    def test_patch_settings(self, owner_sess):
        r = owner_sess.patch(f"{API}/org/settings", json={"accuracy_tolerance_meters": 75})
        assert r.status_code == 200
        assert r.json()["settings"]["accuracy_tolerance_meters"] == 75
        # revert
        owner_sess.patch(f"{API}/org/settings", json={"accuracy_tolerance_meters": 50})

    def test_employee_cannot_patch(self, employee_sess):
        r = employee_sess.patch(f"{API}/org/settings", json={"accuracy_tolerance_meters": 10})
        assert r.status_code == 403
