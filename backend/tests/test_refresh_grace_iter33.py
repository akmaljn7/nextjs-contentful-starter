"""
Iter 33: Test the refresh-token GRACE window fix that prevents forced-logout
on mobile when concurrent requests present the same refresh token.
"""
import os
import asyncio
import pytest
import requests
import httpx

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

EMPLOYEE = {"email": "employee@example.com", "password": "Employee123!"}
ADMIN = {"email": "akmaljn7@gmail.com", "password": "GeofenceAdmin123!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    d = r.json()
    assert "access_token" in d and "refresh_token" in d
    return d


# --- Basic login + /me ---
def test_login_and_me_employee():
    d = _login(EMPLOYEE)
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {d['access_token']}"}, timeout=30)
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["email"] == EMPLOYEE["email"]


def test_login_and_me_admin():
    d = _login(ADMIN)
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {d['access_token']}"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == ADMIN["email"]
    assert r.json()["role"] in ("org_owner", "admin")


# --- Normal rotation chain ---
def test_refresh_rotation_chain():
    d = _login(EMPLOYEE)
    rt = d["refresh_token"]
    seen = {rt}
    for i in range(3):
        r = requests.post(f"{API}/auth/refresh", json={"refresh_token": rt}, timeout=30)
        assert r.status_code == 200, f"rotation {i} failed: {r.status_code} {r.text}"
        j = r.json()
        assert "access_token" in j and "refresh_token" in j
        new_rt = j["refresh_token"]
        assert new_rt not in seen, "refresh token must rotate"
        seen.add(new_rt)
        rt = new_rt


# --- THE BUG FIX: sequential reuse within grace ---
def test_refresh_double_use_within_grace():
    d = _login(EMPLOYEE)
    r1 = d["refresh_token"]
    a = requests.post(f"{API}/auth/refresh", json={"refresh_token": r1}, timeout=30)
    b = requests.post(f"{API}/auth/refresh", json={"refresh_token": r1}, timeout=30)
    assert a.status_code == 200, f"first refresh failed: {a.status_code} {a.text}"
    assert b.status_code == 200, f"second refresh (grace) failed: {b.status_code} {b.text}"
    for r in (a, b):
        j = r.json()
        assert "access_token" in j and "refresh_token" in j


# --- Concurrent burst with same refresh token ---
def test_refresh_concurrent_burst_all_200():
    d = _login(EMPLOYEE)
    r1 = d["refresh_token"]

    async def run_burst():
        async with httpx.AsyncClient(timeout=30) as client:
            tasks = [client.post(f"{API}/auth/refresh", json={"refresh_token": r1}) for _ in range(8)]
            return await asyncio.gather(*tasks)

    results = asyncio.run(run_burst())
    statuses = [r.status_code for r in results]
    assert all(s == 200 for s in statuses), f"expected all 200, got: {statuses} bodies={[r.text for r in results]}"

    # Pick a successor and confirm it can refresh
    successor = results[0].json()["refresh_token"]
    r = requests.post(f"{API}/auth/refresh", json={"refresh_token": successor}, timeout=30)
    assert r.status_code == 200, f"successor refresh failed: {r.status_code} {r.text}"


# --- Regression: logout invalidates refresh token ---
def test_logout_invalidates_refresh():
    d = _login(EMPLOYEE)
    r = requests.post(
        f"{API}/auth/logout",
        headers={"Authorization": f"Bearer {d['access_token']}"},
        json={"refresh_token": d["refresh_token"]},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    r2 = requests.post(f"{API}/auth/refresh", json={"refresh_token": d["refresh_token"]}, timeout=30)
    assert r2.status_code == 401, f"expected 401 after logout, got {r2.status_code} {r2.text}"


# --- Regression: invalid / missing refresh token returns 401 ---
def test_refresh_invalid_token():
    r = requests.post(f"{API}/auth/refresh", json={"refresh_token": "garbage.not.a.jwt"}, timeout=30)
    assert r.status_code == 401


def test_refresh_missing_token():
    r = requests.post(f"{API}/auth/refresh", json={}, timeout=30)
    assert r.status_code == 401


# --- Regression: time-off endpoints still work ---
def test_time_off_employee_then_admin_list():
    emp = _login(EMPLOYEE)
    payload = {
        "start_date": "2030-06-01",
        "end_date": "2030-06-02",
        "type": "vacation",
        "reason": "iter33 regression test",
    }
    r = requests.post(
        f"{API}/time-off",
        headers={"Authorization": f"Bearer {emp['access_token']}"},
        json=payload,
        timeout=30,
    )
    assert r.status_code in (200, 201), f"time-off create: {r.status_code} {r.text}"

    admin = _login(ADMIN)
    r2 = requests.get(
        f"{API}/time-off?status=pending",
        headers={"Authorization": f"Bearer {admin['access_token']}"},
        timeout=30,
    )
    assert r2.status_code == 200, f"admin list: {r2.status_code} {r2.text}"
    body = r2.json()
    # Response shape may be list or {items:[]}
    items = body if isinstance(body, list) else body.get("items", body.get("requests", []))
    assert isinstance(items, list)
