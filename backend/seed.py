"""Seed org + owner. NO hardcoded office — the owner creates offices at their real location."""
import os
from datetime import datetime, timezone
from bson import ObjectId

from db import get_db
from security import hash_password


async def seed_demo():
    db = get_db()
    admin_email = os.environ["ADMIN_EMAIL"].lower().strip()
    admin_password = os.environ["ADMIN_PASSWORD"]
    org_name = os.environ.get("ADMIN_ORG_NAME", "Demo Org")

    # One-time cleanup: remove the previously-seeded hardcoded Times Square office
    # (and detach any employees still assigned to it) IF it has no attendance records.
    ts_office = await db.offices.find_one({
        "name": "HQ — Times Square",
        "location.coordinates": [-73.9855, 40.7580],
    })
    if ts_office:
        office_id = str(ts_office["_id"])
        has_records = await db.attendance_records.find_one({"office_id": office_id})
        if not has_records:
            await db.users.update_many({"office_id": office_id}, {"$set": {"office_id": None}})
            await db.offices.delete_one({"_id": ts_office["_id"]})
        # If it has records, leave it — the admin can delete it manually.

    now = datetime.now(timezone.utc).isoformat()
    owner = await db.users.find_one({"email": admin_email})
    if owner:
        from security import verify_password
        if not verify_password(admin_password, owner.get("password_hash", "")):
            await db.users.update_one({"_id": owner["_id"]}, {"$set": {"password_hash": hash_password(admin_password)}})
        return

    org_res = await db.organizations.insert_one({
        "name": org_name,
        "slug": "emergent-operations",
        "plan": "free",
        "settings": {
            "session_duration_minutes": 60,
            "resume_window_hours": 10,
            "accuracy_tolerance_meters": 50,
            "max_speed_kmh": 200,
            "spoof_sensitivity": "medium",
            "notify_admin_on_spoof": True,
        },
        "created_at": now,
        "deleted_at": None,
    })
    org_id = str(org_res.inserted_id)

    await db.users.insert_one({
        "org_id": org_id,
        "email": admin_email,
        "password_hash": hash_password(admin_password),
        "name": "Akmal (Owner)",
        "role": "org_owner",
        "office_id": None,
        "failed_login_count": 0,
        "locked_until": None,
        "last_login_at": None,
        "created_at": now,
        "deleted_at": None,
    })

    # Also seed a sample employee (unassigned — owner assigns them to an office they create)
    emp_email = os.environ.get("EMPLOYEE_EMAIL", "employee@example.com").lower().strip()
    emp_password = os.environ.get("EMPLOYEE_PASSWORD", "Employee123!")
    if not await db.users.find_one({"email": emp_email}):
        await db.users.insert_one({
            "org_id": org_id,
            "email": emp_email,
            "password_hash": hash_password(emp_password),
            "name": "Sample Employee",
            "role": "employee",
            "office_id": None,
            "failed_login_count": 0,
            "locked_until": None,
            "last_login_at": None,
            "created_at": now,
            "deleted_at": None,
        })
