"""Iteration 7 — Time-Off Self-Service tests.

Single TestTimeOff class (xdist loadscope pinning). Teardown deletes every
time_off_requests row created + resets employee schedule to {mode:'any'}.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone as py_tz

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    from pathlib import Path
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


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return s


def _today():
    return datetime.now(py_tz.utc).date()


def _iso(d):
    return d.isoformat()


@pytest.fixture(scope="module")
def owner_sess():
    return _login(OWNER_EMAIL, OWNER_PW)


@pytest.fixture(scope="module")
def emp_id(owner_sess):
    emps = owner_sess.get(f"{API}/employees").json()
    emp = next((e for e in emps if e["email"].lower() == EMP_EMAIL), None)
    assert emp, "seed employee missing"
    return emp["id"]


@pytest.fixture(scope="module")
def nigerian_office(owner_sess, emp_id):
    r = owner_sess.post(f"{API}/offices", json={
        "name": f"TEST_ToLagos_{uuid.uuid4().hex[:6]}",
        "lat": OFFICE_LAT, "lng": OFFICE_LNG, "radius_meters": OFFICE_RADIUS,
    })
    assert r.status_code == 200, r.text
    office_id = r.json()["id"]
    owner_sess.patch(f"{API}/employees/{emp_id}", json={"office_id": office_id})
    yield {"office_id": office_id, "emp_id": emp_id}
    try:
        # Cleanup: remove ANY leftover time-off rows and reset schedule
        rows = owner_sess.get(f"{API}/time-off").json() or []
        for row in rows:
            owner_sess.delete(f"{API}/time-off/{row['id']}")
        owner_sess.patch(f"{API}/employees/{emp_id}", json={"schedule": {"mode": "any"}})
        # end any active session
        emp_sess = _login(EMP_EMAIL, EMP_PW)
        emp_sess.post(f"{API}/sessions/reset")
        owner_sess.delete(f"{API}/offices/{office_id}")
    except Exception:
        pass


@pytest.fixture(scope="module")
def emp_sess(nigerian_office):
    s = _login(EMP_EMAIL, EMP_PW)
    s.post(f"{API}/sessions/reset")
    return s


def _cleanup_time_off(owner_sess):
    rows = owner_sess.get(f"{API}/time-off").json() or []
    for row in rows:
        owner_sess.delete(f"{API}/time-off/{row['id']}")


class TestTimeOff:
    """All time-off tests in one class → single xdist worker via loadscope."""

    def test_00_clean_state(self, owner_sess, nigerian_office):
        _cleanup_time_off(owner_sess)
        # ensure emp schedule=any so session-start tests aren't blocked by schedule
        owner_sess.patch(f"{API}/employees/{nigerian_office['emp_id']}",
                         json={"schedule": {"mode": "any"}})

    # ---------- CREATE ----------

    def test_employee_create_valid(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        payload = {"start_date": _iso(t + timedelta(days=10)),
                   "end_date":   _iso(t + timedelta(days=12)),
                   "reason": "Family trip"}
        r = emp_sess.post(f"{API}/time-off", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["id", "org_id", "user_id", "employee_name", "employee_email",
                  "start_date", "end_date", "reason", "status", "created_at"]:
            assert k in d, f"missing {k} in {d}"
        assert d["status"] == "pending"
        assert d["reason"] == "Family trip"
        assert d["employee_email"].lower() == EMP_EMAIL
        _cleanup_time_off(owner_sess)

    def test_end_before_start_400(self, emp_sess):
        t = _today()
        r = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=5)),
            "end_date":   _iso(t + timedelta(days=3)),
            "reason": "bad range",
        })
        assert r.status_code == 400, r.text
        assert r.json()["detail"] == "End date is before start date"

    def test_start_in_past_400(self, emp_sess):
        t = _today()
        r = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t - timedelta(days=1)),
            "end_date":   _iso(t + timedelta(days=1)),
            "reason": "past",
        })
        assert r.status_code == 400, r.text
        assert r.json()["detail"] == "Cannot request time off in the past"

    def test_overlap_rejected(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        r1 = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=20)),
            "end_date":   _iso(t + timedelta(days=22)),
            "reason": "first",
        })
        assert r1.status_code == 200, r1.text
        r2 = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=21)),
            "end_date":   _iso(t + timedelta(days=23)),
            "reason": "overlap",
        })
        assert r2.status_code == 400, r2.text
        assert r2.json()["detail"] == "You already have a request covering those dates"
        _cleanup_time_off(owner_sess)

    def test_owner_cannot_create(self, owner_sess):
        t = _today()
        r = owner_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=30)),
            "end_date":   _iso(t + timedelta(days=31)),
            "reason": "owner attempt",
        })
        assert r.status_code == 403, r.text

    # ---------- LIST ----------

    def test_employee_list_me(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=40)),
            "end_date":   _iso(t + timedelta(days=41)),
            "reason": "list-me",
        })
        r = emp_sess.get(f"{API}/time-off/me")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) >= 1
        assert all(row["employee_email"].lower() == EMP_EMAIL for row in rows)
        _cleanup_time_off(owner_sess)

    def test_admin_list_filter_pending_and_tenant_isolation(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=50)),
            "end_date":   _iso(t + timedelta(days=50)),
            "reason": "will-approve",
        })
        emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=60)),
            "end_date":   _iso(t + timedelta(days=60)),
            "reason": "stay-pending",
        })
        all_r = owner_sess.get(f"{API}/time-off")
        assert all_r.status_code == 200
        assert len(all_r.json()) >= 2
        # approve one
        first_id = all_r.json()[-1]["id"]  # oldest
        owner_sess.patch(f"{API}/time-off/{first_id}/approve", json={})
        # filter pending
        pend = owner_sess.get(f"{API}/time-off?status=pending").json()
        assert all(x["status"] == "pending" for x in pend)
        assert len(pend) >= 1

        # Tenant isolation: create a foreign org owner
        foreign_email = f"TEST_foreign_{uuid.uuid4().hex[:6]}@example.com"
        s = requests.Session()
        rr = s.post(f"{API}/auth/register-org", json={
            "org_name": f"TEST_ForeignOrg_{uuid.uuid4().hex[:5]}",
            "owner_name": "Foreign Owner",
            "email": foreign_email,
            "password": "ForeignPass123!",
        })
        assert rr.status_code in (200, 201), rr.text
        fs = _login(foreign_email, "ForeignPass123!")
        fr = fs.get(f"{API}/time-off")
        assert fr.status_code == 200
        assert fr.json() == [], f"expected empty foreign list, got {fr.json()}"

        _cleanup_time_off(owner_sess)

    # ---------- DECISIONS ----------

    def test_approve_flow_and_audit_log(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        r = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=70)),
            "end_date":   _iso(t + timedelta(days=70)),
            "reason": "approve-me",
        })
        rid = r.json()["id"]
        pr = owner_sess.patch(f"{API}/time-off/{rid}/approve", json={"notes": "ok"})
        assert pr.status_code == 200, pr.text
        d = pr.json()
        assert d["status"] == "approved"
        assert d["decided_at"] and d["decided_by"] and d["decided_by_name"]

        # audit log
        alog = owner_sess.get(f"{API}/admin/audit-log")
        if alog.status_code == 404:
            alog = owner_sess.get(f"{API}/admin-audit-log")
        if alog.status_code == 404:
            alog = owner_sess.get(f"{API}/audit-log")
        assert alog.status_code == 200, f"audit endpoint not found: {alog.status_code} {alog.text[:200]}"
        rows = alog.json()
        assert any(x.get("action") == "time_off.approved" for x in rows), \
            f"missing time_off.approved in audit, sample actions={[x.get('action') for x in rows][:10]}"

        # double-approve → 400
        again = owner_sess.patch(f"{API}/time-off/{rid}/approve", json={})
        assert again.status_code == 400
        assert again.json()["detail"] == "Request is already approved"
        _cleanup_time_off(owner_sess)

    def test_deny_flow_and_audit_log(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        r = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=80)),
            "end_date":   _iso(t + timedelta(days=80)),
            "reason": "deny-me",
        })
        rid = r.json()["id"]
        pr = owner_sess.patch(f"{API}/time-off/{rid}/deny", json={"notes": "nope"})
        assert pr.status_code == 200, pr.text
        assert pr.json()["status"] == "denied"

        alog_r = None
        for path in ["/admin/audit-log", "/admin-audit-log", "/audit-log"]:
            alog_r = owner_sess.get(f"{API}{path}")
            if alog_r.status_code == 200:
                break
        assert alog_r and alog_r.status_code == 200
        assert any(x.get("action") == "time_off.denied" for x in alog_r.json())

        again = owner_sess.patch(f"{API}/time-off/{rid}/deny", json={})
        assert again.status_code == 400
        _cleanup_time_off(owner_sess)

    # ---------- SCHEDULE OVERRIDE ----------

    def test_pending_does_not_block_session_but_approved_does(self, owner_sess, emp_sess, nigerian_office):
        _cleanup_time_off(owner_sess)
        emp_id2 = nigerian_office["emp_id"]
        # Ensure schedule=any so only time-off can block
        owner_sess.patch(f"{API}/employees/{emp_id2}", json={"schedule": {"mode": "any"}})
        emp_sess.post(f"{API}/sessions/reset")

        today_iso = _iso(_today())
        r = emp_sess.post(f"{API}/time-off", json={
            "start_date": today_iso, "end_date": today_iso, "reason": "sick day",
        })
        assert r.status_code == 200, r.text
        rid = r.json()["id"]

        # PENDING → session should still succeed
        emp_sess.post(f"{API}/sessions/reset")
        ok = emp_sess.post(f"{API}/sessions/start",
                           json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert ok.status_code == 200, ok.text
        emp_sess.post(f"{API}/sessions/reset")

        # APPROVE → session denied
        ap = owner_sess.patch(f"{API}/time-off/{rid}/approve", json={})
        assert ap.status_code == 200
        deny = emp_sess.post(f"{API}/sessions/start",
                             json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert deny.status_code == 403, deny.text
        detail = deny.json()["detail"]
        assert "Approved time off today" in detail
        assert "sick day" in detail
        assert "Enjoy your day" in detail

        _cleanup_time_off(owner_sess)

    def test_timeoff_beats_weekly_calendar(self, owner_sess, emp_sess, nigerian_office):
        _cleanup_time_off(owner_sess)
        emp_id2 = nigerian_office["emp_id"]
        # Set a wide-open weekly window covering NOW
        from datetime import datetime as _dt
        from zoneinfo import ZoneInfo
        now = _dt.now(ZoneInfo("UTC"))
        open_dt = now - timedelta(minutes=5)
        close_dt = now + timedelta(hours=3)
        if close_dt.date() != now.date():
            pytest.skip("Too close to UTC midnight")
        DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"]
        weekly = {d: {"open": open_dt.strftime("%H:%M"), "close": close_dt.strftime("%H:%M")} for d in DAY_KEYS}
        owner_sess.patch(f"{API}/employees/{emp_id2}", json={
            "schedule": {"mode": "weekly_calendar", "timezone": "UTC", "weekly_schedule": weekly}
        })
        # Fresh login so token/user is up-to-date
        emp2 = _login(EMP_EMAIL, EMP_PW)
        emp2.post(f"{API}/sessions/reset")

        today_iso = _iso(_today())
        r = emp2.post(f"{API}/time-off", json={
            "start_date": today_iso, "end_date": today_iso, "reason": "wedding",
        })
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        owner_sess.patch(f"{API}/time-off/{rid}/approve", json={})

        deny = emp2.post(f"{API}/sessions/start",
                        json={"lat": IN_LAT, "lng": IN_LNG, "accuracy": 10})
        assert deny.status_code == 403, deny.text
        detail = deny.json()["detail"]
        assert "wedding" in detail
        assert "shift" not in detail.lower(), f"schedule reason leaked: {detail}"

        # Cleanup
        _cleanup_time_off(owner_sess)
        owner_sess.patch(f"{API}/employees/{emp_id2}", json={"schedule": {"mode": "any"}})
        emp2.post(f"{API}/sessions/reset")

    def test_today_endpoint(self, owner_sess, emp_sess, nigerian_office):
        _cleanup_time_off(owner_sess)
        # null case
        r0 = emp_sess.get(f"{API}/time-off/today")
        assert r0.status_code == 200
        assert r0.json() in (None, {}), f"expected null, got {r0.json()}"

        today_iso = _iso(_today())
        c = emp_sess.post(f"{API}/time-off", json={
            "start_date": today_iso, "end_date": today_iso, "reason": "today",
        })
        rid = c.json()["id"]
        # while pending: /today should still be null
        pend = emp_sess.get(f"{API}/time-off/today").json()
        assert pend in (None, {}), f"pending should not appear in /today, got {pend}"
        owner_sess.patch(f"{API}/time-off/{rid}/approve", json={})
        r1 = emp_sess.get(f"{API}/time-off/today")
        assert r1.status_code == 200
        d = r1.json()
        assert d and d["status"] == "approved" and d["reason"] == "today"

        _cleanup_time_off(owner_sess)

    # ---------- DELETE / CANCEL ----------

    def test_employee_cancel_pending(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        r = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=90)),
            "end_date":   _iso(t + timedelta(days=90)),
            "reason": "cancel me",
        })
        rid = r.json()["id"]
        d = emp_sess.delete(f"{API}/time-off/{rid}")
        assert d.status_code == 200, d.text
        _cleanup_time_off(owner_sess)

    def test_employee_cannot_cancel_approved(self, owner_sess, emp_sess):
        _cleanup_time_off(owner_sess)
        t = _today()
        r = emp_sess.post(f"{API}/time-off", json={
            "start_date": _iso(t + timedelta(days=95)),
            "end_date":   _iso(t + timedelta(days=95)),
            "reason": "approved cancel",
        })
        rid = r.json()["id"]
        owner_sess.patch(f"{API}/time-off/{rid}/approve", json={})
        d = emp_sess.delete(f"{API}/time-off/{rid}")
        assert d.status_code == 400, d.text
        assert d.json()["detail"] == "Only pending requests can be cancelled"
        # admin cleanup
        owner_sess.delete(f"{API}/time-off/{rid}")
        _cleanup_time_off(owner_sess)

    def test_employee_cannot_cancel_others_request(self, owner_sess, emp_sess, nigerian_office):
        """Create a second employee, submit a request as them, verify EMP_EMAIL can't delete it."""
        _cleanup_time_off(owner_sess)
        office_id = nigerian_office["office_id"]
        other_email = f"TEST_other_{uuid.uuid4().hex[:6]}@example.com"
        cr = owner_sess.post(f"{API}/employees", json={
            "name": "TEST Other", "email": other_email,
            "password": "Otherpass123!", "office_id": office_id,
        })
        assert cr.status_code == 200, cr.text
        other_id = cr.json()["id"]
        try:
            other_sess = _login(other_email, "Otherpass123!")
            t = _today()
            r = other_sess.post(f"{API}/time-off", json={
                "start_date": _iso(t + timedelta(days=100)),
                "end_date":   _iso(t + timedelta(days=100)),
                "reason": "other",
            })
            assert r.status_code == 200, r.text
            rid = r.json()["id"]
            d = emp_sess.delete(f"{API}/time-off/{rid}")
            assert d.status_code == 403, d.text
            assert d.json()["detail"] == "Not your request"
        finally:
            _cleanup_time_off(owner_sess)
            owner_sess.delete(f"{API}/employees/{other_id}")

    def test_404_on_missing_id(self, owner_sess):
        fake = "507f1f77bcf86cd799439011"
        r1 = owner_sess.patch(f"{API}/time-off/{fake}/approve", json={})
        assert r1.status_code == 404
        r2 = owner_sess.patch(f"{API}/time-off/{fake}/deny", json={})
        assert r2.status_code == 404
        r3 = owner_sess.delete(f"{API}/time-off/{fake}")
        assert r3.status_code == 404
