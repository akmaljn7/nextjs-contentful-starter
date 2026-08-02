"""Pydantic models."""
from datetime import datetime, timezone
from typing import Optional, List, Literal, Dict
from pydantic import BaseModel, EmailStr, Field, ConfigDict


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


# ---------- Org Settings ----------
class OrgSettingsUpdate(BaseModel):
    session_duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    resume_window_hours: Optional[int] = Field(default=None, ge=1, le=48)
    accuracy_tolerance_meters: Optional[int] = Field(default=None, ge=5, le=500)
    max_speed_kmh: Optional[int] = Field(default=None, ge=10, le=1000)
    spoof_sensitivity: Optional[Literal["low", "medium", "high"]] = None
    notify_admin_on_spoof: Optional[bool] = None
