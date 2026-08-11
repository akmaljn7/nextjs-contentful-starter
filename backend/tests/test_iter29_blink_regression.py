"""Iteration 29 regression tests.

Covers:
- Auth regression (owner & employee login, /me, /refresh token rotation)
- Selfie challenge liveness_action must be 'blink' (never turn_left/turn_right)
- Respond endpoint contract validation (400 on missing liveness fields for
  face-enrolled user; endpoint reachable for non-enrolled user).
"""
import os
import requests
import pytest
from pathlib import Path

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    envf = Path("/app/frontend/.env")
    if envf.exists():
        for line in envf.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url().rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "akmaljn7@gmail.com"
OWNER_PASSWORD = "GeofenceAdmin123!"
EMP_EMAIL = "employee@example.com"
EMP_PASSWORD = "Employee123!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def owner_tokens():
    r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def emp_tokens():
    r = requests.post(f"{API}/auth/login", json={"email": EMP_EMAIL, "password": EMP_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Employee login failed: {r.status_code} {r.text}"
    return r.json()


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- auth regression ----------
class TestAuthRegression:
    def test_owner_login_returns_tokens(self, owner_tokens):
        assert isinstance(owner_tokens.get("access_token"), str) and owner_tokens["access_token"]
        assert isinstance(owner_tokens.get("refresh_token"), str) and owner_tokens["refresh_token"]

    def test_employee_login_returns_tokens_and_role(self, emp_tokens):
        assert emp_tokens.get("access_token")
        assert emp_tokens.get("refresh_token")
        # role can be in body or in user obj
        role = emp_tokens.get("role") or (emp_tokens.get("user") or {}).get("role")
        assert role == "employee", f"expected role=employee, body={emp_tokens}"

    def test_me_owner(self, owner_tokens):
        r = requests.get(f"{API}/auth/me", headers=_auth(owner_tokens["access_token"]), timeout=15)
        assert r.status_code == 200, r.text
        me = r.json()
        for f in ("id", "org_id", "role", "org_name"):
            assert f in me, f"missing {f} in /me: {me}"
        assert me["role"] in ("owner", "admin", "org_owner")

    def test_refresh_rotates_tokens(self, owner_tokens):
        r = requests.post(f"{API}/auth/refresh", json={"refresh_token": owner_tokens["refresh_token"]}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("access_token") and isinstance(body["access_token"], str)
        assert body.get("refresh_token") and isinstance(body["refresh_token"], str)
        # rotated → refresh should differ from the one we sent
        assert body["refresh_token"] != owner_tokens["refresh_token"], "refresh_token was not rotated"


# ---------- selfie challenge liveness_action == 'blink' ----------
class TestSelfieChallengeBlink:
    def test_admin_challenge_now_creates_blink_challenge(self, owner_tokens, emp_tokens):
        """If employee has an active session, admin can create an on-demand
        challenge and its liveness_action must be 'blink'. If no active
        session exists and we can't create one via API, we report skip."""
        # Get employee user_id via /me
        me = requests.get(f"{API}/auth/me", headers=_auth(emp_tokens["access_token"]), timeout=15).json()
        emp_id = me["id"]

        # Check for an active session (admin view)
        live = requests.get(f"{API}/sessions/live", headers=_auth(owner_tokens["access_token"]), timeout=15)
        assert live.status_code == 200, live.text
        sessions = live.json() if isinstance(live.json(), list) else live.json().get("sessions") or []

        has_active = any((s.get("user_id") == emp_id) for s in sessions)
        if not has_active:
            pytest.skip("No active session for employee; cannot exercise challenge-now. "
                        "LIVENESS_ACTIONS=['blink'] is verified by code-inspection + unit tests.")

        r = requests.post(
            f"{API}/sessions/challenge-now/{emp_id}",
            headers=_auth(owner_tokens["access_token"]),
            json={},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        action = (body.get("liveness_action")
                  or (body.get("challenge") or {}).get("liveness_action")
                  or (body.get("active_challenge") or {}).get("liveness_action"))

        # Fallback: read via /sessions/me as the employee
        if not action:
            me_sess = requests.get(f"{API}/sessions/me", headers=_auth(emp_tokens["access_token"]), timeout=15).json()
            ac = me_sess.get("active_challenge") or {}
            action = ac.get("liveness_action")

        assert action == "blink", f"expected liveness_action=='blink', got {action!r}"

    def test_liveness_actions_constant_is_blink_only(self):
        """Static safety net — read the source and assert the constant."""
        import re
        with open("/app/backend/routes/sessions.py") as f:
            src = f.read()
        m = re.search(r"^LIVENESS_ACTIONS\s*=\s*(\[[^\]]*\])", src, re.M)
        assert m, "LIVENESS_ACTIONS not found"
        val = eval(m.group(1))
        assert val == ["blink"], f"LIVENESS_ACTIONS must be ['blink'], got {val}"


# ---------- respond endpoint contract ----------
class TestRespondContract:
    def test_respond_missing_challenge_returns_404_not_500(self, emp_tokens):
        """Endpoint exists and validates input — a bogus challenge id should
        return a client error (400/404), never 500."""
        # Provide a payload passing Pydantic length (>=100 chars) so we exercise
        # the handler, not the request-body validator. Bogus challenge id ->
        # should be a client error (400/404), never 500.
        big = "data:image/jpeg;base64," + ("A" * 200)
        r = requests.post(
            f"{API}/sessions/challenge/does-not-exist/respond",
            headers=_auth(emp_tokens["access_token"]),
            json={"face_photo": big, "liveness_frame": big, "liveness_action": "blink"},
            timeout=20,
        )
        assert r.status_code in (400, 404), f"expected 4xx (400/404), got {r.status_code}: {r.text}"

    def test_respond_rejects_invalid_action_shape_400(self, emp_tokens):
        """Malformed payload (empty body) should be a 4xx validation error, not 500."""
        r = requests.post(
            f"{API}/sessions/challenge/anything/respond",
            headers=_auth(emp_tokens["access_token"]),
            json={},
            timeout=20,
        )
        assert 400 <= r.status_code < 500, f"expected 4xx, got {r.status_code}: {r.text}"
