"""Iteration 30 — Offline scheduled selfies backend tests.

Covers the new offline selfie sync feature:
- POST /api/mobile/selfie-sync (missed / idempotent / verified / mismatch)
- Session flag propagation on mismatch/missed
- GET /api/mobile/reconcile now returns selfie_config + schedule
- Admin endpoints under /api/offline-selfies (list, photo, review, filters)
- Tenant/role isolation (employees cannot access admin endpoints)
- Regression: online selfie challenge respond still works
"""
import asyncio
import base64
import os
import time
import urllib.request
import uuid
from pathlib import Path

import pytest
import requests
from bson import ObjectId

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
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

OBAMA_URL = "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/obama.jpg"
BIDEN_URL = "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/biden.jpg"
_OBAMA_PATH = "/tmp/_test_obama.jpg"
_BIDEN_PATH = "/tmp/_test_biden.jpg"


def _download(url: str, path: str) -> bool:
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        return True
    try:
        urllib.request.urlretrieve(url, path)
        return os.path.getsize(path) > 5000
    except Exception as e:
        print(f"Download failed {url}: {e}")
        return False


NET_OK = _download(OBAMA_URL, _OBAMA_PATH) and _download(BIDEN_URL, _BIDEN_PATH)


def _as_data_url(path: str) -> str:
    data = Path(path).read_bytes()
    return "data:image/jpeg;base64," + base64.b64encode(data).decode()


def _mongo():
    from motor.motor_asyncio import AsyncIOMotorClient
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    dbname = os.environ.get("DB_NAME", "geofence_console")
    return AsyncIOMotorClient(url)[dbname]


async def _patch_session(sid: str, patch: dict):
    await _mongo().active_sessions.update_one({"_id": ObjectId(sid)}, {"$set": patch})


async def _wipe_offline_selfies(user_id: str):
    await _mongo().offline_selfies.delete_many({"user_id": user_id})


async def _find_offline_selfie_id(user_id: str, client_selfie_id: str) -> str | None:
    doc = await _mongo().offline_selfies.find_one(
        {"user_id": user_id, "client_selfie_id": client_selfie_id}
    )
    return doc.get("id") if doc else None


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def owner_sess():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def emp_ids(owner_sess):
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "Sample employee must be seeded"
    return {"emp_id": emp["id"]}


@pytest.fixture(scope="module")
def lagos_office(owner_sess, emp_ids):
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_OfflineSelfie_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    owner_sess.patch(f"{API}/employees/{emp_ids['emp_id']}",
                     json={"office_id": office_id, "schedule": {"mode": "any"}})
    yield {"office_id": office_id}
    try:
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


@pytest.fixture(scope="module")
def employee_sess(lagos_office):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PW})
    assert r.status_code == 200, r.text
    s.post(f"{API}/sessions/reset")
    return s


@pytest.fixture(autouse=True)
def _reset(owner_sess, employee_sess, emp_ids):
    owner_sess.delete(f"{API}/face/reset/{emp_ids['emp_id']}")
    employee_sess.post(f"{API}/sessions/reset")
    asyncio.run(_wipe_offline_selfies(emp_ids["emp_id"]))
    owner_sess.patch(f"{API}/org/settings", json={
        "auto_start_on_entry": True,
        "selfie_challenges_per_shift": 2,
        "selfie_response_window_minutes": 5,
        "selfie_mode": "random",
        "selfie_fixed_times": [],
        "accuracy_tolerance_meters": 50,
        "active_liveness": False,
    })
    owner_sess.patch(f"{API}/employees/{emp_ids['emp_id']}", json={"schedule": {"mode": "any"}})
    yield
    employee_sess.post(f"{API}/sessions/reset")
    owner_sess.delete(f"{API}/face/reset/{emp_ids['emp_id']}")
    asyncio.run(_wipe_offline_selfies(emp_ids["emp_id"]))


def _draft(outcome="captured", face_photo=None, client_selfie_id=None, scheduled_ms=None):
    now = int(time.time() * 1000)
    scheduled_ms = scheduled_ms if scheduled_ms is not None else (now - 300_000)
    return {
        "client_selfie_id": client_selfie_id or f"cs_{uuid.uuid4().hex[:12]}",
        "scheduled_ms": scheduled_ms,
        "respond_by_ms": scheduled_ms + 300_000,
        "captured_ms": (scheduled_ms + 60_000) if outcome == "captured" else None,
        "outcome": outcome,
        "face_photo": face_photo,
        "client_liveness": True,
        "battery": 0.65,
    }


def _start_session(employee_sess):
    r = employee_sess.post(f"{API}/sessions/auto-start", json={
        "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------- Tests ----------

class TestSelfieSyncBasics:

    def test_missed_draft_records_and_processed_one(self, employee_sess):
        d = _draft(outcome="missed", face_photo=None)
        r = employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["processed"] == 1
        results = body["results"]
        assert len(results) == 1
        assert results[0]["client_selfie_id"] == d["client_selfie_id"]
        assert results[0]["status"] == "missed"
        # duplicate flag NOT set on first insert
        assert not results[0].get("duplicate")

    def test_idempotency_same_client_selfie_id_returns_duplicate(self, employee_sess, emp_ids):
        d = _draft(outcome="missed", face_photo=None)
        # First send
        r1 = employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        assert r1.status_code == 200
        assert r1.json()["results"][0]["status"] == "missed"
        # Second send (same client_selfie_id)
        r2 = employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        assert body2["processed"] == 1
        res = body2["results"][0]
        assert res["duplicate"] is True
        assert res["status"] == "missed"
        # Verify only ONE record in DB
        async def _count():
            return await _mongo().offline_selfies.count_documents(
                {"user_id": emp_ids["emp_id"], "client_selfie_id": d["client_selfie_id"]}
            )
        cnt = asyncio.run(_count())
        assert cnt == 1, f"Expected 1 offline_selfies row, got {cnt}"


@pytest.mark.skipif(not NET_OK, reason="face images unavailable")
class TestSelfieSyncFaceMatch:

    def test_captured_matching_baseline_verified(self, employee_sess):
        obama = _as_data_url(_OBAMA_PATH)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        d = _draft(outcome="captured", face_photo=obama)
        r = employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        assert r.status_code == 200, r.text
        res = r.json()["results"][0]
        assert res["status"] == "verified", f"Expected verified, got {res}"
        assert res["similarity"] is not None and res["similarity"] >= 0.93, res

    def test_captured_mismatch_flagged(self, employee_sess):
        obama = _as_data_url(_OBAMA_PATH)
        biden = _as_data_url(_BIDEN_PATH)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        d = _draft(outcome="captured", face_photo=biden)
        r = employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        assert r.status_code == 200, r.text
        res = r.json()["results"][0]
        # Either mismatch OR no_face (if biden crop doesn't detect a face) — both count as flagged
        assert res["status"] in ("mismatch", "no_face"), f"Expected mismatch/no_face, got {res}"

    def test_mismatch_flags_active_session(self, employee_sess, emp_ids):
        obama = _as_data_url(_OBAMA_PATH)
        biden = _as_data_url(_BIDEN_PATH)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        sid = _start_session(employee_sess)
        # Confirm session initially not flagged
        me = employee_sess.get(f"{API}/sessions/me").json()
        assert me is not None
        assert me.get("flagged") in (False, None), me
        # Sync a mismatch draft
        d = _draft(outcome="captured", face_photo=biden)
        r = employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        assert r.status_code == 200, r.text
        status = r.json()["results"][0]["status"]
        assert status in ("mismatch", "no_face")
        # Session should now be flagged
        me2 = employee_sess.get(f"{API}/sessions/me").json()
        assert me2 is not None
        assert me2.get("flagged") is True, f"Session should be flagged after mismatch: {me2}"


class TestReconcile:

    def test_reconcile_returns_selfie_config_and_schedule(self, employee_sess):
        r = employee_sess.get(f"{API}/mobile/reconcile")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "selfie_config" in body, body
        sc = body["selfie_config"]
        for k in ("challenges_per_shift", "response_window_minutes", "mode",
                  "fixed_times", "active_liveness"):
            assert k in sc, f"selfie_config missing key {k}: {sc}"
        assert isinstance(sc["challenges_per_shift"], int)
        assert isinstance(sc["response_window_minutes"], int)
        assert sc["mode"] in ("random", "fixed")
        assert isinstance(sc["fixed_times"], list)
        assert isinstance(sc["active_liveness"], bool)
        assert "schedule" in body, body
        assert isinstance(body["schedule"], dict)
        assert "mode" in body["schedule"]


class TestAdminOfflineSelfies:

    def test_admin_list_all(self, owner_sess, employee_sess, emp_ids):
        # Seed one missed draft
        d = _draft(outcome="missed", face_photo=None)
        employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        rec_id = asyncio.run(_find_offline_selfie_id(emp_ids["emp_id"], d["client_selfie_id"]))
        assert rec_id is not None, "offline_selfies row should exist in DB"
        r = owner_sess.get(f"{API}/offline-selfies?status=all")
        assert r.status_code == 200, r.text
        lst = r.json()
        assert isinstance(lst, list)
        assert any(x["id"] == rec_id for x in lst), f"Admin list missing record {rec_id}"

    def test_admin_filter_missed(self, owner_sess, employee_sess):
        d = _draft(outcome="missed", face_photo=None)
        employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        r = owner_sess.get(f"{API}/offline-selfies?status=missed")
        assert r.status_code == 200, r.text
        for x in r.json():
            assert x["status"] == "missed"

    def test_admin_filter_flagged_covers_multiple(self, owner_sess, employee_sess):
        d = _draft(outcome="missed", face_photo=None)
        employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        r = owner_sess.get(f"{API}/offline-selfies?status=flagged")
        assert r.status_code == 200, r.text
        for x in r.json():
            assert x["status"] in ("mismatch", "no_face", "missed", "invalid_photo"), x

    @pytest.mark.skipif(not NET_OK, reason="face images unavailable")
    def test_admin_get_photo_of_captured(self, owner_sess, employee_sess, emp_ids):
        obama = _as_data_url(_OBAMA_PATH)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        d = _draft(outcome="captured", face_photo=obama)
        employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        rec_id = asyncio.run(_find_offline_selfie_id(emp_ids["emp_id"], d["client_selfie_id"]))
        assert rec_id is not None
        lst = owner_sess.get(f"{API}/offline-selfies?status=all").json()
        rec = next((x for x in lst if x["id"] == rec_id), None)
        assert rec is not None, lst
        assert rec["has_photo"] is True
        r = owner_sess.get(f"{API}/offline-selfies/{rec_id}/photo")
        assert r.status_code == 200, r.text
        assert len(r.content) > 500
        assert r.headers.get("content-type", "").startswith("image/")

    def test_admin_get_photo_404_for_missed(self, owner_sess, employee_sess, emp_ids):
        d = _draft(outcome="missed", face_photo=None)
        employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        rec_id = asyncio.run(_find_offline_selfie_id(emp_ids["emp_id"], d["client_selfie_id"]))
        assert rec_id is not None
        r = owner_sess.get(f"{API}/offline-selfies/{rec_id}/photo")
        assert r.status_code == 404, r.text

    def test_admin_review_marks_reviewed(self, owner_sess, employee_sess, emp_ids):
        d = _draft(outcome="missed", face_photo=None)
        employee_sess.post(f"{API}/mobile/selfie-sync", json={"drafts": [d]})
        rec_id = asyncio.run(_find_offline_selfie_id(emp_ids["emp_id"], d["client_selfie_id"]))
        assert rec_id is not None
        lst = owner_sess.get(f"{API}/offline-selfies?status=missed").json()
        rec = next((x for x in lst if x["id"] == rec_id), None)
        assert rec is not None
        assert rec.get("reviewed") is False
        r = owner_sess.post(f"{API}/offline-selfies/{rec_id}/review")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["reviewed"] is True
        lst2 = owner_sess.get(f"{API}/offline-selfies?status=missed").json()
        rec2 = next((x for x in lst2 if x["id"] == rec_id), None)
        assert rec2 is not None
        assert rec2["reviewed"] is True
        assert rec2["reviewed_by"] == OWNER_EMAIL


class TestRoleIsolation:

    def test_employee_cannot_list_offline_selfies(self, employee_sess):
        r = employee_sess.get(f"{API}/offline-selfies")
        assert r.status_code == 403, r.text

    def test_employee_cannot_review(self, employee_sess):
        r = employee_sess.post(f"{API}/offline-selfies/nonexistent/review")
        assert r.status_code == 403, r.text

    def test_employee_cannot_get_photo(self, employee_sess):
        r = employee_sess.get(f"{API}/offline-selfies/nonexistent/photo")
        assert r.status_code == 403, r.text


@pytest.mark.skipif(not NET_OK, reason="face images unavailable")
class TestOnlineSelfieRegression:

    def test_online_selfie_flow_still_works(self, employee_sess):
        """Regression: existing online challenge response flow unchanged."""
        obama = _as_data_url(_OBAMA_PATH)
        assert employee_sess.post(f"{API}/face/enroll", json={"face_photo": obama}).status_code == 200
        # Auto-start session; a challenge is triggered
        r = employee_sess.post(f"{API}/sessions/auto-start", json={
            "lat": IN_LAT, "lng": IN_LNG, "accuracy": 10,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        sid = body["id"]
        challenges = body.get("challenges") or []
        assert challenges, "auto-start should create at least one challenge"
        ch_id = challenges[0]["id"]
        # Backdate trigger so challenge is due
        past = int(time.time() * 1000) - 60_000
        asyncio.run(_patch_session(sid, {"challenges.0.trigger_ms": past}))
        employee_sess.post(f"{API}/sessions/ping",
                           json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        rr = employee_sess.post(f"{API}/sessions/challenge/{ch_id}/respond",
                                json={"face_photo": obama})
        assert rr.status_code == 200, rr.text
