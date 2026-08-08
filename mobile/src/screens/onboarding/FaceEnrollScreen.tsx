/**
 * Mandatory face enrollment — shown the first time an employee logs in after
 * an office has been assigned, before they can use the app. Captures a clear
 * front-facing photo and posts it to /api/face/enroll to store the baseline
 * embedding used for all future selfie verification (incl. proxy selfies).
 */
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { CameraCapture } from "@/components/CameraCapture";
import { useAuth } from "@/context/AuthContext";
import { api, apiError } from "@/api/client";
import { colors } from "@/theme";

export default function FaceEnrollScreen() {
  const { refresh, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const onCapture = useCallback(async (dataUrl: string) => {
    setBusy(true);
    try {
      await api.post("/face/enroll", { face_photo: dataUrl });
      Alert.alert("✅ Face enrolled", "Your identity is now set up. Welcome!");
      await refresh();
    } catch (e) {
      Alert.alert("Couldn't enroll", apiError(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="scan-circle" size={40} color={colors.green} />
          <Text style={styles.title}>Verify your identity</Text>
          <Text style={styles.sub}>
            Before you start, enroll your face. This is required once and is used to confirm
            it's really you during random selfie check-ins.
          </Text>
        </View>

        <CameraCapture
          onCapture={onCapture}
          busy={busy}
          hint="Center your face, good lighting, look straight at the camera."
          captureLabel="Enroll my face"
          testID="face-enroll-capture"
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
