"""Regression tests for bug #1: proxied colleagues stay online together.

The lending phone's live-location fix must refresh last_live_ts_ms on EVERY
active proxy_checkin session it vouches for (proxy_by == owner email), not
just the streaming user's own session.
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "geofence_console")

ADMIN_EMAIL = "akmaljn7@gmail.com"
ADMIN_PASSWORD = "GeofenceAdmin123!"
SEED_EMPLOYEE_EMAIL = "employee@example.com"
SEED_EMPLOYEE_PASSWORD = "Employee123!"

# Test data prefix
TAG = "TEST_PROXY_"


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def org_id(db):
    org = db.organizations.find_one({"owner_email": ADMIN_EMAIL}) or \
          db.users.find_one({"email": ADMIN_EMAIL})
    assert org, "admin org not found"
    return str(org.get("org_id") or org["_id"])


@pytest.fixture(scope="module")
def office_id(admin_token, db):
    """Pick an existing office (seed 'UI Test Lagos') or create one."""
    r = requests.get(f"{BASE_URL}/api/offices", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200, r.text
    offices = r.json()
    # Prefer seed office; else create a test office
    if offices:
        o = offices[0]
        return {"id": o["id"], "lat": o["lat"], "lng": o["lng"], "radius": o["radius_meters"]}
    r = requests.post(f"{BASE_URL}/api/offices", headers=_h(admin_token),
                      json={"name": f"{TAG}Office", "lat": 6.5244, "lng": 3.3792,
                            "radius_meters": 300}, timeout=15)
    assert r.status_code in (200, 201), r.text
    o = r.json()
    return {"id": o["id"], "lat": o["lat"], "lng": o["lng"], "radius": o["radius_meters"]}


def _ensure_employee(admin_token, db, email: str, name: str, office_id: str,
                     password: str = "TestPass123!", enroll_face: bool = False) -> str:
    """Create employee if missing; return user_id."""
    u = db.users.find_one({"email": email.lower()})
    if u:
        # ensure office assigned and not soft-deleted
        db.users.update_one({"_id": u["_id"]},
                            {"$set": {"office_id": office_id, "deleted_at": None,
                                      "role": "employee"}})
        uid = str(u["_id"])
    else:
        r = requests.post(f"{BASE_URL}/api/employees", headers=_h(admin_token),
                          json={"email": email, "password": password, "name": name,
                                "office_id": office_id}, timeout=15)
        assert r.status_code in (200, 201), f"create emp failed: {r.status_code} {r.text}"
        uid = r.json()["id"]
    if enroll_face:
        # Bypass face detection: seed a fake baseline directly (proxy check-in
        # only checks truthiness of face_baseline).
        db.users.update_one({"_id": ObjectId(uid)},
                            {"$set": {"face_baseline": [0.01] * 128,
                                      "face_enrolled_at": "2026-01-01T00:00:00+00:00"}})
    # Reset password so we can login (in case account existed with unknown pwd)
    from passlib.hash import bcrypt
    db.users.update_one({"_id": ObjectId(uid)},
                        {"$set": {"password_hash": bcrypt.hash(password),
                                  "failed_login_count": 0, "locked_until": None,
                                  "logout_enabled": True, "bound_device_id": None}})
    return uid


@pytest.fixture(scope="module")
def setup_users(admin_token, db, office_id):
    """Create emp_a, emp_b (with face baseline) + lender + other_lender."""
    ts = int(time.time())
    emails = {
        "emp_a": f"test_proxy_a_{ts}@example.com",
        "emp_b": f"test_proxy_b_{ts}@example.com",
        "lender": f"test_proxy_lender_{ts}@example.com",
        "other": f"test_proxy_other_{ts}@example.com",
    }
    ids = {}
    ids["emp_a"] = _ensure_employee(admin_token, db, emails["emp_a"], "Test Emp A",
                                    office_id["id"], enroll_face=True)
    ids["emp_b"] = _ensure_employee(admin_token, db, emails["emp_b"], "Test Emp B",
                                    office_id["id"], enroll_face=True)
    ids["lender"] = _ensure_employee(admin_token, db, emails["lender"], "Test Lender",
                                     office_id["id"], enroll_face=False)
    ids["other"] = _ensure_employee(admin_token, db, emails["other"], "Test Other",
                                    office_id["id"], enroll_face=False)
    tokens = {
        "lender": _login(emails["lender"], "TestPass123!"),
        "other": _login(emails["other"], "TestPass123!"),
    }
    yield {"emails": emails, "ids": ids, "tokens": tokens}
    # Cleanup
    for uid in ids.values():
        db.active_sessions.delete_many({"user_id": uid})
        db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"deleted_at": "cleanup"}})


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_health_check():
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": "Bearer bogus"}, timeout=10)
    assert r.status_code in (401, 403), f"unexpected {r.status_code}"


def test_login_admin():
    tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert tok and isinstance(tok, str)


def test_proxy_checkin_creates_active_sessions(setup_users, office_id, db):
    """(a-c) Lender checks in emp_a AND emp_b. Both should create active
    proxy_checkin sessions."""
    lender_tok = setup_users["tokens"]["lender"]
    # Clean any prior sessions
    for k in ("emp_a", "emp_b", "lender"):
        db.active_sessions.delete_many({"user_id": setup_users["ids"][k]})

    for key in ("emp_a", "emp_b"):
        r = requests.post(f"{BASE_URL}/api/colleague/checkin",
                          headers=_h(lender_tok),
                          json={"email_or_id": setup_users["emails"][key],
                                "reason": "phone dead", "lat": office_id["lat"],
                                "lng": office_id["lng"], "accuracy": 5.0}, timeout=15)
        assert r.status_code == 200, f"checkin {key} failed: {r.status_code} {r.text}"
        assert r.json().get("ok") is True

    # Verify DB sessions exist and are proxy_checkin
    s_a = db.active_sessions.find_one({"user_id": setup_users["ids"]["emp_a"]})
    s_b = db.active_sessions.find_one({"user_id": setup_users["ids"]["emp_b"]})
    assert s_a and s_a["source"] == "proxy_checkin"
    assert s_b and s_b["source"] == "proxy_checkin"
    assert s_a["proxy_by"] == setup_users["emails"]["lender"]
    assert s_b["proxy_by"] == setup_users["emails"]["lender"]


def test_duplicate_checkin_returns_409(setup_users, office_id):
    """Regression: duplicate proxy check-in of same colleague returns 409."""
    lender_tok = setup_users["tokens"]["lender"]
    r = requests.post(f"{BASE_URL}/api/colleague/checkin", headers=_h(lender_tok),
                      json={"email_or_id": setup_users["emails"]["emp_a"],
                            "reason": "dup", "lat": office_id["lat"],
                            "lng": office_id["lng"], "accuracy": 5.0}, timeout=15)
    assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text}"


def test_location_fix_refreshes_all_proxy_sessions(setup_users, office_id, db):
    """CORE FIX: one live-location fix from lender must bump last_live_ts_ms
    on BOTH emp_a and emp_b proxy sessions."""
    lender_tok = setup_users["tokens"]["lender"]
    emp_a_id = setup_users["ids"]["emp_a"]
    emp_b_id = setup_users["ids"]["emp_b"]

    # BEFORE snapshot
    before_a = db.active_sessions.find_one({"user_id": emp_a_id})
    before_b = db.active_sessions.find_one({"user_id": emp_b_id})
    before_a_ts = before_a.get("last_live_ts_ms")
    before_b_ts = before_b.get("last_live_ts_ms")
    print(f"BEFORE emp_a.last_live_ts_ms={before_a_ts}  emp_b.last_live_ts_ms={before_b_ts}")

    # Wait to ensure ts_ms advances
    time.sleep(1.2)
    now_ms = int(time.time() * 1000)
    device_id = f"TESTDEV-{uuid.uuid4().hex[:12]}"

    r = requests.post(f"{BASE_URL}/api/mobile/location", headers=_h(lender_tok),
                      json={"device_id": device_id, "lat": office_id["lat"],
                            "lng": office_id["lng"], "accuracy": 5.0, "ts_ms": now_ms,
                            "battery": 0.9}, timeout=15)
    assert r.status_code == 200, f"location fix failed: {r.status_code} {r.text}"
    print(f"location outcome: {r.json()}")

    # AFTER snapshot
    after_a = db.active_sessions.find_one({"user_id": emp_a_id})
    after_b = db.active_sessions.find_one({"user_id": emp_b_id})
    after_a_ts = after_a.get("last_live_ts_ms")
    after_b_ts = after_b.get("last_live_ts_ms")
    print(f"AFTER  emp_a.last_live_ts_ms={after_a_ts}  emp_b.last_live_ts_ms={after_b_ts}")

    # Both must be bumped to ~now_ms
    assert after_a_ts is not None and after_a_ts >= now_ms - 500, \
        f"emp_a not refreshed: before={before_a_ts} after={after_a_ts} now_ms={now_ms}"
    assert after_b_ts is not None and after_b_ts >= now_ms - 500, \
        f"emp_b not refreshed: before={before_b_ts} after={after_b_ts} now_ms={now_ms}"
    # Both must be strictly greater than before (proves refresh actually happened)
    assert after_a_ts > (before_a_ts or 0)
    assert after_b_ts > (before_b_ts or 0)
    # last_fix should also be updated
    assert after_a["last_fix"]["ts_ms"] == now_ms
    assert after_b["last_fix"]["ts_ms"] == now_ms


def test_isolation_other_users_fix_does_not_refresh_proxies(setup_users, office_id, db):
    """A DIFFERENT user's location fix must NOT refresh emp_a/emp_b."""
    other_tok = setup_users["tokens"]["other"]
    emp_a_id = setup_users["ids"]["emp_a"]
    emp_b_id = setup_users["ids"]["emp_b"]

    before_a = db.active_sessions.find_one({"user_id": emp_a_id})["last_live_ts_ms"]
    before_b = db.active_sessions.find_one({"user_id": emp_b_id})["last_live_ts_ms"]

    time.sleep(1.2)
    now_ms = int(time.time() * 1000)
    device_id = f"TESTDEV-{uuid.uuid4().hex[:12]}"
    r = requests.post(f"{BASE_URL}/api/mobile/location", headers=_h(other_tok),
                      json={"device_id": device_id, "lat": office_id["lat"],
                            "lng": office_id["lng"], "accuracy": 5.0, "ts_ms": now_ms,
                            "battery": 0.8}, timeout=15)
    assert r.status_code == 200, r.text

    after_a = db.active_sessions.find_one({"user_id": emp_a_id})["last_live_ts_ms"]
    after_b = db.active_sessions.find_one({"user_id": emp_b_id})["last_live_ts_ms"]
    assert after_a == before_a, f"emp_a wrongly refreshed by other user: {before_a} -> {after_a}"
    assert after_b == before_b, f"emp_b wrongly refreshed by other user: {before_b} -> {after_b}"


def test_regression_own_session_live_location_updates(setup_users, office_id, db):
    """Regression: streaming user's OWN session's last_live_ts_ms still updates."""
    other_tok = setup_users["tokens"]["other"]
    other_id = setup_users["ids"]["other"]

    # The 'other' user posted a location above inside office w/ good accuracy;
    # should have auto-started their own session.
    sess = db.active_sessions.find_one({"user_id": other_id})
    assert sess is not None, "own session not auto-started"
    before_ts = sess["last_live_ts_ms"]

    time.sleep(1.2)
    now_ms = int(time.time() * 1000)
    device_id = f"TESTDEV-{uuid.uuid4().hex[:12]}"
    r = requests.post(f"{BASE_URL}/api/mobile/location", headers=_h(other_tok),
                      json={"device_id": device_id, "lat": office_id["lat"],
                            "lng": office_id["lng"], "accuracy": 5.0, "ts_ms": now_ms,
                            "battery": 0.8}, timeout=15)
    assert r.status_code == 200, r.text
    sess2 = db.active_sessions.find_one({"user_id": other_id})
    assert sess2["last_live_ts_ms"] > before_ts, \
        f"own session not refreshed: {before_ts} -> {sess2['last_live_ts_ms']}"


def test_admin_live_sessions_shows_both_proxies_fresh(admin_token, setup_users, office_id, db):
    """Verify via /api/sessions/live that both proxy sessions surface with a
    fresh last_fix.ts_ms (proxy admin view)."""
    lender_tok = setup_users["tokens"]["lender"]
    time.sleep(1.2)
    now_ms = int(time.time() * 1000)
    device_id = f"TESTDEV-{uuid.uuid4().hex[:12]}"
    r = requests.post(f"{BASE_URL}/api/mobile/location", headers=_h(lender_tok),
                      json={"device_id": device_id, "lat": office_id["lat"],
                            "lng": office_id["lng"], "accuracy": 5.0, "ts_ms": now_ms,
                            "battery": 0.9}, timeout=15)
    assert r.status_code == 200, r.text

    r = requests.get(f"{BASE_URL}/api/sessions/live", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200, r.text
    sessions = r.json()
    proxies = [s for s in sessions if s.get("proxy_by") == setup_users["emails"]["lender"]]
    assert len(proxies) >= 2, f"expected >=2 proxy sessions, got {len(proxies)}"
    for s in proxies:
        ts = (s.get("last_fix") or {}).get("ts_ms", 0)
        assert ts >= now_ms - 500, f"proxy session stale in live view: {ts} vs now={now_ms}"
        assert s.get("stale") is False, f"proxy session marked stale: {s}"
