"""Employee work-schedule tests — iteration 5.

Covers /api/employees + /api/sessions/start schedule modes:
- any (org default duration)
- fixed_hours (min_hours_per_day)
- weekly_calendar (per-day open/close + timezone)
- schedule_denied security event
- validation (422 on bad HH:MM, out-of-range hours)
- create employee w/ schedule persists
- regression: photo + schedule coexist, geofence/accuracy still enforced
"""
import os
import base64
import time
import uuid
from datetime import datetime, timezone as py_tz
from zoneinfo import ZoneInfo

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

OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS = 6.5244, 3.3792, 300
IN_LAT, IN_LNG = 6.5245, 3.3793
OUT_LAT, OUT_LNG = 6.6244, 3.3792

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return s


def _start_with_retry(sess, payload, retries=6):
    """Tolerate brief cross-worker contention on the shared seeded employee."""
    last = None
    for _ in range(retries):
        sess.post(f"{API}/sessions/reset")
        r = sess.post(f"{API}/sessions/start", json=payload)
        last = r
        if r.status_code != 400 or "already active" not in r.text.lower():
            return r
        time.sleep(0.4)
    return last


def _tiny_jpeg_data_url() -> str:
    header = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
                    0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
    body = header + (b"\x00" * 1024) + bytes([0xff, 0xd9])
    return "data:image/jpeg;base64," + base64.b64encode(body).decode()


def _today_key(tz_name="UTC"):
    return DAY_KEYS[datetime.now(ZoneInfo(tz_name)).weekday()]


def _weekly_all(open_t="09:00", close_t="17:00"):
    return {d: {"open": open_t, "close": close_t} for d in DAY_KEYS}


@pytest.fixture(scope="module")
def owner_sess():
    return _login(OWNER_EMAIL, OWNER_PW)


@pytest.fixture(scope="module")
def nigerian_setup(owner_sess):
    """Assign the sample employee to a fresh Lagos office; tear down after."""
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "Sample employee must be seeded"
    emp_id = emp["id"]
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_SchLagos_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    r2 = owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": office_id})
    assert r2.status_code == 200, r2.text
    yield {"office_id": office_id, "emp_id": emp_id}
    # Reset schedule + delete office (best-effort)
    try:
        owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "any"}})
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


@pytest.fixture(scope="module")
def employee_sess(nigerian_setup):
    s = _login(EMP_EMAIL, EMP_PW)
    s.post(f"{API}/sessions/reset")
    return s


class TestSchedule:
    """All schedule-related backend tests in one class → single xdist worker."""

    # ---------- persistence on PATCH / POST ----------

    def test_patch_schedule_fixed_hours_persists_and_lists(self, owner_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 6}
        })
        assert r.status_code == 200, r.text
        sch = r.json().get("schedule")
        assert sch and sch.get("mode") == "fixed_hours"
        assert sch.get("min_hours_per_day") == 6
        # verify in list
        emps = owner_sess.get(f"{API}/employees").json()
        this = next(e for e in emps if e["id"] == emp_id)
        assert this["schedule"]["mode"] == "fixed_hours"
        assert this["schedule"]["min_hours_per_day"] == 6

    def test_create_employee_with_schedule_persists(self, owner_sess, nigerian_setup):
        email = f"TEST_sched_{uuid.uuid4().hex[:8]}@example.com"
        r = owner_sess.post(f"{API}/employees", json={
            "email": email,
            "password": "Employee123!",
            "name": "TEST Sched User",
            "office_id": nigerian_setup["office_id"],
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 8},
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["schedule"]["mode"] == "fixed_hours"
        assert data["schedule"]["min_hours_per_day"] == 8
        # visible in list
        emps = owner_sess.get(f"{API}/employees").json()
        found = next((e for e in emps if e["id"] == data["id"]), None)
        assert found and found["schedule"]["min_hours_per_day"] == 8
        # cleanup
        owner_sess.delete(f"{API}/employees/{data['id']}")

    # ---------- sessions/start honors schedule ----------

    def test_fixed_hours_start_returns_6h_remaining(self, owner_sess, employee_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 6}
        })
        assert r.status_code == 200
        r2 = _start_with_retry(employee_sess, {"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 200, r2.text
        assert r2.json()["remaining_ms"] == 6 * 3600 * 1000
        employee_sess.post(f"{API}/sessions/reset")

    def test_any_mode_start_returns_org_default(self, owner_sess, employee_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "any"}})
        assert r.status_code == 200
        r2 = _start_with_retry(employee_sess, {"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 200, r2.text
        assert r2.json()["remaining_ms"] == 3600000
        employee_sess.post(f"{API}/sessions/reset")

    def test_weekly_calendar_off_day_denied(self, owner_sess, employee_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        today = _today_key("UTC")
        weekly = {d: {"open": "09:00", "close": "17:00"} for d in DAY_KEYS if d != today}
        weekly[today] = None  # off today
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200, r.text
        employee_sess.post(f"{API}/sessions/reset")
        r2 = employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 403, r2.text
        assert r2.json()["detail"] == "You are not scheduled to work today."

        # Verify security event
        ev_r = owner_sess.get(f"{API}/security-events")
        assert ev_r.status_code == 200, ev_r.text
        evs = ev_r.json()
        assert any(e.get("type") == "schedule_denied" for e in evs), \
            f"expected a schedule_denied security event, got types={[e.get('type') for e in evs][:10]}"

    def test_weekly_calendar_open_now_returns_time_until_close(self, owner_sess, employee_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        # Open-all-day window covering current UTC time.
        weekly = _weekly_all("00:00", "23:59")
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200
        employee_sess.post(f"{API}/sessions/reset")
        before = datetime.now(ZoneInfo("UTC"))
        r2 = _start_with_retry(employee_sess, {"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 200, r2.text
        remaining = r2.json()["remaining_ms"]
        # expected: ms from `before` to today's 23:59:00 UTC
        close_dt = before.replace(hour=23, minute=59, second=0, microsecond=0)
        expected = int((close_dt - before).total_seconds() * 1000)
        # allow ±3s tolerance
        assert abs(remaining - expected) < 3000, f"remaining={remaining}, expected~{expected}"
        employee_sess.post(f"{API}/sessions/reset")

    def test_weekly_calendar_past_close_denied(self, owner_sess, employee_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        # Set a window that closed already today: 00:00-00:01 UTC.
        # Skip if we are actually inside that (unlikely but possible right after midnight).
        now = datetime.now(ZoneInfo("UTC"))
        if now.hour == 0 and now.minute < 2:
            pytest.skip("Too close to UTC midnight; past-close window would still be open.")
        weekly = _weekly_all("00:00", "00:01")
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200
        employee_sess.post(f"{API}/sessions/reset")
        r2 = employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 403, r2.text
        assert "shift ended" in r2.json()["detail"].lower(), r2.text

    # ---------- validation (Pydantic 422) ----------

    def test_invalid_hhmm_regex_returns_422(self, owner_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar",
                         "weekly_schedule": {"mon": {"open": "25:99", "close": "26:00"}}}
        })
        assert r.status_code == 422, r.text

    def test_fixed_hours_zero_returns_422(self, owner_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 0}
        })
        assert r.status_code == 422, r.text

    def test_fixed_hours_over_24_returns_422(self, owner_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 25}
        })
        assert r.status_code == 422, r.text

    # ---------- regressions ----------

    def test_photo_and_schedule_coexist(self, owner_sess, employee_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 6}
        })
        assert r.status_code == 200
        employee_sess.post(f"{API}/sessions/reset")
        r2 = _start_with_retry(employee_sess, {
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10, "face_photo": _tiny_jpeg_data_url()
        })
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data["remaining_ms"] == 6 * 3600 * 1000
        assert data.get("has_photo") is True
        employee_sess.post(f"{API}/sessions/reset")

    def test_schedule_denied_does_not_bypass_geofence_or_accuracy(self, owner_sess, employee_sess, nigerian_setup):
        emp_id = nigerian_setup["emp_id"]
        # Reset to any so we can test other guards independently
        owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "any"}})
        employee_sess.post(f"{API}/sessions/reset")
        # accuracy 400
        r = employee_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 5000})
        assert r.status_code == 400, r.text
        # geofence 403
        r2 = employee_sess.post(f"{API}/sessions/start", json={"lat": OUT_LAT, "lng": OUT_LNG, "accuracy": 10})
        assert r2.status_code == 403, r2.text
        assert "Signing denied" in r2.json()["detail"]

    def test_ws_session_update_reflects_schedule_remaining(self, owner_sess, employee_sess, nigerian_setup):
        """Regression: /api/sessions/live payload picks up schedule-derived remaining_ms."""
        emp_id = nigerian_setup["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 6}
        })
        assert r.status_code == 200
        employee_sess.post(f"{API}/sessions/reset")
        r2 = _start_with_retry(employee_sess, {"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 200, r2.text
        live = owner_sess.get(f"{API}/sessions/live").json()
        row = next((s for s in live if s["user_id"] == emp_id), None)
        assert row, f"no live session for emp {emp_id}"
        # remaining_ms decays with time; upper bound is 6h, lower bound generous
        assert row["remaining_ms"] <= 6 * 3600 * 1000
        assert row["remaining_ms"] > 6 * 3600 * 1000 - 60_000
        employee_sess.post(f"{API}/sessions/reset")
        # reset schedule
        owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "any"}})
