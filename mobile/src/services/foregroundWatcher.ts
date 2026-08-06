/**
 * Foreground location watcher — instant detection while the app is open.
 *
 * Native geofences (Location.startGeofencingAsync) are the source of truth
 * when the app is background/killed, but:
 *   - On Android they can lag 30-90s after crossing the boundary
 *   - On some OEMs they don't fire at all until the app backgrounds
 *   - They require ACCESS_BACKGROUND_LOCATION which some users decline
 *
 * This watcher runs a continuous `Location.watchPositionAsync` while the
 * employee screen is foreground and enqueues enter/exit events the moment
 * the user crosses the office radius. Native geofences remain armed for the
 * background/killed case. Deduplication happens server-side via the
 * `mobile_events` unique index on (user_id, client_event_id).
 */
import * as Location from "expo-location";

import { enqueueAndSync } from "@/services/syncWorker";
import { getDeviceId } from "@/lib/storage";
import { mobile } from "@/api/mobile";

interface Office {
  id: string;
  lat: number;
  lng: number;
  radius_meters: number;
  name?: string;
}

let subscription: Location.LocationSubscription | null = null;
let currentOffice: Office | null = null;
let lastInsideState: boolean | null = null; // null = unknown, true = inside, false = outside
let lastEventTs = 0;

// Debounce: don't fire two events for the same crossing within 30 s
const CROSS_DEBOUNCE_MS = 30_000;
// Add a small hysteresis band so a GPS blip doesn't flap enter/exit
const HYSTERESIS_M = 15;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function handleFix(loc: Location.LocationObject) {
  if (!currentOffice) return;
  const dist = haversineMeters(
    loc.coords.latitude, loc.coords.longitude,
    currentOffice.lat, currentOffice.lng,
  );
  // Hysteresis: entering must be firmly inside; exiting must be firmly outside
  let nextInside: boolean;
  if (dist <= currentOffice.radius_meters - HYSTERESIS_M) {
    nextInside = true;
  } else if (dist >= currentOffice.radius_meters + HYSTERESIS_M) {
    nextInside = false;
  } else {
    return; // in the fuzzy band — keep last state, don't fire
  }
  if (lastInsideState === null) {
    // First fix — just record baseline, DO NOT fire an event. Cold-start
    // reconcile handles the "inside on startup" case via a separate path.
    lastInsideState = nextInside;
    return;
  }
  if (nextInside === lastInsideState) return;
  const now = Date.now();
  if (now - lastEventTs < CROSS_DEBOUNCE_MS) return;
  lastInsideState = nextInside;
  lastEventTs = now;

  const deviceId = await getDeviceId();
  const clientEventId = `fg-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const type = nextInside ? "enter" : "exit";
  console.info("[fgWatcher] boundary cross:", type, "dist=", Math.round(dist));
  await enqueueAndSync({
    client_event_id: clientEventId,
    type,
    ts_ms: now,
    office_id: currentOffice.id,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? 50,
    mock_location: (loc as any).mocked === true,
    from_boot: false,
    device_id: deviceId,
  });
}

/**
 * Start the foreground watcher. Idempotent — safe to call on every screen
 * mount. Only requires foreground location permission (works even when the
 * user hasn't granted "Always").
 */
export async function startForegroundWatcher(): Promise<boolean> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      console.info("[fgWatcher] not starting — no foreground permission");
      return false;
    }
    // Fetch the current office from server; if unknown, do nothing.
    let office: Office | null = null;
    try {
      const rec = await mobile.reconcile();
      if (rec.office) office = {
        id: rec.office.id, lat: rec.office.lat, lng: rec.office.lng,
        radius_meters: rec.office.radius_meters, name: rec.office.name,
      };
    } catch { /* offline — will retry on next foreground */ }
    if (!office) {
      console.info("[fgWatcher] not starting — no office assigned yet");
      return false;
    }
    currentOffice = office;
    // If already running, restart with the new office
    if (subscription) { subscription.remove(); subscription = null; }
    lastInsideState = null;

    subscription = await Location.watchPositionAsync(
      {
        // Balanced accuracy = "cellular + Wi-Fi + occasional GPS", low battery cost.
        // Good enough for a 50-500m geofence radius.
        accuracy: Location.Accuracy.Balanced,
        // Fire on every 20 m OR every 15 s, whichever comes first
        distanceInterval: 20,
        timeInterval: 15_000,
      },
      (loc) => { handleFix(loc).catch((e) => console.warn("[fgWatcher] fix error:", e)); },
    );
    console.info("[fgWatcher] started — office=", office.name, "r=", office.radius_meters);
    return true;
  } catch (e) {
    console.warn("[fgWatcher] start failed:", e);
    return false;
  }
}

/** Stop the watcher. Called on screen unmount / sign-out. */
export function stopForegroundWatcher(): void {
  if (subscription) { subscription.remove(); subscription = null; }
  currentOffice = null;
  lastInsideState = null;
  lastEventTs = 0;
}

export function isForegroundWatcherActive(): boolean {
  return subscription !== null;
}
