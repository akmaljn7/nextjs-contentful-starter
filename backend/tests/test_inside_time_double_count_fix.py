"""Regression tests for inside-time double-count fix (iter 25) AFTER the
GPS-jitter suppression change (iter 26).

BEHAVIOR CHANGE: a SINGLE outside live-location fix no longer immediately
pauses. It returns 'exit_pending' (status stays active) until either the
employee returns inside (jitter, no OUT crossing logged) OR stays outside
for more than EXIT_GRACE_MS (=3min), at which point a confirmed exit is
recorded with a BACKDATED pause_live crossing. Tests that need a pause
now send TWO outside fixes >3min apart.
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
# ~400m north of office center — comfortably beyond radius(300)+accuracy(8)
FAR_OUTSIDE = (6.5280, 3.3792)
FAR_FAR = (6.6, 3.45)
EXIT_GRACE_MS = 3 * 60 * 1000


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
    """3 inside fixes then a SUSTAINED outside (two outside fixes >3min apart)
    must produce total_inside_ms == 30000 (delta between inside fixes only)."""

    def test_no_double_count_on_sustained_outside_pause(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 15_000)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 30_000)

        # First outside fix -> exit_pending (NOT paused)
        p1 = _post_fix(emp_tok, device_id, *FAR_OUTSIDE, now + 45_000)
        assert p1.get("outcome") == "exit_pending", p1
        assert p1.get("status") == "active", p1

        # Second outside fix >3min later -> confirmed sustained exit -> paused
        p2 = _post_fix(emp_tok, device_id, *FAR_OUTSIDE, now + 45_000 + EXIT_GRACE_MS + 5_000)
        assert p2.get("outcome") == "session_paused", p2
        assert p2.get("status") == "paused", p2

        s = _get_live_session(admin_tok)
        assert s is not None
        assert s.get("status") == "paused", s
        total = s.get("total_inside_ms", -1)
        assert 29_000 <= total <= 31_000, (
            f"double-count regression: total_inside_ms={total} (expected ~30000)"
        )

    def test_resume_incremental_accrual_continues(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 15_000)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 30_000)

        # Sustained outside -> pause
        _post_fix(emp_tok, device_id, *FAR_OUTSIDE, now + 45_000)
        _post_fix(emp_tok, device_id, *FAR_OUTSIDE, now + 45_000 + EXIT_GRACE_MS + 5_000)

        base = now + 45_000 + EXIT_GRACE_MS + 5_000
        # Resume inside
        r1 = _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, base + 15_000)
        assert r1.get("status") == "active", r1
        # +15s inside -> +15000 accrual
        r2 = _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, base + 30_000)
        assert r2.get("status") == "active", r2

        s = _get_live_session(admin_tok)
        assert s is not None
        assert s.get("status") == "active", s
        total = s.get("total_inside_ms", -1)
        assert 44_000 <= total <= 46_000, (
            f"expected ~45000 (30000 + 15000 post-resume), got {total}"
        )


class TestOfflineBatchReplayAccrual:
    """/location-sync batch drains through the same debounce/speed logic. Two
    outside fixes >3min apart in the ordered batch confirm the exit."""

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
            # first outside -> exit_pending
            {"device_id": device_id, "lat": FAR_OUTSIDE[0], "lng": FAR_OUTSIDE[1],
             "accuracy": 8, "ts_ms": now + 180_000, "battery": 0.9},
            # second outside >3min later -> confirmed pause
            {"device_id": device_id, "lat": FAR_OUTSIDE[0], "lng": FAR_OUTSIDE[1],
             "accuracy": 8, "ts_ms": now + 180_000 + EXIT_GRACE_MS + 5_000, "battery": 0.9},
        ]
        r = requests.post(f"{BASE}/api/mobile/location-sync",
                          headers=_h(emp_tok), json={"fixes": fixes}, timeout=30)
        assert r.status_code == 200, r.text
        outs = r.json().get("outcomes", [])
        # first three: auto-start then active accrual
        assert outs[-2] == "exit_pending", outs
        assert outs[-1] == "session_paused", outs

        s = _get_live_session(admin_tok)
        assert s is not None
        assert s.get("status") == "paused", s
        total_first = s.get("total_inside_ms", -1)
        assert 118_000 <= total_first <= 122_000, (
            f"expected ~120000 from offline batch, got {total_first}"
        )

        # Replay identical batch -> watermark rejects all as stale_replay.
        r2 = requests.post(f"{BASE}/api/mobile/location-sync",
                           headers=_h(emp_tok), json={"fixes": fixes}, timeout=30)
        assert r2.status_code == 200, r2.text
        s2 = _get_live_session(admin_tok)
        total_second = s2.get("total_inside_ms", -1)
        assert total_second == total_first, (
            f"replay should be idempotent, got {total_first} -> {total_second}"
        )


class TestCoverageGapExcluded:
    """>10min coverage gap between inside fixes is excluded and flags session."""

    def test_coverage_gap_excludes_time(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 60_000)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 780_000)

        s = _get_live_session(admin_tok)
        assert s is not None
        total = s.get("total_inside_ms", -1)
        assert 55_000 <= total <= 65_000, (
            f"expected ~60000 (gap excluded), got {total}"
        )
        assert s.get("flagged") is True, "session should be flagged for the gap"
