/**
 * Wake diagnostics — best-effort telemetry of what background trigger woke the
 * app in the field (geofence / ring / SLC / visit / boot / rearm). Admins see a
 * per-employee breakdown on the console. Never throws, never blocks the caller;
 * silently drops when offline (diagnostics are not queued).
 */
import { getDeviceId } from "@/lib/storage";
import { mobile, WakeSource } from "@/api/mobile";

export async function logWake(
  source: WakeSource,
  coords?: { lat?: number; lng?: number },
): Promise<void> {
  try {
    const device_id = await getDeviceId();
    await mobile.logWake({
      source,
      device_id,
      ts_ms: Date.now(),
      lat: coords?.lat,
      lng: coords?.lng,
    });
  } catch {
    /* best-effort — ignore */
  }
}
