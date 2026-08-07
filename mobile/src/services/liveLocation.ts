/**
 * Continuous background location — WhatsApp-style live tracking.
 *
 * Native geofences (services/geofence.ts) only fire on ENTER/EXIT transitions
 * and, on aggressive OEMs like Samsung, are suppressed entirely once the phone
 * sleeps in a pocket. That caused two field bugs:
 *   1. Session stayed "active" forever because the OS never fired the EXIT.
 *   2. The admin live-map pin never moved because nothing was streamed
 *      between transitions.
 *
 * This service runs an Android/iOS foreground-service location task that keeps
 * the process alive with a persistent notification and streams a GPS fix every
 * ~15s (or every 25m) even with the screen off. Each fix is POSTed to
 * `/api/mobile/location`, where the SERVER decides inside/outside on every fix
 * (auto-start / pause / resume) and broadcasts the moving position to the admin
 * map in real time.
 *
 * Geofences remain armed as a battery-cheap fast-path for instant enter/exit;
 * live streaming is the reliable source of truth while on shift.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { mobile } from "@/api/mobile";
import { getDeviceId } from "@/lib/storage";

export const LIVE_LOCATION_TASK = "gfattend.live";

// Cadence — 15s / 25m per product decision (responsive, WhatsApp-like).
const TIME_INTERVAL_MS = 15_000;
const DISTANCE_INTERVAL_M = 25;

TaskManager.defineTask(LIVE_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[liveLocation] task error:", error);
    return;
  }
  if (!data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;

  const deviceId = await getDeviceId();
  // Only the freshest fix matters for live tracking; post it (and any others)
  // best-effort. Failures are dropped — the next fix (≤15s away) supersedes.
  for (const loc of locations) {
    try {
      await mobile.postLocation({
        device_id: deviceId,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 50,
        ts_ms: Math.round(loc.timestamp || Date.now()),
        speed: loc.coords.speed ?? undefined,
        mock_location: (loc as any).mocked === true,
      });
    } catch {
      /* offline / transient — next fix will catch up */
    }
  }
});

export async function isLiveLocationActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LIVE_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Start the continuous foreground-service location stream. Requires
 * background ("Always") location permission. Idempotent.
 */
export async function startLiveLocation(): Promise<boolean> {
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      console.info("[liveLocation] not starting — no background permission");
      return false;
    }
    if (await isLiveLocationActive()) return true;

    await Location.startLocationUpdatesAsync(LIVE_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: TIME_INTERVAL_MS,
      distanceInterval: DISTANCE_INTERVAL_M,
      // Keep streaming while the screen is off / phone in pocket.
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true,
      // Android foreground service = persistent notification (required by the
      // OS + Play Store for continuous background location). This is what
      // survives Samsung's battery optimizer.
      foregroundService: {
        notificationTitle: "Attendance tracking active",
        notificationBody: "Sharing your location with your workplace while on shift.",
        notificationColor: "#10b981",
        killServiceOnDestroy: false,
      },
    });
    console.info("[liveLocation] started — foreground service armed");
    return true;
  } catch (e) {
    console.warn("[liveLocation] start failed:", e);
    return false;
  }
}

/** Stop the continuous stream + dismiss the persistent notification. */
export async function stopLiveLocation(): Promise<void> {
  try {
    if (await isLiveLocationActive()) {
      await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK);
      console.info("[liveLocation] stopped");
    }
  } catch {
    /* ignore */
  }
}
