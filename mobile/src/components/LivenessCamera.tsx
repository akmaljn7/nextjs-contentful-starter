/**
 * LivenessCamera — real-time face + blink detection (no shutter spam, no Skia).
 *
 * Uses react-native-vision-camera with a REGULAR frame processor (NOT the Skia
 * wrapper — that one lazily requires @shopify/react-native-skia and crashes when
 * it isn't installed). Face detection runs on the frame stream via
 * useFaceDetector().detectFaces(frame); results are marshalled back to JS with
 * Worklets.createRunOnJS. Detection is throttled to ~5fps with runAtTargetFps.
 *
 * Flow: Face not detected → Face detected ✓ → Blink to capture → (blink!) →
 * one silent takePhoto → parent verifies (Verifying → Verified / Face didn't match).
 * Shared by the selfie challenge, first-time enrollment, and re-enrollment.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  runAtTargetFps,
} from "react-native-vision-camera";
import { useFaceDetector, FaceDetectionOptions, Face } from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

export type LiveVerifyResult =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "verified" }
  | { kind: "failed"; message?: string };

interface Props {
  onCapture: (selfieB64: string) => void;
  result: LiveVerifyResult;
  headline?: string;
  testID?: string;
}

type UiPhase = "searching" | "blink" | "closing" | "captured";

const EYE_OPEN = 0.6;
const EYE_CLOSED = 0.3;

export function LivenessCamera({ onCapture, result, headline, testID }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");
  const camRef = useRef<Camera>(null);

  const faceDetectionOptions = useMemo<FaceDetectionOptions>(() => ({
    performanceMode: "fast",
    classificationMode: "all", // eye-open probabilities for blink detection
    landmarkMode: "none",
    contourMode: "none",
    trackingEnabled: false,
  }), []);
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  const [uiPhase, setUiPhase] = useState<UiPhase>("searching");

  const sawOpenRef = useRef(false);
  const sawClosedRef = useRef(false);
  const capturingRef = useRef(false);
  const mountedRef = useRef(true);
  const resultRef = useRef(result);
  resultRef.current = result;

  useEffect(() => { if (!hasPermission) requestPermission(); }, [hasPermission, requestPermission]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (result.kind === "failed" || result.kind === "idle") {
      sawOpenRef.current = false;
      sawClosedRef.current = false;
      capturingRef.current = false;
      if (mountedRef.current) setUiPhase("searching");
    }
  }, [result.kind]);

  const setPhase = useCallback((p: UiPhase) => {
    if (mountedRef.current) setUiPhase((prev) => (prev === p ? prev : p));
  }, []);

  const doCapture = useCallback(async () => {
    try {
      const cam = camRef.current;
      if (!cam) { capturingRef.current = false; return; }
      const photo = await cam.takePhoto({ enableShutterSound: false, flash: "off" });
      const path: string = (photo as any).path;
      const uri = path.startsWith("file") ? path : `file://${path}`;
      const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (manip.base64 && mountedRef.current) onCapture(`data:image/jpeg;base64,${manip.base64}`);
      else capturingRef.current = false;
    } catch {
      capturingRef.current = false;
    }
  }, [onCapture]);

  // Runs on the JS thread with each frame's detected faces.
  const handleFaces = useCallback((faces: Face[]) => {
    const r = resultRef.current;
    if (r.kind === "verifying" || r.kind === "verified" || capturingRef.current) return;
    if (!faces || faces.length === 0) {
      sawOpenRef.current = false;
      sawClosedRef.current = false;
      setPhase("searching");
      return;
    }
    const f = faces[0];
    const l = typeof f.leftEyeOpenProbability === "number" ? f.leftEyeOpenProbability : 1;
    const rr = typeof f.rightEyeOpenProbability === "number" ? f.rightEyeOpenProbability : 1;
    const eyes = (l + rr) / 2;

    if (eyes >= EYE_OPEN) {
      if (sawOpenRef.current && sawClosedRef.current) {
        capturingRef.current = true;
        setPhase("captured");
        doCapture();
        return;
      }
      sawOpenRef.current = true;
      setPhase("blink");
    } else if (eyes <= EYE_CLOSED) {
      if (sawOpenRef.current) {
        sawClosedRef.current = true;
        setPhase("closing");
      }
    }
  }, [doCapture, setPhase]);

  const handleFacesJS = useMemo(() => Worklets.createRunOnJS(handleFaces), [handleFaces]);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    runAtTargetFps(5, () => {
      "worklet";
      try {
        const faces = detectFaces(frame);
        handleFacesJS(faces);
      } catch (e) {
        // ignore transient frame errors
      }
    });
  }, [handleFacesJS, detectFaces]);

  const statusText =
    result.kind === "verifying" ? "Verifying…"
    : result.kind === "verified" ? "Verified ✓"
    : result.kind === "failed" ? (result.message || "Face didn't match — blink to try again")
    : uiPhase === "searching" ? "Face not detected"
    : uiPhase === "closing" ? "Keep going…"
    : uiPhase === "captured" ? "Got it — checking…"
    : "Face detected ✓ — now BLINK to capture";

  const good = result.kind === "verified" || (result.kind === "idle" && (uiPhase === "blink" || uiPhase === "closing" || uiPhase === "captured"));
  const bad = result.kind === "failed" || (result.kind === "idle" && uiPhase === "searching");
  const accent = good ? colors.green : bad ? colors.red : colors.text;

  if (!hasPermission) {
    return (
      <View style={[styles.camWrap, styles.center]} testID={testID}>
        <Ionicons name="camera" size={44} color={colors.textDim} />
        <Text style={styles.permText}>Camera access is required for the selfie check-in.</Text>
        <Pressable onPress={requestPermission} style={styles.permBtn} testID="liveness-allow-camera">
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }
  if (!device) {
    return (
      <View style={[styles.camWrap, styles.center]} testID={testID}>
        <Ionicons name="alert-circle" size={40} color={colors.amber} />
        <Text style={styles.permText}>No front camera available on this device.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.camWrap}>
        <Camera
          ref={camRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={result.kind !== "verified"}
          photo
          frameProcessor={frameProcessor}
        />
        <View pointerEvents="none" style={[styles.guide, { borderColor: accent }]} />
      </View>

      <View style={styles.statusBox} testID="liveness-status">
        {result.kind === "verifying" || uiPhase === "captured" ? (
          <ActivityIndicator color={colors.green} size="large" />
        ) : result.kind === "verified" ? (
          <View style={[styles.badge, { backgroundColor: colors.green }]}>
            <Ionicons name="checkmark" size={30} color="#000" />
          </View>
        ) : uiPhase === "blink" || uiPhase === "closing" ? (
          <View style={[styles.badge, { borderColor: colors.green, borderWidth: 3 }]}>
            <Ionicons name="eye" size={28} color={colors.green} />
          </View>
        ) : (
          <View style={[styles.badge, { borderColor: accent, borderWidth: 3 }]}>
            <Ionicons name={bad ? "scan-outline" : "person"} size={28} color={accent} />
          </View>
        )}
        {headline ? <Text style={styles.headline}>{headline}</Text> : null}
        <Text style={[styles.status, { color: accent }]} testID="liveness-status-text">{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 16 },
  camWrap: {
    width: "100%", height: 380, borderRadius: 12, overflow: "hidden",
    backgroundColor: "#000", position: "relative",
  },
  center: { alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  guide: {
    position: "absolute", top: "12%", bottom: "12%", left: "18%", right: "18%",
    borderWidth: 2, borderRadius: 160, opacity: 0.7,
  },
  statusBox: { alignItems: "center", gap: 10 },
  badge: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  headline: { color: colors.textDim, fontSize: 12, letterSpacing: 1.5, fontWeight: "700", textTransform: "uppercase" },
  status: { fontSize: 17, fontWeight: "800", textAlign: "center", letterSpacing: 0.3, paddingHorizontal: 12 },
  permText: { color: colors.text, fontSize: 15, textAlign: "center", lineHeight: 22 },
  permBtn: { backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 12 },
  permBtnText: { color: "#000", fontWeight: "700", letterSpacing: 0.5 },
});
