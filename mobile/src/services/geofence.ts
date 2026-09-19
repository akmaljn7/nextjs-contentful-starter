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
import * as Battery from "expo-battery";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { enqueueAndSync, drainQueue } from "@/services/syncWorker";
import { drainLocationQueue } from "@/services/liveLocation";
import { enqueueLocationFix } from "@/services/offlineQueue";
import { getDeviceId } from "@/lib/storage";
import { mobile, WakeSource } from "@/api/mobile";
import { logWake } from "@/services/wakeLog";

export const GEOFENCE_TASK = "gfattend.geofence";
// Suffix marking the outer "approach ring" region (wake-only, not attendance).
export const RING_SUFFIX = "::ring";
// The ring is a concentric geofence this many times the office radius (capped),
// so the app wakes / re-arms as the employee nears the office, earlier than the
// precise core boundary or an SLC tower change would fire.
const RING_MULTIPLIER = 3;
const RING_MAX_RADIUS_M = 2000;
// iOS Resurrection Layer — Significant Location Change. Registered as a
// location-updates task (see registerOfficeGeofence). Wakes the app roughly on
// every cell-tower change, even after the user force-quits it.
export const SLC_TASK = "gfattend.slc";

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

  // Outer approach-ring crossings are WAKE-ONLY — they must NOT be recorded as
  // an attendance enter/exit (that would check the employee in before they
  // reach the office). We use the ring purely to resurrect earlier than SLC:
  // re-arm geofences, capture a fresh fix, drain the queues.
  if (region.identifier && region.identifier.endsWith(RING_SUFFIX)) {
    let fix: ResurrectFix | null = null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      fix = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? 100,
        ts_ms: Date.now(),
        mock: (loc as any).mocked === true,
      };
    } catch { /* no fix — still worth re-arming */ }
    await backgroundResurrect(fix ? [fix] : [], "geofence_ring");
    return;
  }

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

  logWake("geofence", { lat, lng }).catch(() => undefined);

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
        title: kind === "enter" ? "✅ Attendance started" : "⏸ Attendance paused",
        body: kind === "enter" ? "Welcome to the office." : "See you next time.",
        sound: "default",
      },
      trigger: null,
    });
  }
});

// -----------------------------------------------------------------------------
// iOS Resurrection Layer — shared background wake handler (SLC + CLVisit)
// -----------------------------------------------------------------------------

export interface ResurrectFix {
  lat: number;
  lng: number;
  accuracy: number;
  ts_ms: number;
  speed?: number;
  mock?: boolean;
}

/**
 * Shared background wake handler used by BOTH the iOS SLC task and the CLVisit
 * monitor (services/visitMonitor.ts). The Precision Layer (geofences above)
 * can be torn down when the user force-quits the app, so on any background
 * resurrection we:
 *   1. re-arm the geofences,
 *   2. persist each supplied fix to the offline-durable queue,
 *   3. drain both queues so the server session state machine advances.
 *
 * Idempotent server-side (the session `last_live_ts_ms` watermark rejects
 * replays), so overlapping SLC + visit wakes can never double-count time.
 * Executes in a stripped-down background JS context — keep it minimal and
 * failure-tolerant.
 */
export async function backgroundResurrect(fixes: ResurrectFix[], source: WakeSource = "slc"): Promise<void> {
  // Record what woke us (best-effort field telemetry).
  logWake(source, fixes[0] ? { lat: fixes[0].lat, lng: fixes[0].lng } : undefined)
    .catch(() => undefined);

  // 1) Re-arm geofences that a force-quit may have torn down.
  await syncOfficeGeofence().catch(() => undefined);

  // 2) Treat each fix as a real location update (offline-durable enqueue).
  if (fixes.length) {
    const deviceId = await getDeviceId();
    let battery: number | undefined;
    try {
      const lvl = await Battery.getBatteryLevelAsync();
      battery = lvl >= 0 ? lvl : undefined;
    } catch {
      battery = undefined;
    }
    for (const f of fixes) {
      try {
        await enqueueLocationFix({
          device_id: deviceId,
          lat: f.lat,
          lng: f.lng,
          accuracy: f.accuracy,
          ts_ms: f.ts_ms,
          speed: f.speed,
          battery,
          mock_location: f.mock === true,
        });
      } catch (e) {
        console.warn("[resurrect] enqueue fix failed:", e);
      }
    }
  }

  // 3) Drain both queues — location fixes drive the session state machine
  //    server-side; the event queue flushes any buffered enter/exit crossings.
  await drainLocationQueue().catch(() => undefined);
  await drainQueue().catch(() => undefined);
}

/**
 * Significant-Location-Change task. iOS wakes this (even after a force-quit)
 * roughly on every cell-tower change. Thin wrapper over backgroundResurrect.
 */
TaskManager.defineTask(SLC_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[slc] task error:", error);
    return;
  }
  const { locations } = (data as { locations?: Location.LocationObject[] }) || {};
  await backgroundResurrect(
    (locations || []).map((loc) => ({
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 50,
      ts_ms: Math.round(loc.timestamp || Date.now()),
      speed: loc.coords.speed ?? undefined,
      mock: (loc as any).mocked === true,
    })),
    "slc",
  );
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
  const core: Location.LocationRegion = {
    identifier: office.id,
    latitude: office.lat,
    longitude: office.lng,
    radius: Math.max(50, office.radius_meters), // iOS ignores < 50 m
    notifyOnEnter: true,
    notifyOnExit: true,
  };
  // Outer "approach ring" — a larger concentric geofence that wakes / re-arms
  // the app as the employee nears the office, earlier than the precise core
  // boundary. Wake-only (see GEOFENCE_TASK ring branch).
  const ringRadius = Math.min(
    RING_MAX_RADIUS_M,
    Math.max(150, office.radius_meters * RING_MULTIPLIER),
  );
  const ring: Location.LocationRegion = {
    identifier: `${office.id}${RING_SUFFIX}`,
    latitude: office.lat,
    longitude: office.lng,
    radius: ringRadius,
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
  await Location.startGeofencingAsync(GEOFENCE_TASK, [core, ring]);

  // iOS-only SLC fallback (fires roughly on every cell tower change).
  if (Platform.OS === "ios") {
    try {
      // expo-location doesn't expose SLC directly, but startLocationUpdatesAsync
      // with distanceInterval of ~500m gets very close to the same behavior.
      // Only start once — guarded by task-manager.
      const started = await Location.hasStartedLocationUpdatesAsync(SLC_TASK);
      if (!started) {
        await Location.startLocationUpdatesAsync(SLC_TASK, {
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
    const slcStarted = await Location.hasStartedLocationUpdatesAsync(SLC_TASK);
    if (slcStarted) await Location.stopLocationUpdatesAsync(SLC_TASK);
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
