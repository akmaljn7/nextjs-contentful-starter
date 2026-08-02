"""Face-photo storage — keeps the base64 payload out of the session doc so
list endpoints stay lean, but keeps a permanent copy indexed by session id."""
import base64
import binascii
from datetime import datetime, timezone
from bson import ObjectId

from db import get_db


def _strip_data_url(s: str) -> tuple[str, str]:
    """Return (mime, base64_body). Accepts either a data URL or a bare base64 string."""
    if s.startswith("data:"):
        try:
            header, body = s.split(",", 1)
            mime = header.split(";")[0][5:] or "image/jpeg"
            return mime, body
        except ValueError:
            return "image/jpeg", s
    return "image/jpeg", s


async def save_session_photo(session_id: str, org_id: str, user_id: str, data_url: str) -> bool:
    """Persist the photo into the `session_photos` collection (upsert by session_id)."""
    if not data_url:
        return False
    mime, body = _strip_data_url(data_url)
    # Basic sanity check
    try:
        raw = base64.b64decode(body, validate=True)
    except (binascii.Error, ValueError):
        return False
    if len(raw) < 512:  # under 512B is almost certainly bogus
        return False
    if len(raw) > 5 * 1024 * 1024:  # reject > 5MB decoded (defense-in-depth)
        return False
    db = get_db()
    await db.session_photos.update_one(
        {"session_id": session_id},
        {"$set": {
            "session_id": session_id,
            "org_id": org_id,
            "user_id": user_id,
            "mime": mime,
            "photo_b64": body,
            "size_bytes": len(raw),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return True


async def get_photo(session_id: str, org_id: str) -> tuple[bytes, str] | None:
    """Return (bytes, mime) tuple or None. Enforces tenant scope."""
    db = get_db()
    doc = await db.session_photos.find_one({"session_id": session_id, "org_id": org_id})
    if not doc:
        return None
    try:
        return base64.b64decode(doc["photo_b64"]), doc.get("mime", "image/jpeg")
    except Exception:
        return None


async def has_photo(session_id: str) -> bool:
    db = get_db()
    return bool(await db.session_photos.find_one({"session_id": session_id}, {"_id": 1}))
