/**
 * Selfie challenge modal — automatic blink capture (no shutter button).
 *
 * Triggered by:
 *   1. FCM push (handled in ChallengeContext)
 *   2. /sessions/me poll returning an `active_challenge`
 *   3. Native full-screen "OPEN CAMERA" deep link
 *
 * Once the camera opens the flow is fully hands-free:
 *   1. A short "position your face" settle window.
 *   2. Auto-captures a NEUTRAL frame (eyes open).
 *   3. Prompts the employee to gently close their eyes and auto-captures the
 *      BLINK frame while their eyes are shut.
 *   4. Uploads both to /api/sessions/challenge/{id}/respond, where server-side
 *      dlib confirms the eye-closure (liveness) and matches the enrolled face.
 * If a frame fails to verify, it retries automatically (server allows 5 tries).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

import { useChallenge } from "@/context/ChallengeContext";
import { api, apiError } from "@/api/client";
import { startAlarm, stopAlarm } from "@/services/alarm";
import { colors } from "@/theme";

const MAX_CLIENT_ATTEMPTS = 5;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type AutoPhase = "idle" | "settle" | "neutral" | "blink" | "uploading" | "retry";

export function ChallengeModal() {
  const { active, dismiss, markResponded, cameraRequested, consumeCameraRequest } = useChallenge();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView | null>(null);
  const [countdownMs, setCountdownMs] = useState<number>(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [autoPhase, setAutoPhase] = useState<AutoPhase>("idle");
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const [attemptNo, setAttemptNo] = useState(1);
  const [missed, setMissed] = useState(false);
  const timeoutFiredRef = useRef(false);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);

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
    setCamReady(false);
  }, [active?.id, cameraRequested]);

  // Reset the auto-capture state whenever a new challenge arrives.
  useEffect(() => {
    cancelledRef.current = false;
    runningRef.current = false;
    setAutoPhase("idle");
    setRetryNote(null);
    setAttemptNo(1);
    setMissed(false);
    timeoutFiredRef.current = false;
    return () => { cancelledRef.current = true; };
  }, [active?.id]);

  // Loud alarm rings from the moment the request appears until the camera opens.
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
  // it's marked MISSED immediately, then show a brief "missed" screen.
  useEffect(() => {
    if (!active) return;
    const onExpire = async () => {
      if (timeoutFiredRef.current) return;
      timeoutFiredRef.current = true;
      cancelledRef.current = true;
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

  // Hands-free capture sequence — runs once the camera surface is ready.
  const runAuto = useCallback(async () => {
    if (runningRef.current || !active) return;
    runningRef.current = true;
    stopAlarm();
    try {
      for (let attempt = 1; attempt <= MAX_CLIENT_ATTEMPTS; attempt++) {
        if (cancelledRef.current) break;
        setAttemptNo(attempt);
        setRetryNote(null);

        // 1) settle — let the employee frame their face
        setAutoPhase("settle");
        await wait(1300);
        if (cancelledRef.current) break;

        // 2) neutral frame (eyes open)
        setAutoPhase("neutral");
        await wait(250);
        let neutral: string;
        try {
          neutral = await takeCompressed();
        } catch {
          setRetryNote("Camera wasn't ready — trying again.");
          setAutoPhase("retry");
          await wait(1200);
          continue;
        }
        if (cancelledRef.current) break;

        // 3) blink frame — ask them to close their eyes and hold briefly
        setAutoPhase("blink");
        await wait(1900);
        if (cancelledRef.current) break;
        let blink: string;
        try {
          blink = await takeCompressed();
        } catch {
          setRetryNote("Camera wasn't ready — trying again.");
          setAutoPhase("retry");
          await wait(1200);
          continue;
        }
        if (cancelledRef.current) break;

        // 4) upload — server confirms the eye-closure + face match
        setAutoPhase("uploading");
        try {
          await api.post(`/sessions/challenge/${active.id}/respond`, {
            face_photo: neutral,
            liveness_frame: blink,
            liveness_action: "blink",
          });
          if (!cancelledRef.current) markResponded();
          return;
        } catch (e) {
          const msg = apiError(e);
          // Terminal states — stop retrying and let the countdown/miss flow take over.
          if (/already|missed|no active session|window expired/i.test(msg)) {
            setRetryNote(msg);
            setAutoPhase("retry");
            return;
          }
          setRetryNote(msg);
          setAutoPhase("retry");
          await wait(1700);
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [active, takeCompressed, markResponded]);

  // Kick off the sequence as soon as the camera is open + ready + permitted.
  useEffect(() => {
    if (cameraOpen && camReady && perm?.granted && active && !missed && autoPhase === "idle") {
      runAuto();
    }
  }, [cameraOpen, camReady, perm?.granted, active?.id, missed, autoPhase, runAuto]);

  if (!active) return null;

  const mm = Math.floor(countdownMs / 60000);
  const ss = Math.floor((countdownMs % 60000) / 1000).toString().padStart(2, "0");
  const dangerZone = countdownMs < 60_000;

  const statusText =
    autoPhase === "settle" ? "Position your face in the frame…"
    : autoPhase === "neutral" ? "Hold still — capturing…"
    : autoPhase === "blink" ? "Now gently CLOSE your eyes and hold"
    : autoPhase === "uploading" ? "Verifying your face…"
    : autoPhase === "retry" ? (retryNote || "Let's try that again…")
    : "Getting ready…";

  const isBusy = autoPhase === "uploading";

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => { /* not dismissible by back-button */ }}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {missed ? (
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
              Just look at the camera and blink when asked — it captures automatically.
            </Text>
            <Pressable testID="challenge-open-camera" onPress={openCamera} style={styles.openBtn}>
              <Ionicons name="camera" size={18} color="#000" />
              <Text style={styles.openBtnText}>Start selfie</Text>
            </Pressable>
          </View>
        ) : (
          // Phase 2 — camera (automatic capture)
          <>
            {perm?.granted ? (
              <CameraView
                ref={(r) => { camRef.current = r; }}
                style={styles.cam}
                facing="front"
                mode="picture"
                onCameraReady={() => setCamReady(true)}
              />
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
                  {active.manual ? "ADMIN-REQUESTED SELFIE" : "AUTOMATIC SELFIE CHECK-IN"}
                </Text>
              </View>
              {active.for_name ? (
                <Text style={styles.forName}>This selfie is for {active.for_name}</Text>
              ) : null}
              <Text style={[styles.countdown, dangerZone && { color: colors.red }]}>{mm}:{ss}</Text>
            </View>

            {/* Big hands-free instruction — the eye is the star during the blink step */}
            <View style={styles.overlayBottom} testID="challenge-auto-status">
              {autoPhase === "blink" ? (
                <View style={[styles.autoIcon, { borderColor: colors.green }]}>
                  <Ionicons name="eye-off" size={40} color={colors.green} />
                </View>
              ) : isBusy ? (
                <ActivityIndicator color={colors.green} size="large" />
              ) : (
                <View style={[styles.autoIcon, { borderColor: colors.text }]}>
                  <Ionicons name="scan" size={36} color={colors.text} />
                </View>
              )}
              <Text style={[styles.autoStatus, autoPhase === "blink" && { color: colors.green }]}>
                {statusText}
              </Text>
              <Text style={styles.autoSub}>
                {camReady ? `Hands-free · attempt ${attemptNo} of ${MAX_CLIENT_ATTEMPTS}` : "Starting camera…"}
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
  overlayBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 48, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", gap: 12,
  },
  autoIcon: {
    width: 82, height: 82, borderRadius: 41, borderWidth: 3,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)",
  },
  autoStatus: {
    color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center", letterSpacing: 0.3,
  },
  autoSub: {
    color: colors.textDim, fontSize: 12, letterSpacing: 1, fontWeight: "600",
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
