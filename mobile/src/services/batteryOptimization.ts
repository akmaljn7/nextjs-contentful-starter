/**
 * Android battery-optimization exemption.
 *
 * When the phone sits idle with the screen off, Android's Doze mode defers
 * (effectively freezes) location updates from our foreground-service location
 * task — even though the service keeps the process alive. The stream stops for
 * minutes, and the server then logs a false "coverage gap" the moment the phone
 * wakes and the deferred fix finally arrives.
 *
 * Per Android's own docs, a foreground service is STILL subject to Doze unless
 * the app is exempt from battery optimization. This module prompts the user
 * once to grant that exemption (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS), which is
 * what keeps the 15s live stream flowing while the phone is idle in a pocket.
 *
 * iOS has no equivalent (its background model is different) — no-op there.
 */
import { Platform } from "react-native";
import * as Application from "expo-application";
import * as IntentLauncher from "expo-intent-launcher";
import * as SecureStore from "expo-secure-store";

const PROMPTED_KEY = "battery_opt_prompted_v1";

// Raw Android settings actions (not exposed as enum constants by the SDK).
const ACTION_REQUEST_IGNORE =
  "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS";
const ACTION_IGNORE_SETTINGS =
  "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS";

export async function hasPromptedBatteryOptimization(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PROMPTED_KEY)) === "1";
  } catch {
    return false;
  }
}

async function markPrompted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(PROMPTED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Ask Android to exempt this app from battery optimization. Shows the system
 * "Allow app to run in background / ignore optimizations?" dialog directly.
 * Falls back to the battery-optimization settings list if the direct request
 * intent is unavailable on the device. Safe no-op on iOS. Idempotent-ish: it
 * records that we've prompted so callers can avoid nagging.
 */
export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== "android") return;
  const pkg = Application.applicationId ?? "com.geofenceattendance.app";
  try {
    await IntentLauncher.startActivityAsync(ACTION_REQUEST_IGNORE, {
      data: `package:${pkg}`,
    });
  } catch {
    // Some OEMs disallow the direct request intent — open the list instead so
    // the user can flip this app to "Not optimized" manually.
    try {
      await IntentLauncher.startActivityAsync(ACTION_IGNORE_SETTINGS);
    } catch {
      /* nothing else we can do from managed code */
    }
  } finally {
    await markPrompted();
  }
}

const FS_PROMPTED_KEY = "fullscreen_intent_prompted_v1";
const ACTION_MANAGE_FULL_SCREEN = "android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT";

/**
 * Android 14+ (API 34) restricts full-screen intents (the WhatsApp-style
 * wake-screen selfie page) to apps the user has explicitly allowed. Open that
 * settings screen once so the user can grant it. No-op below API 34 / on iOS.
 */
export async function requestFullScreenIntentAccess(): Promise<void> {
  if (Platform.OS !== "android") return;
  if ((Platform.Version as number) < 34) return;
  if ((await SecureStore.getItemAsync(FS_PROMPTED_KEY).catch(() => null)) === "1") return;
  const pkg = Application.applicationId ?? "com.geofenceattendance.app";
  try {
    await IntentLauncher.startActivityAsync(ACTION_MANAGE_FULL_SCREEN, { data: `package:${pkg}` });
  } catch {
    /* not available on this device — the notification degrades to a heads-up */
  } finally {
    await SecureStore.setItemAsync(FS_PROMPTED_KEY, "1").catch(() => undefined);
  }
}
