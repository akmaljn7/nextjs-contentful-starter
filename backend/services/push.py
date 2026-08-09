"""FCM push notification service.

Uses Firebase Cloud Messaging HTTP v1 with an OAuth2 access token minted from
a service account JSON. Fails gracefully when creds are missing so the rest
of the mobile pipeline still works during development.

Env vars:
- FCM_SERVICE_ACCOUNT_JSON: full JSON string of a Google service-account key
  with the `firebase.messaging` scope.
- FCM_PROJECT_ID: firebase project id (redundant with service-account JSON but
  handy for logs)

If FCM_SERVICE_ACCOUNT_JSON is unset the service logs the intended push and
returns success without sending. Real push wiring happens in Phase 3 when the
user provides FCM credentials.
"""
import json
import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_TOKEN_CACHE: dict = {"token": None, "exp": 0}


def _fcm_configured() -> bool:
    return bool(os.environ.get("FCM_SERVICE_ACCOUNT_JSON"))


async def _get_access_token() -> Optional[str]:
    """Mint an OAuth2 access token for the FCM v1 API."""
    if _TOKEN_CACHE["token"] and _TOKEN_CACHE["exp"] > time.time() + 60:
        return _TOKEN_CACHE["token"]
    raw = os.environ.get("FCM_SERVICE_ACCOUNT_JSON")
    if not raw:
        return None
    try:
        # Lazy import — google-auth already in requirements
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        info = json.loads(raw)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
        creds.refresh(Request())
        _TOKEN_CACHE["token"] = creds.token
        _TOKEN_CACHE["exp"] = creds.expiry.timestamp() if creds.expiry else time.time() + 3300
        return creds.token
    except Exception as e:
        logger.error("fcm_token_error err=%s", e)
        return None


def _project_id() -> Optional[str]:
    pid = os.environ.get("FCM_PROJECT_ID")
    if pid:
        return pid
    raw = os.environ.get("FCM_SERVICE_ACCOUNT_JSON")
    if not raw:
        return None
    try:
        return json.loads(raw).get("project_id")
    except Exception:
        return None


async def send_push(
    push_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    silent: bool = False,
    channel_id: str = "attendance",
    sound: Optional[str] = None,
) -> dict:
    """Send an FCM push. Returns {ok, reason, [message_id]}.

    Silent pushes are used for background wake-ups (deadman timer, live-map
    admin pings). Regular pushes carry title/body for the OS to render.
    """
    if not _fcm_configured():
        logger.info(
            "push_stub token=%s...%s title=%r body=%r silent=%s data=%s",
            push_token[:8] if push_token else "?", push_token[-4:] if push_token else "?",
            title, body, silent, data,
        )
        return {"ok": True, "reason": "fcm_not_configured", "stubbed": True}
    if not push_token:
        return {"ok": False, "reason": "no_push_token"}
    access = await _get_access_token()
    if not access:
        return {"ok": False, "reason": "no_access_token"}
    project = _project_id()
    if not project:
        return {"ok": False, "reason": "no_project_id"}

    message: dict = {
        "token": push_token,
        "data": {k: str(v) for k, v in (data or {}).items()},
        "android": {
            "priority": "high",
            "notification": {"channel_id": channel_id, "notification_priority": "PRIORITY_MAX"},
        },
        "apns": {
            "headers": {"apns-priority": "10", "apns-push-type": "alert"},
        },
    }
    if silent:
        # Content-available silent push — wakes app without showing UI
        message["apns"]["headers"] = {"apns-priority": "5", "apns-push-type": "background"}
        message["apns"]["payload"] = {"aps": {"content-available": 1}}
        message["android"]["priority"] = "normal"
        message["data"]["silent"] = "true"
    else:
        message["notification"] = {"title": title, "body": body}
        aps_sound = sound or "default"
        message["apns"]["payload"] = {"aps": {"alert": {"title": title, "body": body}, "sound": aps_sound}}
        # Android plays the channel's configured sound; nothing else needed here.

    url = f"https://fcm.googleapis.com/v1/projects/{project}/messages:send"
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, headers=headers, json={"message": message})
            if r.status_code == 200:
                logger.info("push_sent title=%r silent=%s", title, silent)
                return {"ok": True, "message_id": r.json().get("name")}
            logger.warning("push_failed status=%s body=%s", r.status_code, r.text[:300])
            return {"ok": False, "reason": f"fcm_{r.status_code}", "detail": r.text[:200]}
    except Exception as e:
        logger.error("push_exception err=%s", e)
        return {"ok": False, "reason": "network_error", "detail": str(e)}


async def send_push_to_user(db, user_id: str, title: str, body: str,
                            data: Optional[dict] = None, silent: bool = False,
                            channel_id: str = "attendance", sound: Optional[str] = None) -> list:
    """Fan-out to every registered device for a user. Returns list of send results."""
    results = []
    async for dev in db.mobile_devices.find({"user_id": user_id, "deleted_at": None, "push_token": {"$ne": None}}):
        res = await send_push(dev["push_token"], title, body, data=data, silent=silent,
                              channel_id=channel_id, sound=sound)
        results.append({"device_id": dev.get("device_id"), **res})
        if not res.get("ok") and res.get("reason") in {"fcm_404", "fcm_400"}:
            # Token invalidated — mark device for cleanup
            await db.mobile_devices.update_one(
                {"_id": dev["_id"]}, {"$set": {"push_token": None, "push_token_invalid_at": time.time()}},
            )
    return results
