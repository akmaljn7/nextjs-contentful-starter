/**
 * Onboarding permissions screen.
 *
 * Shown on first launch (or after a permission was revoked). Explains why
 * we need location "Always" access, then requests foreground → background
 * → notifications in the correct OS-mandated order.
 *
 * On iOS, "Always" cannot be requested up-front — the app must first hold
 * "When In Use" and then prompt for the upgrade. This flow does that.
 */
import React, { useCallback, useState } from "react";
import { Text, View, StyleSheet, ScrollView, Platform, Linking, Alert } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { requestIgnoreBatteryOptimizations, requestFullScreenIntentAccess } from "@/services/batteryOptimization";
import { colors } from "@/theme";

interface Props {
  onGranted: () => void;
}

type StepState = "idle" | "requesting" | "granted" | "denied";

interface Step {
  key: "foreground" | "background" | "notifications" | "battery";
  title: string;
  reason: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: Step[] = [
  {
    key: "foreground",
    title: "Location while using the app",
    reason: "So the app can show you your office on the map and detect when you arrive.",
    icon: "location",
  },
  {
    key: "background",
    title: "Location even when the app is closed",
    reason:
      "This is what lets your attendance start automatically when you walk into the office — without opening the app.",
    icon: "compass",
  },
  {
    key: "notifications",
    title: "Send you notifications",
    reason:
      "So we can nudge you for a quick selfie check-in and confirm when attendance starts or pauses.",
    icon: "notifications",
  },
  // Android-only: without this, Doze freezes background location while the
  // phone is idle and creates false coverage gaps.
  ...(Platform.OS === "android"
    ? ([{
        key: "battery",
        title: "Keep tracking running (battery)",
        reason:
          "Allow the app to run without battery restrictions. Otherwise your phone pauses location tracking when it's idle in your pocket, which can flag a false 'phone off' gap.",
        icon: "battery-charging",
      }] as Step[])
    : []),
];

export default function PermissionsScreen({ onGranted }: Props) {
  const [state, setState] = useState<Record<Step["key"], StepState>>({
    foreground: "idle",
    background: "idle",
    notifications: "idle",
    battery: "idle",
  });

  const setStep = (k: Step["key"], v: StepState) =>
    setState((prev) => ({ ...prev, [k]: v }));

  const runAll = useCallback(async () => {
    // 1. Foreground
    setStep("foreground", "requesting");
    const fg = await Location.requestForegroundPermissionsAsync();
    setStep("foreground", fg.status === "granted" ? "granted" : "denied");
    if (fg.status !== "granted") {
      Alert.alert(
        "Location required",
        "Attendance can't work without at least foreground location access. You can enable it later in Settings.",
      );
      return;
    }
    // 2. Background — iOS requires a small delay so the OS-level dialog doesn't stack
    setStep("background", "requesting");
    await new Promise((r) => setTimeout(r, 500));
    const bg = await Location.requestBackgroundPermissionsAsync();
    setStep("background", bg.status === "granted" ? "granted" : "denied");
    // Not fatal — user can still use the app in foreground mode
    // 3. Notifications
    setStep("notifications", "requesting");
    const notif = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    setStep("notifications", notif.status === "granted" ? "granted" : "denied");
    // 4. Android battery-optimization exemption — keeps the live stream alive
    // in Doze so idle phones don't produce false coverage gaps. The system
    // dialog doesn't return a readable result, so we mark it granted best-effort.
    if (Platform.OS === "android") {
      setStep("battery", "requesting");
      await new Promise((r) => setTimeout(r, 400));
      try {
        await requestIgnoreBatteryOptimizations();
        await requestFullScreenIntentAccess();
      } catch {
        /* ignore */
      }
      setStep("battery", "granted");
    }
    onGranted();
  }, [onGranted]);

  const openSettings = () => {
    if (Platform.OS === "ios") Linking.openURL("app-settings:");
    else Linking.openSettings();
  };

  const anyDenied = STEPS.some((s) => state[s.key] === "denied");
  const allSettled = STEPS.every((s) => state[s.key] === "granted" || state[s.key] === "denied");

  return (
    <Screen scroll>
      <View style={{ paddingTop: 48 }}>
        <Text style={styles.h1}>Let's set things up</Text>
        <Text style={styles.sub}>
          StayPin needs a few permissions to work in the background.
          You always keep full control — nothing is shared beyond your employer.
        </Text>

        {STEPS.map((s) => {
          const st = state[s.key];
          return (
            <View key={s.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name={s.icon} size={22} color={colors.green} />
                <Text style={styles.cardTitle}>{s.title}</Text>
                <View style={styles.badgeWrap}>
                  {st === "granted" && <Text style={[styles.badge, { color: colors.green, borderColor: colors.green }]}>GRANTED</Text>}
                  {st === "denied" && <Text style={[styles.badge, { color: colors.red, borderColor: colors.red }]}>DENIED</Text>}
                  {st === "requesting" && <Text style={[styles.badge, { color: colors.amber, borderColor: colors.amber }]}>ASKING…</Text>}
                </View>
              </View>
              <Text style={styles.cardBody}>{s.reason}</Text>
            </View>
          );
        })}

        {anyDenied && (
          <View style={styles.deniedNote}>
            <Text style={styles.deniedLabel}>SOMETHING WAS DECLINED</Text>
            <Text style={styles.deniedMsg}>
              You can re-enable any permission in Settings. Automatic attendance requires all three.
            </Text>
            <Button
              label="Open Settings"
              variant="ghost"
              onPress={openSettings}
              style={{ marginTop: 12 }}
              testID="perm-open-settings"
            />
          </View>
        )}

        <Button
          testID="perm-continue"
          label={allSettled ? "Continue" : "Request permissions"}
          onPress={allSettled ? onGranted : runAll}
          style={{ marginTop: 24 }}
        />

        <Text style={styles.footer}>
          By continuing you agree to your employer's attendance policy. Location data is used only for
          attendance records and is never sold.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 14, marginTop: 8, lineHeight: 20 },
  card: {
    marginTop: 20, padding: 16, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  badgeWrap: { minWidth: 62, alignItems: "flex-end" },
  badge: {
    fontSize: 9, letterSpacing: 1.6, fontWeight: "700",
    paddingVertical: 3, paddingHorizontal: 6, borderWidth: 1,
  },
  cardBody: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 8 },
  deniedNote: {
    marginTop: 20, padding: 16, backgroundColor: colors.amberSoft,
    borderColor: colors.amber, borderLeftWidth: 3,
  },
  deniedLabel: { color: colors.amber, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  deniedMsg: { color: colors.text, fontSize: 13, marginTop: 6, lineHeight: 18 },
  footer: { color: colors.textMute, fontSize: 11, marginTop: 24, textAlign: "center", lineHeight: 16 },
});
