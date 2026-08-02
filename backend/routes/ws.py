"""WebSocket endpoint for live session updates.

Auth strategy: verify JWT from the `access_token` cookie sent during the WS
handshake. As a fallback (useful for testing / non-browser clients) accept a
`?token=<jwt>` query param.
"""
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from bson import ObjectId
import jwt

from db import get_db
from security import decode_token
from services.ws_manager import manager

router = APIRouter()


async def _authenticate(ws: WebSocket) -> dict | None:
    token = ws.cookies.get("access_token") or ws.query_params.get("token")
    if not token:
        return None
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        return None
    if not user or user.get("deleted_at"):
        return None
    if user.get("role") not in ("org_owner", "admin", "super_admin"):
        return None
    return {"id": str(user["_id"]), "org_id": user["org_id"], "role": user["role"]}


@router.websocket("/api/ws/live")
async def ws_live(ws: WebSocket):
    await ws.accept()
    user = await _authenticate(ws)
    if not user:
        await ws.send_json({"type": "error", "message": "unauthorized"})
        await ws.close(code=4401)
        return

    org_id = user["org_id"]
    await manager.connect(org_id, ws)
    await ws.send_json({"type": "hello", "org_id": org_id})
    try:
        # Keep the socket alive with server-side pings; also accept client keepalive.
        while True:
            try:
                # Client can send arbitrary keep-alive messages; we ignore contents.
                await asyncio.wait_for(ws.receive_text(), timeout=25.0)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await manager.disconnect(org_id, ws)
