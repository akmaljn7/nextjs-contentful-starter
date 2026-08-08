"""GPS jitter suppression tests (iter 26).

Two server-side mechanisms in _apply_location_fix:
  (A) EXIT DEBOUNCE — a brief outside excursion returning within 3 minutes
      is jitter: no pause_live crossing, session stays ACTIVE. Only outside
      beyond 3 min confirms a real exit and pauses with a BACKDATED pause_live
      crossing at the first-outside ts_ms.
  (B) IMPOSSIBLE-SPEED FILTER — a fix implying >55 m/s over <=120s with
      >=100m displacement is discarded (outcome 'rejected_gps_glitch') —
      state does not change, no log entry, no gps_ping written.
"""
import os
import time
import uuid
import math
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
FAR_OUTSIDE = (6.5280, 3.3792)   # ~400m north — beyond r(300)+acc(8)
FAR_FAR = (6.6, 3.45)             # ~far
TELEPORT = (6.5514, 3.3792)       # ~3km north — teleport spike
EXIT_GRACE_MS = 3 * 60 * 1000


def _haversine(lat1, lng1, lat2, lng2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# Sanity: verify our chosen outside coord truly is outside the geofence
def test_outside_coord_is_actually_outside():
    d = _haversine(OFFICE_LAT, OFFICE_LNG, *FAR_OUTSIDE)
    assert d > 300 + 8, f"FAR_OUTSIDE only {d:.0f}m from center — pick a farther point"


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
    r = requests.patch(f"{BASE}/api/employees/{EMP_ID}", headers=_h(admin_tok),
                       json={"office_id": OFFICE_ID}, timeout=20)
    assert r.status_code in (200, 204), f"assign office: {r.status_code} {r.text}"
    yield
    requests.post(f"{BASE}/api/sessions/force-expire/{EMP_ID}", headers=_h(admin_tok), timeout=20)


def _force_expire(admin_tok):
    requests.post(f"{BASE}/api/sessions/force-expire/{EMP_ID}", headers=_h(admin_tok), timeout=20)
    time.sleep(0.4)


def _post_fix(emp_tok, device_id, lat, lng, ts_ms, battery=0.9, accuracy=8):
    r = requests.post(f"{BASE}/api/mobile/location", headers=_h(emp_tok),
                      json={"device_id": device_id, "lat": lat, "lng": lng,
                            "accuracy": accuracy, "ts_ms": ts_ms, "battery": battery}, timeout=20)
    assert r.status_code == 200, f"POST /mobile/location ts={ts_ms}: {r.status_code} {r.text}"
    return r.json()


def _get_live_session(admin_tok):
    r = requests.get(f"{BASE}/api/sessions/live", headers=_h(admin_tok), timeout=15)
    assert r.status_code == 200, r.text
    for s in r.json():
        if s.get("user_id") == EMP_ID:
            return s
    return None


def _pause_live_entries(session):
    return [e for e in (session or {}).get("log", []) if e.get("event") == "pause_live"]


class TestExitDebounceJitterSuppressed:
    """A single outside excursion that returns inside within 3 min = jitter.
    Session stays ACTIVE. Zero pause_live crossings ever logged."""

    def test_jitter_no_phantom_out_in(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        r1 = _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        assert r1.get("outcome") == "session_started", r1
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 30_000)

        out = _post_fix(emp_tok, device_id, *FAR_OUTSIDE, now + 90_000)
        assert out.get("outcome") == "exit_pending", f"expected exit_pending, got {out}"
        assert out.get("status") == "active", out

        back = _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 150_000)
        # Return within grace clears pending_exit; no pause logged.
        assert back.get("status") == "active", back

        s = _get_live_session(admin_tok)
        assert s is not None
        assert s.get("status") == "active", s
        assert _pause_live_entries(s) == [], (
            f"phantom pause_live log entries appeared: {_pause_live_entries(s)}"
        )


class TestExitDebounceSustainedExit:
    """Two outside fixes >3 min apart = confirmed exit. Session pauses with
    a BACKDATED pause_live crossing (ts_ms == first-outside ts). Grace-period
    outside time is NOT counted toward total_inside_ms."""

    def test_sustained_exit_backdated_pause(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now + 30_000)

        first_out_ts = now + 60_000
        p1 = _post_fix(emp_tok, device_id, *FAR_OUTSIDE, first_out_ts)
        assert p1.get("outcome") == "exit_pending", p1

        second_out_ts = first_out_ts + EXIT_GRACE_MS + 5_000
        p2 = _post_fix(emp_tok, device_id, *FAR_OUTSIDE, second_out_ts)
        assert p2.get("outcome") == "session_paused", p2
        assert p2.get("status") == "paused", p2

        s = _get_live_session(admin_tok)
        assert s is not None
        assert s.get("status") == "paused", s

        pauses = _pause_live_entries(s)
        assert len(pauses) == 1, f"expected exactly one pause_live, got {pauses}"
        # Backdated to first-outside ts
        assert pauses[0]["ts_ms"] == first_out_ts, (
            f"pause_live not backdated: {pauses[0]['ts_ms']} != {first_out_ts}"
        )
        # total_inside_ms must be ~30_000 (the pre-exit inside delta only).
        total = s.get("total_inside_ms", -1)
        assert 29_000 <= total <= 31_000, (
            f"grace-outside must not be counted; total_inside_ms={total} (expected ~30000)"
        )


class TestImpossibleSpeedFilterRejectsTeleport:
    """A ~3km jump in 5s (~600 m/s) is discarded outright.
    Outcome 'rejected_gps_glitch', session state unchanged, no crossing logged."""

    def test_teleport_rejected_state_unchanged(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        device_id = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)

        r1 = _post_fix(emp_tok, device_id, OFFICE_LAT, OFFICE_LNG, now)
        assert r1.get("outcome") == "session_started", r1

        r2 = _post_fix(emp_tok, device_id, *TELEPORT, now + 5_000)
        assert r2.get("outcome") == "rejected_gps_glitch", r2
        assert r2.get("speed_mps", 0) > 55, r2

        s = _get_live_session(admin_tok)
        assert s is not None
        assert s.get("status") == "active", s
        last = s.get("last_fix") or {}
        # last_fix must be unchanged (still at office center from r1)
        assert abs(last.get("lat", 0) - OFFICE_LAT) < 1e-6, last
        assert abs(last.get("lng", 0) - OFFICE_LNG) < 1e-6, last
        # No pause_live logged
        assert _pause_live_entries(s) == [], s.get("log")
