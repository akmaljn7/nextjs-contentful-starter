"""Iteration 6 — /api/auth/me now includes `schedule` field.

Verifies:
- employee's schedule (weekly_calendar) round-trips through /me
- fixed_hours schedule round-trips through /me
- owner /me returns schedule=None (or absent)
- PATCH by owner + fresh employee login reflects on next /me (no stale cache)
- REGRESSION: sessions/start with 06:40->09:00 today's window returns 200 + remaining_ms=ms-until-close
- REGRESSION: sessions/start outside window returns 403 with correct detail strings

Single TestMeSchedule class → pinned to one xdist worker via loadscope.
"""
import os
import uuid
from datetime import datetime, timedelta
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

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return s


def _today_key(tz_name="UTC"):
    return DAY_KEYS[datetime.now(ZoneInfo(tz_name)).weekday()]


@pytest.fixture(scope="module")
def owner_sess():
    return _login(OWNER_EMAIL, OWNER_PW)


@pytest.fixture(scope="module")
def nigerian_office(owner_sess):
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "seed employee missing"
    emp_id = emp["id"]
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_MeSchLagos_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": office_id})
    yield {"office_id": office_id, "emp_id": emp_id}
    try:
        owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "any"}})
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


class TestMeSchedule:

    def test_owner_me_schedule_is_null(self, owner_sess):
        r = owner_sess.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "org_owner"
        # per UserPublic, schedule is Optional; owner should have None or absent
        assert data.get("schedule") in (None, {}), f"owner should not have a schedule: {data.get('schedule')}"

    def test_me_returns_weekly_calendar_schedule(self, owner_sess, nigerian_office):
        emp_id = nigerian_office["emp_id"]
        weekly = {d: {"open": "06:40", "close": "09:00"} for d in DAY_KEYS}
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200, r.text
        # fresh login → fresh access token reads latest schedule
        emp_sess = _login(EMP_EMAIL, EMP_PW)
        me = emp_sess.get(f"{API}/auth/me")
        assert me.status_code == 200, me.text
        sch = me.json().get("schedule")
        assert sch, "schedule missing from /me"
        assert sch["mode"] == "weekly_calendar"
        assert sch["timezone"] == "UTC"
        ws = sch["weekly_schedule"]
        assert set(ws.keys()) == set(DAY_KEYS), f"expected 7 day keys, got {sorted(ws.keys())}"
        for d in DAY_KEYS:
            assert ws[d] == {"open": "06:40", "close": "09:00"}, f"{d}={ws[d]}"

    def test_me_returns_fixed_hours_schedule(self, owner_sess, nigerian_office):
        emp_id = nigerian_office["emp_id"]
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "fixed_hours", "min_hours_per_day": 6}
        })
        assert r.status_code == 200, r.text
        emp_sess = _login(EMP_EMAIL, EMP_PW)
        me = emp_sess.get(f"{API}/auth/me")
        assert me.status_code == 200, me.text
        sch = me.json().get("schedule")
        assert sch and sch["mode"] == "fixed_hours"
        assert sch["min_hours_per_day"] == 6

    def test_me_reflects_new_schedule_after_patch_and_relogin(self, owner_sess, nigerian_office):
        """PATCH then re-login as employee → /me reflects new value (no stale caching)."""
        emp_id = nigerian_office["emp_id"]
        # Set A
        owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "any"}})
        s1 = _login(EMP_EMAIL, EMP_PW)
        me1 = s1.get(f"{API}/auth/me").json()
        assert (me1.get("schedule") or {}).get("mode") == "any", me1.get("schedule")

        # Change to fixed_hours=8
        owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "fixed_hours", "min_hours_per_day": 8}})
        # NEW login (as advised in review context) — fresh token, fresh DB read
        s2 = _login(EMP_EMAIL, EMP_PW)
        me2 = s2.get(f"{API}/auth/me").json()
        sch2 = me2.get("schedule") or {}
        assert sch2.get("mode") == "fixed_hours", sch2
        assert sch2.get("min_hours_per_day") == 8, sch2

    # ---------- REGRESSION: iteration-6 06:40→09:00 open-now scenario ----------

    def test_sessions_start_open_window_returns_ms_until_close(self, owner_sess, nigerian_office):
        """Simulate the bug scenario: weekly window covering NOW, remaining_ms = ms-until-close."""
        emp_id = nigerian_office["emp_id"]
        now = datetime.now(ZoneInfo("UTC"))
        # Build a wide open window covering the current minute; close 3 hours later same day.
        open_dt = now - timedelta(minutes=5)
        close_dt = now + timedelta(hours=3)
        if close_dt.date() != now.date():
            pytest.skip("Too close to UTC midnight for stable close-same-day test")
        open_t = open_dt.strftime("%H:%M")
        close_t = close_dt.strftime("%H:%M")
        weekly = {d: {"open": open_t, "close": close_t} for d in DAY_KEYS}
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200, r.text
        emp_sess = _login(EMP_EMAIL, EMP_PW)
        emp_sess.post(f"{API}/sessions/reset")
        before = datetime.now(ZoneInfo("UTC"))
        r2 = emp_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 200, r2.text
        remaining = r2.json()["remaining_ms"]
        # expected: ms from `before` to close_t today (H:M, seconds=0)
        expected_close = before.replace(hour=close_dt.hour, minute=close_dt.minute, second=0, microsecond=0)
        expected = int((expected_close - before).total_seconds() * 1000)
        assert abs(remaining - expected) < 5000, f"remaining={remaining} expected~{expected}"
        emp_sess.post(f"{API}/sessions/reset")

    def test_sessions_start_before_shift_returns_403_starts_at(self, owner_sess, nigerian_office):
        emp_id = nigerian_office["emp_id"]
        now = datetime.now(ZoneInfo("UTC"))
        # A window that starts +2h from now — before shift.
        open_dt = now + timedelta(hours=2)
        close_dt = now + timedelta(hours=4)
        if close_dt.date() != now.date():
            pytest.skip("Too close to UTC midnight")
        weekly = {d: {"open": open_dt.strftime("%H:%M"), "close": close_dt.strftime("%H:%M")} for d in DAY_KEYS}
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200, r.text
        emp_sess = _login(EMP_EMAIL, EMP_PW)
        emp_sess.post(f"{API}/sessions/reset")
        r2 = emp_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 403, r2.text
        detail = r2.json()["detail"].lower()
        assert "shift starts at" in detail or "starts at" in detail, r2.text

    def test_sessions_start_after_shift_returns_403_ended_at(self, owner_sess, nigerian_office):
        emp_id = nigerian_office["emp_id"]
        now = datetime.now(ZoneInfo("UTC"))
        # A window that closed already today
        if now.hour == 0 and now.minute < 5:
            pytest.skip("Too close to UTC midnight")
        weekly = {d: {"open": "00:00", "close": "00:01"} for d in DAY_KEYS}
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200, r.text
        emp_sess = _login(EMP_EMAIL, EMP_PW)
        emp_sess.post(f"{API}/sessions/reset")
        r2 = emp_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 403, r2.text
        assert "shift ended" in r2.json()["detail"].lower(), r2.text

    def test_sessions_start_off_day_returns_403_not_scheduled(self, owner_sess, nigerian_office):
        emp_id = nigerian_office["emp_id"]
        today = _today_key("UTC")
        weekly = {d: {"open": "09:00", "close": "17:00"} for d in DAY_KEYS if d != today}
        weekly[today] = None
        r = owner_sess.patch(f"{API}/employees/{emp_id}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        assert r.status_code == 200, r.text
        emp_sess = _login(EMP_EMAIL, EMP_PW)
        emp_sess.post(f"{API}/sessions/reset")
        r2 = emp_sess.post(f"{API}/sessions/start", json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert r2.status_code == 403, r2.text
        assert "not scheduled" in r2.json()["detail"].lower(), r2.text
