/**
 * Geofence lifecycle — the heart of Phase 2.
 *
 * Uses `expo-location`'s native geofencing API which under the hood registers
 * a CLCircularRegion on iOS and a GeofencingClient region on Android. The OS
 * wakes our TaskManager task on region transitions even when the app is
 * completely killed.
 *
 * Reliability fixes documented in /app/memory/MOBILE_ARCHITECTURE.md:
 *   1. Boot receiver (Android config plugin, deferred to Phase 6 polish)
 *   2. Cold-start reconciliation (services/reconcile.ts)
 *   3. Server-side deadman timer (backend Phase 6)
 *   4. iOS SLC fallback (this file — startMonitoringSignificantLocation)
 *   5. Health chip (services/health.ts)
 *   6. Admin OFFLINE DEVICE badge (backend, already done in Phase 0)
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { enqueueAndSync } from "@/services/syncWorker";
import { getDeviceId } from "@/lib/storage";
import { mobile } from "@/api/mobile";

export const GEOFENCE_TASK = "gfattend.geofence";

interface Office {
  id: string;
  lat: number;
  lng: number;
  radius_meters: number;
  name: string;
}

/**
 * TaskManager callback — MUST be defined at module top-level (not inside a
 * hook or component). Fires when the OS notifies us of geofence transitions.
 * Executes in a stripped-down JS context; keep it small and side-effect
 * safe. Any long-running work must be enqueued and drained by the sync
 * worker later.
 */
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[geofence] task error:", error);
    return;
  }
  if (!data) return;
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  const kind =
    eventType === Location.GeofencingEventType.Enter ? "enter"
    : eventType === Location.GeofencingEventType.Exit ? "exit"
    : null;
  if (!kind) return;

  const deviceId = await getDeviceId();
  const clientEventId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  // Get one fresh GPS reading so lat/lng/accuracy reflect actual position,
  // not just the region center. Fallback to region.latitude/longitude on
  // failure so we still record something.
  let lat = region.latitude;
  let lng = region.longitude;
  let accuracy = region.radius;
  let mockLocation = false;
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    lat = loc.coords.latitude;
    lng = loc.coords.longitude;
    accuracy = loc.coords.accuracy ?? region.radius;
    // expo-location surfaces mocked provider via loc.mocked on Android
    mockLocation = (loc as any).mocked === true;
  } catch { /* keep region fallback */ }

  await enqueueAndSync({
    client_event_id: clientEventId,
    type: kind,
    ts_ms: Date.now(),
    office_id: region.identifier || "unknown",
    lat, lng, accuracy,
    mock_location: mockLocation,
    from_boot: false,
    device_id: deviceId,
  });

  // Local notification — but ONLY on a REAL transition. iOS re-fires ENTER
  // whenever the geofence is re-registered (app open, "reactivate" tap, cold
  // start) even while already inside, which spammed "Welcome to the office"
  // repeatedly. We persist the last presence and only notify when it actually
  // flips, so you get one notice on arrival and one when you go offline.
  const PRESENCE_KEY = "gfattend.presence";
  const nextState = kind === "enter" ? "inside" : "outside";
  let prevState: string | null = null;
  try { prevState = await AsyncStorage.getItem(PRESENCE_KEY); } catch { /* ignore */ }
  if (prevState !== nextState) {
    try { await AsyncStorage.setItem(PRESENCE_KEY, nextState); } catch { /* ignore */ }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: kind === "enter" ? "✅ You are in office" : "⏸ You are offline",
        body: kind === "enter"
          ? "Attendance is now being recorded."
          : "You left the office — attendance is paused.",
        sound: "default",
      },
      trigger: null,
    });
  }
});

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function isGeofencingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  } catch {
    return false;
  }
}

/**
 * Register (or refresh) the geofence for a single office. Safe to call
 * repeatedly — no-op if already registered with the same office/radius.
 * Also arms iOS significant-location-change as a fallback safety net.
 */
export async function registerOfficeGeofence(office: Office): Promise<void> {
  const perm = await Location.getBackgroundPermissionsAsync();
  if (perm.status !== "granted") {
    console.info("[geofence] skipping — no background permission");
    return;
  }
  const region: Location.LocationRegion = {
    identifier: office.id,
    latitude: office.lat,
    longitude: office.lng,
    radius: Math.max(50, office.radius_meters), // iOS ignores < 50 m
    notifyOnEnter: true,
    notifyOnExit: true,
  };
  // Always stop-then-start to guarantee the geofence reflects any radius or
  // coordinate change the admin made server-side. Cheap operation.
  try {
    if (await isGeofencingActive()) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  } catch { /* ignore */ }
  await Location.startGeofencingAsync(GEOFENCE_TASK, [region]);

  // iOS-only SLC fallback (fires roughly on every cell tower change).
  if (Platform.OS === "ios") {
    try {
      // expo-location doesn't expose SLC directly, but startLocationUpdatesAsync
      // with distanceInterval of ~500m gets very close to the same behavior.
      // Only start once — guarded by task-manager.
      const started = await Location.hasStartedLocationUpdatesAsync("gfattend.slc");
      if (!started) {
        await Location.startLocationUpdatesAsync("gfattend.slc", {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 500,
          deferredUpdatesInterval: 60_000,
          showsBackgroundLocationIndicator: false,
          pausesUpdatesAutomatically: true,
        });
      }
    } catch { /* non-fatal */ }
  }
}

/** Stop all geofencing — called on sign-out or when the user has no office. */
export async function stopGeofencing(): Promise<void> {
  try {
    if (await isGeofencingActive()) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  } catch { /* ignore */ }
  try {
    const slcStarted = await Location.hasStartedLocationUpdatesAsync("gfattend.slc");
    if (slcStarted) await Location.stopLocationUpdatesAsync("gfattend.slc");
  } catch { /* ignore */ }
}

/**
 * Full sync of the assigned office. Called from AuthContext after login,
 * from cold-start reconciliation, and on app foreground. Idempotent.
 */
export async function syncOfficeGeofence(): Promise<Office | null> {
  try {
    const rec = await mobile.reconcile();
    const office = rec.office;
    if (!office) {
      await stopGeofencing();
      return null;
    }
    await registerOfficeGeofence({
      id: office.id, lat: office.lat, lng: office.lng,
      radius_meters: office.radius_meters, name: office.name,
    });
    return { id: office.id, lat: office.lat, lng: office.lng,
             radius_meters: office.radius_meters, name: office.name };
  } catch (e) {
    console.warn("[geofence] sync failed:", e);
    return null;
  }
}
