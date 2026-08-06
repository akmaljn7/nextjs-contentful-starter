"""Phase 5 regression: attendance summary/records + employees/offices CRUD via Bearer token
for the mobile app. Backend-only sanity — most endpoints already covered in iteration_12."""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or pytest.skip("no BASE", allow_module_level=True)
ADMIN = {"email": "akmaljn7@gmail.com", "password": "GeofenceAdmin123!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Attendance ----------
class TestAttendance:
    def test_summary_shape_ints(self, H):
        r = requests.get(f"{BASE}/api/attendance/summary", headers=H, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_offices", "total_employees", "active_sessions", "paused_sessions", "total_records", "flagged_records"]:
            assert k in d, f"missing {k}"
            assert isinstance(d[k], int), f"{k} not int: {d[k]!r}"

    def test_records_shape(self, H):
        r = requests.get(f"{BASE}/api/attendance/records?limit=5", headers=H, timeout=30)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            for k in ["id", "employee_name", "office_name", "started_at", "ended_at", "outcome",
                     "total_inside_ms", "bout_count", "flagged", "record_hash"]:
                assert k in arr[0], f"records[0] missing {k}"

    def test_records_filter_by_user(self, H):
        # find employee id
        r = requests.get(f"{BASE}/api/employees", headers=H, timeout=30)
        assert r.status_code == 200
        emps = r.json()
        assert emps, "no employees"
        uid = emps[0]["id"]
        r2 = requests.get(f"{BASE}/api/attendance/records?user_id={uid}&limit=50", headers=H, timeout=30)
        assert r2.status_code == 200, r2.text
        for rec in r2.json():
            assert rec["user_id"] == uid if "user_id" in rec else True


# ---------- Employees CRUD ----------
class TestEmployeesCRUD:
    def test_create_list_delete_and_dup_409(self, H):
        # Need an office to assign
        offs = requests.get(f"{BASE}/api/offices", headers=H, timeout=30).json()
        assert offs, "seed office missing"
        office_id = offs[0]["id"]

        uniq = uuid.uuid4().hex[:8]
        email = f"TEST_emp_{uniq}@example.com"
        payload = {"name": "TEST Emp", "email": email, "password": "Pass1234!!", "office_id": office_id}
        r = requests.post(f"{BASE}/api/employees", headers=H, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        emp = r.json()
        emp_id = emp["id"]

        # appears in GET
        arr = requests.get(f"{BASE}/api/employees", headers=H, timeout=30).json()
        assert any(e["id"] == emp_id for e in arr)

        # duplicate → 409 with reason
        r2 = requests.post(f"{BASE}/api/employees", headers=H, json=payload, timeout=30)
        assert r2.status_code == 409, r2.text
        detail = (r2.json().get("detail") or "").lower()
        assert "email" in detail or "duplicate" in detail or "exists" in detail, f"vague 409: {r2.text}"

        # PATCH — update name AND reassign office (same office is fine; still exercises path)
        r3 = requests.patch(f"{BASE}/api/employees/{emp_id}", headers=H,
                            json={"name": "TEST Emp Renamed", "office_id": office_id}, timeout=30)
        assert r3.status_code == 200, r3.text
        assert r3.json()["name"] == "TEST Emp Renamed"

        # DELETE
        r4 = requests.delete(f"{BASE}/api/employees/{emp_id}", headers=H, timeout=30)
        assert r4.status_code in (200, 204), r4.text


# ---------- Offices CRUD ----------
class TestOfficesCRUD:
    def test_create_get_patch_delete(self, H):
        payload = {"name": f"TEST Office {uuid.uuid4().hex[:6]}", "lat": 6.5244, "lng": 3.3792, "radius_meters": 250}
        r = requests.post(f"{BASE}/api/offices", headers=H, json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        off = r.json()
        for k in ["id", "name", "lat", "lng", "radius_meters"]:
            assert k in off
        oid = off["id"]

        # in list
        arr = requests.get(f"{BASE}/api/offices", headers=H, timeout=30).json()
        assert any(o["id"] == oid for o in arr)

        # PATCH lat/lng/radius simultaneously
        r2 = requests.patch(f"{BASE}/api/offices/{oid}", headers=H,
                            json={"lat": 6.5300, "lng": 3.3800, "radius_meters": 400}, timeout=30)
        assert r2.status_code == 200, r2.text
        upd = r2.json()
        assert upd["radius_meters"] == 400
        assert abs(upd["lat"] - 6.5300) < 1e-6
        assert abs(upd["lng"] - 3.3800) < 1e-6

        # DELETE
        r3 = requests.delete(f"{BASE}/api/offices/{oid}", headers=H, timeout=30)
        assert r3.status_code == 200, r3.text
        assert r3.json().get("ok") is True

        # confirm gone
        arr2 = requests.get(f"{BASE}/api/offices", headers=H, timeout=30).json()
        assert not any(o["id"] == oid for o in arr2)


# ---------- Mobile stale office ID ----------
class TestMobileStaleOffice:
    def test_stale_office_returns_400(self, H):
        # Login as employee to hit mobile route
        r = requests.post(f"{BASE}/api/auth/login",
                          json={"email": "employee@example.com", "password": "Employee123!"}, timeout=30)
        assert r.status_code == 200, r.text
        etok = r.json().get("access_token") or r.json().get("token")
        eH = {"Authorization": f"Bearer {etok}"}

        # Create + delete an office as admin so we have a "stale" id
        payload = {"name": f"TEST Stale {uuid.uuid4().hex[:6]}", "lat": 6.5244, "lng": 3.3792, "radius_meters": 200}
        cr = requests.post(f"{BASE}/api/offices", headers=H, json=payload, timeout=30)
        assert cr.status_code in (200, 201), cr.text
        stale_id = cr.json()["id"]
        dr = requests.delete(f"{BASE}/api/offices/{stale_id}", headers=H, timeout=30)
        assert dr.status_code == 200

        # Fire enter event with stale id
        evt = {
            "client_event_id": f"evt-{uuid.uuid4().hex}",
            "device_id": f"dev-{uuid.uuid4().hex}",
            "type": "enter",
            "office_id": stale_id,
            "lat": 6.5244, "lng": 3.3792, "accuracy": 10,
            "ts_ms": int(time.time() * 1000),
        }
        ev = requests.post(f"{BASE}/api/mobile/geofence-event", headers=eH, json=evt, timeout=30)
        assert ev.status_code == 400, ev.text
        assert "unknown office" in (ev.json().get("detail") or "").lower()
