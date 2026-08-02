"""Audit + security event logging."""
from datetime import datetime, timezone
from db import get_db


async def log_admin_action(
    org_id: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    before: dict | None = None,
    after: dict | None = None,
    ip: str = "",
    user_agent: str = "",
):
    db = get_db()
    await db.admin_audit_log.insert_one({
        "org_id": org_id,
        "actor_id": actor_id,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "before": before,
        "after": after,
        "ip": ip,
        "user_agent": user_agent,
        "ts": datetime.now(timezone.utc).isoformat(),
    })


async def log_security_event(
    type_: str,
    severity: str,
    ip: str,
    details: dict,
    org_id: str | None = None,
    user_id: str | None = None,
):
    db = get_db()
    await db.security_events.insert_one({
        "org_id": org_id,
        "user_id": user_id,
        "type": type_,
        "severity": severity,
        "ip": ip,
        "details": details,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
