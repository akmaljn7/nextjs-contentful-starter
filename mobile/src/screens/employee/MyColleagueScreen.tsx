/**
 * "My Colleague" — proxy actions for an employee whose own phone is dead/off.
 * The lending employee is logged in; the ABSENT employee is identified by
 * email/ID and proven present by a live selfie matching their enrolled face.
 *
 *  1. Check me in + selfie  — starts the absent employee's session (location
 *     proof = this phone's GPS, must be inside their office) then takes their
 *     selfie on this phone.
 *  2. Explain a phone-off gap — attach a note + verified selfie to the
 *     employee's flagged coverage gap for admin approve/reject.
 */
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { CameraCapture } from "@/components/CameraCapture";
import { colleague } from "@/api/colleague";
import { apiError } from "@/api/client";
import { colors } from "@/theme";

type Mode = "checkin" | "gap";

export default function MyColleagueScreen() {
  const [mode, setMode] = useState<Mode>("checkin");
  const [emailOrId, setEmailOrId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState<string>("");
  const [step, setStep] = useState<"form" | "camera">("form");

  const reset = () => {
    setEmailOrId(""); setReason(""); setChallengeId(null); setTargetName(""); setStep("form");
  };

  // ---- Check-in flow ----
  const startCheckin = useCallback(async () => {
    if (!emailOrId.trim()) return Alert.alert("Missing", "Enter the employee's email or ID.");
    setBusy(true);
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== "granted") throw new Error("Location permission is required to prove you're at the office.");
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await colleague.checkin({
        email_or_id: emailOrId.trim(),
        reason: reason.trim(),
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 50,
      });
      setChallengeId(res.challenge_id);
      setTargetName(res.target_name || emailOrId.trim());
      setStep("camera");
    } catch (e: any) {
      Alert.alert("Couldn't check in", e?.message && !e?.response ? e.message : apiError(e));
    } finally {
      setBusy(false);
    }
  }, [emailOrId, reason]);

  const submitSelfie = useCallback(async (dataUrl: string) => {
    setBusy(true);
    try {
      const res = await colleague.selfie({
        email_or_id: emailOrId.trim(),
        challenge_id: challengeId || undefined,
        face_photo: dataUrl,
      });
      Alert.alert("✅ Checked in", `${targetName} was checked in and their selfie verified (match ${(res.similarity ?? 0).toFixed(2)}).`);
      reset();
    } catch (e) {
      Alert.alert("Selfie not accepted", apiError(e));
    } finally {
      setBusy(false);
    }
  }, [emailOrId, challengeId, targetName]);

  // ---- Gap-reason flow ----
  const submitGap = useCallback(async (dataUrl?: string) => {
    if (!emailOrId.trim()) return Alert.alert("Missing", "Enter the employee's email or ID.");
    if (!reason.trim()) return Alert.alert("Missing", "Write a short reason for the phone being off.");
    setBusy(true);
    try {
      const res = await colleague.gapReason({
        email_or_id: emailOrId.trim(),
        note: reason.trim(),
        face_photo: dataUrl,
      });
      const verified = res.selfie_match === true ? " Selfie verified." : res.selfie_match === false ? " (selfie did NOT match)" : "";
      Alert.alert("✅ Reason submitted", `Sent to admin for review.${verified}`);
      reset();
    } catch (e) {
      Alert.alert("Couldn't submit", apiError(e));
    } finally {
      setBusy(false);
    }
  }, [emailOrId, reason]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>My Colleague</Text>
        <Text style={styles.sub}>Help a colleague whose phone is dead or off.</Text>

        <View style={styles.tabs}>
          <Pressable
            testID="colleague-tab-checkin"
            onPress={() => { setMode("checkin"); setStep("form"); }}
            style={[styles.tab, mode === "checkin" && styles.tabActive]}
          >
            <Ionicons name="log-in" size={16} color={mode === "checkin" ? "#000" : colors.textDim} />
            <Text style={[styles.tabText, mode === "checkin" && styles.tabTextActive]}>Check me in</Text>
          </Pressable>
          <Pressable
            testID="colleague-tab-gap"
            onPress={() => { setMode("gap"); setStep("form"); }}
            style={[styles.tab, mode === "gap" && styles.tabActive]}
          >
            <Ionicons name="alert-circle" size={16} color={mode === "gap" ? "#000" : colors.textDim} />
            <Text style={[styles.tabText, mode === "gap" && styles.tabTextActive]}>Phone-off reason</Text>
          </Pressable>
        </View>

        {step === "form" && (
          <View>
            <Input
              label="Employee email or ID"
              testID="colleague-email"
              placeholder="colleague@company.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailOrId}
              onChangeText={setEmailOrId}
            />
            <Input
              label={mode === "checkin" ? "Reason (optional)" : "Reason for phone being off"}
              testID="colleague-reason"
              placeholder={mode === "checkin" ? "e.g. phone battery dead" : "e.g. phone crashed and switched off"}
              value={reason}
              onChangeText={setReason}
              multiline
            />
            {mode === "checkin" ? (
              <Button
                testID="colleague-checkin-btn"
                label="Check in & take selfie"
                loading={busy}
                onPress={startCheckin}
              />
            ) : (
              <Button
                testID="colleague-gap-photo-btn"
                label="Add verified selfie + submit"
                disabled={busy}
                onPress={() => {
                  if (!emailOrId.trim() || !reason.trim())
                    return Alert.alert("Missing", "Enter the employee and a reason first.");
                  setStep("camera");
                }}
              />
            )}
          </View>
        )}

        {step === "camera" && (
          <View style={{ gap: 12 }}>
            <Text style={styles.camTitle}>
              {mode === "checkin"
                ? `Take ${targetName}'s selfie`
                : `Take ${emailOrId.trim()}'s selfie (proof of presence)`}
            </Text>
            <CameraCapture
              onCapture={mode === "checkin" ? submitSelfie : (d) => submitGap(d)}
              busy={busy}
              hint="The colleague must face the camera — it's matched to their enrolled photo."
              captureLabel="Capture selfie"
              testID="colleague-selfie-capture"
            />
            <Button label="Cancel" variant="ghost" onPress={reset} testID="colleague-cancel-btn" />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 14, marginBottom: 12 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 2, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.green, borderColor: colors.green },
  tabText: { color: colors.textDim, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#000" },
  camTitle: { color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
});
