"""Employees CRUD (users with role=employee)."""
import logging
import traceback
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId

from db import get_db
from models import EmployeeCreate, EmployeeUpdate
from security import hash_password
from deps import require_admin, client_ip
from services.audit import log_admin_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/employees", tags=["employees"])


def _shape(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "org_id": doc["org_id"],
        "email": doc["email"],
        "name": doc["name"],
        "role": doc["role"],
        "office_id": doc.get("office_id"),
        "schedule": doc.get("schedule") or {"mode": "any"},
        "logout_enabled": bool(doc.get("logout_enabled", False)),
        "bound_device_id": doc.get("bound_device_id"),
        "face_enrolled": bool(doc.get("face_baseline")),
        "created_at": doc.get("created_at"),
        "last_login_at": doc.get("last_login_at"),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_employees(user: dict = Depends(require_admin)):
    db = get_db()
    cur = db.users.find({"org_id": user["org_id"], "role": "employee", "deleted_at": None})
    return [_shape(d) async for d in cur]


@router.post("")
async def create_employee(payload: EmployeeCreate, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    email = payload.email.lower().strip()
    ip = client_ip(request)
    logger.info("employee_create_attempt admin=%s email=%s office_id=%s ip=%s",
                user.get("email"), email, payload.office_id, ip)
    try:
        # Duplicate check — give admin a specific reason
        existing = await db.users.find_one({"email": email})
        if existing:
            same_org = existing.get("org_id") == user["org_id"]
            role = existing.get("role", "user")
            soft_deleted = bool(existing.get("deleted_at"))
            if same_org and role == "employee" and soft_deleted:
                detail = "An employee with this email was removed. Restore them or use a different email."
            elif same_org and role == "employee":
                detail = "An employee with this email already exists in your organization."
            elif same_org:
                detail = f"This email is already used by a {role} in your organization."
            else:
                detail = "This email is already registered on another organization."
            logger.warning("employee_create_conflict admin=%s email=%s reason=%s",
                           user.get("email"), email, detail)
            raise HTTPException(status_code=409, detail=detail)

        # Verify office belongs to org
        try:
            office = await db.offices.find_one({"_id": ObjectId(payload.office_id), "org_id": user["org_id"]})
        except Exception:
            office = None
        if not office:
            logger.warning("employee_create_invalid_office admin=%s office_id=%s",
                           user.get("email"), payload.office_id)
            raise HTTPException(status_code=400, detail="Selected office is invalid or does not belong to your organization.")

        doc = {
            "org_id": user["org_id"],
            "email": email,
            "password_hash": hash_password(payload.password),
            "name": payload.name,
            "role": "employee",
            "office_id": payload.office_id,
            "schedule": payload.schedule.model_dump(exclude_none=True) if payload.schedule else {"mode": "any"},
            "failed_login_count": 0,
            "locked_until": None,
            "last_login_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted_at": None,
        }
        res = await db.users.insert_one(doc)
        doc["_id"] = res.inserted_id
        await log_admin_action(
            user["org_id"], user["id"], "employee.create", "employee", str(res.inserted_id),
            after={"name": doc["name"], "email": doc["email"], "office_id": doc["office_id"]},
            ip=ip, user_agent=request.headers.get("user-agent", ""),
        )
        logger.info("employee_create_ok admin=%s email=%s new_id=%s",
                    user.get("email"), email, res.inserted_id)
        return _shape(doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("employee_create_error admin=%s email=%s err=%s\n%s",
                     user.get("email"), email, e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Could not create employee: {e}")


@router.patch("/{employee_id}")
async def update_employee(employee_id: str, payload: EmployeeUpdate, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    try:
        eid = ObjectId(employee_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    existing = await db.users.find_one({"_id": eid, "org_id": user["org_id"], "role": "employee"})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    update = {}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.office_id is not None:
        try:
            office = await db.offices.find_one({"_id": ObjectId(payload.office_id), "org_id": user["org_id"]})
        except Exception:
            office = None
        if not office:
            raise HTTPException(status_code=400, detail="Invalid office")
        update["office_id"] = payload.office_id
    if payload.schedule is not None:
        update["schedule"] = payload.schedule.model_dump(exclude_none=True)
    if payload.logout_enabled is not None:
        update["logout_enabled"] = bool(payload.logout_enabled)
    if update:
        await db.users.update_one({"_id": eid}, {"$set": update})

    # Office reassignment: the employee's active session belongs to the OLD
    # office. Close it out into an immutable attendance record and stamp a
    # session cutoff so queued/offline events from the old office can't bleed
    # into a fresh session at the new office.
    office_changed = "office_id" in update and update["office_id"] != existing.get("office_id")
    if office_changed:
        import time as _time
        from routes.sessions import _write_attendance_record, _broadcast_session
        now_ms = int(_time.time() * 1000)
        s = await db.active_sessions.find_one({"user_id": employee_id, "org_id": user["org_id"]})
        if s:
            await _write_attendance_record(db, s, "office_reassigned", now_ms)
            await db.active_sessions.delete_one({"_id": s["_id"]})
            await _broadcast_session(db, s, ended=True, outcome="office_reassigned")
        await db.users.update_one({"_id": eid}, {"$set": {"session_cutoff_ms": now_ms}})
        logger.info("employee_office_reassigned admin=%s target=%s closed_session=%s",
                    user.get("email"), employee_id, bool(s))

    new_doc = await db.users.find_one({"_id": eid})
    await log_admin_action(
        user["org_id"], user["id"],
        "employee.reassign" if "office_id" in update else "employee.update",
        "employee", employee_id,
        before={"name": existing["name"], "office_id": existing.get("office_id")},
        after={"name": new_doc["name"], "office_id": new_doc.get("office_id")},
        ip=client_ip(request), user_agent=request.headers.get("user-agent", ""),
    )
    logger.info("employee_update_ok admin=%s target=%s updated_keys=%s",
                user.get("email"), employee_id, list(update.keys()))
    return _shape(new_doc)


@router.delete("/{employee_id}")
async def delete_employee(employee_id: str, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    try:
        eid = ObjectId(employee_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    existing = await db.users.find_one({"_id": eid, "org_id": user["org_id"], "role": "employee"})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.users.update_one(
        {"_id": eid},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    # End any active session
    await db.active_sessions.delete_one({"user_id": employee_id})
    await log_admin_action(
        user["org_id"], user["id"], "employee.delete", "employee", employee_id,
        before={"name": existing["name"], "email": existing["email"]},
        ip=client_ip(request), user_agent=request.headers.get("user-agent", ""),
    )
    logger.info("employee_delete_ok admin=%s target=%s email=%s",
                user.get("email"), employee_id, existing.get("email"))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Device binding — manager review of new-device requests
# ---------------------------------------------------------------------------
@router.get("/device-requests")
async def list_device_requests(user: dict = Depends(require_admin)):
    db = get_db()
    out = []
    cur = db.device_requests.find({"org_id": user["org_id"], "status": "pending"}).sort("created_at", -1)
    async for r in cur:
        try:
            emp = await db.users.find_one({"_id": ObjectId(r["user_id"])}, {"name": 1, "email": 1, "bound_device_id": 1})
        except Exception:
            emp = None
        out.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "employee_name": (emp or {}).get("name", "Unknown"),
            "employee_email": (emp or {}).get("email", ""),
            "current_bound_device_id": (emp or {}).get("bound_device_id"),
            "device_id": r.get("device_id"),
            "platform": r.get("platform"),
            "model": r.get("model"),
            "created_at": r.get("created_at"),
        })
    return out


@router.post("/device-requests/{request_id}/approve")
async def approve_device_request(request_id: str, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    req = await db.device_requests.find_one({"org_id": user["org_id"], "id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Request already {req.get('status')}")
    await db.device_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "approved", "reviewed_by": user.get("email"), "reviewed_at": _now_iso()}},
    )
    await db.users.update_one({"_id": ObjectId(req["user_id"])}, {"$set": {"bound_device_id": req["device_id"]}})
    # Supersede any other pending requests for the same employee.
    await db.device_requests.update_many(
        {"org_id": user["org_id"], "user_id": req["user_id"], "status": "pending", "id": {"$ne": request_id}},
        {"$set": {"status": "superseded"}},
    )
    await log_admin_action(user["org_id"], user["id"], "device.approve", "employee", req["user_id"],
                           after={"device_id": req["device_id"]},
                           ip=client_ip(request), user_agent=request.headers.get("user-agent", ""))
    logger.info("device_request_approved admin=%s user=%s device=%s", user.get("email"), req["user_id"], req["device_id"])
    return {"ok": True}


@router.post("/device-requests/{request_id}/reject")
async def reject_device_request(request_id: str, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    req = await db.device_requests.find_one({"org_id": user["org_id"], "id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Request already {req.get('status')}")
    await db.device_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"status": "rejected", "reviewed_by": user.get("email"), "reviewed_at": _now_iso()}},
    )
    await log_admin_action(user["org_id"], user["id"], "device.reject", "employee", req["user_id"],
                           after={"device_id": req["device_id"]},
                           ip=client_ip(request), user_agent=request.headers.get("user-agent", ""))
    logger.info("device_request_rejected admin=%s user=%s device=%s", user.get("email"), req["user_id"], req["device_id"])
    return {"ok": True}


@router.post("/{employee_id}/reset-device")
async def reset_device(employee_id: str, request: Request, user: dict = Depends(require_admin)):
    """Unbind an employee's device (e.g. they got a new phone). Their next
    login auto-binds the new device."""
    db = get_db()
    try:
        eid = ObjectId(employee_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    existing = await db.users.find_one({"_id": eid, "org_id": user["org_id"], "role": "employee"})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.users.update_one({"_id": eid}, {"$set": {"bound_device_id": None}})
    await db.device_requests.update_many(
        {"org_id": user["org_id"], "user_id": employee_id, "status": "pending"},
        {"$set": {"status": "cancelled"}},
    )
    await log_admin_action(user["org_id"], user["id"], "device.reset", "employee", employee_id,
                           ip=client_ip(request), user_agent=request.headers.get("user-agent", ""))
    logger.info("device_reset admin=%s target=%s", user.get("email"), employee_id)
    return {"ok": True}
