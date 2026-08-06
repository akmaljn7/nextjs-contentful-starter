/**
 * PermissionsGate — blocks the employee flow until Location "Always" +
 * Notifications are granted.
 *
 * Without ACCESS_BACKGROUND_LOCATION native geofencing silently no-ops on
 * Android 10+, which is exactly what caused the "no auto clock-in even
 * while walking to the office" bug reported. This gate makes the
 * requirement explicit, prompts the OS dialogs in the right order, and
 * kicks the geofence registration + foreground watcher the moment the
 * grant lands.
 */
import React, { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

import PermissionsScreen from "@/screens/onboarding/PermissionsScreen";
import { syncOfficeGeofence } from "@/services/geofence";
import { startForegroundWatcher } from "@/services/foregroundWatcher";

interface Props {
  children: React.ReactNode;
}

type Status = "checking" | "granted" | "needed";

async function evaluate(): Promise<Status> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return "needed";
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== "granted") return "needed";
    // Notifications: we prefer granted but do NOT block the app if the
    // user declined push (the selfie challenge modal still works while
    // the app is foreground).
    return "granted";
  } catch {
    return "needed";
  }
}

export function PermissionsGate({ children }: Props) {
  const [status, setStatus] = useState<Status>("checking");

  const check = useCallback(async () => {
    const s = await evaluate();
    setStatus(s);
    if (s === "granted") {
      // Kick everything off now that we have full permission.
      syncOfficeGeofence().catch(() => undefined);
      startForegroundWatcher().catch(() => undefined);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  // Re-check when the user returns from Settings (typical OS-level grant flow).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, [check]);

  if (status === "checking") return null;
  if (status === "needed") {
    return (
      <PermissionsScreen
        onGranted={async () => {
          // Also ask for notification permission (soft — non-blocking)
          try { await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          }); } catch { /* ignore */ }
          await check();
        }}
      />
    );
  }
  return <>{children}</>;
}
