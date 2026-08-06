/**
 * Cold-start reconciliation.
 *
 * Fires on every app open (via AuthContext bootstrap) to heal any state
 * drift between the device and the server:
 *
 *  1. Fetch server state (reconcile endpoint) — has the user got an active
 *     session? Where is their assigned office?
 *  2. Take one fresh GPS fix.
 *  3. Am I currently INSIDE my office geofence but the server thinks I have
 *     no active session? → synthesize a "cold_start_reconcile" enter event
 *     and enqueue it. This heals the Android-reboot-at-office case where
 *     the OS never fired an enter transition because we were already inside.
 *  4. Am I OUTSIDE the geofence but the server thinks I'm active? → this is
 *     benign; ping will pause naturally, no synthetic event needed.
 *  5. Refresh the geofence registration itself (admin may have moved the
 *     office or changed the radius).
 */
import * as Location from "expo-location";

import { mobile } from "@/api/mobile";
import { getDeviceId } from "@/lib/storage";
import { registerOfficeGeofence, stopGeofencing } from "@/services/geofence";
import { enqueueAndSync } from "@/services/syncWorker";
import { drainQueue } from "@/services/syncWorker";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface ReconcileResult {
  office: any | null;
  session: any | null;
  synthesized: "enter" | null;
}

export async function coldStartReconcile(): Promise<ReconcileResult> {
  // 0. Best-effort drain of any pending offline events first
  await drainQueue().catch(() => undefined);

  // 1. Server state
  let rec: any;
  try {
    rec = await mobile.reconcile();
  } catch {
    return { office: null, session: null, synthesized: null };
  }
  const office = rec.office;
  const session = rec.session;

  // 2. Sync geofence registration to reflect any admin edits
  if (office) {
    await registerOfficeGeofence(office);
  } else {
    await stopGeofencing();
    return { office: null, session, synthesized: null };
  }

  // 3. Foreground GPS fix — only attempt if we already have foreground permission
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== "granted") return { office, session, synthesized: null };
  let loc: Location.LocationObject | null = null;
  try {
    loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch { /* GPS unavailable */ }
  if (!loc) return { office, session, synthesized: null };

  const dist = haversineMeters(
    loc.coords.latitude, loc.coords.longitude, office.lat, office.lng,
  );
  const inside = dist <= office.radius_meters;

  // 4. Heal: inside geofence but no active session → synthetic enter
  if (inside && !session) {
    const clientEventId = `cs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await enqueueAndSync({
      client_event_id: clientEventId,
      type: "cold_start_reconcile",
      ts_ms: Date.now(),
      office_id: office.id,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 50,
      mock_location: (loc as any).mocked === true,
      from_boot: true,
      device_id: await getDeviceId(),
    });
    return { office, session, synthesized: "enter" };
  }

  return { office, session, synthesized: null };
}
