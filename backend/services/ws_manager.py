"""In-memory WebSocket connection manager, keyed by org_id."""
import json
import asyncio
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._by_org: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, org_id: str, ws: WebSocket):
        async with self._lock:
            self._by_org.setdefault(org_id, set()).add(ws)

    async def disconnect(self, org_id: str, ws: WebSocket):
        async with self._lock:
            conns = self._by_org.get(org_id)
            if conns and ws in conns:
                conns.discard(ws)
                if not conns:
                    self._by_org.pop(org_id, None)

    async def broadcast(self, org_id: str, payload: dict):
        conns = list(self._by_org.get(org_id, set()))
        if not conns:
            return
        text = json.dumps(payload, default=str)
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._by_org.get(org_id, set()).discard(ws)


manager = ConnectionManager()
