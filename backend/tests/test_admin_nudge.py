"""Tests for POST /api/sessions/nudge/{user_id} endpoint.

Verifies:
- Admin can nudge a valid employee (200, response contains sent_to email)
- Non-existent user_id → 404
- Cross-org isolation → 404
- Employee (non-admin) JWT → 403
- Custom title/body truncated correctly (accepted with 200)
"""
import os
import httpx
import pytest
from bson import ObjectId

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "akmaljn7@gmail.com"
ADMIN_PWD = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PWD = "Employee123!"


async def _login(client, email, pwd):
    r = await client.post("/api/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_nudge_valid_employee_returns_200():
    async with httpx.AsyncClient(base_url=API, timeout=30) as c:
        tok = await _login(c, ADMIN_EMAIL, ADMIN_PWD)
        c.headers.update({"Authorization": f"Bearer {tok}"})
        emps = (await c.get("/api/employees")).json()
        emp = next(e for e in emps if e["email"] == EMP_EMAIL)
        r = await c.post(f"/api/sessions/nudge/{emp['id']}", json={})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("sent_to") == EMP_EMAIL


@pytest.mark.asyncio
async def test_nudge_nonexistent_user_returns_404():
    async with httpx.AsyncClient(base_url=API, timeout=30) as c:
        tok = await _login(c, ADMIN_EMAIL, ADMIN_PWD)
        c.headers.update({"Authorization": f"Bearer {tok}"})
        fake = str(ObjectId())
        r = await c.post(f"/api/sessions/nudge/{fake}", json={})
        assert r.status_code == 404, r.text
        assert "not found" in r.text.lower()


@pytest.mark.asyncio
async def test_nudge_non_admin_returns_403():
    async with httpx.AsyncClient(base_url=API, timeout=30) as c:
        emp_tok = await _login(c, EMP_EMAIL, EMP_PWD)
        # Get employee's own id via /api/auth/me
        me = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {emp_tok}"})
        assert me.status_code == 200
        my_id = me.json().get("id") or me.json().get("_id") or me.json().get("user", {}).get("id")
        assert my_id, me.text
        c.headers.update({"Authorization": f"Bearer {emp_tok}"})
        r = await c.post(f"/api/sessions/nudge/{my_id}", json={})
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"


@pytest.mark.asyncio
async def test_nudge_custom_title_body_truncation_accepted():
    async with httpx.AsyncClient(base_url=API, timeout=30) as c:
        tok = await _login(c, ADMIN_EMAIL, ADMIN_PWD)
        c.headers.update({"Authorization": f"Bearer {tok}"})
        emps = (await c.get("/api/employees")).json()
        emp = next(e for e in emps if e["email"] == EMP_EMAIL)
        long_title = "T" * 500
        long_body = "B" * 1000
        r = await c.post(
            f"/api/sessions/nudge/{emp['id']}",
            json={"title": long_title, "body": long_body},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True


@pytest.mark.asyncio
async def test_nudge_cross_org_isolation_returns_404():
    """Create a user in a different org and confirm admin cannot nudge them."""
    from motor.motor_asyncio import AsyncIOMotorClient
    import bcrypt
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "geofence_console")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    other_org = await db.orgs.insert_one({"name": "TEST_OtherOrg_nudge"})
    other_user = await db.users.insert_one({
        "email": "TEST_otherorg_user@example.com",
        "password_hash": bcrypt.hashpw(b"x", bcrypt.gensalt()).decode(),
        "role": "employee",
        "org_id": other_org.inserted_id,
    })
    try:
        async with httpx.AsyncClient(base_url=API, timeout=30) as c:
            tok = await _login(c, ADMIN_EMAIL, ADMIN_PWD)
            c.headers.update({"Authorization": f"Bearer {tok}"})
            r = await c.post(f"/api/sessions/nudge/{other_user.inserted_id}", json={})
            assert r.status_code == 404, f"expected 404 cross-org, got {r.status_code}: {r.text}"
    finally:
        await db.users.delete_one({"_id": other_user.inserted_id})
        await db.orgs.delete_one({"_id": other_org.inserted_id})
        client.close()
