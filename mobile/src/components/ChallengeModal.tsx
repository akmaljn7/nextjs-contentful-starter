/**
 * Selfie challenge modal — Phase 3.
 *
 * Triggered by:
 *   1. FCM push (handled in ChallengeContext)
 *   2. /sessions/me poll returning an `active_challenge`
 *
 * Shows a full-screen camera view, front-facing, with a countdown to
 * `respond_by_ms`. On capture, uploads the base64 photo to
 * /api/sessions/challenge/{id}/respond where server-side dlib verifies
 * against the enrolled face baseline.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

import { useChallenge } from "@/context/ChallengeContext";
import { api, apiError } from "@/api/client";
import { startAlarm, stopAlarm } from "@/services/alarm";
import { colors } from "@/theme";

export function ChallengeModal() {
  const { active, dismiss, markResponded, cameraRequested, consumeCameraRequest } = useChallenge();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdownMs, setCountdownMs] = useState<number>(0);
  // Two-phase: first an "incoming" ring screen (alarm loud), then the camera.
  const [cameraOpen, setCameraOpen] = useState(false);
  // Active-liveness 2-step capture: "neutral" (eyes open, facing straight)
  // then "action" (blink / turn as prompted).
  const [step, setStep] = useState<"neutral" | "action">("neutral");
  const neutralRef = useRef<string | null>(null);
  const [missed, setMissed] = useState(false);
  const timeoutFiredRef = useRef(false);

  const livenessAction = active?.liveness_action || "blink";
  const actionLabel =
    livenessAction === "turn_left" ? "Turn your head to the LEFT"
    : livenessAction === "turn_right" ? "Turn your head to the RIGHT"
    : "Slowly BLINK (close your eyes)";

  // Reset to the ring phase whenever a new challenge arrives — UNLESS we were
  // launched straight from the native full-screen "OPEN CAMERA" button, in
  // which case jump directly to the camera (the native screen already rang).
  useEffect(() => {
    if (active && cameraRequested) {
      setCameraOpen(true);
      consumeCameraRequest();
      if (perm && !perm.granted) requestPerm();
    } else {
      setCameraOpen(false);
    }
  }, [active?.id, cameraRequested]);

  // Reset the 2-step capture state whenever a new challenge arrives.
  useEffect(() => {
    setStep("neutral");
    neutralRef.current = null;
    setMissed(false);
    timeoutFiredRef.current = false;
  }, [active?.id]);

  // Loud alarm (looping tone + repeating vibration) rings from the moment the
  // request appears until the user opens the camera — so a busy/sleeping user
  // notices. It STOPS as soon as the camera window opens.
  useEffect(() => {
    if (active && !cameraOpen) {
      startAlarm();
      return () => { stopAlarm(); };
    }
  }, [active?.id, cameraOpen]);

  const openCamera = useCallback(async () => {
    stopAlarm();
    await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    if (perm && !perm.granted) await requestPerm();
    setCameraOpen(true);
  }, [perm, requestPerm]);

  // Countdown ticker — on expiry, tell the server the selfie was ignored so
  // it's marked MISSED immediately (don't wait for the next server tick), then
  // show a brief "missed" screen and auto-dismiss.
  useEffect(() => {
    if (!active) return;
    const onExpire = async () => {
      if (timeoutFiredRef.current) return;
      timeoutFiredRef.current = true;
      stopAlarm();
      setMissed(true);
      try { await api.post(`/sessions/challenge/${active.id}/timeout`); } catch { /* server tick will still expire it */ }
      setTimeout(() => dismiss(), 2500);
    };
    const tick = () => {
      const remaining = Math.max(0, active.respond_by_ms - Date.now());
      setCountdownMs(remaining);
      if (remaining <= 0) onExpire();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [active, dismiss]);

  // Camera permission is requested when the user taps "Open camera" (openCamera).

  const takeCompressed = useCallback(async (): Promise<string> => {
    if (!camRef.current) throw new Error("camera_not_ready");
    const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: true });
    if (!photo?.uri) throw new Error("capture_failed");
    const manip = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 512 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!manip.base64) throw new Error("encode_failed");
    return `data:image/jpeg;base64,${manip.base64}`;
  }, []);

  const capture = useCallback(async () => {
    if (!camRef.current || busy || !active) return;
    setBusy(true);
    try {
      // Step 1 — neutral frame (eyes open, facing straight). Store and advance
      // to the action step; the alarm keeps quiet from here.
      if (step === "neutral") {
        stopAlarm();
        neutralRef.current = await takeCompressed();
        setStep("action");
        setBusy(false);
        return;
      }
      // Step 2 — action frame (blink / turn). Upload both frames for the
      // server-side active-liveness + face-match check.
      const actionFrame = await takeCompressed();
      await api.post(`/sessions/challenge/${active.id}/respond`, {
        face_photo: neutralRef.current,
        liveness_frame: actionFrame,
        liveness_action: livenessAction,
      });
      markResponded();
      Alert.alert("✅ Confirmed", "Selfie check-in accepted.");
    } catch (e) {
      // A failed match/liveness attempt returns 403 — let the user retake from
      // the neutral step (the server keeps the challenge open up to 5 tries).
      neutralRef.current = null;
      setStep("neutral");
      Alert.alert("Couldn't verify", apiError(e));
    } finally {
      setBusy(false);
    }
  }, [busy, active, step, takeCompressed, livenessAction, markResponded]);

  if (!active) return null;

  const mm = Math.floor(countdownMs / 60000);
  const ss = Math.floor((countdownMs % 60000) / 1000).toString().padStart(2, "0");
  const dangerZone = countdownMs < 60_000;

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => { /* not dismissible by back-button */ }}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {missed ? (
          // Auto-timeout — selfie went unanswered; reported to admin.
          <View style={styles.ringScreen} testID="challenge-missed">
            <View style={[styles.ringPulse, { backgroundColor: colors.red }]}>
              <Ionicons name="close" size={54} color="#fff" />
            </View>
            <Text style={styles.ringBadge}>SELFIE MISSED</Text>
            <Text style={styles.ringTitle}>Time's up</Text>
            <Text style={styles.ringHint}>
              You didn't complete the selfie in time. This has been reported to your admin.
            </Text>
          </View>
        ) : !cameraOpen ? (
          // Phase 1 — incoming selfie request (alarm ringing)
          <View style={styles.ringScreen}>
            <View style={styles.ringPulse}>
              <Ionicons name="camera" size={54} color="#fff" />
            </View>
            <Text style={styles.ringBadge}>
              {active.manual ? "ADMIN-REQUESTED SELFIE" : "SELFIE CHECK-IN"}
            </Text>
            <Text style={styles.ringTitle}>
              {active.for_name ? `Selfie for ${active.for_name}` : "Selfie check-in required"}
            </Text>
            <Text style={[styles.countdown, dangerZone && { color: colors.red }]}>{mm}:{ss}</Text>
            <Text style={styles.ringHint}>
              {active.for_name
                ? `${active.for_name} must take a live selfie to confirm they're at the office.`
                : "Take a live selfie to confirm you're at the office."}
            </Text>
            <Pressable testID="challenge-open-camera" onPress={openCamera} style={styles.openBtn}>
              <Ionicons name="camera" size={18} color="#000" />
              <Text style={styles.openBtnText}>Open camera</Text>
            </Pressable>
          </View>
        ) : (
          // Phase 2 — camera (alarm stopped)
          <>
            {perm?.granted ? (
              <CameraView ref={(r) => { camRef.current = r; }} style={styles.cam} facing="front" mode="picture" />
            ) : (
              <View style={[styles.cam, styles.permPrompt]}>
                <Ionicons name="camera" size={44} color={colors.textDim} />
                <Text style={styles.permText}>Camera access required for selfie check-in.</Text>
                <Pressable onPress={requestPerm} style={styles.permBtn}>
                  <Text style={styles.permBtnText}>Allow camera</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.overlayTop}>
              <View style={styles.badgeRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.badgeText}>
                  {active.manual ? "ADMIN-REQUESTED SELFIE" : "RANDOM SELFIE CHECK-IN"}
                </Text>
              </View>
              {active.for_name ? (
                <Text style={styles.forName}>This selfie is for {active.for_name}</Text>
              ) : null}
              <Text style={[styles.countdown, dangerZone && { color: colors.red }]}>{mm}:{ss}</Text>
              <View style={styles.stepChip}>
                <Text style={styles.stepChipText}>STEP {step === "neutral" ? "1" : "2"} OF 2 · LIVENESS</Text>
              </View>
              <Text style={styles.hint}>
                {step === "neutral"
                  ? "Look straight at the camera with your eyes open, then capture."
                  : `Now ${actionLabel.toLowerCase()} while facing the camera, then capture.`}
              </Text>
            </View>

            <View style={styles.overlayBottom}>
              <Pressable
                testID="challenge-capture"
                onPress={capture}
                disabled={busy || !perm?.granted}
                style={[styles.shutter, (busy || !perm?.granted) && { opacity: 0.5 }]}
              >
                {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
              </Pressable>
              <Text style={styles.shutterHint}>
                {busy ? "Verifying…" : step === "neutral" ? "Capture · look straight" : `Capture · ${actionLabel}`}
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  cam: { flex: 1 },
  permPrompt: { alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  permText: { color: colors.text, fontSize: 15, textAlign: "center", lineHeight: 22 },
  permBtn: {
    backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 12, marginTop: 12,
  },
  permBtnText: { color: "#000", fontWeight: "700", letterSpacing: 0.5 },
  overlayTop: {
    position: "absolute", top: 0, left: 0, right: 0,
    padding: 24, paddingTop: 60, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", gap: 8,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pulseDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red,
  },
  badgeText: {
    color: colors.text, fontSize: 10, letterSpacing: 2, fontWeight: "700",
  },
  forName: {
    color: colors.green, fontSize: 15, fontWeight: "700", textAlign: "center",
  },
  countdown: {
    color: colors.text, fontSize: 44, fontWeight: "700",
    fontVariant: ["tabular-nums"], letterSpacing: 2,
  },
  hint: { color: colors.textDim, fontSize: 13, textAlign: "center", marginTop: 4 },
  stepChip: {
    marginTop: 6, backgroundColor: colors.green, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
  },
  stepChipText: { color: "#000", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  overlayBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 48, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", gap: 12,
  },
  shutter: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    borderWidth: 4, borderColor: colors.green,
  },
  shutterInner: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#fff",
  },
  shutterHint: {
    color: colors.text, fontSize: 12, letterSpacing: 1.5, fontWeight: "600",
  },
  ringScreen: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16,
    backgroundColor: "#0a0a0a",
  },
  ringPulse: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: colors.red,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  ringBadge: {
    color: colors.red, fontSize: 11, letterSpacing: 2, fontWeight: "800",
  },
  ringTitle: {
    color: colors.text, fontSize: 22, fontWeight: "800", textAlign: "center",
  },
  ringHint: {
    color: colors.textDim, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8,
  },
  openBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.green, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 999,
    marginTop: 8,
  },
  openBtnText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
});
