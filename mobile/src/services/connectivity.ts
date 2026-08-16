/**
 * Connectivity-triggered sync + offline alert.
 *
 * 1. The moment the device goes offline → online, drains BOTH offline queues
 *    (geofence events + live-location fixes) so buffered data pushes
 *    automatically without the employee opening the app.
 * 2. When the device stays offline for a few seconds, notifies the employee
 *    ("You are offline") so they know attendance may not be recording — this
 *    mirrors what the admin console shows when the device stops streaming.
 */
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";

import { drainQueue } from "@/services/syncWorker";
import { drainLocationQueue } from "@/services/liveLocation";
import { drainSelfieDrafts } from "@/services/offlineSelfie";

let unsubscribe: (() => void) | null = null;
let wasConnected = true;
// Debounce so transient network blips don't fire the offline alert.
let offlineTimer: ReturnType<typeof setTimeout> | null = null;
let offlineNotified = false;
const OFFLINE_GRACE_MS = 12_000;

export function startConnectivityWatcher(): void {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener((state) => {
    const connected = !!state.isConnected && state.isInternetReachable !== false;

    // offline edge: arm a delayed alert; ignore if it recovers within grace.
    if (!connected && wasConnected) {
      if (offlineTimer) clearTimeout(offlineTimer);
      offlineTimer = setTimeout(() => {
        offlineTimer = null;
        offlineNotified = true;
        Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ You are offline",
            body: "No internet connection — your attendance may not be recording until you're back online.",
            sound: "default",
          },
          trigger: null,
        }).catch(() => undefined);
      }, OFFLINE_GRACE_MS);
    }

    // online edge: cancel a pending alert, drain queues, tell them they're back.
    if (connected && !wasConnected) {
      if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
      console.info("[connectivity] network back — draining offline queues");
      drainLocationQueue().catch(() => undefined);
      drainQueue().catch(() => undefined);
      drainSelfieDrafts().catch(() => undefined);
      if (offlineNotified) {
        offlineNotified = false;
        Notifications.scheduleNotificationAsync({
          content: {
            title: "✅ Back online",
            body: "Connection restored — your attendance is syncing again.",
            sound: "default",
          },
          trigger: null,
        }).catch(() => undefined);
      }
    }

    wasConnected = connected;
  });
}

export function stopConnectivityWatcher(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
  offlineNotified = false;
  wasConnected = true;
}
