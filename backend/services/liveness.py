"""Passive face-liveness (anti-spoofing) via MiniFASNet ONNX.

Model: hairymax/Face-AntiSpoofing `AntiSpoofing_bin_1.5_128.onnx` — a
MiniFASNet binary classifier. Blocks presentation attacks (a printed photo or
a screen showing a colleague's face) which plain face-matching cannot detect.

Pipeline (must match the model's training distribution):
  1. Take the detected face bbox and expand it 1.5x around its centre.
  2. Crop, then letterbox-resize to 128x128 (aspect-preserving, black pad).
  3. Feed as BGR, CHW, /255.0.
  4. softmax(logits) -> index 0 = SPOOF, index 1 = REAL.

Runs on CPU via onnxruntime. All calls are CPU-bound and MUST be invoked from a
threadpool (asyncio.to_thread) so they don't block the event loop.
"""
import logging
import os
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "antispoof.onnx")
_session = None
_input_name = None
_load_failed = False


def _get_session():
    global _session, _input_name, _load_failed
    if _session is not None or _load_failed:
        return _session
    try:
        import onnxruntime as ort
        _session = ort.InferenceSession(_MODEL_PATH, providers=["CPUExecutionProvider"])
        _input_name = _session.get_inputs()[0].name
    except Exception as e:
        _load_failed = True
        logger.error("liveness_model_load_failed err=%s", e)
    return _session


def is_available() -> bool:
    return _get_session() is not None


def _crop_scaled(img: np.ndarray, loc: tuple, scale: float = 1.5) -> np.ndarray:
    """loc = (top, right, bottom, left) from face_recognition."""
    top, right, bottom, left = loc
    h, w = img.shape[:2]
    cx = (left + right) / 2.0
    cy = (top + bottom) / 2.0
    side = max(right - left, bottom - top) * scale
    x1 = max(0, int(round(cx - side / 2)))
    y1 = max(0, int(round(cy - side / 2)))
    x2 = min(w, int(round(cx + side / 2)))
    y2 = min(h, int(round(cy + side / 2)))
    if x2 <= x1 or y2 <= y1:
        return img
    return img[y1:y2, x1:x2]


def _letterbox(arr_rgb: np.ndarray, size: int = 128) -> np.ndarray:
    h, w = arr_rgb.shape[:2]
    if h == 0 or w == 0:
        return np.zeros((size, size, 3), dtype=np.uint8)
    ratio = float(size) / max(h, w)
    nh, nw = max(1, int(round(h * ratio))), max(1, int(round(w * ratio)))
    im = Image.fromarray(arr_rgb).resize((nw, nh), Image.BILINEAR)
    canvas = Image.new("RGB", (size, size), (0, 0, 0))
    canvas.paste(im, ((size - nw) // 2, (size - nh) // 2))
    return np.array(canvas)


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / np.sum(e)


def score_liveness(img_rgb: np.ndarray, loc: tuple) -> Optional[float]:
    """Return P(real) in [0,1], or None if the model is unavailable/errors."""
    sess = _get_session()
    if sess is None:
        return None
    try:
        crop = _crop_scaled(img_rgb, loc, scale=1.5)
        lb = _letterbox(crop, 128)          # RGB
        bgr = lb[:, :, ::-1]                 # model was trained on BGR
        x = np.expand_dims(bgr.transpose(2, 0, 1).astype(np.float32) / 255.0, axis=0)
        out = sess.run(None, {_input_name: x})[0]
        probs = _softmax(np.asarray(out[0], dtype=np.float64))
        return float(probs[1])               # index 1 = REAL
    except Exception as e:
        logger.error("liveness_score_error err=%s", e)
        return None
