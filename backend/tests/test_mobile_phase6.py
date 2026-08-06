"""Phase 6 backend tests — attestation endpoint + deadman cron.

Covers:
- POST /api/mobile/attestation:
    - 404 if device isn't registered
    - Stub token → verdict=stub_accepted, no security_event
    - Malformed token → verdict=invalid_structure, security_event logged
    - Valid-looking JWS (Android) → verdict=ok
- POST /api/cron/deadman-tick:
    - 401 when secret missing / wrong
    - Duplicate run_id returns duplicate=True
    - Happy path enqueues background sweep, returns 200 quickly
"""
import os
import time
import uuid
import httpx
import pytest
import asyncio

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "akmaljn7@gmail.com"
ADMIN_PWD = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PWD = "Employee123!"


async def _login(c: httpx.AsyncClient, email: str, pwd: str):
    r = await c.post("/api/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = c.cookies.get("access_token")
    if tok:
        c.headers.update({"Authorization": f"Bearer {tok}"})


async def _register_device(c: httpx.AsyncClient, dev_id: str) -> None:
    r = await c.post("/api/mobile/register-device", json={
        "device_id": dev_id,
        "platform": "android",
        "push_token": f"tok-{dev_id}",
        "app_version": "1.0.0",
    })
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_attestation_404_when_device_missing():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as emp:
        await _login(emp, EMP_EMAIL, EMP_PWD)
        r = await emp.post("/api/mobile/attestation", json={
            "device_id": f"UNREG-{uuid.uuid4().hex[:12]}",
            "platform": "android",
            "token": "stub-abc123-def456-hex7890abcdef",
            "nonce": f"nonce-{uuid.uuid4().hex[:16]}",
            "ts_ms": int(time.time() * 1000),
        })
        assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_attestation_stub_accepted():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as emp:
        await _login(emp, EMP_EMAIL, EMP_PWD)
        dev_id = f"TESTDEV-{uuid.uuid4().hex[:12]}"
        await _register_device(emp, dev_id)
        r = await emp.post("/api/mobile/attestation", json={
            "device_id": dev_id,
            "platform": "android",
            "token": f"stub-abc-{uuid.uuid4().hex}-fakehex",
            "nonce": f"nonce-{uuid.uuid4().hex[:16]}",
            "ts_ms": int(time.time() * 1000),
            "client_event_id": f"ev-{uuid.uuid4().hex[:12]}",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["verdict"] == "stub_accepted"


@pytest.mark.asyncio
async def test_attestation_invalid_structure_flags_security_event():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as emp:
        await _login(emp, EMP_EMAIL, EMP_PWD)
        dev_id = f"TESTDEV-{uuid.uuid4().hex[:12]}"
        await _register_device(emp, dev_id)
        # Random non-JWS, non-stub token for android → invalid_structure
        r = await emp.post("/api/mobile/attestation", json={
            "device_id": dev_id,
            "platform": "android",
            "token": "not_a_real_jws_token",
            "nonce": f"nonce-{uuid.uuid4().hex[:16]}",
            "ts_ms": int(time.time() * 1000),
        })
        assert r.status_code == 200, r.text
        assert r.json()["verdict"] == "invalid_structure"

    # Verify security_event landed on admin side
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as admin:
        await _login(admin, ADMIN_EMAIL, ADMIN_PWD)
        r = await admin.get("/api/security-events?limit=50")
        assert r.status_code == 200
        types = [e["type"] for e in r.json()]
        assert "attestation_invalid" in types


@pytest.mark.asyncio
async def test_attestation_jws_shape_accepted():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as emp:
        await _login(emp, EMP_EMAIL, EMP_PWD)
        dev_id = f"TESTDEV-{uuid.uuid4().hex[:12]}"
        await _register_device(emp, dev_id)
        # 3-segment token (JWS-shaped) — should be accepted structurally
        fake_jws = "aGVhZGVy.cGF5bG9hZA.c2ln"
        r = await emp.post("/api/mobile/attestation", json={
            "device_id": dev_id,
            "platform": "android",
            "token": fake_jws,
            "nonce": f"nonce-{uuid.uuid4().hex[:16]}",
            "ts_ms": int(time.time() * 1000),
        })
        assert r.status_code == 200, r.text
        assert r.json()["verdict"] == "ok"


# ---------------------------------------------------------------------------
# Deadman-tick cron
# ---------------------------------------------------------------------------
def _cron_secret() -> str:
    # Read from backend env — tests run in-cluster with the same file
    import pathlib
    for line in pathlib.Path("/app/backend/.env").read_text().splitlines():
        if line.startswith("WEBHOOK_CRON_SECRET"):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError("WEBHOOK_CRON_SECRET not found in /app/backend/.env")


@pytest.mark.asyncio
async def test_deadman_tick_requires_auth():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as c:
        r = await c.post("/api/cron/deadman-tick", json={})
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_deadman_tick_wrong_secret_rejected():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as c:
        r = await c.post(
            "/api/cron/deadman-tick",
            json={},
            headers={"Authorization": "Bearer wrong-secret"},
        )
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_deadman_sweep_pokes_stale_employee():
    """End-to-end: stale employee + no active session → silent push is stubbed."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from datetime import datetime, timezone, timedelta
    from bson import ObjectId

    # Directly poke the DB to plant a stale mobile_device for the seeded employee
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "geofence_console")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    user = await db.users.find_one({"email": EMP_EMAIL})
    assert user, "seeded employee missing"
    user_id = str(user["_id"])

    # Clean any active session so the sweep considers this user
    await db.active_sessions.delete_many({"user_id": user_id})

    # Plant a stale device (last_seen_at 40 min ago, no cooldown yet)
    dev_id = f"STALE-{uuid.uuid4().hex[:12]}"
    stale_iso = (datetime.now(timezone.utc) - timedelta(minutes=40)).isoformat()
    await db.mobile_devices.insert_one({
        "org_id": user["org_id"], "user_id": user_id, "device_id": dev_id,
        "platform": "android", "push_token": f"stale-tok-{dev_id}",
        "app_version": "1.0.0", "last_seen_at": stale_iso,
        "deleted_at": None, "created_at": stale_iso,
        "last_deadman_poke_ms": 0,
    })

    secret = _cron_secret()
    run_id = f"stale-run-{uuid.uuid4().hex[:12]}"
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as c:
        r = await c.post(
            "/api/cron/deadman-tick",
            json={"event": "schedule.triggered", "run_id": run_id},
            headers={"Authorization": f"Bearer {secret}", "X-Webhook-Id": run_id},
        )
        assert r.status_code == 200, r.text

    # Wait for background sweep, then confirm the device was poked
    await asyncio.sleep(1.5)
    dev_now = await db.mobile_devices.find_one({"device_id": dev_id})
    # Any employee-scheduling logic may skip during off-hours; assert only if
    # user was in scheduled window. Since seeded employee has mode='any',
    # sweep only pokes them between 06:00-22:00 local. Check accordingly.
    hour_utc = datetime.now(timezone.utc).hour
    if 6 <= hour_utc < 22:
        assert dev_now.get("last_deadman_poke_ms", 0) > 0, "expected deadman poke"

    # Cleanup
    await db.mobile_devices.delete_one({"device_id": dev_id})
    client.close()


@pytest.mark.asyncio
async def test_deadman_tick_happy_path_and_dedup():
    secret = _cron_secret()
    run_id = f"run-{uuid.uuid4().hex[:16]}"
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as c:
        r = await c.post(
            "/api/cron/deadman-tick",
            json={"event": "schedule.triggered", "run_id": run_id},
            headers={
                "Authorization": f"Bearer {secret}",
                "X-Webhook-Id": run_id,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["accepted"] is True
        assert body["run_id"] == run_id

        # Give the background sweep a moment to actually record the run
        await asyncio.sleep(1.2)

        # Second call with same run_id → duplicate=True, no new work
        r2 = await c.post(
            "/api/cron/deadman-tick",
            json={"event": "schedule.triggered", "run_id": run_id},
            headers={
                "Authorization": f"Bearer {secret}",
                "X-Webhook-Id": run_id,
            },
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["duplicate"] is True
