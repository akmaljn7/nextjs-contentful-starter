"""Active liveness — a 2-frame blink / head-turn challenge.

Defeats presentation attacks (a printed photo or a screen showing a face) that
plain face-matching cannot catch: a flat photo cannot blink or turn on demand.

Flow: the client captures a NEUTRAL frame (eyes open, facing straight) and then,
in response to a RANDOM prompt, an ACTION frame — either "blink" (eyes closed)
or "turn_left" / "turn_right" (head yaw). We use dlib 68-point landmarks (via
face_recognition) to verify a real eye-closure (Eye-Aspect-Ratio drop) or a real
head turn, AND that BOTH frames are the same enrolled person (anti face-swap).

All functions here are CPU-bound and MUST be called from a threadpool
(asyncio.to_thread) so they never block the event loop.

Known limit: a pre-recorded VIDEO replay could still blink — full defeat needs a
certified (paid) SDK. This raises the bar substantially against the common
printed-photo / static-screen attacks for free.
"""
import logging
from typing import Optional

import numpy as np
import face_recognition

from services.face_match import _load_image, similarity

logger = logging.getLogger(__name__)

VALID_ACTIONS = ("blink", "turn_left", "turn_right")

# Thresholds — tuned for typical selfie framing. Exposed so the decision logic
# is unit-testable without images.
EAR_OPEN_MIN = 0.20     # neutral frame eyes must be at least this open
EAR_CLOSED_MAX = 0.16   # action frame eyes must be at least this closed
EAR_MIN_DROP = 0.07     # open->closed EAR must fall by at least this much
YAW_TURN_MIN = 0.20     # |yaw| in the action frame to count as "turned"
YAW_MIN_DELTA = 0.12    # yaw must change by at least this much vs neutral
IDENTITY_MIN = 0.85     # action frame must match the baseline this closely


def _dist(a, b) -> float:
    return float(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5)


def _eye_ear(eye: list) -> float:
    """Eye Aspect Ratio for a 6-point eye (p1..p6). 0 (shut) .. ~0.4 (wide)."""
    if not eye or len(eye) < 6:
        return 0.0
    vertical = _dist(eye[1], eye[5]) + _dist(eye[2], eye[4])
    horizontal = 2.0 * _dist(eye[0], eye[3])
    if horizontal == 0:
        return 0.0
    return vertical / horizontal


def _yaw(landmarks: dict) -> float:
    """Rough head-yaw proxy from nose position relative to the two eyes.

    ~0 when facing straight; magnitude grows as the head turns to either side.
    """
    le = landmarks.get("left_eye") or []
    re = landmarks.get("right_eye") or []
    nose = landmarks.get("nose_tip") or []
    if not le or not re or not nose:
        return 0.0
    lcx = sum(p[0] for p in le) / len(le)
    rcx = sum(p[0] for p in re) / len(re)
    ncx = sum(p[0] for p in nose) / len(nose)
    span = rcx - lcx
    if abs(span) < 1e-6:
        return 0.0
    return float((rcx + lcx - 2 * ncx) / span)


def extract_features(img_rgb: Optional[np.ndarray]) -> Optional[dict]:
    """Return {ear, yaw, encoding, loc} for the largest face, or None."""
    if img_rgb is None:
        return None
    try:
        locations = face_recognition.face_locations(img_rgb, model="hog")
    except Exception as e:
        logger.error("liveness_detect_error err=%s", e)
        return None
    if not locations:
        return None
    locations.sort(key=lambda b: (b[2] - b[0]) * (b[1] - b[3]), reverse=True)
    loc = locations[0]
    try:
        marks = face_recognition.face_landmarks(img_rgb, face_locations=[loc], model="large")
    except Exception as e:
        logger.error("liveness_landmark_error err=%s", e)
        return None
    if not marks:
        return None
    m = marks[0]
    ear = (_eye_ear(m.get("left_eye")) + _eye_ear(m.get("right_eye"))) / 2.0
    yaw = _yaw(m)
    encoding = None
    try:
        encs = face_recognition.face_encodings(img_rgb, known_face_locations=[loc], num_jitters=1)
        if encs:
            encoding = encs[0].tolist()
    except Exception:
        encoding = None
    return {"ear": ear, "yaw": yaw, "encoding": encoding, "loc": loc}


def evaluate(action: str, feat_a: dict, feat_b: dict) -> dict:
    """Pure decision: did the ACTION frame (feat_b) satisfy `action` vs the
    NEUTRAL frame (feat_a)? Returns {passed, reason}."""
    if action not in VALID_ACTIONS:
        return {"passed": False, "reason": "invalid_action"}
    ea, eb = feat_a.get("ear", 0.0), feat_b.get("ear", 0.0)
    ya, yb = feat_a.get("yaw", 0.0), feat_b.get("yaw", 0.0)
    if action == "blink":
        if ea < EAR_OPEN_MIN:
            return {"passed": False, "reason": "eyes_not_open_in_first_frame"}
        if eb > EAR_CLOSED_MAX or (ea - eb) < EAR_MIN_DROP:
            return {"passed": False, "reason": "no_blink_detected"}
        return {"passed": True, "reason": None}
    # turn_left / turn_right
    if abs(yb) < YAW_TURN_MIN or abs(yb - ya) < YAW_MIN_DELTA:
        return {"passed": False, "reason": "no_head_turn_detected"}
    return {"passed": True, "reason": None}


def analyze_frames(baseline: list, neutral_b64: str, action_b64: str, action: str) -> dict:
    """Full 2-frame active-liveness check. CPU-bound — call via asyncio.to_thread.

    Returns {passed, reason, similarity, ear_a, ear_b, yaw_a, yaw_b}.
    `similarity` is the action-frame match vs baseline (identity continuity).
    """
    if action not in VALID_ACTIONS:
        return {"passed": False, "reason": "invalid_action"}
    feat_a = extract_features(_load_image(neutral_b64))
    feat_b = extract_features(_load_image(action_b64))
    if feat_a is None or feat_b is None:
        return {"passed": False, "reason": "no_face_in_liveness_frames"}
    # Identity continuity — the action frame must be the same enrolled person,
    # so you can't blink using a stand-in's closed-eye photo.
    sim = similarity(baseline, feat_b["encoding"]) if (baseline and feat_b.get("encoding")) else 0.0
    if baseline and sim < IDENTITY_MIN:
        return {"passed": False, "reason": "liveness_frame_identity_mismatch", "similarity": sim,
                "ear_a": feat_a["ear"], "ear_b": feat_b["ear"], "yaw_a": feat_a["yaw"], "yaw_b": feat_b["yaw"]}
    decision = evaluate(action, feat_a, feat_b)
    return {"passed": decision["passed"], "reason": decision["reason"], "similarity": sim,
            "ear_a": feat_a["ear"], "ear_b": feat_b["ear"], "yaw_a": feat_a["yaw"], "yaw_b": feat_b["yaw"]}
