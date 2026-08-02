"""Time-off requests — employees submit, admins approve/deny.

Approved time-off overrides the weekly schedule for the covered dates.
Session start is denied on covered dates regardless of schedule mode.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from bson import ObjectId

from db import get_db
from models import TimeOffCreate, TimeOffDecision
from deps import get_current_user, require_admin, client_ip
from services.audit import log_admin_action

router = APIRouter(prefix="/api/time-off", tags=["time-off"])


def _today_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _shape(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "org_id": doc["org_id"],
        "user_id": doc["user_id"],
        "employee_name": doc.get("employee_name", ""),
        "employee_email": doc.get("employee_email", ""),
        "start_date": doc["start_date"],
        "end_date": doc["end_date"],
        "reason": doc.get("reason", ""),
        "status": doc["status"],
        "created_at": doc.get("created_at"),
        "decided_at": doc.get("decided_at"),
        "decided_by": doc.get("decided_by"),
        "decided_by_name": doc.get("decided_by_name", ""),
        "decision_notes": doc.get("decision_notes", ""),
    }


@router.post("")
async def create_request(payload: TimeOffCreate, request: Request, user: dict = Depends(get_current_user)):
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Only employees can request time off")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date is before start date")
    if payload.start_date < _today_utc():
        raise HTTPException(status_code=400, detail="Cannot request time off in the past")
    db = get_db()
    # Deduplicate: reject if an overlapping pending or approved request exists
    overlap = await db.time_off_requests.find_one({
        "user_id": user["id"],
        "org_id": user["org_id"],
        "status": {"$in": ["pending", "approved"]},
        "start_date": {"$lte": payload.end_date},
        "end_date": {"$gte": payload.start_date},
    })
    if overlap:
        raise HTTPException(status_code=400, detail="You already have a request covering those dates")

    doc = {
        "org_id": user["org_id"],
        "user_id": user["id"],
        "employee_name": user.get("name", ""),
        "employee_email": user.get("email", ""),
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "reason": payload.reason.strip(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "decided_at": None,
        "decided_by": None,
        "decided_by_name": None,
        "decision_notes": None,
    }
    res = await db.time_off_requests.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _shape(doc)


@router.get("/me")
async def my_requests(user: dict = Depends(get_current_user)):
    db = get_db()
    cur = db.time_off_requests.find({"org_id": user["org_id"], "user_id": user["id"]}).sort("start_date", -1)
    return [_shape(d) async for d in cur]


@router.get("/today")
async def today_status(user: dict = Depends(get_current_user)):
    """Return the caller's approved time-off spanning today (UTC), or null."""
    db = get_db()
    today = _today_utc()
    doc = await db.time_off_requests.find_one({
        "org_id": user["org_id"],
        "user_id": user["id"],
        "status": "approved",
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
    })
    return _shape(doc) if doc else None


@router.get("")
async def list_requests(user: dict = Depends(require_admin), status: str | None = Query(None)):
    db = get_db()
    q = {"org_id": user["org_id"]}
    if status:
        q["status"] = status
    cur = db.time_off_requests.find(q).sort("created_at", -1)
    return [_shape(d) async for d in cur]


async def _decide(request_id: str, decision: str, notes: str | None, user: dict, request: Request):
    db = get_db()
    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    existing = await db.time_off_requests.find_one({"_id": oid, "org_id": user["org_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")
    if existing["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {existing['status']}")
    update = {
        "status": decision,
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "decided_by": user["id"],
        "decided_by_name": user.get("name", ""),
        "decision_notes": (notes or "").strip() or None,
    }
    await db.time_off_requests.update_one({"_id": oid}, {"$set": update})
    new_doc = await db.time_off_requests.find_one({"_id": oid})
    await log_admin_action(
        user["org_id"], user["id"], f"time_off.{decision}", "time_off", request_id,
        before={"status": existing["status"]}, after={"status": decision, "notes": update["decision_notes"]},
        ip=client_ip(request), user_agent=request.headers.get("user-agent", ""),
    )
    return _shape(new_doc)


@router.patch("/{request_id}/approve")
async def approve_request(request_id: str, payload: TimeOffDecision, request: Request, user: dict = Depends(require_admin)):
    return await _decide(request_id, "approved", payload.notes, user, request)


@router.patch("/{request_id}/deny")
async def deny_request(request_id: str, payload: TimeOffDecision, request: Request, user: dict = Depends(require_admin)):
    return await _decide(request_id, "denied", payload.notes, user, request)


@router.delete("/{request_id}")
async def cancel_request(request_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    existing = await db.time_off_requests.find_one({"_id": oid, "org_id": user["org_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")
    # Employees can cancel their own PENDING requests; admins can cancel any status
    is_admin = user.get("role") in ("org_owner", "admin", "super_admin")
    if not is_admin:
        if existing["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your request")
        if existing["status"] != "pending":
            raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")
    await db.time_off_requests.delete_one({"_id": oid})
    return {"ok": True}
