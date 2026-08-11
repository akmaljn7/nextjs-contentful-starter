/**
 * LivenessCamera — hands-free face-detected + blink-to-capture surface.
 *
 * Uses expo-camera for the live preview and @infinitered/react-native-mlkit-face-detection
 * (Google ML Kit) to detect a real face and a real blink ON-DEVICE before it
 * captures. Flow shown to the user:
 *
 *   1. "Face not detected" → "Face detected ✓"
 *   2. "Blink to capture"  → when a blink (eyes open → eyes closed) is detected
 *      it automatically grabs the eyes-open (neutral) frame + the eyes-closed
 *      (blink) frame and hands them to the parent via onCapture().
 *   3. Parent verifies against the enrolled face and drives the `result` prop
 *      ("verifying" → "verified" / "failed"). On "failed" the camera re-arms so
 *      the employee can simply blink again.
 *
 * Shared by the selfie challenge, first-time face enrollment, and re-enrollment
 * so the capture logic is identical everywhere.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useFaceDetection } from "@infinitered/react-native-mlkit-face-detection";
import { colors } from "@/theme";

export type LiveVerifyResult =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "verified" }
  | { kind: "failed"; message?: string };

interface Props {
  /** Fired once per detected blink with the neutral (eyes-open) + blink frames as base64 data URLs. */
  onCapture: (neutralB64: string, blinkB64: string) => void;
  /** Parent-controlled verification state. */
  result: LiveVerifyResult;
  /** Optional short heading shown above the status. */
  headline?: string;
  testID?: string;
}

type FaceState = "searching" | "hold" | "blink" | "captured";

const EYE_OPEN = 0.55;   // avg eye-open probability to count as "eyes open"
const EYE_CLOSED = 0.35; // avg eye-open probability to count as "eyes closed" (a blink)

function eyeScore(l?: number | null, r?: number | null): number {
  const vals = [l, r].filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return 1; // classification unavailable → treat as open
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function LivenessCamera({ onCapture, result, headline, testID }: Props) {
  const detector = useFaceDetection();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [faceState, setFaceState] = useState<FaceState>("searching");

  const neutralRef = useRef<string | null>(null); // last eyes-open frame (base64)
  const capturedRef = useRef(false);              // guards duplicate onCapture until result resolves
  const mountedRef = useRef(true);
  const loopStartedRef = useRef(false);
  const resultRef = useRef(result);
  resultRef.current = result;

  useEffect(() => {
    if (perm && !perm.granted) requestPerm();
  }, [perm, requestPerm]);

  // Re-arm on failure / idle so a fresh blink starts a new attempt.
  useEffect(() => {
    if (result.kind === "failed" || result.kind === "idle") {
      capturedRef.current = false;
      neutralRef.current = null;
      if (mountedRef.current) setFaceState("searching");
    }
  }, [result.kind]);

  const scanOnce = useCallback(async (): Promise<void> => {
    if (!mountedRef.current || !camRef.current) return;
    const r = resultRef.current;
    // Pause capturing while the parent is verifying / already verified, or while
    // we're holding a captured pair waiting for the verdict.
    if (r.kind === "verifying" || r.kind === "verified" || capturedRef.current) return;
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.5, skipProcessing: true });
      if (!photo?.uri || !mountedRef.current) return;
      const manip = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!mountedRef.current) return;
      const b64 = manip.base64 ? `data:image/jpeg;base64,${manip.base64}` : null;
      const det = await detector.detectFaces(manip.uri);
      const faces = det?.faces ?? [];
      if (!mountedRef.current) return;

      if (faces.length === 0) {
        neutralRef.current = null;
        setFaceState("searching");
        return;
      }
      // Largest face in frame
      const f = faces.reduce((a, b) =>
        (b.frame.size.x * b.frame.size.y) > (a.frame.size.x * a.frame.size.y) ? b : a);
      const eyes = eyeScore(f.leftEyeOpenProbability, f.rightEyeOpenProbability);

      if (!neutralRef.current) {
        if (eyes >= EYE_OPEN && b64) {
          neutralRef.current = b64;
          setFaceState("blink");
        } else {
          setFaceState("hold");
        }
        return;
      }
      // We have a neutral (eyes-open) frame — watch for the blink.
      if (eyes <= EYE_CLOSED && b64) {
        capturedRef.current = true;
        setFaceState("captured");
        onCapture(neutralRef.current, b64);
      } else if (eyes >= EYE_OPEN && b64) {
        // keep the neutral frame fresh while eyes stay open
        neutralRef.current = b64;
        setFaceState("blink");
      }
    } catch {
      // transient camera/detector hiccup — ignore and keep scanning
    }
  }, [detector, onCapture]);

  // Detection loop — reschedules itself after each scan.
  useEffect(() => {
    mountedRef.current = true;
    if (!camReady || !perm?.granted || loopStartedRef.current) return;
    loopStartedRef.current = true;
    let cancelled = false;
    const run = async () => {
      while (!cancelled && mountedRef.current) {
        await scanOnce();
        await new Promise((res) => setTimeout(res, 200));
      }
    };
    run();
    return () => { cancelled = true; };
  }, [camReady, perm?.granted, scanOnce]);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // ---- UI ----
  const statusText =
    result.kind === "verifying" ? "Verifying…"
    : result.kind === "verified" ? "Verified ✓"
    : result.kind === "failed" ? (result.message || "Face didn't match — blink to try again")
    : !camReady ? "Starting camera…"
    : faceState === "searching" ? "Face not detected"
    : faceState === "hold" ? "Hold still — look at the camera"
    : faceState === "captured" ? "Got it — checking…"
    : "Face detected ✓ — now BLINK to capture";

  const good = result.kind === "verified"
    || (result.kind === "idle" && (faceState === "blink" || faceState === "captured"));
  const bad = result.kind === "failed" || (result.kind === "idle" && faceState === "searching");
  const accent = result.kind === "verified" ? colors.green
    : good ? colors.green : bad ? colors.red : colors.text;

  if (!perm?.granted) {
    return (
      <View style={[styles.cam, styles.permPrompt]} testID={testID}>
        <Ionicons name="camera" size={44} color={colors.textDim} />
        <Text style={styles.permText}>Camera access is required for the selfie check-in.</Text>
        <Pressable onPress={requestPerm} style={styles.permBtn} testID="liveness-allow-camera">
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.camWrap}>
        <CameraView
          ref={(r) => { camRef.current = r; }}
          style={styles.cam}
          facing="front"
          mode="picture"
          animateShutter={false}
          onCameraReady={() => setCamReady(true)}
        />
        {/* face frame guide */}
        <View pointerEvents="none" style={[styles.guide, { borderColor: accent }]} />
      </View>

      <View style={styles.statusBox} testID="liveness-status">
        {result.kind === "verifying" || faceState === "captured" ? (
          <ActivityIndicator color={colors.green} size="large" />
        ) : result.kind === "verified" ? (
          <View style={[styles.badge, { backgroundColor: colors.green }]}>
            <Ionicons name="checkmark" size={30} color="#000" />
          </View>
        ) : faceState === "blink" ? (
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
  cam: { flex: 1 },
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
  permPrompt: {
    width: "100%", height: 380, borderRadius: 12, alignItems: "center", justifyContent: "center",
    gap: 14, padding: 24, backgroundColor: "#000",
  },
  permText: { color: colors.text, fontSize: 15, textAlign: "center", lineHeight: 22 },
  permBtn: { backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 12 },
  permBtnText: { color: "#000", fontWeight: "700", letterSpacing: 0.5 },
});
