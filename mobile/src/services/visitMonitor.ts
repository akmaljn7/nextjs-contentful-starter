/**
 * CLVisit watcher (iOS only) — the "arrival/departure" resurrection layer.
 *
 * Complements the SLC task: where SLC wakes roughly on cell-tower changes,
 * CLVisit wakes a force-quit app when the employee actually SETTLES AT or
 * LEAVES a place (dwell-based). Both funnel through the SAME
 * `backgroundResurrect()` path in geofence.ts, so a wake from either source
 * re-arms geofences, records the fix, and drains the offline queues. The
 * backend's `last_live_ts_ms` watermark makes overlapping SLC + visit wakes
 * idempotent — they can never double-count.
 */
import { Platform } from "react-native";

import {
  addVisitListener, startVisitMonitoring, stopVisitMonitoring,
  getLastVisit, clearLastVisit, VisitEvent, VisitSubscription,
} from "../../modules/clvisit-monitor";
import { backgroundResurrect } from "@/services/geofence";

let sub: VisitSubscription | null = null;

async function processVisit(v: VisitEvent): Promise<void> {
  const ts = v.is_arrival ? (v.arrival_ms || Date.now()) : (v.departure_ms || Date.now());
  await backgroundResurrect([{
    lat: v.latitude,
    lng: v.longitude,
    accuracy: v.accuracy > 0 ? v.accuracy : 150,
    ts_ms: Math.round(ts),
  }]);
}

/** Start (or re-arm) visit monitoring. Idempotent; no-op off iOS. */
export function startVisitWatcher(): void {
  if (Platform.OS !== "ios") return;
  if (!sub) {
    sub = addVisitListener((v) => { processVisit(v).catch(() => undefined); });
  }
  startVisitMonitoring();
  // Drain any visit delivered natively before JS was ready (cold bg launch).
  const last = getLastVisit();
  if (last) {
    clearLastVisit();
    processVisit(last).catch(() => undefined);
  }
}

/** Stop visit monitoring + remove the JS listener. No-op off iOS. */
export function stopVisitWatcher(): void {
  if (Platform.OS !== "ios") return;
  stopVisitMonitoring();
  if (sub) { sub.remove(); sub = null; }
}
