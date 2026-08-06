"""MongoDB connection + index setup."""
import os
from motor.motor_asyncio import AsyncIOMotorClient

_client: AsyncIOMotorClient | None = None
_db = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()[os.environ["DB_NAME"]]
    return _db


async def close_db():
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def ensure_indexes():
    db = get_db()
    await db.organizations.create_index("slug", unique=True)
    await db.users.create_index([("email", 1)], unique=True)
    await db.users.create_index([("org_id", 1)])
    await db.offices.create_index([("org_id", 1)])
    await db.offices.create_index([("location", "2dsphere")])
    await db.active_sessions.create_index([("org_id", 1), ("user_id", 1)], unique=True)
    await db.attendance_records.create_index([("org_id", 1), ("user_id", 1), ("ended_at", -1)])
    await db.gps_pings.create_index([("session_id", 1), ("ts", 1)])
    # 90-day TTL for GPS pings (data-minimization)
    await db.gps_pings.create_index("ts", expireAfterSeconds=60 * 60 * 24 * 90)
    await db.admin_audit_log.create_index([("org_id", 1), ("ts", -1)])
    await db.security_events.create_index([("org_id", 1), ("ts", -1)])
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.refresh_tokens.create_index("jti", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.time_off_requests.create_index([("org_id", 1), ("user_id", 1), ("status", 1)])
    await db.time_off_requests.create_index([("org_id", 1), ("start_date", 1), ("end_date", 1)])
    # Mobile app collections (Phase 0)
    await db.mobile_devices.create_index([("user_id", 1), ("device_id", 1)], unique=True)
    await db.mobile_devices.create_index([("org_id", 1), ("last_seen_at", -1)])
    await db.mobile_events.create_index(
        [("user_id", 1), ("client_event_id", 1)], unique=True,
    )
    await db.mobile_events.create_index([("org_id", 1), ("ts_ms", -1)])
    # 90-day retention on raw mobile events, same policy as gps_pings
    await db.mobile_events.create_index("received_at_dt", expireAfterSeconds=60 * 60 * 24 * 90)
