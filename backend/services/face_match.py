"""Face embedding + match — server-side, dlib-based (via face_recognition)."""
import base64
import binascii
import io
import logging
from typing import Optional
import numpy as np
from PIL import Image
import face_recognition

logger = logging.getLogger(__name__)


def _strip_data_url(s: str) -> str:
    if s.startswith("data:"):
        try:
            _, body = s.split(",", 1)
            return body
        except ValueError:
            return s
    return s


def _load_image(data_url_or_b64: str) -> Optional[np.ndarray]:
    """Decode a JPEG data URL/base64 into an RGB numpy array."""
    body = _strip_data_url(data_url_or_b64)
    try:
        raw = base64.b64decode(body, validate=True)
    except (binascii.Error, ValueError):
        return None
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        return np.array(img)
    except Exception as e:
        logger.warning(f"image decode failed: {e}")
        return None


def extract_embedding(data_url_or_b64: str) -> Optional[list[float]]:
    """Return a 128-D face embedding for the largest face in the image, or None."""
    img = _load_image(data_url_or_b64)
    if img is None:
        return None
    try:
        locations = face_recognition.face_locations(img, model="hog")
        if not locations:
            return None
        # pick the largest face
        locations.sort(key=lambda box: (box[2] - box[0]) * (box[1] - box[3]), reverse=True)
        encodings = face_recognition.face_encodings(img, known_face_locations=[locations[0]], num_jitters=1)
        if not encodings:
            return None
        return encodings[0].tolist()
    except Exception as e:
        logger.error(f"embedding extraction failed: {e}")
        return None


def similarity(a: list[float], b: list[float]) -> float:
    """Return cosine similarity in [-1, 1] (higher = more similar)."""
    va = np.array(a, dtype=np.float64)
    vb = np.array(b, dtype=np.float64)
    na = np.linalg.norm(va); nb = np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def verify(baseline: list[float], challenge_photo_b64: str, threshold: float = 0.93) -> dict:
    """Return {match: bool, similarity: float, reason?: str}.

    face_recognition embeddings are already L2-normalized-ish; a cosine of 0.90
    corresponds roughly to a euclidean distance of ~0.45 — moderately strict
    but tolerant of typical selfie variation (lighting, angle, glasses).
    """
    emb = extract_embedding(challenge_photo_b64)
    if emb is None:
        return {"match": False, "similarity": 0.0, "reason": "no_face_detected"}
    sim = similarity(baseline, emb)
    return {"match": sim >= threshold, "similarity": sim}


def analyze(baseline: list[float], photo_b64: str, threshold: float = 0.93) -> dict:
    """One-pass selfie analysis: face-match + passive liveness (single face
    detection). CPU-bound — call via asyncio.to_thread.

    Returns:
      {ok, match, similarity, live_prob (0..1 or None), reason?}
    """
    img = _load_image(photo_b64)
    if img is None:
        return {"ok": False, "match": False, "similarity": 0.0, "live_prob": None, "reason": "invalid_photo"}
    try:
        locations = face_recognition.face_locations(img, model="hog")
    except Exception as e:
        logger.error(f"face detection failed: {e}")
        return {"ok": False, "match": False, "similarity": 0.0, "live_prob": None, "reason": "detect_error"}
    if not locations:
        return {"ok": True, "match": False, "similarity": 0.0, "live_prob": None, "reason": "no_face_detected"}
    locations.sort(key=lambda box: (box[2] - box[0]) * (box[1] - box[3]), reverse=True)
    loc = locations[0]
    try:
        encodings = face_recognition.face_encodings(img, known_face_locations=[loc], num_jitters=1)
    except Exception as e:
        logger.error(f"encoding failed: {e}")
        encodings = []
    sim = similarity(baseline, encodings[0].tolist()) if encodings else 0.0
    from services.liveness import score_liveness
    live_prob = score_liveness(img, loc)
    return {"ok": True, "match": sim >= threshold, "similarity": sim,
            "live_prob": live_prob, "reason": None if encodings else "no_encoding"}
