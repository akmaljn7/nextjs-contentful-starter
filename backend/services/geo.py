"""Geospatial helpers + anti-spoof engine."""
import math
from typing import Optional


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance between two GPS coordinates in meters."""
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def is_inside(lat: float, lng: float, center_lat: float, center_lng: float, radius_m: float) -> bool:
    return haversine_meters(lat, lng, center_lat, center_lng) <= radius_m


def analyze_ping(
    lat: float,
    lng: float,
    accuracy: float,
    prev_lat: Optional[float],
    prev_lng: Optional[float],
    prev_ts_ms: Optional[int],
    now_ts_ms: int,
    accuracy_tolerance: float,
    max_speed_kmh: float,
) -> dict:
    """Return {flags: [...], reason: str|None, speed_kmh: float|None}."""
    flags = []
    reason = None
    speed_kmh = None

    if accuracy > accuracy_tolerance:
        flags.append("low_accuracy")
        reason = f"accuracy {accuracy:.0f}m > tolerance {accuracy_tolerance:.0f}m"

    if prev_lat is not None and prev_lng is not None and prev_ts_ms is not None:
        dt_s = max(0.001, (now_ts_ms - prev_ts_ms) / 1000.0)
        dist_m = haversine_meters(prev_lat, prev_lng, lat, lng)
        speed_kmh = (dist_m / dt_s) * 3.6
        if speed_kmh > max_speed_kmh:
            flags.append("impossible_speed")
            reason = f"speed {speed_kmh:.1f} km/h > max {max_speed_kmh:.0f} km/h"

    return {"flags": flags, "reason": reason, "speed_kmh": speed_kmh}
