"""Pydantic models."""
from datetime import datetime, timezone
from typing import Optional, List, Literal, Dict
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Work Schedule ----------
class DayHours(BaseModel):
    open: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class EmployeeSchedule(BaseModel):
    """Per-employee work schedule.

    mode:
        - "any": no restriction (session uses org default duration)
        - "fixed_hours": min_hours_per_day is the session duration (e.g., 6h shift)
        - "weekly_calendar": weekly_schedule dictates open/close for each weekday
    """
    mode: Literal["any", "fixed_hours", "weekly_calendar"] = "any"
    min_hours_per_day: Optional[int] = Field(default=None, ge=1, le=24)
    weekly_schedule: Optional[Dict[str, Optional[DayHours]]] = None
    timezone: Optional[str] = "UTC"

    @field_validator("timezone")
    @classmethod
    def _tz_valid(cls, v):
        if v is None:
            return "UTC"
        try:
            ZoneInfo(v)
        except ZoneInfoNotFoundError as exc:
            raise ValueError(f"Unknown IANA timezone: {v!r}") from exc
        return v

    @model_validator(mode="after")
    def _mode_requires(self):
        if self.mode == "fixed_hours" and self.min_hours_per_day is None:
            raise ValueError("fixed_hours mode requires min_hours_per_day")
        if self.mode == "weekly_calendar":
            if not self.weekly_schedule:
                raise ValueError("weekly_calendar mode requires weekly_schedule")
            # weekly_schedule must contain at least one working day
            if not any(v is not None for v in self.weekly_schedule.values()):
                raise ValueError("weekly_calendar mode requires at least one working day")
        return self


# ---------- Auth ----------
class RegisterOrgRequest(BaseModel):
    org_name: str = Field(min_length=2, max_length=120)
    owner_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    org_id: str
    email: EmailStr
    name: str
    role: Literal["super_admin", "org_owner", "admin", "employee"]
    office_id: Optional[str] = None
    org_name: Optional[str] = None
    schedule: Optional[Dict] = None
    created_at: Optional[str] = None


# ---------- Office ----------
class OfficeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    radius_meters: int = Field(ge=10, le=5000)


class OfficeUpdate(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_meters: Optional[int] = Field(default=None, ge=10, le=5000)


class OfficePublic(BaseModel):
    id: str
    org_id: str
    name: str
    lat: float
    lng: float
    radius_meters: int
    created_at: str


# ---------- Employee ----------
class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    office_id: str
    schedule: Optional[EmployeeSchedule] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    office_id: Optional[str] = None
    schedule: Optional[EmployeeSchedule] = None


# ---------- Sessions ----------
class SessionStart(BaseModel):
    lat: float
    lng: float
    accuracy: float = Field(ge=0)
    device_fingerprint: Optional[str] = None
    face_photo: Optional[str] = Field(default=None, max_length=6_000_000)  # data URL or raw base64 (max ~4MB image)


class SessionPing(BaseModel):
    lat: float
    lng: float
    accuracy: float = Field(ge=0)
    speed: Optional[float] = None


# ---------- Time Off ----------
class TimeOffCreate(BaseModel):
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("start_date", "end_date")
    @classmethod
    def _real_date(cls, v):
        from datetime import date as _date
        try:
            _date.fromisoformat(v)
        except ValueError as exc:
            raise ValueError(f"Not a real calendar date: {v!r}") from exc
        return v

    @field_validator("reason")
    @classmethod
    def _no_whitespace_only(cls, v):
        if not (v or "").strip():
            raise ValueError("Reason cannot be blank")
        return v


class TimeOffDecision(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=500)


# ---------- Org Settings ----------
class OrgSettingsUpdate(BaseModel):
    session_duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    resume_window_hours: Optional[int] = Field(default=None, ge=1, le=48)
    accuracy_tolerance_meters: Optional[int] = Field(default=None, ge=5, le=500)
    max_speed_kmh: Optional[int] = Field(default=None, ge=10, le=1000)
    spoof_sensitivity: Optional[Literal["low", "medium", "high"]] = None
    notify_admin_on_spoof: Optional[bool] = None
    selfie_challenges_per_shift: Optional[int] = Field(default=None, ge=0, le=10)
    selfie_response_window_minutes: Optional[int] = Field(default=None, ge=1, le=30)
    selfie_mode: Optional[Literal["random", "fixed"]] = None
    selfie_fixed_times: Optional[List[str]] = None
    auto_start_on_entry: Optional[bool] = None


class SessionAutoStart(BaseModel):
    lat: float
    lng: float
    accuracy: float = Field(ge=0)
    device_fingerprint: Optional[str] = None


class ChallengeResponse(BaseModel):
    face_photo: str = Field(min_length=100, max_length=6_000_000)


# ---------- Mobile app models (Phase 0) ----------
class MobileDeviceRegister(BaseModel):
    """Called by mobile app on login / token refresh. Upserted per (user, device)."""
    device_id: str = Field(min_length=8, max_length=128)
    platform: Literal["ios", "android"]
    push_token: Optional[str] = Field(default=None, max_length=512)
    app_version: str = Field(min_length=1, max_length=32)
    os_version: Optional[str] = Field(default=None, max_length=64)
    tz: Optional[str] = Field(default=None, max_length=64)
    locale: Optional[str] = Field(default=None, max_length=16)
    model: Optional[str] = Field(default=None, max_length=64)

    @field_validator("tz")
    @classmethod
    def _tz_valid(cls, v):
        if not v:
            return v
        try:
            ZoneInfo(v)
        except ZoneInfoNotFoundError:
            return None  # ignore bad tz silently, we default UTC
        return v


class MobileGeofenceEvent(BaseModel):
    """A single enter/exit event from the mobile geofencing runtime.

    Idempotent via `client_event_id` — a UUID generated on the device. This lets
    us safely retry offline events without creating duplicate sessions.
    """
    client_event_id: str = Field(min_length=8, max_length=64)
    device_id: str = Field(min_length=8, max_length=128)
    type: Literal["enter", "exit", "cold_start_reconcile"]
    ts_ms: int = Field(ge=0)  # client-side UTC timestamp of the event (NOT arrival time)
    office_id: str = Field(min_length=1)
    lat: float
    lng: float
    accuracy: float = Field(ge=0, le=10_000)
    mock_location: bool = False
    from_boot: bool = False
    battery: Optional[float] = Field(default=None, ge=0, le=1)
    attestation: Optional[Dict] = None  # Play Integrity / App Attest verdict, verified server-side later


class MobileBulkSync(BaseModel):
    events: List[MobileGeofenceEvent] = Field(min_length=1, max_length=200)


class MobileHeartbeat(BaseModel):
    device_id: str = Field(min_length=8, max_length=128)
    ts_ms: int = Field(ge=0)
    battery: Optional[float] = Field(default=None, ge=0, le=1)
    permission_state: Optional[Literal["always", "when_in_use", "denied", "restricted"]] = None
    last_geofence_event_ms: Optional[int] = None


class MobileAttestation(BaseModel):
    """Play Integrity (Android) / App Attest (iOS) attestation payload (Phase 6).

    The token is minted client-side. Server verifies structure now (stub) —
    later phases can swap in real Google Play Integrity + Apple App Attest
    verification without a new endpoint. Any suspicious payload records a
    high-severity security_events row.
    """
    device_id: str = Field(min_length=8, max_length=128)
    platform: Literal["ios", "android"]
    token: str = Field(min_length=1, max_length=8192)
    nonce: str = Field(min_length=8, max_length=128)
    ts_ms: int = Field(ge=0)
    # Optional context so the server can correlate with a specific event
    # (mobile geofence event this attestation is protecting, if any).
    client_event_id: Optional[str] = Field(default=None, max_length=64)



class MobileLocationFix(BaseModel):
    """A single continuous background-location fix (WhatsApp-style live tracking).

    Streamed every ~15s by the Android/iOS foreground-service location task while
    the employee is on shift. Unlike geofence enter/exit events these arrive
    continuously, so the server decides inside/outside on every fix — this is
    what keeps a session correctly paused when the phone sleeps in a pocket and
    what makes the admin map pin move in real time.
    """
    device_id: str = Field(min_length=8, max_length=128)
    lat: float
    lng: float
    accuracy: float = Field(ge=0, le=10_000)
    ts_ms: int = Field(ge=0)
    speed: Optional[float] = None
    battery: Optional[float] = Field(default=None, ge=0, le=1)
    mock_location: bool = False
