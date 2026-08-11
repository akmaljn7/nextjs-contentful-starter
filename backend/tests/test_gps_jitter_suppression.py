"""GPS jitter suppression tests.

_apply_location_fix now suppresses jitter with TWO layers:
  1. IMPOSSIBLE-SPEED FILTER — a fix implying >55 m/s over <=120s with
     >=100m displacement is discarded outright (outcome 'rejected_gps_glitch').
  2. CROSSING HYSTERESIS — a boundary crossing is only committed once it is
     SUSTAINED across EXIT_CONFIRM_FIXES(3) fixes AND EXIT_CONFIRM_MS(45s)
     (enter: 2 fixes / 20s). A single/brief out-and-back blip logs NO in/out
     (a non-crossing 'jitter_ignored' breadcrumb is recorded instead). This is
     what stops a stationary on-desk phone from flapping false OUT/IN.
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


def _events(session):
    return [e.get("event") for e in (session or {}).get("log", [])]


class TestExitHysteresis:
    """A single/brief outside blip (GPS jitter) must NOT log a false OUT.
    Only an exit sustained across EXIT_CONFIRM_FIXES fixes AND EXIT_CONFIRM_MS
    commits a pause_live, backdated to the first outside fix."""

    def test_jitter_blip_out_and_back_logs_no_crossing(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        dev = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)
        assert _post_fix(emp_tok, dev, OFFICE_LAT, OFFICE_LNG, now)["outcome"] == "session_started"

        blip = _post_fix(emp_tok, dev, *FAR_OUTSIDE, now + 15_000)
        assert blip["outcome"] == "pending_exit", f"blip should be held, not paused: {blip}"

        back = _post_fix(emp_tok, dev, OFFICE_LAT, OFFICE_LNG, now + 30_000)
        assert back["outcome"] == "active", f"jitter should resolve back to active: {back}"

        s = _get_live_session(admin_tok)
        assert s is not None and s.get("status") == "active", s
        assert _pause_live_entries(s) == [], f"NO false OUT expected, got {s.get('log')}"
        assert "jitter_ignored" in _events(s), f"expected a jitter_ignored breadcrumb: {s.get('log')}"

    def test_sustained_exit_commits_after_confirmation(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        dev = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)
        assert _post_fix(emp_tok, dev, OFFICE_LAT, OFFICE_LNG, now)["outcome"] == "session_started"

        first_out = now + 15_000
        r1 = _post_fix(emp_tok, dev, *FAR_OUTSIDE, first_out)
        assert r1["outcome"] == "pending_exit" and r1["outside_fixes"] == 1, r1
        r2 = _post_fix(emp_tok, dev, *FAR_OUTSIDE, now + 31_000)
        assert r2["outcome"] == "pending_exit" and r2["outside_fixes"] == 2, r2
        r3 = _post_fix(emp_tok, dev, *FAR_OUTSIDE, now + 62_000)   # 3rd fix, sustained 47s
        assert r3["outcome"] == "session_paused", f"exit should now commit: {r3}"

        s = _get_live_session(admin_tok)
        assert s is not None and s.get("status") == "paused", s
        pauses = _pause_live_entries(s)
        assert len(pauses) == 1, f"exactly one pause_live expected, got {pauses}"
        assert pauses[0]["ts_ms"] == first_out, (
            f"pause_live must be backdated to the first outside fix: {pauses[0]['ts_ms']} != {first_out}"
        )


class TestEnterHysteresis:
    """Returning inside is also confirmed (ENTER_CONFIRM_FIXES/MS) so a jitter
    blip back inside can't create a phantom resume."""

    def test_reentry_requires_confirmation(self, admin_tok, emp_tok):
        _force_expire(admin_tok)
        dev = "testdev-" + uuid.uuid4().hex[:8]
        now = int(time.time() * 1000)
        assert _post_fix(emp_tok, dev, OFFICE_LAT, OFFICE_LNG, now)["outcome"] == "session_started"
        # Sustained exit -> paused
        _post_fix(emp_tok, dev, *FAR_OUTSIDE, now + 15_000)
        _post_fix(emp_tok, dev, *FAR_OUTSIDE, now + 31_000)
        assert _post_fix(emp_tok, dev, *FAR_OUTSIDE, now + 62_000)["outcome"] == "session_paused"

        e1 = _post_fix(emp_tok, dev, OFFICE_LAT, OFFICE_LNG, now + 80_000)
        assert e1["outcome"] == "pending_enter", f"first inside fix should be held: {e1}"
        e2 = _post_fix(emp_tok, dev, OFFICE_LAT, OFFICE_LNG, now + 101_000)  # 2nd fix, 21s later
        assert e2["outcome"] == "session_resumed", f"re-entry should now commit: {e2}"

        s = _get_live_session(admin_tok)
        assert s is not None and s.get("status") == "active", s


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
