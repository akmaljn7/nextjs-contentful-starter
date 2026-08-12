/**
 * Mandatory face enrollment — shown the first time an employee logs in after
 * an office has been assigned, before they can use the app. Uses the SAME
 * face-detect + blink-to-capture flow as the selfie challenge (LivenessCamera),
 * so a live face is proven at enrollment too. The eyes-open (neutral) frame is
 * posted to /api/face/enroll to store the baseline embedding used for all
 * future selfie verification.
 */
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { LivenessCamera, LiveVerifyResult } from "@/components/LivenessCamera";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/api/client";
import { colors } from "@/theme";

export default function FaceEnrollScreen() {
  const { refresh, signOut } = useAuth();
  const [verify, setVerify] = useState<LiveVerifyResult>({ kind: "idle" });

  const onCapture = useCallback(async (selfieB64: string) => {
    setVerify({ kind: "verifying" });
    try {
      // Blink already proved liveness on-device; store the clean eyes-open frame.
      await api.post("/face/enroll", { face_photo: selfieB64 });
      setVerify({ kind: "verified" });
      setTimeout(() => { refresh(); }, 1200);
    } catch (e) {
      setVerify({ kind: "failed", message: apiError(e) });
    }
  }, [refresh]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="scan-circle" size={40} color={colors.green} />
          <Text style={styles.title}>Verify your identity</Text>
          <Text style={styles.sub}>
            Enroll your face once. Look at the camera and blink — it captures automatically and
            is used to confirm it's really you during random selfie check-ins.
          </Text>
        </View>

        <LivenessCamera
          onCapture={onCapture}
          result={verify}
          headline="Face enrollment"
          testID="face-enroll-liveness-camera"
        />

        <Text style={styles.footer}>
          Tip: remove glasses/hats and avoid strong backlight for a clean baseline.
        </Text>
        <Text style={styles.signout} onPress={signOut} testID="face-enroll-signout">
          Sign out
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  header: { alignItems: "center", gap: 8, marginTop: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 },
  footer: { color: colors.textMute, fontSize: 12, textAlign: "center" },
  signout: { color: colors.textDim, fontSize: 13, textAlign: "center", marginTop: 8, textDecorationLine: "underline" },
});
