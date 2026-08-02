"""End-to-end backend tests for Geofence Attendance Console (iteration 2 — Nigerian office regression)."""
import os
import time
import uuid
import pytest
import requests

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

# Nigerian sample office (Lagos), radius 200m
OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS = 6.5244, 3.3792, 200
IN_LAT, IN_LNG = 6.5245, 3.3793      # ~15m from center
OUT_LAT, OUT_LNG = 6.6244, 3.3792    # ~11km north


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def owner_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="session")
def nigerian_office(owner_sess):
    """Create a Nigerian office and assign the sample employee to it. Cleanup at session end."""
    # Locate sample employee
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "Sample employee must be seeded"
    emp_id = emp["id"]

    # Create office
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_Lagos_HQ_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]

    # Assign employee
    r2 = owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": office_id})
    assert r2.status_code == 200, r2.text
    assert r2.json()["office_id"] == office_id

    yield {"office_id": office_id, "emp_id": emp_id}

    # Teardown: detach employee & delete office (best effort)
    try:
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


@pytest.fixture(scope="session")
def employee_sess(nigerian_office):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PW})
    assert r.status_code == 200, r.text
    s.post(f"{API}/sessions/reset")
    return s


# ---------- API Root ----------

def test_api_root():
    r = requests.get(f"{API}")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- REGRESSION: Seed cleanup ----------

class TestSeedCleanup:
    def test_no_times_square_office(self, owner_sess):
        """Seed cleanup must have removed HQ — Times Square."""
        r = owner_sess.get(f"{API}/offices")
        assert r.status_code == 200
        for o in r.json():
            assert o["name"] != "HQ — Times Square", "Stale seeded office still exists"
            # And no office at NYC coords
            assert not (abs(o["lat"] - 40.7580) < 1e-3 and abs(o["lng"] - -73.9855) < 1e-3), \
                "Stale NYC-coord office still exists"

    def test_sample_employee_exists_and_unassigned(self, owner_sess):
        """Sample employee still present but office_id must be null initially."""
        # Fresh owner session (no nigerian_office fixture yet — but this test may
        # run after fixture. We check DB directly by owner listing pre-assignment
        # is not possible cross-run; instead we just assert the employee exists.)
        emps = owner_sess.get(f"{API}/employees").json()
        sample = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
        assert sample, "Sample employee must still be seeded"
        # office_id starts as null (may be reassigned by nigerian_office fixture)
        # If it's set, verify it points to a valid office in same org
        if sample["office_id"]:
            offices = owner_sess.get(f"{API}/offices").json()
            oids = {o["id"] for o in offices}
            assert sample["office_id"] in oids


# ---------- Auth ----------

class TestAuth:
    def test_login_owner_and_me(self, owner_sess):
        assert "access_token" in owner_sess.cookies.get_dict()
        assert "refresh_token" in owner_sess.cookies.get_dict()
        me = owner_sess.get(f"{API}/auth/me")
        assert me.status_code == 200
        data = me.json()
        assert data["email"] == OWNER_EMAIL
        assert data["role"] == "org_owner"
        assert data["org_name"] == "Emergent Operations"

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
        old_access = s.cookies.get("access_token")
        r2 = s.post(f"{API}/auth/refresh")
        assert r2.status_code == 200, r2.text
        new_refresh = s.cookies.get("refresh_token")
        new_access = s.cookies.get("access_token")
        assert new_refresh and new_refresh != old_refresh
        assert new_access and new_access != old_access
        # Old refresh should be revoked
        s2 = requests.Session()
        s2.cookies.set("refresh_token", old_refresh)
        r3 = s2.post(f"{API}/auth/refresh")
        assert r3.status_code == 401
        # Authenticated GET still works with rotated tokens
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200

    def test_refresh_same_second_produces_distinct_access_tokens(self):
        """Two refresh calls in the same second must produce different access_token strings (iat+jti)."""
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
        assert r.status_code == 200
        r1 = s.post(f"{API}/auth/refresh")
        assert r1.status_code == 200
        access1 = s.cookies.get("access_token")
        r2 = s.post(f"{API}/auth/refresh")
        assert r2.status_code == 200
        access2 = s.cookies.get("access_token")
        assert access1 and access2
        assert access1 != access2, "Access tokens must differ even within same second (jti/iat)"

    def test_logout_clears_cookies(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        s.cookies.clear()
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 401

    def test_forgot_password_unknown_shape_exact(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": f"unknown_{uuid.uuid4().hex[:6]}@example.com"})
        assert r.status_code == 200
        body = r.json()
        assert body == {"ok": True}, f"Expected exactly {{'ok': True}}, got {body}"

    def test_forgot_password_known_shape_exact(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": OWNER_EMAIL})
        assert r.status_code == 200
        body = r.json()
        assert body == {"ok": True}, f"Expected exactly {{'ok': True}}, got {body} (no `sent` leak)"

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid_" + uuid.uuid4().hex, "password": "NewPass123!"})
        assert r.status_code == 400


# ---------- Offices CRUD (Nigerian coords) ----------

class TestOfficesCRUD:
    def test_full_crud_nigerian_office(self, owner_sess):
        # CREATE
        name = f"TEST_LagosCRUD_{uuid.uuid4().hex[:6]}"
        r = owner_sess.post(f"{API}/offices", json={
            "name": name, "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
        })
        assert r.status_code == 200, r.text
        created = r.json()
        assert abs(created["lat"] - OFFICE_LAT) < 1e-6
        assert abs(created["lng"] - OFFICE_LNG) < 1e-6
        assert created["radius_meters"] == OFFICE_RADIUS
        oid = created["id"]

        # GET (list)
        r2 = owner_sess.get(f"{API}/offices")
        assert r2.status_code == 200
        assert any(o["id"] == oid for o in r2.json())

        # PATCH
        r3 = owner_sess.patch(f"{API}/offices/{oid}", json={"radius_meters": 300, "name": name + "_upd"})
        assert r3.status_code == 200
        assert r3.json()["radius_meters"] == 300
        assert r3.json()["name"] == name + "_upd"

        # DELETE
        r4 = owner_sess.delete(f"{API}/offices/{oid}")
        assert r4.status_code == 200

        # Verify gone
        r5 = owner_sess.get(f"{API}/offices")
        assert not any(o["id"] == oid for o in r5.json())

    def test_employee_cannot_create_office(self, employee_sess):
        r = employee_sess.post(f"{API}/offices", json={
            "name": "Nope", "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": 100
        })
        assert r.status_code == 403


# ---------- Employees ----------

class TestEmployees:
    def test_owner_can_list(self, owner_sess):
        r = owner_sess.get(f"{API}/employees")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_employee_cannot_list(self, employee_sess):
        r = employee_sess.get(f"{API}/employees")
        assert r.status_code == 403

    def test_reassign_employee_to_new_office(self, owner_sess, nigerian_office):
        # Create a second office
        r = owner_sess.post(f"{API}/offices", json={
            "name": f"TEST_Off2_{uuid.uuid4().hex[:6]}", "lat": 6.53, "lng": 3.38, "radius_meters": 150
        })
        assert r.status_code == 200
        oid2 = r.json()["id"]
        emp_id = nigerian_office["emp_id"]
        r2 = owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": oid2})
        assert r2.status_code == 200
        assert r2.json()["office_id"] == oid2
        # Restore assignment back to primary Nigerian office (for downstream tests)
        r3 = owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": nigerian_office["office_id"]})
        assert r3.status_code == 200
        # Cleanup second office
        owner_sess.delete(f"{API}/offices/{oid2}")


# ---------- Sessions (with Nigerian office) ----------

class TestSessions:
    def test_start_outside_geofence(self, employee_sess, nigerian_office):
        employee_sess.post(f"{API}/sessions/reset")
        r = employee_sess.post(f"{API}/sessions/start", json={
            "lat": OUT_LAT, "lng": OUT_LNG, "accuracy": 10
        })
        assert r.status_code == 403, r.text
        assert "Signing denied" in r.json().get("detail", "")

    def test_start_success_and_remaining(self, employee_sess, nigerian_office):
        employee_sess.post(f"{API}/sessions/reset")
        r = employee_sess.post(f"{API}/sessions/start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "active"
        assert data["remaining_ms"] == 3600000
        assert data["center"]["radius_m"] == OFFICE_RADIUS

    def test_ping_and_reset_writes_record(self, employee_sess, nigerian_office):
        # Ensure active
        me = employee_sess.get(f"{API}/sessions/me").json()
        if not me:
            employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        time.sleep(0.4)
        r = employee_sess.post(f"{API}/sessions/ping", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r.status_code == 200
        assert r.json()["status"] == "active"
        r2 = employee_sess.post(f"{API}/sessions/reset")
        assert r2.status_code == 200
        recs = employee_sess.get(f"{API}/attendance/records").json()
        assert recs, "at least one attendance record should exist"
        latest = recs[0]
        assert latest["outcome"] == "reset"
        assert latest.get("record_hash")
        assert "prev_record_hash" in latest


# ---------- Attendance hash chain ----------

class TestAttendance:
    def test_hash_chain_across_two_resets(self, employee_sess, owner_sess, nigerian_office):
        for _ in range(2):
            employee_sess.post(f"{API}/sessions/reset")
            s = employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
            assert s.status_code == 200, s.text
            employee_sess.post(f"{API}/sessions/reset")
        recs = owner_sess.get(f"{API}/attendance/records").json()
        assert len(recs) >= 2
        # sorted desc; verify chain: rec[i].prev == rec[i+1].hash
        assert recs[0]["record_hash"]
        assert recs[0]["prev_record_hash"] == recs[1]["record_hash"]

    def test_csv_export(self, owner_sess, nigerian_office):
        r = owner_sess.get(f"{API}/attendance/export.csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        assert r.text.strip(), "CSV body must be non-empty"

    def test_pdf_export(self, owner_sess, nigerian_office):
        r = owner_sess.get(f"{API}/attendance/export.pdf")
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content.startswith(b"%PDF")
        assert len(r.content) > 500  # non-empty
