"""Resend transactional email via Emergent proxy."""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"


def _key() -> str:
    return os.environ["EMERGENT_EMAIL_KEY"]


def _from_name() -> str:
    return os.environ["EMAIL_FROM_NAME"]


async def send_email(to: str, subject: str, html: str, reply_to: str | None = None) -> bool:
    payload = {
        "to": [to],
        "subject": subject,
        "html": html,
        "from_name": _from_name(),
    }
    if reply_to:
        payload["contact_email"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": _key()},
                json=payload,
            )
        if resp.status_code >= 400:
            logger.error(f"Email send failed: {resp.status_code} {resp.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False


def render_reset_email(reset_url: str, name: str) -> str:
    return f"""
<table cellpadding="0" cellspacing="0" width="100%" style="background:#0A0A0A;padding:32px 0;font-family:Inter,Arial,sans-serif;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="480" style="background:#121212;border:1px solid #262626;">
      <tr><td style="padding:32px 32px 16px 32px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.24em;color:#9CA3AF;text-transform:uppercase;">Geofence Console</div>
        <h1 style="margin:16px 0 8px 0;color:#F9FAFB;font-size:22px;font-weight:600;">Reset your password</h1>
        <p style="color:#9CA3AF;font-size:14px;line-height:1.6;">Hi {name}, click the button below to set a new password. This link expires in 1 hour.</p>
      </td></tr>
      <tr><td style="padding:8px 32px 32px 32px;">
        <a href="{reset_url}" style="display:inline-block;background:#F9FAFB;color:#0A0A0A;text-decoration:none;padding:12px 24px;font-weight:600;font-size:14px;">Reset password</a>
        <p style="margin-top:24px;color:#6B7280;font-size:12px;font-family:'IBM Plex Mono',monospace;word-break:break-all;">{reset_url}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
"""


def render_alert_email(subject_line: str, body_lines: list[str]) -> str:
    rows = "".join(f'<p style="color:#F9FAFB;font-size:14px;margin:8px 0;">{ln}</p>' for ln in body_lines)
    return f"""
<table cellpadding="0" cellspacing="0" width="100%" style="background:#0A0A0A;padding:32px 0;font-family:Inter,Arial,sans-serif;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="480" style="background:#121212;border:1px solid #EF4444;">
      <tr><td style="padding:32px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.24em;color:#EF4444;text-transform:uppercase;">Security Alert</div>
        <h1 style="margin:12px 0 16px 0;color:#F9FAFB;font-size:20px;font-weight:600;">{subject_line}</h1>
        {rows}
      </td></tr>
    </table>
  </td></tr>
</table>
"""
