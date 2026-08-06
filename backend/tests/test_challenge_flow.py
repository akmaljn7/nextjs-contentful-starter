"""Phase 3 mobile challenge flow: end-to-end auto-start → challenge-now → respond.

Verifies the endpoint that /app/mobile/src/components/ChallengeModal.tsx calls:
POST /api/sessions/challenge/{challenge_id}/respond with {face_photo: dataUrl}
"""
import os
import time
import uuid
import base64
import httpx
import pytest

API = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "akmaljn7@gmail.com"
ADMIN_PWD = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PWD = "Employee123!"
OFFICE_LAT, OFFICE_LNG = 6.5244, 3.3792

# Fake JPEG-ish payload — needs ≥512 bytes decoded to pass photos.save_session_photo sanity.
# Real JPEG header bytes + padding so the check passes.
FAKE_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * 2048 + b"\xff\xd9"
JPEG_DATAURL = "data:image/jpeg;base64," + base64.b64encode(FAKE_JPEG_BYTES).decode()


@pytest.mark.asyncio
async def test_full_challenge_flow_auto_start_challenge_now_respond():
    # Admin: setup — Lagos office assigned, no prior session
    async with httpx.AsyncClient(base_url=API, timeout=30) as admin:
        r = await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        assert r.status_code == 200
        admin.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
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

    # Employee: auto-start via geofence enter
    async with httpx.AsyncClient(base_url=API, timeout=30) as emp_c:
        r = await emp_c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        assert r.status_code == 200
        emp_c.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        dev_id = f"TESTDEV-{uuid.uuid4().hex[:10]}"
        await emp_c.post("/api/mobile/register-device", json={
            "device_id": dev_id, "platform": "android", "app_version": "1.0.0",
            "os_version": "14", "push_token": "CHALLENGE_FLOW",
        })
        await emp_c.post("/api/mobile/geofence-event", json={
            "device_id": dev_id,
            "client_event_id": f"evt-{uuid.uuid4().hex}",
            "type": "enter",
            "office_id": lagos["id"],
            "ts_ms": int(time.time() * 1000),
            "lat": OFFICE_LAT, "lng": OFFICE_LNG, "accuracy": 10.0,
        })
        recon = (await emp_c.get("/api/mobile/reconcile")).json()
        assert recon.get("session"), f"session did not auto-start: {recon}"

    # Admin: challenge-now
    async with httpx.AsyncClient(base_url=API, timeout=30) as admin:
        r = await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        admin.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        r2 = await admin.post(f"/api/sessions/challenge-now/{emp['id']}")
        assert r2.status_code == 200, f"challenge-now failed: {r2.status_code} {r2.text}"

    # Employee: poll /sessions/me to see active_challenge, then respond
    async with httpx.AsyncClient(base_url=API, timeout=30) as emp_c:
        r = await emp_c.post("/api/auth/login", json={"email": EMP_EMAIL, "password": EMP_PWD})
        emp_c.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        active_ch = None
        for _ in range(6):
            mine = (await emp_c.get("/api/sessions/me")).json()
            active_ch = mine.get("active_challenge") if mine else None
            if active_ch:
                break
            time.sleep(0.5)
        assert active_ch, f"active_challenge not found after 3s: {mine}"
        challenge_id = active_ch["id"]

        # POST the selfie
        r3 = await emp_c.post(
            f"/api/sessions/challenge/{challenge_id}/respond",
            json={"face_photo": JPEG_DATAURL},
        )
        assert r3.status_code == 200, f"respond failed: {r3.status_code} {r3.text}"

        # Confirm state moved to responded
        mine2 = (await emp_c.get("/api/sessions/me")).json()
        challenges = (mine2 or {}).get("challenges") or []
        target = next((c for c in challenges if c.get("id") == challenge_id), None)
        assert target and target.get("status") == "responded", \
            f"expected responded, got {target}"

    # Cleanup
    async with httpx.AsyncClient(base_url=API, timeout=30) as admin:
        r = await admin.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
        admin.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
        try:
            await admin.post(f"/api/sessions/force-expire/{emp['id']}")
        except Exception:
            pass
