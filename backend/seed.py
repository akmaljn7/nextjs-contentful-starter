"""Seed initial demo data: org + owner + one office + one employee."""
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
    emp_email = os.environ.get("EMPLOYEE_EMAIL", "employee@example.com").lower().strip()
    emp_password = os.environ.get("EMPLOYEE_PASSWORD", "Employee123!")

    now = datetime.now(timezone.utc).isoformat()
    owner = await db.users.find_one({"email": admin_email})
    if owner:
        # Ensure password matches env (dev convenience)
        from security import verify_password
        if not verify_password(admin_password, owner.get("password_hash", "")):
            await db.users.update_one({"_id": owner["_id"]}, {"$set": {"password_hash": hash_password(admin_password)}})
        return

    # Create org
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

    owner_res = await db.users.insert_one({
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

    # Seed a sample office (Times Square NYC as reference)
    office_res = await db.offices.insert_one({
        "org_id": org_id,
        "name": "HQ — Times Square",
        "location": {"type": "Point", "coordinates": [-73.9855, 40.7580]},
        "radius_meters": 150,
        "created_by": str(owner_res.inserted_id),
        "created_at": now,
    })

    await db.users.insert_one({
        "org_id": org_id,
        "email": emp_email,
        "password_hash": hash_password(emp_password),
        "name": "Sample Employee",
        "role": "employee",
        "office_id": str(office_res.inserted_id),
        "failed_login_count": 0,
        "locked_until": None,
        "last_login_at": None,
        "created_at": now,
        "deleted_at": None,
    })
