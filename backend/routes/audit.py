"""Audit log + security events (admin read-only views)."""
from fastapi import APIRouter, Depends, Query
from bson import ObjectId

from db import get_db
from deps import require_admin

router = APIRouter(prefix="/api", tags=["audit"])


@router.get("/audit-log")
async def audit_log(user: dict = Depends(require_admin), limit: int = Query(200, ge=1, le=1000)):
    db = get_db()
    cur = db.admin_audit_log.find({"org_id": user["org_id"]}).sort("ts", -1).limit(limit)
    rows = [r async for r in cur]
    actor_ids = list({r.get("actor_id") for r in rows if r.get("actor_id")})
    actor_map = {}
    if actor_ids:
        try:
            oids = [ObjectId(x) for x in actor_ids]
            async for u in db.users.find({"_id": {"$in": oids}}):
                actor_map[str(u["_id"])] = u["name"]
        except Exception:
            pass
    return [{
        "id": str(r["_id"]),
        "action": r["action"],
        "target_type": r["target_type"],
        "target_id": r["target_id"],
        "actor_id": r.get("actor_id"),
        "actor_name": actor_map.get(r.get("actor_id", ""), ""),
        "before": r.get("before"),
        "after": r.get("after"),
        "ip": r.get("ip", ""),
        "user_agent": r.get("user_agent", ""),
        "ts": r["ts"],
    } for r in rows]


@router.get("/security-events")
async def security_events(user: dict = Depends(require_admin), limit: int = Query(200, ge=1, le=1000)):
    db = get_db()
    cur = db.security_events.find({"org_id": user["org_id"]}).sort("ts", -1).limit(limit)
    rows = [r async for r in cur]
    user_ids = list({r.get("user_id") for r in rows if r.get("user_id")})
    user_map = {}
    if user_ids:
        try:
            oids = [ObjectId(x) for x in user_ids]
            async for u in db.users.find({"_id": {"$in": oids}}):
                user_map[str(u["_id"])] = u["name"]
        except Exception:
            pass
    return [{
        "id": str(r["_id"]),
        "type": r["type"],
        "severity": r["severity"],
        "user_id": r.get("user_id"),
        "user_name": user_map.get(r.get("user_id", ""), ""),
        "ip": r.get("ip", ""),
        "details": r.get("details", {}),
        "ts": r["ts"],
    } for r in rows]
