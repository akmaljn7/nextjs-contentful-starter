"""Serve check-in face photos. Tenant-scoped — only members of the same org can view."""
from fastapi import APIRouter, HTTPException, Depends, Response
from bson import ObjectId

from db import get_db
from deps import get_current_user
from services.photos import get_photo

router = APIRouter(prefix="/api/photos", tags=["photos"])


@router.get("/session/{session_id}")
async def get_session_photo(session_id: str, user: dict = Depends(get_current_user)):
    result = await get_photo(session_id, user["org_id"])
    if not result:
        raise HTTPException(status_code=404, detail="Photo not found")
    body, mime = result
    return Response(content=body, media_type=mime, headers={"Cache-Control": "private, max-age=300"})
