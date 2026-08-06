/**
 * SQLite-backed offline event queue.
 *
 * When the app is offline (or a background task can't reach the network),
 * geofence events are stored here with a client_event_id so they can be
 * safely replayed when connectivity returns without creating duplicates
 * on the server.
 *
 * Table: mobile_events
 *   id           INTEGER PK AUTOINCREMENT
 *   client_event_id TEXT UNIQUE  — matches server-side dedup key
 *   type         TEXT NOT NULL   — 'enter' | 'exit' | 'cold_start_reconcile'
 *   ts_ms        INTEGER NOT NULL
 *   office_id    TEXT NOT NULL
 *   lat          REAL NOT NULL
 *   lng          REAL NOT NULL
 *   accuracy     REAL NOT NULL
 *   mock_location INTEGER NOT NULL DEFAULT 0
 *   from_boot    INTEGER NOT NULL DEFAULT 0
 *   battery      REAL
 *   device_id    TEXT NOT NULL
 *   synced_at    INTEGER          — null if not yet synced
 *   sync_error   TEXT             — last sync error message
 *   attempts     INTEGER NOT NULL DEFAULT 0
 *   created_at   INTEGER NOT NULL
 */
import * as SQLite from "expo-sqlite";

const DB_NAME = "gfattend.db";

let _db: SQLite.SQLiteDatabase | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mobile_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_event_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      ts_ms INTEGER NOT NULL,
      office_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL NOT NULL,
      mock_location INTEGER NOT NULL DEFAULT 0,
      from_boot INTEGER NOT NULL DEFAULT 0,
      battery REAL,
      device_id TEXT NOT NULL,
      synced_at INTEGER,
      sync_error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_unsynced
      ON mobile_events (synced_at, created_at);
  `);
  return _db;
}

export interface QueuedEvent {
  id?: number;
  client_event_id: string;
  type: "enter" | "exit" | "cold_start_reconcile";
  ts_ms: number;
  office_id: string;
  lat: number;
  lng: number;
  accuracy: number;
  mock_location?: boolean;
  from_boot?: boolean;
  battery?: number | null;
  device_id: string;
}

export async function enqueue(event: QueuedEvent): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR IGNORE INTO mobile_events
     (client_event_id, type, ts_ms, office_id, lat, lng, accuracy, mock_location,
      from_boot, battery, device_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.client_event_id, event.type, event.ts_ms, event.office_id,
      event.lat, event.lng, event.accuracy,
      event.mock_location ? 1 : 0, event.from_boot ? 1 : 0,
      event.battery ?? null, event.device_id, Date.now(),
    ],
  );
}

export async function pendingEvents(limit = 100): Promise<QueuedEvent[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>(
    `SELECT * FROM mobile_events WHERE synced_at IS NULL
     ORDER BY ts_ms ASC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    client_event_id: r.client_event_id,
    type: r.type,
    ts_ms: r.ts_ms,
    office_id: r.office_id,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
    mock_location: !!r.mock_location,
    from_boot: !!r.from_boot,
    battery: r.battery ?? undefined,
    device_id: r.device_id,
  }));
}

export async function markSynced(clientEventIds: string[]): Promise<void> {
  if (!clientEventIds.length) return;
  const d = await db();
  const now = Date.now();
  const placeholders = clientEventIds.map(() => "?").join(",");
  await d.runAsync(
    `UPDATE mobile_events SET synced_at = ?, sync_error = NULL
     WHERE client_event_id IN (${placeholders})`,
    [now, ...clientEventIds],
  );
}

export async function markFailed(clientEventIds: string[], errMsg: string): Promise<void> {
  if (!clientEventIds.length) return;
  const d = await db();
  const placeholders = clientEventIds.map(() => "?").join(",");
  await d.runAsync(
    `UPDATE mobile_events SET attempts = attempts + 1, sync_error = ?
     WHERE client_event_id IN (${placeholders})`,
    [errMsg.slice(0, 250), ...clientEventIds],
  );
}

/** Delete synced events older than 7 days to keep the DB small. */
export async function purgeOldSynced(): Promise<number> {
  const d = await db();
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const res = await d.runAsync(
    `DELETE FROM mobile_events WHERE synced_at IS NOT NULL AND synced_at < ?`,
    [cutoff],
  );
  return res.changes ?? 0;
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM mobile_events WHERE synced_at IS NULL`,
  );
  return row?.n ?? 0;
}
