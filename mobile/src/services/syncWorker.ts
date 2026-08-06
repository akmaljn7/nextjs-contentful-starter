/**
 * Sync worker — drains the offline queue to the server.
 *
 * Runs opportunistically:
 *   - immediately after enqueue when the app has network
 *   - on app foreground (RootNavigator effect)
 *   - after cold-start reconciliation
 *   - after Network state flips online
 *
 * Uses the bulk /api/mobile/sync endpoint so a hundred queued events cost
 * one round-trip. Server-side idempotency (client_event_id unique index)
 * means retries are safe.
 */
import { mobile, MobileEventPayload } from "@/api/mobile";
import { apiError } from "@/api/client";
import * as queue from "@/services/offlineQueue";

let running = false;

export interface SyncResult {
  attempted: number;
  synced: number;
  failed: number;
  duplicates: number;
  error?: string;
}

export async function drainQueue(): Promise<SyncResult> {
  if (running) return { attempted: 0, synced: 0, failed: 0, duplicates: 0 };
  running = true;
  try {
    const pending = await queue.pendingEvents(100);
    if (!pending.length) {
      return { attempted: 0, synced: 0, failed: 0, duplicates: 0 };
    }
    const events: MobileEventPayload[] = pending.map((e) => ({
      client_event_id: e.client_event_id,
      device_id: e.device_id,
      type: e.type,
      ts_ms: e.ts_ms,
      office_id: e.office_id,
      lat: e.lat,
      lng: e.lng,
      accuracy: e.accuracy,
      mock_location: e.mock_location,
      from_boot: e.from_boot,
      battery: e.battery ?? undefined,
    }));
    try {
      const res = await mobile.bulkSync(events);
      const processed: Array<{ client_event_id: string; duplicate: boolean; outcome: string }> = res.processed || [];
      // Every returned event is now server-known — mark synced locally.
      const ids = processed.map((p) => p.client_event_id);
      await queue.markSynced(ids);
      const dupes = processed.filter((p) => p.duplicate).length;
      return { attempted: pending.length, synced: ids.length, failed: 0, duplicates: dupes };
    } catch (e) {
      const msg = apiError(e);
      await queue.markFailed(pending.map((p) => p.client_event_id), msg);
      return { attempted: pending.length, synced: 0, failed: pending.length, duplicates: 0, error: msg };
    }
  } finally {
    running = false;
  }
}

/** Convenience: enqueue an event and try to sync it immediately. */
export async function enqueueAndSync(event: queue.QueuedEvent): Promise<SyncResult> {
  await queue.enqueue(event);
  return drainQueue();
}
