"""Iter 31 regression: verify shared /api/auth/login path still works
after mobile-only removal of react-native-reanimated + expo-router."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mobile-roster-3.preview.emergentagent.com").rstrip("/")
LOGIN = f"{BASE_URL}/api/auth/login"

OWNER = {"email": "akmaljn7@gmail.com", "password": "GeofenceAdmin123!"}
EMP = {"email": "employee@example.com", "password": "Employee123!"}


def _login_and_me(creds, expected_roles):
    r = requests.post(LOGIN, json=creds, timeout=20)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    assert isinstance(tok, str) and len(tok) > 10
    me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=20)
    assert me.status_code == 200, me.text
    body = me.json()
    assert body.get("role") in expected_roles, body
    return tok, body


def test_owner_login_success():
    _login_and_me(OWNER, ("org_owner", "admin", "owner"))


def test_employee_login_success():
    _login_and_me(EMP, ("employee",))


def test_wrong_password_not_500():
    r = requests.post(LOGIN, json={"email": OWNER["email"], "password": "wrong-nope-123"}, timeout=20)
    assert r.status_code in (400, 401, 403), f"expected auth error, got {r.status_code} {r.text}"
    assert r.status_code != 500
