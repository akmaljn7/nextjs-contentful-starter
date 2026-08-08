"""Bug fix: inside-time was double-counted (iteration 25).

Validates:
  * BUG 1a: Active inside pings accrue incremental dt only. On a definitely-outside
    fix the session flips to paused WITHOUT re-adding the full bout.
  * BUG 1b: After pause, resuming (inside fix) and further inside accrual continues
    to only add the dt between consecutive post-resume inside fixes.
  * BUG 1c: Offline batch via /location-sync accrues INCREMENTAL deltas only, and
    replaying the same batch is idempotent thanks to the last_live_ts_ms watermark.
  * Regression: coverage gap >10min inside is excluded from total_inside_ms and
    flags the session.
"""
import os
import time
import uuid
import requests
import pytest


def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE = _load_backend_url()
ADMIN = ("akmaljn7@gmail.com", "GeofenceAdmin123!")
EMP = ("employee@example.com", "Employee123!")
EMP_ID = "6a6f63fda37a01476b2c4cca"
OFFICE_ID = "6a6f842be7d1e8c6030df446"
OFFICE_LAT = 6.5244
OFFICE_LNG = 3.3792


def _login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def emp_tok():
    return _login(*EMP)


@pytest.fixture(scope="module", autouse=True)
def _assign_office(admin_tok):
    r = requests.patch(
        f"{BASE}/api/employees/{EMP_ID}",
        headers=_h(admin_tok),
        json={"office_id": OFFICE_ID},
        timeout=20,
    )
    assert r.status_code in (200, 204), f"assign office: {r.status_code} {r.text}"
    yield
    requests.post(f"{BASE}/api/sessions/force-expire/{EMP_ID}", headers=_h(admin_tok), timeout=20)


def _force_expire(admin_tok):
    requests.post(f"{BASE}/api/sessions/force-expire/{EMP_ID}", headers=_h(admin_tok), timeout=20)
    time.sleep(0.4)


def _post_fix(emp_tok, device_id, lat, lng, ts_ms, battery=0.9, accuracy=8):
    r = requests.post(
        f"{BASE}/api/mobile/location",
        headers=_h(emp_tok),
        json={"device_id": device_id, "lat": lat, "lng": lng,
              "accuracy": accuracy, "ts_ms": ts_ms, "battery": battery},
        timeout=20,
    )
    assert r.status_code == 200, f"POST /mobile/location {ts_ms}: {r.status_code} {r.text}"
    return r.json()


def _get_live_session(admin_tok):
    r = requests.get(f"{BASE}/api/sessions/live", headers=_h(admin_tok), timeout=15)
    assert r.status_code == 200, r.text
    for s in r.json():
        if s.get("user_id") == EMP_ID:
            return s
    return None


class TestActiveInsideAccrualNoDoubleCount:
    """BUG 1 primary: 3 inside fixes then one far-outside must produce
    total_inside_ms == 30000 (delta between fixes), NOT 75000 (delta + full bout)."""

    def test_no_double_count_on_outside_pause(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        # 3 inside fixes 15s apart
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 15_000)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 30_000)

        # One far-outside fix
        out = _post_fix(emp_tok, device_id, 6.6, 3.45, now + 45_000)
        assert out.get("status") == "paused", f"expected paused, got {out}"

        s = _get_live_session(admin_tok)
        assert s is not None, "expected live (paused) session"
        assert s.get("status") == "paused", s
        total = s.get("total_inside_ms", -1)
        # 30_000ms inside (from ts_ms=0 -> 15000 -> 30000), NOT 75_000
        assert 29_000 <= total <= 31_000, (
            f"double-count bug re-appeared: total_inside_ms={total} (expected ~30000)"
        )

    def test_resume_incremental_accrual_continues(self, admin_tok, emp_tok):
        """Continuation of the previous scenario in a FRESH session:
        after paused state, resume with inside fix, then another inside fix
        15s later -> total should become 45000 (30000 + 15000)."""
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        # inside x3 -> total 30_000
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 15_000)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 30_000)
        # outside -> paused, still 30_000
        _post_fix(emp_tok, device_id, 6.6, 3.45, now + 45_000)

        # resume
        r1 = _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 60_000)
        assert r1.get("status") == "active", r1
        # accrue another 15s
        r2 = _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 75_000)
        assert r2.get("status") == "active", r2

        s = _get_live_session(admin_tok)
        assert s is not None
        assert s.get("status") == "active", s
        total = s.get("total_inside_ms", -1)
        assert 44_000 <= total <= 46_000, (
            f"expected ~45000 after resume+15s inside, got {total}"
        )


class TestOfflineBatchReplayAccrual:
    """BUG 1 offline path: /location-sync batch produces incremental accrual
    (120s inside for 3 inside pings 60s apart, then far-outside)."""

    def test_batch_accrual_and_idempotent_replay(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)
        fixes = [
            {"device_id": device_id, "lat": OFFICE_LAT, "lng": OFFICE_LNG,
             "accuracy": 8, "ts_ms": now, "battery": 0.9},
            {"device_id": device_id, "lat": OFFICE_LAT, "lng": OFFICE_LNG,
             "accuracy": 8, "ts_ms": now + 60_000, "battery": 0.9},
            {"device_id": device_id, "lat": OFFICE_LAT, "lng": OFFICE_LNG,
             "accuracy": 8, "ts_ms": now + 120_000, "battery": 0.9},
            {"device_id": device_id, "lat": 6.6, "lng": 3.45,
             "accuracy": 8, "ts_ms": now + 180_000, "battery": 0.9},
        ]
        r = requests.post(
            f"{BASE}/api/mobile/location-sync",
            headers=_h(emp_tok),
            json={"fixes": fixes},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        s = _get_live_session(admin_tok)
        assert s is not None, "session should exist after batch"
        assert s.get("status") == "paused", s
        total_first = s.get("total_inside_ms", -1)
        # 60_000 + 60_000 = 120_000 (deltas between the 3 inside fixes). NOT
        # 300_000 (that would be double-count including a full bout on pause).
        assert 118_000 <= total_first <= 122_000, (
            f"expected ~120000 from offline batch, got {total_first}"
        )

        # Replay identical batch -> watermark on last_live_ts_ms should reject
        # all fixes as stale; total must not change.
        r2 = requests.post(
            f"{BASE}/api/mobile/location-sync",
            headers=_h(emp_tok),
            json={"fixes": fixes},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        s2 = _get_live_session(admin_tok)
        total_second = s2.get("total_inside_ms", -1)
        assert total_second == total_first, (
            f"replay should be idempotent, got {total_first} -> {total_second}"
        )


class TestCoverageGapExcluded:
    """Regression: coverage gap >10min inside is excluded and flagged."""

    def test_coverage_gap_excludes_time(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 60_000)
        # 780_000 = 13 minutes after 2nd fix -> gap
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 780_000)

        s = _get_live_session(admin_tok)
        assert s is not None
        total = s.get("total_inside_ms", -1)
        # Only the 60s pre-gap delta should be counted
        assert 55_000 <= total <= 65_000, (
            f"expected ~60000 (gap excluded), got {total}"
        )
        assert s.get("flagged") is True, "session should be flagged for the gap"
