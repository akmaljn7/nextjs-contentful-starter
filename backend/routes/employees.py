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
        "created_at": doc.get("created_at"),
        "last_login_at": doc.get("last_login_at"),
    }


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
    if update:
        await db.users.update_one({"_id": eid}, {"$set": update})
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
