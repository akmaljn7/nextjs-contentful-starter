/**
 * Device-health signal for the on-app health chip and the admin OFFLINE
 * DEVICE badge. Runs periodically while the app is foregrounded, and once
 * on cold-start. Reports:
 *   - Location permission state (always / when_in_use / denied)
 *   - Battery level (best-effort — Expo doesn't expose it stably)
 *   - Timestamp of the most recent geofence event we've seen from the OS
 *   - Server round-trips this via /api/mobile/heartbeat
 */
import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";

import { mobile } from "@/api/mobile";
import { getDeviceId } from "@/lib/storage";
import { pendingCount } from "@/services/offlineQueue";

const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

async function permissionState(): Promise<"always" | "when_in_use" | "denied" | "restricted"> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return "denied";
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === "granted") return "always";
    return "when_in_use";
  } catch {
    return "denied";
  }
}

export async function sendHeartbeat(): Promise<void> {
  try {
    await mobile.heartbeat({
      device_id: await getDeviceId(),
      ts_ms: Date.now(),
      permission_state: await permissionState(),
    });
  } catch {
    // silently swallow — heartbeats are best-effort
  }
}

export function startHealthLoop() {
  stopHealthLoop();
  sendHeartbeat().catch(() => undefined);
  timer = setInterval(() => { sendHeartbeat().catch(() => undefined); }, HEARTBEAT_INTERVAL_MS);
}

export function stopHealthLoop() {
  if (timer) { clearInterval(timer); timer = null; }
}

/** Register a foreground listener so heartbeats fire on app resume too. */
export function registerAppStateHeartbeat(): () => void {
  const handler = (state: AppStateStatus) => {
    if (state === "active") sendHeartbeat().catch(() => undefined);
  };
  const sub = AppState.addEventListener("change", handler);
  return () => sub.remove();
}

export interface HealthSnapshot {
  permission: "always" | "when_in_use" | "denied" | "restricted";
  queuedEvents: number;
  geofenceArmed: boolean;
}

export async function healthSnapshot(): Promise<HealthSnapshot> {
  return {
    permission: await permissionState(),
    queuedEvents: await pendingCount(),
    geofenceArmed: (await Location.getBackgroundPermissionsAsync()).status === "granted",
  };
}
