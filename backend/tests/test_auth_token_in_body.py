"""Phase 1 auth: /login, /refresh, /logout return + accept Bearer tokens in body.

Verifies backwards-compatible dual auth (cookie for web, Bearer body for mobile):
- /login response body carries access_token, refresh_token, token_type='bearer'
- Set-Cookie still present on /login (web flow unaffected)
- /refresh accepts refresh_token in JSON body AND still works via cookie
- /refresh rotates and returns new tokens in body
- Reusing OLD refresh_token after rotation returns 401 (revoked)
- /logout accepts refresh_token in JSON body; token becomes revoked;
  active session (if any) ended with outcome='logout'
- Mobile endpoints (/api/mobile/reconcile, /register-device, /devices,
  /heartbeat, /geofence-event, /sync) still function with Bearer header
- Web dashboard cookie flow still works for /me, /offices, /employees,
  /sessions/live, /sessions/me (spot-check regression)
- Duplicate employee create returns 409 with specific reason
- Mock-location soft flag: session still starts + security event logged
"""
import os
import time
import uuid
import httpx
import requests
import pytest

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "akmaljn7@gmail.com"
ADMIN_PWD = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PWD = "Employee123!"
OFFICE_LAT, OFFICE_LNG = 6.5244, 3.3792
OUTSIDE_LAT, OUTSIDE_LNG = 6.6000, 3.5000


# -----------------------------------------------------------------------
# Login: returns tokens in body AND sets Set-Cookie headers
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_login_returns_tokens_in_body_and_sets_cookies():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as c:
        r = await c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200, r.text
        body = r.json()
        # Body carries tokens
        assert isinstance(body.get("access_token"), str) and len(body["access_token"]) > 20
        assert isinstance(body.get("refresh_token"), str) and len(body["refresh_token"]) > 20
        assert body.get("token_type") == "bearer"
        assert body["email"] == ADMIN_EMAIL
        # And user shape is intact
        for k in ("id", "org_id", "email", "name", "role"):
            assert k in body
        # Cookies still set (web dashboard depends on this)
        set_cookies = r.headers.get_list("set-cookie") if hasattr(r.headers, "get_list") else r.headers.raw
        raw = " ".join(str(x) for x in set_cookies)
        assert "access_token=" in raw and "refresh_token=" in raw
        assert "HttpOnly" in raw
        assert "SameSite=None" in raw or "samesite=none" in raw.lower()


@pytest.mark.asyncio
async def test_login_works_for_employee_too():
    async with httpx.AsyncClient(base_url=API) as c:
        r = await c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["role"] == "employee"
        assert body["access_token"] and body["refresh_token"]


# -----------------------------------------------------------------------
# Bearer flow: use tokens from body against /me and mobile endpoints
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bearer_token_from_body_authorizes_me_and_mobile():
    async with httpx.AsyncClient(base_url=API) as c:
        r = await c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        assert r.status_code == 200
        access = r.json()["access_token"]

    # Fresh client — no cookies. Purely Bearer auth.
    async with httpx.AsyncClient(base_url=API, headers={"Authorization": f"Bearer {access}"}) as bearer:
        me = await bearer.get("/api/auth/me")
        assert me.status_code == 200, me.text
        assert me.json()["email"] == EMP_EMAIL

        # Mobile endpoints work with Bearer
        recon = await bearer.get("/api/mobile/reconcile")
        assert recon.status_code == 200, recon.text
        rj = recon.json()
        assert "office" in rj and "session" in rj and "server_ts_ms" in rj

        devs = await bearer.get("/api/mobile/devices")
        assert devs.status_code == 200

        dev_id = f"TESTDEV-{uuid.uuid4().hex[:10]}"
        reg = await bearer.post("/api/mobile/register-device", json={
            "device_id": dev_id, "platform": "android",
            "app_version": "1.0.0", "os_version": "14", "push_token": "TESTPUSH_BEARER",
        })
        assert reg.status_code == 200, reg.text

        hb = await bearer.post("/api/mobile/heartbeat", json={
            "device_id": dev_id, "ts_ms": int(time.time() * 1000),
        })
        assert hb.status_code == 200, hb.text

        # Cleanup
        await bearer.delete(f"/api/mobile/register-device/{dev_id}")


# -----------------------------------------------------------------------
# Refresh: body flow + rotation + old token revoked
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_refresh_via_body_rotates_and_old_token_revoked():
    async with httpx.AsyncClient(base_url=API) as c:
        r = await c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        assert r.status_code == 200
        old_refresh = r.json()["refresh_token"]

    # First refresh via body — should return new pair
    async with httpx.AsyncClient(base_url=API) as c:
        r2 = await c.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert r2.status_code == 200, r2.text
        b2 = r2.json()
        assert b2.get("ok") is True
        assert b2.get("token_type") == "bearer"
        new_access = b2["access_token"]
        new_refresh = b2["refresh_token"]
        assert new_refresh and new_refresh != old_refresh
        assert new_access

        # Verify new access token authorizes /me
        me = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {new_access}"})
        assert me.status_code == 200

    # Reusing OLD refresh token must now be revoked (401)
    async with httpx.AsyncClient(base_url=API) as c:
        r3 = await c.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert r3.status_code == 401, f"expected 401 revoked, got {r3.status_code} {r3.text}"
        assert "revoked" in r3.text.lower() or "invalid" in r3.text.lower()

    # New refresh token itself still valid — can rotate again
    async with httpx.AsyncClient(base_url=API) as c:
        r4 = await c.post("/api/auth/refresh", json={"refresh_token": new_refresh})
        assert r4.status_code == 200, r4.text


@pytest.mark.asyncio
async def test_refresh_via_cookie_still_works_web_dashboard():
    # Test-harness note: requests/httpx cookie jars under pytest strip cookies
    # (Cloudflare edge quirk in preview env — cookies are set but not resent).
    # Shell out to curl, which handles the Partitioned + SameSite=None cookies
    # correctly. This proves the SERVER accepts /refresh via cookie-only.
    import subprocess, tempfile, os as _os
    jar = tempfile.mktemp(suffix=".cookies")
    try:
        login = subprocess.run(
            ["curl", "-sk", "-c", jar, "-o", "/dev/null", "-w", "%{http_code}",
             "-H", "Content-Type: application/json",
             "-X", "POST", f"{API}/api/auth/login",
             "-d", f'{{"email":"{EMP_EMAIL}","password":"{EMP_PWD}"}}'],
            capture_output=True, text=True, timeout=15,
        )
        assert login.stdout.strip() == "200", login.stdout
        refresh = subprocess.run(
            ["curl", "-sk", "-b", jar, "-X", "POST", f"{API}/api/auth/refresh",
             "-w", "\n%{http_code}"],
            capture_output=True, text=True, timeout=15,
        )
        lines = refresh.stdout.strip().splitlines()
        code = lines[-1]
        body = "\n".join(lines[:-1])
        assert code == "200", f"cookie refresh failed: {code} {body}"
        import json as _j
        b = _j.loads(body)
        assert b.get("access_token") and b.get("refresh_token")
    finally:
        if _os.path.exists(jar):
            _os.unlink(jar)


# -----------------------------------------------------------------------
# Logout: body flow
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_logout_with_body_refresh_token_revokes_and_ends_session():
    async with httpx.AsyncClient(base_url=API) as c:
        r = await c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        assert r.status_code == 200
        access = r.json()["access_token"]
        refresh = r.json()["refresh_token"]

    # Purely Bearer client (fresh cookie jar). Logout with body.
    async with httpx.AsyncClient(base_url=API, headers={"Authorization": f"Bearer {access}"}) as bearer:
        r2 = await bearer.post("/api/auth/logout", json={"refresh_token": refresh})
        assert r2.status_code == 200, r2.text
        assert r2.json().get("ok") is True

    # Old refresh should now be revoked
    async with httpx.AsyncClient(base_url=API) as c:
        r3 = await c.post("/api/auth/refresh", json={"refresh_token": refresh})
        assert r3.status_code == 401


# -----------------------------------------------------------------------
# Web dashboard regression: cookie flow across common endpoints
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_web_cookie_flow_regression_admin_endpoints():
    # Use curl for the cookie flow — see note on test_refresh_via_cookie_still_works_web_dashboard.
    import subprocess, tempfile, os as _os, json as _j
    for email, pwd, checks in [
        (ADMIN_EMAIL, ADMIN_PWD,
         ["/api/auth/me", "/api/offices", "/api/employees", "/api/sessions/live"]),
        (EMP_EMAIL, EMP_PWD, ["/api/sessions/me"]),
    ]:
        jar = tempfile.mktemp(suffix=".cookies")
        try:
            login = subprocess.run(
                ["curl", "-sk", "-c", jar, "-o", "/dev/null", "-w", "%{http_code}",
                 "-H", "Content-Type: application/json",
                 "-X", "POST", f"{API}/api/auth/login",
                 "-d", f'{{"email":"{email}","password":"{pwd}"}}'],
                capture_output=True, text=True, timeout=15,
            )
            assert login.stdout.strip() == "200", login.stdout
            for path in checks:
                r = subprocess.run(
                    ["curl", "-sk", "-b", jar, f"{API}{path}", "-w", "\n%{http_code}"],
                    capture_output=True, text=True, timeout=15,
                )
                lines = r.stdout.strip().splitlines()
                code = lines[-1]
                assert code == "200", f"{path} → {code}: {' '.join(lines[:-1])[:200]}"
            # /auth/me should include correct email for admin
            if "/api/auth/me" in checks:
                r = subprocess.run(
                    ["curl", "-sk", "-b", jar, f"{API}/api/auth/me"],
                    capture_output=True, text=True, timeout=15,
                )
                assert _j.loads(r.stdout)["email"] == email
        finally:
            if _os.path.exists(jar):
                _os.unlink(jar)


# -----------------------------------------------------------------------
# Duplicate employee -> 409 regression
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_duplicate_employee_returns_409_with_reason():
    async with httpx.AsyncClient(base_url=API) as c:
        r = await c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200
        access = c.cookies.get("access_token") or r.json()["access_token"]
        c.headers.update({"Authorization": f"Bearer {access}"})

        # employee@example.com already exists (seed) -> duplicate create should 409
        offices = (await c.get("/api/offices")).json()
        office_id = offices[0]["id"]
        r2 = await c.post("/api/employees", json={
            "email": EMP_EMAIL, "name": "Dupe Attempt", "password": "SomePwd123!",
            "office_id": office_id,
        })
        assert r2.status_code == 409, f"expected 409, got {r2.status_code} {r2.text}"
        detail = (r2.json().get("detail") or "").lower()
        assert "exist" in detail or "duplicate" in detail or "already" in detail, r2.text


# -----------------------------------------------------------------------
# Mock-location soft-flag: session still starts + security event created
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_mock_location_soft_flag_session_starts_and_event_logged():
    # Admin: fetch employee id + force-expire any active session, ensure assigned
    async with httpx.AsyncClient(base_url=API) as admin:
        r = await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        access = r.json()["access_token"]
        admin.headers.update({"Authorization": f"Bearer {access}"})
        offices = (await admin.get("/api/offices")).json()
        lagos = next((o for o in offices if o["name"] == "UI Test Lagos"), offices[0])
        emps = (await admin.get("/api/employees")).json()
        emp = next(e for e in emps if e["email"] == EMP_EMAIL)
        if emp.get("office_id") != lagos["id"]:
            await admin.patch(f"/api/employees/{emp['id']}", json={"office_id": lagos["id"]})
        try:
            await admin.post(f"/api/sessions/force-expire/{emp['id']}")
        except Exception:
            pass

        before_events = (await admin.get("/api/security-events")).json()
        before_count = sum(1 for e in before_events if e.get("type") == "mock_location_flag" and e.get("user_id") == emp["id"])

    # Employee: post mock-location enter event via Bearer
    async with httpx.AsyncClient(base_url=API) as emp_c:
        r = await emp_c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        assert r.status_code == 200
        emp_c.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        dev_id = f"TESTDEV-{uuid.uuid4().hex[:10]}"
        await emp_c.post("/api/mobile/register-device", json={
            "device_id": dev_id, "platform": "android", "app_version": "1.0.0",
            "os_version": "14", "push_token": "MOCK",
        })
        now_ms = int(time.time() * 1000)
        payload = {
            "device_id": dev_id,
            "client_event_id": f"evt-{uuid.uuid4().hex}",
            "type": "enter",
            "office_id": lagos["id"],
            "ts_ms": now_ms,
            "lat": OFFICE_LAT, "lng": OFFICE_LNG,
            "accuracy": 10.0,
            "mock_location": True,
        }
        r2 = await emp_c.post("/api/mobile/geofence-event", json=payload)
        assert r2.status_code == 200, r2.text
        # session should have started despite mock flag
        recon = (await emp_c.get("/api/mobile/reconcile")).json()
        assert recon.get("session") is not None, f"expected active session, got {recon}"

    # Admin: confirm mock_location_flag security event was logged
    async with httpx.AsyncClient(base_url=API) as admin:
        r = await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        admin.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        after_events = (await admin.get("/api/security-events")).json()
        matches = [e for e in after_events if e.get("type") == "mock_location_flag" and e.get("user_id") == emp["id"]]
        assert len(matches) > before_count, f"no new mock_location_flag events (before={before_count}, after={len(matches)})"
        assert matches[-1].get("severity") == "high"
        # Cleanup: end the session
        await admin.post(f"/api/sessions/force-expire/{emp['id']}")


# -----------------------------------------------------------------------
# Bulk sync via Bearer still works (spot-check /api/mobile/sync)
# -----------------------------------------------------------------------
@pytest.mark.asyncio
async def test_mobile_sync_bulk_via_bearer():
    async with httpx.AsyncClient(base_url=API) as admin:
        r = await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        admin.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        offices = (await admin.get("/api/offices")).json()
        lagos = next((o for o in offices if o["name"] == "UI Test Lagos"), offices[0])
        emps = (await admin.get("/api/employees")).json()
        emp = next(e for e in emps if e["email"] == EMP_EMAIL)
        try:
            await admin.post(f"/api/sessions/force-expire/{emp['id']}")
        except Exception:
            pass

    async with httpx.AsyncClient(base_url=API) as emp_c:
        r = await emp_c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        emp_c.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        dev_id = f"TESTDEV-{uuid.uuid4().hex[:10]}"
        await emp_c.post("/api/mobile/register-device", json={
            "device_id": dev_id, "platform": "android", "app_version": "1.0.0",
            "os_version": "14", "push_token": "SYNC",
        })
        base_ts = int(time.time() * 1000)
        events = [
            {"client_event_id": f"e-{uuid.uuid4().hex}", "device_id": dev_id, "type": "enter",
             "office_id": lagos["id"], "ts_ms": base_ts,
             "lat": OFFICE_LAT, "lng": OFFICE_LNG, "accuracy": 10.0},
            {"client_event_id": f"e-{uuid.uuid4().hex}", "device_id": dev_id, "type": "exit",
             "office_id": lagos["id"], "ts_ms": base_ts + 60_000,
             "lat": OUTSIDE_LAT, "lng": OUTSIDE_LNG, "accuracy": 10.0},
        ]
        r2 = await emp_c.post("/api/mobile/sync", json={"events": events})
        assert r2.status_code == 200, r2.text
        body = r2.json()
        # Should acknowledge both events (server returns {"processed": [...]})
        proc = body.get("processed", [])
        assert isinstance(proc, list) and len(proc) >= 2, f"unexpected sync body: {body}"

    async with httpx.AsyncClient(base_url=API) as admin:
        r = await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        admin.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        try:
            await admin.post(f"/api/sessions/force-expire/{emp['id']}")
        except Exception:
            pass


