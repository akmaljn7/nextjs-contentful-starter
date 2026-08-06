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
import { Ionicons } from "@expo/vector-icons";

import { useChallenge } from "@/context/ChallengeContext";
import { api, apiError } from "@/api/client";
import { colors } from "@/theme";

export function ChallengeModal() {
  const { active, dismiss, markResponded } = useChallenge();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdownMs, setCountdownMs] = useState<number>(0);

  // Countdown ticker
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const remaining = Math.max(0, active.respond_by_ms - Date.now());
      setCountdownMs(remaining);
      if (remaining <= 0) dismiss();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [active, dismiss]);

  // Auto-request camera permission when modal opens
  useEffect(() => {
    if (active && perm && !perm.granted) {
      requestPerm();
    }
  }, [active, perm, requestPerm]);

  const capture = useCallback(async () => {
    if (!camRef.current || busy || !active) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({
        base64: true, quality: 0.6, skipProcessing: true,
      });
      const dataUrl = `data:image/jpeg;base64,${photo?.base64}`;
      await api.post(`/sessions/challenge/${active.id}/respond`, { face_photo: dataUrl });
      markResponded();
      Alert.alert("✅ Confirmed", "Selfie check-in accepted.");
    } catch (e) {
      Alert.alert("Couldn't verify", apiError(e));
    } finally {
      setBusy(false);
    }
  }, [busy, active, markResponded]);

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
        {perm?.granted ? (
          <CameraView
            ref={(r) => { camRef.current = r; }}
            style={styles.cam}
            facing="front"
            mode="picture"
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
              {active.manual ? "ADMIN-REQUESTED SELFIE" : "RANDOM SELFIE CHECK-IN"}
            </Text>
          </View>
          <Text style={[styles.countdown, dangerZone && { color: colors.red }]}>
            {mm}:{ss}
          </Text>
          <Text style={styles.hint}>
            Face the camera. This confirms you're at the office.
          </Text>
        </View>

        <View style={styles.overlayBottom}>
          <Pressable
            testID="challenge-capture"
            onPress={capture}
            disabled={busy || !perm?.granted}
            style={[styles.shutter, (busy || !perm?.granted) && { opacity: 0.5 }]}
          >
            {busy
              ? <ActivityIndicator color="#000" />
              : <View style={styles.shutterInner} />}
          </Pressable>
          <Text style={styles.shutterHint}>
            {busy ? "Verifying…" : "Tap to capture"}
          </Text>
        </View>
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
  countdown: {
    color: colors.text, fontSize: 44, fontWeight: "700",
    fontVariant: ["tabular-nums"], letterSpacing: 2,
  },
  hint: { color: colors.textDim, fontSize: 13, textAlign: "center", marginTop: 4 },
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
});
