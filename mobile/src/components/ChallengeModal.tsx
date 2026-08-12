/**
 * Selfie challenge modal — face-detected + blink-to-capture (hands-free).
 *
 * Triggered by:
 *   1. FCM push (handled in ChallengeContext)
 *   2. /sessions/me poll returning an `active_challenge`
 *   3. Native full-screen "OPEN CAMERA" deep link
 *
 * Capture itself is delegated to <LivenessCamera/>, which detects a real face
 * and a real blink on-device before grabbing the neutral + blink frames. This
 * modal handles the incoming ring, the countdown, uploading the pair to
 * /api/sessions/challenge/{id}/respond, and the missed/verified states.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { useCameraPermissions } from "expo-camera";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

import { useChallenge } from "@/context/ChallengeContext";
import { api, apiError } from "@/api/client";
import { startAlarm, stopAlarm } from "@/services/alarm";
import { LivenessCamera, LiveVerifyResult } from "@/components/LivenessCamera";
import { colors } from "@/theme";

export function ChallengeModal() {
  const { active, dismiss, markResponded, cameraRequested, consumeCameraRequest } = useChallenge();
  const [perm, requestPerm] = useCameraPermissions();
  const [countdownMs, setCountdownMs] = useState<number>(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [missed, setMissed] = useState(false);
  const [verify, setVerify] = useState<LiveVerifyResult>({ kind: "idle" });
  const timeoutFiredRef = useRef(false);

  // Jump straight to the camera when launched from the native "OPEN CAMERA" button.
  useEffect(() => {
    if (active && cameraRequested) {
      setCameraOpen(true);
      consumeCameraRequest();
      if (perm && !perm.granted) requestPerm();
    } else {
      setCameraOpen(false);
    }
  }, [active?.id, cameraRequested]);

  // Reset per-challenge state.
  useEffect(() => {
    setMissed(false);
    setVerify({ kind: "idle" });
    timeoutFiredRef.current = false;
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

  // Countdown ticker — on expiry, report the miss immediately.
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

  // Blink captured → verify against the enrolled baseline. Liveness was proven
  // on-device (real-time blink detection), so we send a single selfie frame.
  const onCapture = useCallback(async (selfieB64: string) => {
    if (!active) return;
    setVerify({ kind: "verifying" });
    try {
      await api.post(`/sessions/challenge/${active.id}/respond`, {
        face_photo: selfieB64,
        liveness_action: "blink",
        client_liveness: true,
      });
      setVerify({ kind: "verified" });
      setTimeout(() => markResponded(), 1300);
    } catch (e) {
      const msg = apiError(e);
      if (/already|missed|no active session|window expired/i.test(msg)) {
        // Terminal — nothing more to try.
        setVerify({ kind: "failed", message: msg });
        setTimeout(() => dismiss(), 2200);
      } else {
        // Recoverable (face mismatch / no blink) — re-arm so they blink again.
        setVerify({ kind: "failed", message: msg });
      }
    }
  }, [active, markResponded, dismiss]);

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
              Just look at the camera and blink — it captures automatically.
            </Text>
            <Pressable testID="challenge-open-camera" onPress={openCamera} style={styles.openBtn}>
              <Ionicons name="camera" size={18} color="#000" />
              <Text style={styles.openBtnText}>Start selfie</Text>
            </Pressable>
          </View>
        ) : (
          // Phase 2 — face-detect + blink-to-capture
          <View style={styles.cameraPhase} testID="challenge-camera">
            <View style={styles.topRow}>
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

            <LivenessCamera
              onCapture={onCapture}
              result={verify}
              headline={active.for_name ? `Selfie for ${active.for_name}` : "Live selfie check-in"}
              testID="challenge-liveness-camera"
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  cameraPhase: { flex: 1, paddingHorizontal: 20, paddingTop: 60, gap: 20 },
  topRow: { alignItems: "center", gap: 8 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  badgeText: { color: colors.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  forName: { color: colors.green, fontSize: 15, fontWeight: "700", textAlign: "center" },
  countdown: {
    color: colors.text, fontSize: 40, fontWeight: "700",
    fontVariant: ["tabular-nums"], letterSpacing: 2,
  },
  ringScreen: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16,
    backgroundColor: "#0a0a0a",
  },
  ringPulse: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: colors.red,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  ringBadge: { color: colors.red, fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  ringTitle: { color: colors.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  ringHint: { color: colors.textDim, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  openBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.green, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 999,
    marginTop: 8,
  },
  openBtnText: { color: "#000", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
});
