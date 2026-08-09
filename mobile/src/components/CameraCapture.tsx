/**
 * Reusable front-camera capture surface. Requests camera permission, shows a
 * live front-facing preview, and returns a base64 JPEG data URL on capture.
 * Used by face enrollment and the "My Colleague" proxy selfie flow.
 */
import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

interface Props {
  onCapture: (dataUrl: string) => Promise<void> | void;
  busy?: boolean;
  hint?: string;
  captureLabel?: string;
  testID?: string;
  facing?: "front" | "back";
}

export function CameraCapture({ onCapture, busy, hint, captureLabel = "Capture", testID, facing = "front" }: Props) {
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView | null>(null);
  const [capturing, setCapturing] = useState(false);

  React.useEffect(() => {
    if (perm && !perm.granted) requestPerm();
  }, [perm, requestPerm]);

  const capture = useCallback(async () => {
    if (!camRef.current || capturing || busy) return;
    setCapturing(true);
    try {
      // Capture at full res WITHOUT base64, then downscale+compress so the
      // upload payload stays small (a raw full-res base64 JPEG easily exceeds
      // the ingress body limit → 413/422 "error"). 512px wide is plenty for
      // face detection/matching and keeps the base64 well under ~80 KB.
      const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: true });
      if (!photo?.uri) throw new Error("capture_failed");
      const manip = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manip.base64) throw new Error("encode_failed");
      await onCapture(`data:image/jpeg;base64,${manip.base64}`);
    } finally {
      setCapturing(false);
    }
  }, [capturing, busy, onCapture]);

  const working = capturing || busy;

  if (!perm?.granted) {
    return (
      <View style={[styles.cam, styles.permPrompt]}>
        <Ionicons name="camera" size={40} color={colors.textDim} />
        <Text style={styles.permText}>Camera access is required.</Text>
        <Pressable onPress={requestPerm} style={styles.permBtn} testID="camera-allow-btn">
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView ref={(r) => { camRef.current = r; }} style={styles.cam} facing={facing} mode="picture" />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Pressable
        testID={testID || "camera-capture-btn"}
        onPress={capture}
        disabled={working}
        style={[styles.shutter, working && { opacity: 0.5 }]}
      >
        {working ? <ActivityIndicator color="#000" /> : <Ionicons name="camera" size={26} color="#000" />}
      </Pressable>
      <Text style={styles.shutterHint}>{working ? "Verifying…" : captureLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 12 },
  cam: { width: "100%", height: 340, borderRadius: 8, overflow: "hidden", backgroundColor: "#000" },
  hint: { color: colors.textDim, fontSize: 13, textAlign: "center" },
  shutter: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: colors.green,
  },
  shutterHint: { color: colors.text, fontSize: 12, letterSpacing: 1.2, fontWeight: "600" },
  permPrompt: { alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  permText: { color: colors.text, fontSize: 15, textAlign: "center" },
  permBtn: { backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 12 },
  permBtnText: { color: "#000", fontWeight: "700", letterSpacing: 0.5 },
});
