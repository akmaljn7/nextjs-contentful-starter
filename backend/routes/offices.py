"""Offices CRUD."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId

from db import get_db
from models import OfficeCreate, OfficeUpdate
from deps import get_current_user, require_admin, client_ip
from services.audit import log_admin_action

router = APIRouter(prefix="/api/offices", tags=["offices"])


def _shape(doc: dict) -> dict:
    coords = doc["location"]["coordinates"]  # [lng, lat]
    return {
        "id": str(doc["_id"]),
        "org_id": doc["org_id"],
        "name": doc["name"],
        "lat": coords[1],
        "lng": coords[0],
        "radius_meters": doc["radius_meters"],
        "created_at": doc.get("created_at", ""),
    }


@router.get("")
async def list_offices(user: dict = Depends(get_current_user)):
    db = get_db()
    cur = db.offices.find({"org_id": user["org_id"]})
    return [_shape(d) async for d in cur]


@router.post("")
async def create_office(payload: OfficeCreate, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    doc = {
        "org_id": user["org_id"],
        "name": payload.name,
        "location": {"type": "Point", "coordinates": [payload.lng, payload.lat]},
        "radius_meters": payload.radius_meters,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.offices.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_admin_action(
        user["org_id"], user["id"], "office.create", "office", str(res.inserted_id),
        after=_shape(doc), ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    return _shape(doc)


@router.patch("/{office_id}")
async def update_office(office_id: str, payload: OfficeUpdate, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    try:
        oid = ObjectId(office_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    existing = await db.offices.find_one({"_id": oid, "org_id": user["org_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Office not found")
    update = {}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.lat is not None and payload.lng is not None:
        update["location"] = {"type": "Point", "coordinates": [payload.lng, payload.lat]}
    elif payload.lat is not None:
        update["location"] = {"type": "Point", "coordinates": [existing["location"]["coordinates"][0], payload.lat]}
    elif payload.lng is not None:
        update["location"] = {"type": "Point", "coordinates": [payload.lng, existing["location"]["coordinates"][1]]}
    if payload.radius_meters is not None:
        update["radius_meters"] = payload.radius_meters
    if update:
        await db.offices.update_one({"_id": oid}, {"$set": update})
    new_doc = await db.offices.find_one({"_id": oid})
    await log_admin_action(
        user["org_id"], user["id"], "office.update", "office", office_id,
        before=_shape(existing), after=_shape(new_doc), ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    return _shape(new_doc)


@router.delete("/{office_id}")
async def delete_office(office_id: str, request: Request, user: dict = Depends(require_admin)):
    db = get_db()
    try:
        oid = ObjectId(office_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    existing = await db.offices.find_one({"_id": oid, "org_id": user["org_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Office not found")
    # Detach employees
    await db.users.update_many({"org_id": user["org_id"], "office_id": office_id}, {"$set": {"office_id": None}})
    await db.offices.delete_one({"_id": oid})
    await log_admin_action(
        user["org_id"], user["id"], "office.delete", "office", office_id,
        before=_shape(existing), ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    return {"ok": True}
