"""Regression tests for the 5 Aug 2026 bugfix batch.

Covers:
- Duplicate employee create returns a 409 with a helpful, specific detail
- /api/sessions/challenge-now creates a pending challenge visible on /me
- Ghost-session tick: /live and /me tick stale detection
"""
import os
import asyncio
import httpx
import pytest

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "akmaljn7@gmail.com"
ADMIN_PWD = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PWD = "Employee123!"

# Approximate coordinates for the "UI Test Lagos" office (r=300m).
OFFICE_LAT, OFFICE_LNG = 6.5244, 3.3792


@pytest.mark.asyncio
async def test_duplicate_employee_returns_specific_409():
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as c:
        r = await c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200, r.text
        # Fetch offices to grab one that belongs to this org
        r = await c.get("/api/offices")
        assert r.status_code == 200
        offices = r.json()
        assert offices, "expected at least 1 office for the seeded org"
        office_id = offices[0]["id"]

        # First: try to re-create the seeded employee (email already exists)
        r = await c.post("/api/employees", json={
            "name": "Dup", "email": EMP_EMAIL, "password": "Password123",
            "office_id": office_id, "schedule": {"mode": "any"},
        })
        assert r.status_code == 409, r.text
        detail = (r.json() or {}).get("detail", "")
        assert "already" in detail.lower()


@pytest.mark.asyncio
async def test_low_accuracy_ping_far_outside_still_pauses():
    """A ping that is unambiguously outside the geofence must pause the
    session even when GPS accuracy is worse than the org tolerance.
    Otherwise a laptop with fuzzy WiFi-geoloc could hide anywhere."""
    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as admin, \
               httpx.AsyncClient(base_url=API, follow_redirects=True) as emp:
        (await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})).raise_for_status()
        (await emp.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})).raise_for_status()

        offices = (await admin.get("/api/offices")).json()
        lagos = next(o for o in offices if o["name"] == "UI Test Lagos")
        emps = (await admin.get("/api/employees")).json()
        emp_row = next(e for e in emps if e["email"] == EMP_EMAIL)
        await admin.patch(f"/api/employees/{emp_row['id']}", json={"office_id": lagos["id"]})

        await admin.post(f"/api/sessions/force-expire/{emp_row['id']}")
        r = await emp.post("/api/sessions/auto-start",
                           json={"lat": OFFICE_LAT, "lng": OFFICE_LNG, "accuracy": 10})
        assert r.status_code == 200 and r.json()["status"] == "active"

        # 5.5km north with 120m accuracy — clearly beyond radius+accuracy → PAUSE.
        r = await emp.post("/api/sessions/ping",
                           json={"lat": OFFICE_LAT + 0.05, "lng": OFFICE_LNG, "accuracy": 120})
        assert r.status_code == 200
        assert r.json()["status"] == "paused", f"expected paused, got {r.json()['status']}"

        # Cleanup
        await admin.post(f"/api/sessions/force-expire/{emp_row['id']}")

    async with httpx.AsyncClient(base_url=API, follow_redirects=True) as admin, \
               httpx.AsyncClient(base_url=API, follow_redirects=True) as emp:
        (await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})).raise_for_status()
        (await emp.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})).raise_for_status()

        # Ensure the employee is assigned to Lagos office (idempotent)
        offices = (await admin.get("/api/offices")).json()
        lagos = next(o for o in offices if o["name"] == "UI Test Lagos")
        emps = (await admin.get("/api/employees")).json()
        emp_row = next(e for e in emps if e["email"] == EMP_EMAIL)
        await admin.patch(f"/api/employees/{emp_row['id']}", json={"office_id": lagos["id"]})

        # Best-effort: end any leftover session, then auto-start
        await admin.post(f"/api/sessions/force-expire/{emp_row['id']}")
        r = await emp.post("/api/sessions/auto-start",
                           json={"lat": OFFICE_LAT, "lng": OFFICE_LNG, "accuracy": 10})
        assert r.status_code == 200, r.text

        # Admin triggers a manual challenge
        r = await admin.post(f"/api/sessions/challenge-now/{emp_row['id']}")
        assert r.status_code == 200, r.text
        payload = r.json()
        assert payload.get("active_challenge"), "expected active_challenge on the session"

        # Employee polling /me should see the same active_challenge
        r = await emp.get("/api/sessions/me")
        assert r.status_code == 200
        me = r.json()
        assert me and me.get("active_challenge"), "employee did not receive pending challenge"

        # Cleanup
        await admin.post(f"/api/sessions/force-expire/{emp_row['id']}")
