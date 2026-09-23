/**
 * Location permission guard.
 *
 * Background attendance only works when the employee grants "Always" location.
 * If they downgrade to "While Using" or "Never", tracking silently breaks. This
 * guard:
 *   1. Detects the current permission level and, on any CHANGE, fires an
 *      immediate heartbeat so the backend records it (and flags admins when it
 *      drops from Always).
 *   2. While the level is anything other than "always", nags the employee with
 *      an immediate + repeating (30-min) Time-Sensitive notification to switch
 *      it back — cancelled the moment it returns to "always".
 *
 * Notifications keep firing via the OS even when the app is closed, so the
 * reminder is persistent, not one-shot.
 */
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { sendHeartbeat } from "@/services/health";

const LAST_PERM_KEY = "gfattend.lastPerm";
const WARN_IDS_KEY = "gfattend.locWarnIds";
const REPEAT_SECONDS = 30 * 60;

export type PermLevel = "always" | "when_in_use" | "denied" | "restricted";

async function currentPerm(): Promise<PermLevel> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return "denied";
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.status === "granted" ? "always" : "when_in_use";
  } catch {
    return "denied";
  }
}

function warnContent(): Notifications.NotificationContentInput {
  return {
    title: "⚠️ Turn Location to “Always”",
    body: "StayPin can't record your attendance unless Location is set to Always. Tap to open Settings and fix it.",
    data: { kind: "location_warning" },
    sound: "selfie_alert.wav",
    interruptionLevel: "timeSensitive",
  };
}

async function scheduleWarnings(): Promise<void> {
  const existing = await AsyncStorage.getItem(WARN_IDS_KEY);
  if (existing) return; // already nagging — don't stack duplicates
  const ids: string[] = [];
  try {
    ids.push(await Notifications.scheduleNotificationAsync({ content: warnContent(), trigger: null })); // now
    ids.push(await Notifications.scheduleNotificationAsync({
      content: warnContent(),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: REPEAT_SECONDS, repeats: true } as any,
    }));
    await AsyncStorage.setItem(WARN_IDS_KEY, JSON.stringify(ids));
  } catch { /* best-effort */ }
}

async function cancelWarnings(): Promise<void> {
  const raw = await AsyncStorage.getItem(WARN_IDS_KEY);
  if (!raw) return;
  try {
    for (const id of JSON.parse(raw) as string[]) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
    }
  } catch { /* ignore */ }
  await AsyncStorage.removeItem(WARN_IDS_KEY);
}

/** Check permission; push a heartbeat on change; nag until it's "always". */
export async function checkLocationPermission(): Promise<void> {
  const perm = await currentPerm();
  const last = await AsyncStorage.getItem(LAST_PERM_KEY);
  if (perm !== last) {
    await AsyncStorage.setItem(LAST_PERM_KEY, perm);
    // Push the new state to the server NOW so admins are alerted immediately
    // instead of waiting for the next 5-min heartbeat.
    sendHeartbeat().catch(() => undefined);
  }
  if (perm !== "always") await scheduleWarnings();
  else await cancelWarnings();
}

/** Tapping a warning notification opens the OS settings page for the app. */
export function registerLocationWarningTapHandler(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const data: any = r?.notification?.request?.content?.data;
    if (data?.kind === "location_warning") {
      Linking.openSettings().catch(() => undefined);
    }
  });
  return () => sub.remove();
}
