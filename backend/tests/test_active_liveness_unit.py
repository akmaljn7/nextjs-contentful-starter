"""Unit tests for the active-liveness decision logic (no images/network).

Covers the pure `evaluate()` blink/turn thresholds and the EAR helper.
"""
from services.active_liveness import (
    evaluate, _eye_ear, EAR_OPEN_MIN, EAR_CLOSED_MAX, EAR_MIN_DROP,
    YAW_TURN_MIN, YAW_MIN_DELTA,
)


def _feat(ear=0.30, yaw=0.0):
    return {"ear": ear, "yaw": yaw}


def test_blink_pass():
    r = evaluate("blink", _feat(ear=0.30), _feat(ear=0.08))
    assert r["passed"] is True


def test_blink_fail_no_closure():
    r = evaluate("blink", _feat(ear=0.30), _feat(ear=0.29))
    assert r["passed"] is False and r["reason"] == "no_blink_detected"


def test_blink_fail_eyes_not_open_first_frame():
    r = evaluate("blink", _feat(ear=0.10), _feat(ear=0.05))
    assert r["passed"] is False and r["reason"] == "eyes_not_open_in_first_frame"


def test_blink_fail_same_frame_no_drop():
    # A printed photo used for both frames -> identical EAR -> no drop.
    r = evaluate("blink", _feat(ear=0.28), _feat(ear=0.28))
    assert r["passed"] is False


def test_turn_left_pass():
    r = evaluate("turn_left", _feat(yaw=0.0), _feat(yaw=YAW_TURN_MIN + 0.1))
    assert r["passed"] is True


def test_turn_right_pass_negative_yaw():
    r = evaluate("turn_right", _feat(yaw=0.02), _feat(yaw=-(YAW_TURN_MIN + 0.1)))
    assert r["passed"] is True


def test_turn_fail_no_movement():
    r = evaluate("turn_left", _feat(yaw=0.0), _feat(yaw=0.03))
    assert r["passed"] is False and r["reason"] == "no_head_turn_detected"


def test_invalid_action():
    r = evaluate("wink", _feat(), _feat())
    assert r["passed"] is False and r["reason"] == "invalid_action"


def test_ear_math_open_vs_closed():
    # Open eye: tall (vertical spread), Closed eye: flat.
    open_eye = [(0, 0), (2, -3), (4, -3), (6, 0), (4, 3), (2, 3)]
    closed_eye = [(0, 0), (2, -0.2), (4, -0.2), (6, 0), (4, 0.2), (2, 0.2)]
    assert _eye_ear(open_eye) > EAR_OPEN_MIN
    assert _eye_ear(closed_eye) < EAR_CLOSED_MAX


def test_thresholds_sane():
    assert EAR_OPEN_MIN > EAR_CLOSED_MAX
    assert 0 < EAR_MIN_DROP < 1
    assert YAW_TURN_MIN > 0 and YAW_MIN_DELTA > 0
